import type { Indicador, IndicadorTipo } from '@/lib/types'
import {
  CONFIG_INDICADORES,
  resumirIndicador,
  type RegistroIndicador,
} from '@/lib/utils/indicadores'
import { createClient } from './server'

type Cliente = Awaited<ReturnType<typeof createClient>>

/**
 * A medição mais recente de cada tipo, uma consulta por tipo. Tirar isso do
 * histórico de 60 linhas falhava: quem mede glicemia quatro vezes por dia
 * perdia o card de peso em duas semanas.
 */
export async function ultimoDeCadaTipo(
  supabase: Cliente,
  alunoId: string
): Promise<Indicador[]> {
  const tipos = Object.keys(CONFIG_INDICADORES) as IndicadorTipo[]
  const respostas = await Promise.all(
    tipos.map((tipo) =>
      supabase
        .from('indicadores')
        .select('*')
        .eq('aluno_id', alunoId)
        .eq('tipo', tipo)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    )
  )
  return respostas.map((r) => r.data as Indicador | null).filter((i): i is Indicador => i !== null)
}

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

  const [{ data: registros }, { data: avaliacao }, maisRecentes] = await Promise.all([
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
    ultimoDeCadaTipo(supabase, alunoId),
  ])

  const altura = (avaliacao?.altura as number | undefined) ?? null
  const historico = ((registros ?? []) as Indicador[]).map((i) =>
    resumirIndicador(i, altura)
  )

  const ultimos: Partial<Record<IndicadorTipo, RegistroIndicador>> = {}
  for (const indicador of maisRecentes) {
    ultimos[indicador.tipo] = resumirIndicador(indicador, altura)
  }

  return { ultimos, historico, altura }
}
