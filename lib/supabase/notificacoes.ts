import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import type { AlertaTipo, AvatarCondicao, Profile } from '@/lib/types'
import { hojeISO, naAcademia, somarDiasISO } from '@/lib/utils/datas'
import { getMedicamentosAluno } from './medicamentos'
import { createClient } from './server'

export type TipoNotificacao =
  | 'comunicado'
  | 'medicamento'
  | 'evento'
  | 'mensagem'
  | 'indicador'
  | 'humor'
  | 'frequencia'

/** Uma linha do sininho — já pronta para exibir, sem consulta no cliente. */
export interface ItemNotificacao {
  id: string
  tipo: TipoNotificacao
  titulo: string
  texto: string
  href: string
  /** ISO. É o que decide a ordem e o que conta como "não visto". */
  criadoEm: string
  urgente: boolean
}

const DIA_MS = 24 * 60 * 60 * 1000

/*
  A academia fica em São Paulo, que não tem horário de verão desde 2019 —
  então "08:00 de hoje na academia" é sempre -03:00. Serve só para dar um
  instante à dose atrasada; o "hoje" continua vindo de `datas.ts`.
*/
function instanteNaAcademia(dataISO: string, horario: string) {
  return new Date(`${dataISO}T${horario}:00-03:00`).toISOString()
}

function ordenar(itens: ItemNotificacao[]) {
  return itens.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
}

function valeParaOAluno(
  item: { para_todos: boolean | null; avatar_condicao: string[] | null },
  condicoes: AvatarCondicao[]
) {
  if (item.para_todos !== false) return true
  if (!item.avatar_condicao?.length) return true
  return item.avatar_condicao.some((c) => condicoes.includes(c as AvatarCondicao))
}

function resumir(texto: string | null, audio: string | null) {
  if (texto?.trim()) return texto.trim()
  return audio ? 'Mensagem de áudio' : 'Nova mensagem'
}

/**
 * Mensagens não lidas agrupadas por remetente: uma linha por conversa, com a
 * mais recente como texto — dez mensagens do mesmo aluno não viram dez itens.
 */
async function mensagensNaoLidas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  usuarioId: string
): Promise<ItemNotificacao[]> {
  const { data } = await supabase
    .from('mensagens')
    .select('id, de, texto, audio_url, created_at')
    .eq('para', usuarioId)
    .eq('lida', false)
    .order('created_at', { ascending: false })
    .limit(60)

  const porRemetente = new Map<
    string,
    { id: string; texto: string; criadoEm: string; total: number }
  >()
  for (const m of data ?? []) {
    if (!m.de) continue
    const atual = porRemetente.get(m.de)
    if (atual) {
      atual.total += 1
    } else {
      porRemetente.set(m.de, {
        id: m.id,
        texto: resumir(m.texto, m.audio_url),
        criadoEm: m.created_at,
        total: 1,
      })
    }
  }

  if (porRemetente.size === 0) return []

  const { data: remetentes } = await supabase
    .from('profiles')
    .select('id, nome')
    .in('id', Array.from(porRemetente.keys()))

  const nomes = new Map((remetentes ?? []).map((p) => [p.id, p.nome as string]))

  return Array.from(porRemetente.entries()).map(([de, m]) => {
    const nome = nomes.get(de)?.split(' ')[0]
    return {
      id: `mensagem:${m.id}`,
      tipo: 'mensagem' as const,
      titulo: nome
        ? m.total > 1
          ? `${m.total} mensagens de ${nome}`
          : `Mensagem de ${nome}`
        : 'Nova mensagem',
      texto: m.texto,
      href: `/chat/${de}`,
      criadoEm: m.criadoEm,
      urgente: false,
    }
  })
}

export async function getNotificacoesAluno(
  perfil: Profile
): Promise<ItemNotificacao[]> {
  const supabase = await createClient()

  const agora = new Date()
  const condicoes = perfil.avatar_condicao ?? []
  const limiteComunicados = new Date(agora.getTime() - 30 * DIA_MS).toISOString()
  const limiteEventos = new Date(agora.getTime() + 2 * DIA_MS).toISOString()

  const [{ data: comunicados }, { data: eventos }, medicamentos, mensagens] =
    await Promise.all([
      supabase
        .from('notificacoes')
        .select('id, titulo, corpo, para_todos, avatar_condicao, created_at')
        .gte('created_at', limiteComunicados)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('eventos')
        .select('id, titulo, data_inicio, para_todos, avatar_condicao')
        .gte('data_inicio', agora.toISOString())
        .lte('data_inicio', limiteEventos)
        .order('data_inicio', { ascending: true })
        .limit(10),
      getMedicamentosAluno(perfil.id),
      mensagensNaoLidas(supabase, perfil.id),
    ])

  const itens: ItemNotificacao[] = [...mensagens]

  for (const c of comunicados ?? []) {
    if (!valeParaOAluno(c, condicoes)) continue
    itens.push({
      id: `comunicado:${c.id}`,
      tipo: 'comunicado',
      titulo: c.titulo,
      texto: c.corpo,
      href: '/agenda',
      criadoEm: c.created_at,
      urgente: false,
    })
  }

  /*
    Uma linha só para as doses atrasadas. O instante é o da dose mais recente:
    quando mais uma vence, o item "renasce" como não visto.
  */
  const atrasadas = medicamentos.doses.filter((d) => d.situacao === 'atrasada')
  if (atrasadas.length > 0) {
    const ultima = atrasadas[atrasadas.length - 1]
    const nomeDose = `${ultima.nome}${ultima.dose ? ` (${ultima.dose})` : ''}`
    itens.push({
      id: `medicamento:${medicamentos.hoje}:${atrasadas.map((d) => `${d.medicamentoId}-${d.horario}`).join(',')}`,
      tipo: 'medicamento',
      titulo:
        atrasadas.length > 1
          ? `${atrasadas.length} doses de medicamento atrasadas`
          : 'Medicamento atrasado',
      texto:
        atrasadas.length > 1
          ? `${nomeDose} das ${ultima.horario} e mais ${atrasadas.length - 1} esperando confirmação.`
          : `${nomeDose} das ${ultima.horario} ainda não foi confirmado.`,
      href: '/medicamentos',
      criadoEm: instanteNaAcademia(medicamentos.hoje, ultima.horario),
      urgente: true,
    })
  }

  const hoje = hojeISO(agora)
  const amanha = somarDiasISO(hoje, 1)
  for (const e of eventos ?? []) {
    if (!valeParaOAluno(e, condicoes)) continue

    const dia = hojeISO(new Date(e.data_inicio))
    const hora = format(naAcademia(e.data_inicio), 'HH:mm')
    const quando =
      dia === hoje
        ? `Hoje às ${hora}`
        : dia === amanha
          ? `Amanhã às ${hora}`
          : format(naAcademia(e.data_inicio), "EEEE 'às' HH:mm", { locale: ptBR })

    // O lembrete "nasce" quando o evento entra na janela de 48 h.
    const entrouNaJanela = new Date(new Date(e.data_inicio).getTime() - 2 * DIA_MS)

    itens.push({
      id: `evento:${e.id}`,
      tipo: 'evento',
      titulo: e.titulo,
      texto: quando.charAt(0).toUpperCase() + quando.slice(1),
      href: '/agenda',
      criadoEm: (entrouNaJanela < agora ? entrouNaJanela : agora).toISOString(),
      urgente: false,
    })
  }

  return ordenar(itens)
}

const TIPO_ALERTA: Record<AlertaTipo, TipoNotificacao> = {
  indicador_vermelho: 'indicador',
  humor_ruim: 'humor',
  medicamento_nao_tomado: 'medicamento',
  sem_treinar: 'frequencia',
}

const ROTULO_ALERTA: Record<AlertaTipo, string> = {
  indicador_vermelho: 'indicador crítico',
  humor_ruim: 'humor',
  medicamento_nao_tomado: 'medicamento',
  sem_treinar: 'frequência',
}

export async function getNotificacoesProfessor(
  perfil: Profile
): Promise<ItemNotificacao[]> {
  const supabase = await createClient()

  const [{ data: alertas }, mensagens] = await Promise.all([
    supabase
      .from('alertas_professor')
      .select(
        'id, aluno_id, tipo, mensagem, created_at, aluno:profiles!alertas_professor_aluno_id_fkey(nome)'
      )
      .eq('professor_id', perfil.id)
      .eq('resolvido', false)
      .order('created_at', { ascending: false })
      .limit(30),
    mensagensNaoLidas(supabase, perfil.id),
  ])

  type Row = {
    id: string
    aluno_id: string
    tipo: AlertaTipo
    mensagem: string
    created_at: string
    aluno: { nome: string } | { nome: string }[] | null
  }

  const itens: ItemNotificacao[] = [...mensagens]

  for (const a of (alertas ?? []) as Row[]) {
    const aluno = Array.isArray(a.aluno) ? a.aluno[0] : a.aluno
    const rotulo = ROTULO_ALERTA[a.tipo] ?? 'alerta'
    itens.push({
      id: `alerta:${a.id}`,
      tipo: TIPO_ALERTA[a.tipo] ?? 'indicador',
      titulo: aluno?.nome ? `${aluno.nome} · ${rotulo}` : `Alerta de ${rotulo}`,
      texto: a.mensagem,
      href: `/alunos/${a.aluno_id}`,
      criadoEm: a.created_at,
      urgente: a.tipo === 'indicador_vermelho',
    })
  }

  return ordenar(itens)
}
