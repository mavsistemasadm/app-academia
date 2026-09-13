import type { Profile } from '@/lib/types'
import { createClient } from './server'

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
