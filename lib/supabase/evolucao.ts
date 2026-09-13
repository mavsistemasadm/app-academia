import type { AvaliacaoFisica, Indicador, IndicadorTipo } from '@/lib/types'
import { hojeISO, somarDiasISO } from '@/lib/utils/datas'
import { calcularIMC } from '@/lib/utils/indicadores'
import { createClient } from './server'

export interface PontoSerie {
  /** `YYYY-MM-DD` na hora da academia. */
  data: string
  valor: number
  /** Só a pressão usa — é a diastólica. */
  valorSecundario?: number
  /** Quantas medições daquele dia entraram na média. */
  leituras: number
}

export interface SerieIndicador {
  tipo: IndicadorTipo
  pontos: PontoSerie[]
  media: number | null
  /** Diferença entre a média deste período e a do período anterior. */
  variacao: number | null
  primeiro: number | null
  ultimo: number | null
}

export interface ResumoTreino {
  /** `YYYY-MM` → treinos concluídos. */
  porMes: { mes: string; concluidos: number }[]
  totalPeriodo: number
  esforcoMedio: number | null
}

export interface EvolucaoData {
  series: Partial<Record<IndicadorTipo, SerieIndicador>>
  treinos: ResumoTreino
  imcAtual: number | null
  altura: number | null
  /** Da mais recente para a mais antiga — o comparativo do módulo 11. */
  avaliacoes: AvaliacaoFisica[]
  dias: number
}

function media(valores: number[]): number | null {
  if (valores.length === 0) return null
  return valores.reduce((s, v) => s + v, 0) / valores.length
}

export async function getEvolucaoAluno(
  alunoId: string,
  dias = 90
): Promise<EvolucaoData> {
  const supabase = await createClient()

  const hoje = hojeISO()
  const inicio = somarDiasISO(hoje, -(dias - 1))
  // Puxa o dobro do período para conseguir comparar com o intervalo anterior.
  const inicioComparativo = somarDiasISO(hoje, -(dias * 2 - 1))

  const [{ data: indicadores }, { data: execucoes }, { data: avaliacoes }] =
    await Promise.all([
      supabase
        .from('indicadores')
        .select('*')
        .eq('aluno_id', alunoId)
        .gte('created_at', `${inicioComparativo}T00:00:00`)
        .order('created_at', { ascending: true }),
      supabase
        .from('treino_execucoes')
        .select('data, concluido, esforco_percebido')
        .eq('aluno_id', alunoId)
        .gte('data', inicioComparativo)
        .order('data', { ascending: true }),
      supabase
        .from('avaliacoes_fisicas')
        .select('*')
        .eq('aluno_id', alunoId)
        .order('data', { ascending: false }),
    ])

  const listaAvaliacoes = (avaliacoes ?? []) as AvaliacaoFisica[]
  const altura = listaAvaliacoes.find((a) => a.altura)?.altura ?? null

  /*
    Duas medições no mesmo dia viram um ponto só (média). Num gráfico de 90
    dias, dois pontos empilhados na mesma data viram ruído — e o eixo de
    categoria do recharts colapsaria os rótulos repetidos de qualquer forma.
  */
  const acumulado = new Map<
    string,
    { soma: number; somaSecundario: number; comSecundario: number; leituras: number }
  >()

  for (const bruto of (indicadores ?? []) as Indicador[]) {
    const data = hojeISO(new Date(bruto.created_at))
    const chave = `${bruto.tipo}|${data}`

    const atual = acumulado.get(chave) ?? {
      soma: 0,
      somaSecundario: 0,
      comSecundario: 0,
      leituras: 0,
    }

    atual.soma += bruto.valor_principal
    atual.leituras += 1

    if (bruto.valor_secundario != null) {
      atual.somaSecundario += bruto.valor_secundario
      atual.comSecundario += 1
    }

    acumulado.set(chave, atual)
  }

  const series: Partial<Record<IndicadorTipo, SerieIndicador>> = {}

  for (const [chave, valores] of acumulado) {
    const [tipoBruto, data] = chave.split('|')
    const tipo = tipoBruto as IndicadorTipo

    const atual = series[tipo] ?? {
      tipo,
      pontos: [],
      media: null,
      variacao: null,
      primeiro: null,
      ultimo: null,
    }

    atual.pontos.push({
      data,
      valor: Number((valores.soma / valores.leituras).toFixed(1)),
      valorSecundario:
        valores.comSecundario > 0
          ? Number((valores.somaSecundario / valores.comSecundario).toFixed(1))
          : undefined,
      leituras: valores.leituras,
    })

    series[tipo] = atual
  }

  for (const serie of Object.values(series)) {
    serie.pontos.sort((a, b) => a.data.localeCompare(b.data))
  }

  for (const serie of Object.values(series)) {
    const noPeriodo = serie.pontos.filter((p) => p.data >= inicio)
    const anteriores = serie.pontos.filter((p) => p.data < inicio)

    const mediaAtual = media(noPeriodo.map((p) => p.valor))
    const mediaAnterior = media(anteriores.map((p) => p.valor))

    serie.pontos = noPeriodo
    serie.media = mediaAtual
    serie.variacao =
      mediaAtual !== null && mediaAnterior !== null
        ? mediaAtual - mediaAnterior
        : null
    serie.primeiro = noPeriodo[0]?.valor ?? null
    serie.ultimo = noPeriodo[noPeriodo.length - 1]?.valor ?? null
  }

  // Um tipo cujo histórico inteiro é anterior ao período fica sem pontos.
  for (const [tipo, serie] of Object.entries(series)) {
    if (serie.pontos.length === 0) {
      delete series[tipo as IndicadorTipo]
    }
  }

  // ── Treinos por mês ────────────────────────────────────────────
  const noPeriodo = (execucoes ?? []).filter((e) => e.data >= inicio)
  const concluidos = noPeriodo.filter((e) => e.concluido)

  const porMesMapa = new Map<string, number>()
  for (const e of concluidos) {
    const mes = e.data.slice(0, 7)
    porMesMapa.set(mes, (porMesMapa.get(mes) ?? 0) + 1)
  }

  const esforcos = noPeriodo
    .map((e) => e.esforco_percebido)
    .filter((v): v is number => typeof v === 'number')

  const pesoAtual = series.peso?.ultimo ?? null

  return {
    series,
    treinos: {
      porMes: Array.from(porMesMapa.entries())
        .map(([mes, concluidos]) => ({ mes, concluidos }))
        .sort((a, b) => a.mes.localeCompare(b.mes)),
      totalPeriodo: concluidos.length,
      esforcoMedio: media(esforcos),
    },
    imcAtual: pesoAtual
      ? calcularIMC(pesoAtual, altura)
      : (listaAvaliacoes[0]?.imc ?? null),
    altura,
    avaliacoes: listaAvaliacoes,
    dias,
  }
}
