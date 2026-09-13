import type { Indicador, IndicadorTipo } from '@/lib/types'
import { resumirIndicador, type RegistroIndicador } from '@/lib/utils/indicadores'
import { createClient } from './server'

/** Quantos registros a tela de indicadores carrega de uma vez. */
const LIMITE_HISTORICO = 60

export type { RegistroIndicador }

export interface IndicadoresAlunoData {
  /** O registro mais recente de cada tipo. */
  ultimos: Partial<Record<IndicadorTipo, RegistroIndicador>>
  historico: RegistroIndicador[]
  /** Da última avaliação física; sem ela o peso não vira IMC. */
  altura: number | null
}

export async function getIndicadoresAluno(
  alunoId: string
): Promise<IndicadoresAlunoData> {
  const supabase = await createClient()

  const [{ data: registros }, { data: avaliacao }] = await Promise.all([
    supabase
      .from('indicadores')
      .select('*')
      .eq('aluno_id', alunoId)
      .order('created_at', { ascending: false })
      .limit(LIMITE_HISTORICO),
    supabase
      .from('avaliacoes_fisicas')
      .select('altura')
      .eq('aluno_id', alunoId)
      .not('altura', 'is', null)
      .order('data', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const altura = (avaliacao?.altura as number | undefined) ?? null
  const historico = ((registros ?? []) as Indicador[]).map((i) =>
    resumirIndicador(i, altura)
  )

  const ultimos: Partial<Record<IndicadorTipo, RegistroIndicador>> = {}
  for (const registro of historico) {
    // A lista já vem do mais recente para o mais antigo.
    if (!ultimos[registro.tipo]) ultimos[registro.tipo] = registro
  }

  return { ultimos, historico, altura }
}
