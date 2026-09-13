import type { Exercicio, IndicadorTipo, Profile } from '@/lib/types'
import { indicadorPrioritario } from '@/lib/utils/avatares'
import { diaSemanaAtual, ehHoje, hojeISO } from '@/lib/utils/datas'
import { createClient } from './server'

export interface ExercicioComProgresso {
  id: string
  nome: string
  /** Sempre ≥ 1: exercício sem série definida vale como série única. */
  series: number
  repeticoes: string | null
  carga: string | null
  descanso: string | null
  videoUrl: string | null
  observacoes: string | null
  ordem: number
  /** Números das séries já marcadas hoje (1-indexado). */
  seriesFeitas: number[]
}

export interface TreinoDoDia {
  id: string
  nome: string
  descricao: string | null
  diaSemana: string[]
  exercicios: ExercicioComProgresso[]
  /** `null` enquanto o aluno não iniciou o treino hoje. */
  execucaoId: string | null
  concluido: boolean
  esforcoPercebido: number | null
  totalSeries: number
  seriesFeitas: number
}

export interface OutroTreino {
  id: string
  nome: string
  diaSemana: string[]
  totalExercicios: number
}

export interface TreinoAlunoData {
  treino: TreinoDoDia | null
  /** Os demais treinos ativos, para o aluno saber o que vem nos outros dias. */
  outros: OutroTreino[]
  hoje: string
  /**
   * Módulo 13: o indicador que a condição clínica do aluno exige antes de
   * começar. `null` quando não há exigência ou quando ele já mediu hoje.
   */
  medirAntes: IndicadorTipo | null
  /** Da última avaliação física — o portão precisa dela para o IMC. */
  altura: number | null
}

interface TreinoRow {
  id: string
  nome: string
  descricao: string | null
  dia_semana: string[] | null
  exercicios: Exercicio[] | null
}

export async function getTreinoAluno(
  perfil: Profile
): Promise<TreinoAlunoData> {
  const supabase = await createClient()

  const alunoId = perfil.id
  const hoje = hojeISO()
  const diaSemana = diaSemanaAtual()
  const exigido = indicadorPrioritario(perfil.avatar_condicao)

  const [{ data: treinos }, { data: avaliacao }, { data: mediuHoje }] =
    await Promise.all([
      supabase
        .from('treinos')
        .select('id, nome, descricao, dia_semana, exercicios(*)')
        .eq('aluno_id', alunoId)
        .eq('ativo', true)
        .order('created_at', { ascending: false }),
      supabase
        .from('avaliacoes_fisicas')
        .select('altura')
        .eq('aluno_id', alunoId)
        .not('altura', 'is', null)
        .order('data', { ascending: false })
        .limit(1)
        .maybeSingle(),
      exigido
        ? supabase
            .from('indicadores')
            .select('id')
            .eq('aluno_id', alunoId)
            .eq('tipo', exigido)
            .gte('created_at', `${hoje}T00:00:00`)
            .limit(1)
        : Promise.resolve({ data: null }),
    ])

  const altura = (avaliacao?.altura as number | undefined) ?? null
  // Já mediu hoje: não faz sentido cobrar de novo a cada vez que abre a tela.
  const medirAntes = exigido && !mediuHoje?.length ? exigido : null

  const lista = (treinos ?? []) as TreinoRow[]
  const doDia = lista.find((t) => ehHoje(t.dia_semana, diaSemana)) ?? null

  const outros: OutroTreino[] = lista
    .filter((t) => t.id !== doDia?.id)
    .map((t) => ({
      id: t.id,
      nome: t.nome,
      diaSemana: t.dia_semana ?? [],
      totalExercicios: t.exercicios?.length ?? 0,
    }))

  if (!doDia) return { treino: null, outros, hoje, medirAntes: null, altura }

  const { data: execucao } = await supabase
    .from('treino_execucoes')
    .select('id, concluido, esforco_percebido')
    .eq('treino_id', doDia.id)
    .eq('aluno_id', alunoId)
    .eq('data', hoje)
    .maybeSingle()

  // Só busca as séries se o treino já foi iniciado hoje.
  const { data: series } = execucao
    ? await supabase
        .from('exercicio_execucoes')
        .select('exercicio_id, serie')
        .eq('execucao_id', execucao.id)
    : { data: null }

  const feitasPorExercicio = new Map<string, number[]>()
  for (const s of series ?? []) {
    const atuais = feitasPorExercicio.get(s.exercicio_id) ?? []
    atuais.push(s.serie)
    feitasPorExercicio.set(s.exercicio_id, atuais)
  }

  const exercicios: ExercicioComProgresso[] = (doDia.exercicios ?? [])
    .slice()
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .map((e) => ({
      id: e.id,
      nome: e.nome,
      series: Math.max(1, e.series ?? 1),
      repeticoes: e.repeticoes ?? null,
      carga: e.carga ?? null,
      descanso: e.descanso ?? null,
      videoUrl: e.video_url ?? null,
      observacoes: e.observacoes ?? null,
      ordem: e.ordem ?? 0,
      seriesFeitas: (feitasPorExercicio.get(e.id) ?? []).sort((a, b) => a - b),
    }))

  return {
    treino: {
      id: doDia.id,
      nome: doDia.nome,
      descricao: doDia.descricao,
      diaSemana: doDia.dia_semana ?? [],
      exercicios,
      execucaoId: execucao?.id ?? null,
      concluido: Boolean(execucao?.concluido),
      esforcoPercebido: execucao?.esforco_percebido ?? null,
      totalSeries: exercicios.reduce((soma, e) => soma + e.series, 0),
      seriesFeitas: exercicios.reduce(
        (soma, e) => soma + e.seriesFeitas.length,
        0
      ),
    },
    outros,
    hoje,
    // Treino já iniciado não volta para o portão no meio da série.
    medirAntes: execucao ? null : medirAntes,
    altura,
  }
}
