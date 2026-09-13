import type { AvatarCondicao, Evento, Notificacao, Profile } from '@/lib/types'
import { createClient } from './server'

export interface EventoNaAgenda {
  id: string
  titulo: string
  descricao: string | null
  dataInicio: string
  dataFim: string | null
  paraTodos: boolean
  condicoes: AvatarCondicao[]
  /** `null` quando o aluno ainda não respondeu. */
  confirmado: boolean | null
  totalConfirmados: number
}

export interface AgendaAlunoData {
  proximos: EventoNaAgenda[]
  passados: EventoNaAgenda[]
  notificacoes: Notificacao[]
}

/**
 * Um evento é do aluno quando é para todos ou quando alguma condição dele
 * bate com a lista do evento — a policy do banco libera a leitura de todos,
 * então o filtro por avatar acontece aqui.
 */
function ehParaOAluno(
  evento: { para_todos: boolean; avatar_condicao: string[] | null },
  condicoes: AvatarCondicao[]
) {
  if (evento.para_todos) return true
  if (!evento.avatar_condicao?.length) return true
  return evento.avatar_condicao.some((c) =>
    condicoes.includes(c as AvatarCondicao)
  )
}

export async function getAgendaAluno(
  perfil: Profile
): Promise<AgendaAlunoData> {
  const supabase = await createClient()

  const agora = new Date().toISOString()
  const condicoes = perfil.avatar_condicao ?? []

  const [{ data: eventos }, { data: confirmacoes }, { data: notificacoes }] =
    await Promise.all([
      supabase
        .from('eventos')
        .select('*, evento_confirmacoes(aluno_id, confirmado)')
        .order('data_inicio', { ascending: true }),
      supabase
        .from('evento_confirmacoes')
        .select('evento_id, confirmado')
        .eq('aluno_id', perfil.id),
      supabase
        .from('notificacoes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20),
    ])

  type Row = Evento & {
    avatar_condicao: string[] | null
    evento_confirmacoes: { aluno_id: string; confirmado: boolean }[] | null
  }

  const minhaResposta = new Map(
    (confirmacoes ?? []).map((c) => [c.evento_id, c.confirmado])
  )

  const mapeados: EventoNaAgenda[] = ((eventos ?? []) as Row[])
    .filter((e) => ehParaOAluno(e, condicoes))
    .map((e) => ({
      id: e.id,
      titulo: e.titulo,
      descricao: e.descricao ?? null,
      dataInicio: e.data_inicio,
      dataFim: e.data_fim ?? null,
      paraTodos: e.para_todos,
      condicoes: (e.avatar_condicao ?? []) as AvatarCondicao[],
      confirmado: minhaResposta.get(e.id) ?? null,
      totalConfirmados: (e.evento_confirmacoes ?? []).filter(
        (c) => c.confirmado
      ).length,
    }))

  return {
    proximos: mapeados.filter((e) => (e.dataFim ?? e.dataInicio) >= agora),
    passados: mapeados
      .filter((e) => (e.dataFim ?? e.dataInicio) < agora)
      .reverse()
      .slice(0, 10),
    notificacoes: (notificacoes ?? []) as Notificacao[],
  }
}

export async function getAgendaProfessor(
  professorId: string
): Promise<EventoNaAgenda[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('eventos')
    .select('*, evento_confirmacoes(aluno_id, confirmado)')
    .eq('professor_id', professorId)
    .order('data_inicio', { ascending: false })

  type Row = Evento & {
    avatar_condicao: string[] | null
    evento_confirmacoes: { aluno_id: string; confirmado: boolean }[] | null
  }

  return ((data ?? []) as Row[]).map((e) => ({
    id: e.id,
    titulo: e.titulo,
    descricao: e.descricao ?? null,
    dataInicio: e.data_inicio,
    dataFim: e.data_fim ?? null,
    paraTodos: e.para_todos,
    condicoes: (e.avatar_condicao ?? []) as AvatarCondicao[],
    confirmado: null,
    totalConfirmados: (e.evento_confirmacoes ?? []).filter((c) => c.confirmado)
      .length,
  }))
}
