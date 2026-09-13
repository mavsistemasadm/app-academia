import type { Indicador } from '@/lib/types'
import { hojeISO, somarDiasISO } from '@/lib/utils/datas'
import { createClient } from './server'

/**
 * As conquistas celebram saúde, não estética — nada de "perdeu 5 kg". As
 * regras rodam sobre os dados que já existem; a tabela `aluno_conquistas`
 * só guarda *quando* cada uma caiu, para dar para comemorar a novidade.
 */
export interface Conquista {
  chave: string
  titulo: string
  descricao: string
  emoji: string
  conquistada: boolean
  /** 0 a 100 — o quanto falta para quem ainda não conseguiu. */
  progresso: number
  /** Texto do progresso: "12 de 30 dias". */
  detalhe: string
  /** Só para as já conquistadas e ainda não vistas pelo aluno. */
  nova: boolean
}

interface Materia {
  diasComTreino: Set<string>
  sequenciaPresenca: number
  totalTreinos: number
  diasComHumor: number
  diasIndicadorVerde: number
  totalIndicadores: number
  adesaoRemedio: number
  diasNaMetaDeAgua: number
  primeiroRegistro: boolean
}

function regras(m: Materia) {
  return [
    {
      chave: 'primeiro_passo',
      titulo: 'Primeiro passo',
      descricao: 'Você registrou seu primeiro dado no app.',
      emoji: '🌱',
      atual: m.primeiroRegistro ? 1 : 0,
      alvo: 1,
      unidade: '',
    },
    {
      chave: 'semana_completa',
      titulo: 'Semana inteira',
      descricao: 'Sete dias seguidos aparecendo na academia.',
      emoji: '🔥',
      atual: m.sequenciaPresenca,
      alvo: 7,
      unidade: 'dias seguidos',
    },
    {
      chave: 'mes_sem_faltar',
      titulo: 'Um mês sem faltar',
      descricao: 'Trinta dias seguidos de presença. Isso muda a vida.',
      emoji: '🏅',
      atual: m.sequenciaPresenca,
      alvo: 30,
      unidade: 'dias seguidos',
    },
    {
      chave: 'vinte_treinos',
      titulo: '20 treinos',
      descricao: 'Vinte treinos concluídos desde que você começou.',
      emoji: '💪',
      atual: m.totalTreinos,
      alvo: 20,
      unidade: 'treinos',
    },
    {
      chave: 'indicadores_no_verde',
      titulo: 'Indicadores no verde',
      descricao: 'Trinta dias com todas as medições dentro da faixa ideal.',
      emoji: '🟢',
      atual: m.diasIndicadorVerde,
      alvo: 30,
      unidade: 'dias',
    },
    {
      chave: 'quem_mede_cuida',
      titulo: 'Quem mede, cuida',
      descricao: 'Cinquenta medições registradas.',
      emoji: '📈',
      atual: m.totalIndicadores,
      alvo: 50,
      unidade: 'medições',
    },
    {
      chave: 'remedio_em_dia',
      titulo: 'Remédio em dia',
      descricao: 'Trinta dias confirmando todos os medicamentos.',
      emoji: '💊',
      atual: m.adesaoRemedio,
      alvo: 30,
      unidade: 'dias',
    },
    {
      chave: 'humor_registrado',
      titulo: 'De olho em si',
      descricao: 'Trinta dias registrando como você se sente.',
      emoji: '🧠',
      atual: m.diasComHumor,
      alvo: 30,
      unidade: 'dias',
    },
    {
      chave: 'bem_hidratado',
      titulo: 'Bem hidratado',
      descricao: 'Catorze dias batendo a meta de água.',
      emoji: '💧',
      atual: m.diasNaMetaDeAgua,
      alvo: 14,
      unidade: 'dias',
    },
  ]
}

export interface ConquistasData {
  conquistas: Conquista[]
  totalConquistadas: number
  sequenciaAtual: number
}

export async function getConquistasAluno(
  alunoId: string,
  metaAguaMl: number
): Promise<ConquistasData> {
  const supabase = await createClient()

  const hoje = hojeISO()
  const inicioJanela = somarDiasISO(hoje, -89)

  const [
    { data: checkins },
    { data: execucoes },
    { data: humores },
    { data: indicadores },
    { data: agua },
    { data: confirmacoes },
    { data: registradas },
  ] = await Promise.all([
    supabase
      .from('checkins')
      .select('data')
      .eq('aluno_id', alunoId)
      .gte('data', inicioJanela),
    supabase
      .from('treino_execucoes')
      .select('data, concluido')
      .eq('aluno_id', alunoId),
    supabase
      .from('humor_diario')
      .select('data')
      .eq('aluno_id', alunoId)
      .gte('data', inicioJanela),
    supabase
      .from('indicadores')
      .select('created_at, status_semaforo')
      .eq('aluno_id', alunoId),
    supabase
      .from('hidratacao_registros')
      .select('data, quantidade_ml')
      .eq('aluno_id', alunoId)
      .gte('data', inicioJanela),
    supabase
      .from('medicamento_confirmacoes')
      .select('data, status')
      .eq('aluno_id', alunoId)
      .gte('data', inicioJanela),
    supabase.from('aluno_conquistas').select('*').eq('aluno_id', alunoId),
  ])

  // ── Presença ────────────────────────────────────────────────────
  const concluidos = (execucoes ?? []).filter((e) => e.concluido)
  const diasComTreino = new Set([
    ...(checkins ?? []).map((c) => c.data as string),
    ...concluidos
      .filter((e) => e.data >= inicioJanela)
      .map((e) => e.data as string),
  ])

  let sequenciaPresenca = 0
  let cursor = diasComTreino.has(hoje) ? hoje : somarDiasISO(hoje, -1)
  while (diasComTreino.has(cursor)) {
    sequenciaPresenca += 1
    cursor = somarDiasISO(cursor, -1)
  }

  // ── Indicadores ─────────────────────────────────────────────────
  const listaIndicadores = (indicadores ?? []) as Pick<
    Indicador,
    'created_at' | 'status_semaforo'
  >[]

  const porDiaIndicador = new Map<string, boolean>()
  for (const i of listaIndicadores) {
    const dia = hojeISO(new Date(i.created_at))
    const jaVerde = porDiaIndicador.get(dia) ?? true
    porDiaIndicador.set(dia, jaVerde && i.status_semaforo === 'verde')
  }

  // ── Água ────────────────────────────────────────────────────────
  const aguaPorDia = new Map<string, number>()
  for (const r of agua ?? []) {
    aguaPorDia.set(r.data, (aguaPorDia.get(r.data) ?? 0) + r.quantidade_ml)
  }

  // ── Remédio: dias em que nada ficou sem confirmação ─────────────
  const remedioPorDia = new Map<string, boolean>()
  for (const c of confirmacoes ?? []) {
    const tudoCerto = remedioPorDia.get(c.data) ?? true
    remedioPorDia.set(c.data, tudoCerto && c.status === 'tomou')
  }

  const materia: Materia = {
    diasComTreino,
    sequenciaPresenca,
    totalTreinos: concluidos.length,
    diasComHumor: (humores ?? []).length,
    diasIndicadorVerde: Array.from(porDiaIndicador.values()).filter(Boolean)
      .length,
    totalIndicadores: listaIndicadores.length,
    adesaoRemedio: Array.from(remedioPorDia.values()).filter(Boolean).length,
    diasNaMetaDeAgua: Array.from(aguaPorDia.values()).filter(
      (ml) => ml >= metaAguaMl
    ).length,
    primeiroRegistro:
      listaIndicadores.length > 0 ||
      concluidos.length > 0 ||
      (humores ?? []).length > 0,
  }

  const jaRegistradas = new Map(
    ((registradas ?? []) as { chave: string; vista: boolean }[]).map((r) => [
      r.chave,
      r.vista,
    ])
  )

  const conquistas: Conquista[] = regras(materia).map((regra) => {
    const conquistada = regra.atual >= regra.alvo

    return {
      chave: regra.chave,
      titulo: regra.titulo,
      descricao: regra.descricao,
      emoji: regra.emoji,
      conquistada,
      progresso: Math.min(100, Math.round((regra.atual / regra.alvo) * 100)),
      detalhe: regra.unidade
        ? `${Math.min(regra.atual, regra.alvo)} de ${regra.alvo} ${regra.unidade}`
        : conquistada
          ? 'Conquistada'
          : 'Ainda não',
      nova: conquistada && jaRegistradas.get(regra.chave) === undefined,
    }
  })

  // Carimba as novas para que na próxima visita já não apareçam como novidade.
  const novas = conquistas.filter((c) => c.nova)
  if (novas.length > 0) {
    await supabase.from('aluno_conquistas').upsert(
      novas.map((c) => ({
        aluno_id: alunoId,
        chave: c.chave,
        vista: true,
      })),
      { onConflict: 'aluno_id,chave' }
    )
  }

  return {
    conquistas,
    totalConquistadas: conquistas.filter((c) => c.conquistada).length,
    sequenciaAtual: sequenciaPresenca,
  }
}
