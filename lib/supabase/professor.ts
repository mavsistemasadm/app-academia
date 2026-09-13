import type { Profile } from '@/lib/types'
import { duracaoDaExecucao } from '@/lib/utils/duracao'
import { createClient } from './server'

export interface ExecucaoRecente {
  id: string
  /** `YYYY-MM-DD` da academia. */
  data: string
  treinoNome: string | null
  concluido: boolean
  esforco: number | null
  /** `null` quando não dá para saber (execução antiga, séries sem horário). */
  duracaoSegundos: number | null
  seriesFeitas: number
  /** Séries previstas hoje no treino — `null` se o professor não enxerga o treino. */
  totalSeries: number | null
}

/**
 * Últimas execuções de treino do aluno, para a ficha. A duração vem de
 * `duracao_segundos` (migração 008) ou, sem ela, dos horários das séries.
 * `select('*')` traz as colunas novas quando existem sem quebrar antes.
 */
export async function getTreinosRecentes(
  alunoId: string,
  limite = 10
): Promise<ExecucaoRecente[]> {
  const supabase = await createClient()

  const { data: execucoes } = await supabase
    .from('treino_execucoes')
    .select('*, treino:treinos(nome, exercicios(series))')
    .eq('aluno_id', alunoId)
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limite)

  type TreinoEmbed = { nome: string; exercicios: { series: number | null }[] | null }
  type Row = {
    id: string
    data: string
    concluido: boolean | null
    esforco_percebido: number | null
    created_at: string | null
    iniciado_em?: string | null
    concluido_em?: string | null
    duracao_segundos?: number | null
    treino: TreinoEmbed | TreinoEmbed[] | null
  }

  const lista = (execucoes ?? []) as Row[]
  if (lista.length === 0) return []

  const { data: series } = await supabase
    .from('exercicio_execucoes')
    .select('execucao_id, created_at')
    .in(
      'execucao_id',
      lista.map((e) => e.id)
    )

  const seriesPorExecucao = new Map<string, string[]>()
  for (const s of series ?? []) {
    const atuais = seriesPorExecucao.get(s.execucao_id) ?? []
    atuais.push(s.created_at)
    seriesPorExecucao.set(s.execucao_id, atuais)
  }

  return lista.map((e) => {
    const treino = Array.isArray(e.treino) ? (e.treino[0] ?? null) : e.treino
    const horarios = seriesPorExecucao.get(e.id) ?? []

    return {
      id: e.id,
      data: e.data,
      treinoNome: treino?.nome ?? null,
      concluido: Boolean(e.concluido),
      esforco: e.esforco_percebido ?? null,
      // Execução em andamento ainda não tem duração.
      duracaoSegundos: e.concluido ? duracaoDaExecucao(e, horarios) : null,
      seriesFeitas: horarios.length,
      totalSeries: treino
        ? (treino.exercicios ?? []).reduce(
            (soma, x) => soma + Math.max(1, x.series ?? 1),
            0
          )
        : null,
    }
  })
}

/**
 * Todos os alunos do centro — não só os que já têm treino. Quem acabou de se
 * cadastrar é justamente quem o professor precisa achar primeiro.
 * A policy `professor_ve_perfis` (migração 004) é quem libera essa leitura.
 */
export async function getAlunos(): Promise<Profile[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'aluno')
    .order('nome', { ascending: true })

  return (data ?? []) as Profile[]
}

export interface TreinoResumo {
  id: string
  nome: string
  diaSemana: string[]
  ativo: boolean
  totalExercicios: number
  aluno: { id: string; nome: string } | null
}

export async function getTreinosDoProfessor(
  professorId: string
): Promise<TreinoResumo[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('treinos')
    .select('id, nome, dia_semana, ativo, aluno:profiles!treinos_aluno_id_fkey(id, nome), exercicios(id)')
    .eq('professor_id', professorId)
    .order('created_at', { ascending: false })

  type Row = {
    id: string
    nome: string
    dia_semana: string[] | null
    ativo: boolean
    aluno: { id: string; nome: string } | { id: string; nome: string }[] | null
    exercicios: { id: string }[] | null
  }

  return ((data ?? []) as Row[]).map((t) => ({
    id: t.id,
    nome: t.nome,
    diaSemana: t.dia_semana ?? [],
    ativo: t.ativo,
    totalExercicios: t.exercicios?.length ?? 0,
    // O PostgREST devolve objeto ou array conforme a cardinalidade inferida.
    aluno: Array.isArray(t.aluno) ? (t.aluno[0] ?? null) : t.aluno,
  }))
}

export interface TreinoEdicao {
  id: string
  nome: string
  descricao: string | null
  alunoId: string
  diaSemana: string[]
  ativo: boolean
  exercicios: {
    id: string
    nome: string
    series: number | null
    repeticoes: string | null
    carga: string | null
    descanso: string | null
    videoUrl: string | null
    observacoes: string | null
    ordem: number
  }[]
}

export async function getTreinoParaEdicao(
  treinoId: string,
  professorId: string
): Promise<TreinoEdicao | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('treinos')
    .select('*, exercicios(*)')
    .eq('id', treinoId)
    .eq('professor_id', professorId)
    .maybeSingle()

  if (!data) return null

  type ExercicioRow = {
    id: string
    nome: string
    series: number | null
    repeticoes: string | null
    carga: string | null
    descanso: string | null
    video_url: string | null
    observacoes: string | null
    ordem: number | null
  }

  return {
    id: data.id,
    nome: data.nome,
    descricao: data.descricao,
    alunoId: data.aluno_id,
    diaSemana: data.dia_semana ?? [],
    ativo: data.ativo,
    exercicios: ((data.exercicios ?? []) as ExercicioRow[])
      .slice()
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
      .map((e) => ({
        id: e.id,
        nome: e.nome,
        series: e.series,
        repeticoes: e.repeticoes,
        carga: e.carga,
        descanso: e.descanso,
        videoUrl: e.video_url,
        observacoes: e.observacoes,
        ordem: e.ordem ?? 0,
      })),
  }
}
