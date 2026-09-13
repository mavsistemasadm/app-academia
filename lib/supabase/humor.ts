import type { HumorTipo } from '@/lib/types'
import { hojeISO, somarDiasISO } from '@/lib/utils/datas'
import { createClient } from './server'

/** Humores que valem como "dia bom" no resumo do mês. */
const POSITIVOS: HumorTipo[] = ['otimo', 'disposto']

export interface DiaHumor {
  data: string
  humor: HumorTipo
  observacao: string | null
}

export interface ResumoHumor {
  registros: DiaHumor[]
  /** Contagem por tipo nos últimos 30 dias. */
  contagem: Record<HumorTipo, number>
  diasRegistrados: number
  diasBons: number
  /** Dias seguidos com registro, contando de hoje para trás. */
  sequencia: number
  humorHoje: HumorTipo | null
}

const VAZIO: Record<HumorTipo, number> = {
  otimo: 0,
  disposto: 0,
  cansado: 0,
  dormiu_mal: 0,
  enfermo: 0,
  ansioso: 0,
}

export async function getHumorAluno(
  alunoId: string,
  dias = 30
): Promise<ResumoHumor> {
  const supabase = await createClient()

  const hoje = hojeISO()
  const inicio = somarDiasISO(hoje, -(dias - 1))

  const { data } = await supabase
    .from('humor_diario')
    .select('data, humor, observacao')
    .eq('aluno_id', alunoId)
    .gte('data', inicio)
    .lte('data', hoje)
    .order('data', { ascending: false })

  const registros = ((data ?? []) as DiaHumor[]).map((r) => ({
    data: r.data,
    humor: r.humor,
    observacao: r.observacao ?? null,
  }))

  const contagem = { ...VAZIO }
  for (const r of registros) contagem[r.humor] += 1

  // Sequência: só quebra quando falta um dia. Hoje sem registro não zera —
  // o dia ainda não acabou, então a contagem começa em ontem.
  const porData = new Map(registros.map((r) => [r.data, r]))
  let sequencia = 0
  let cursor = porData.has(hoje) ? hoje : somarDiasISO(hoje, -1)

  while (porData.has(cursor)) {
    sequencia += 1
    cursor = somarDiasISO(cursor, -1)
  }

  return {
    registros,
    contagem,
    diasRegistrados: registros.length,
    diasBons: registros.filter((r) => POSITIVOS.includes(r.humor)).length,
    sequencia,
    humorHoje: porData.get(hoje)?.humor ?? null,
  }
}
