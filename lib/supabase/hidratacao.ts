import { hojeISO, somarDiasISO } from '@/lib/utils/datas'
import { createClient } from './server'

/** Meta padrão quando o aluno não definiu a dele. */
export const META_PADRAO_ML = 2000

export interface HidratacaoData {
  hoje: string
  metaMl: number
  hojeMl: number
  /** Últimos 14 dias, do mais antigo ao mais recente. */
  ultimosDias: { data: string; ml: number }[]
  /** Dias seguidos batendo a meta, contando de ontem para trás. */
  sequencia: number
  registrosDeHoje: { id: string; quantidadeMl: number; hora: string }[]
}

export async function getHidratacaoAluno(
  alunoId: string,
  metaPerfil?: number | null
): Promise<HidratacaoData> {
  const supabase = await createClient()

  const hoje = hojeISO()
  const inicio = somarDiasISO(hoje, -13)
  const metaMl = metaPerfil && metaPerfil > 0 ? metaPerfil : META_PADRAO_ML

  const { data } = await supabase
    .from('hidratacao_registros')
    .select('id, data, quantidade_ml, created_at')
    .eq('aluno_id', alunoId)
    .gte('data', inicio)
    .order('created_at', { ascending: false })

  const registros = (data ?? []) as {
    id: string
    data: string
    quantidade_ml: number
    created_at: string
  }[]

  const porDia = new Map<string, number>()
  for (const r of registros) {
    porDia.set(r.data, (porDia.get(r.data) ?? 0) + r.quantidade_ml)
  }

  const ultimosDias = Array.from({ length: 14 }, (_, i) => {
    const data = somarDiasISO(hoje, -(13 - i))
    return { data, ml: porDia.get(data) ?? 0 }
  })

  // A sequência começa em ontem: o dia de hoje ainda está em andamento.
  let sequencia = 0
  let cursor = (porDia.get(hoje) ?? 0) >= metaMl ? hoje : somarDiasISO(hoje, -1)
  while ((porDia.get(cursor) ?? 0) >= metaMl) {
    sequencia += 1
    cursor = somarDiasISO(cursor, -1)
  }

  return {
    hoje,
    metaMl,
    hojeMl: porDia.get(hoje) ?? 0,
    ultimosDias,
    sequencia,
    registrosDeHoje: registros
      .filter((r) => r.data === hoje)
      .map((r) => ({
        id: r.id,
        quantidadeMl: r.quantidade_ml,
        hora: r.created_at,
      })),
  }
}
