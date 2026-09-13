import {
  Activity,
  Droplet,
  Heart,
  Scale,
  Wind,
  type LucideIcon,
} from 'lucide-react'

import type {
  Indicador,
  IndicadorMomento,
  IndicadorTipo,
  SemaforoStatus,
} from '@/lib/types'
import { calcularSemaforo } from './semaforo'

export interface ConfigIndicador {
  label: string
  /** Nome curto, para chips e listas. */
  labelCurto: string
  unidade: string
  icone: LucideIcon
  /** Cor de identidade do indicador — não confundir com o semáforo. */
  corIcone: string
  labelPrincipal: string
  placeholder: string
  /** Só pressão tem segundo valor (diastólica). */
  labelSecundario?: string
  placeholderSecundario?: string
  min: number
  max: number
  minSecundario?: number
  maxSecundario?: number
  /** `true` aceita casas decimais (peso). */
  decimal: boolean
  momentos: IndicadorMomento[]
}

export const ORDEM_INDICADORES: IndicadorTipo[] = [
  'glicemia',
  'pressao',
  'peso',
  'fc',
  'saturacao',
]

export const CONFIG_INDICADORES: Record<IndicadorTipo, ConfigIndicador> = {
  glicemia: {
    label: 'Glicemia',
    labelCurto: 'Glicemia',
    unidade: 'mg/dL',
    icone: Droplet,
    corIcone: 'text-neutral-400',
    labelPrincipal: 'Glicemia',
    placeholder: '110',
    min: 20,
    max: 600,
    decimal: false,
    momentos: ['jejum', 'pos_refeicao', 'pre_treino', 'pos_treino'],
  },
  pressao: {
    label: 'Pressão arterial',
    labelCurto: 'Pressão',
    unidade: 'mmHg',
    icone: Heart,
    corIcone: 'text-neutral-400',
    labelPrincipal: 'Sistólica (maior)',
    placeholder: '120',
    labelSecundario: 'Diastólica (menor)',
    placeholderSecundario: '80',
    min: 60,
    max: 260,
    minSecundario: 30,
    maxSecundario: 180,
    decimal: false,
    momentos: ['repouso', 'pre_treino', 'pos_treino'],
  },
  peso: {
    label: 'Peso',
    labelCurto: 'Peso',
    unidade: 'kg',
    icone: Scale,
    corIcone: 'text-neutral-400',
    labelPrincipal: 'Peso',
    placeholder: '72,5',
    min: 20,
    max: 400,
    decimal: true,
    momentos: [],
  },
  fc: {
    label: 'Frequência cardíaca',
    labelCurto: 'Batimentos',
    unidade: 'bpm',
    icone: Activity,
    corIcone: 'text-neutral-400',
    labelPrincipal: 'Batimentos por minuto',
    placeholder: '72',
    min: 20,
    max: 250,
    decimal: false,
    momentos: ['repouso', 'pre_treino', 'pos_treino'],
  },
  saturacao: {
    label: 'Saturação de oxigênio',
    labelCurto: 'Saturação',
    unidade: '%',
    icone: Wind,
    corIcone: 'text-neutral-400',
    labelPrincipal: 'Saturação',
    placeholder: '97',
    min: 50,
    max: 100,
    decimal: false,
    momentos: ['repouso', 'pre_treino', 'pos_treino'],
  },
}

export const MOMENTO_LABEL: Record<IndicadorMomento, string> = {
  jejum: 'Em jejum',
  pos_refeicao: 'Após comer',
  pre_treino: 'Antes do treino',
  pos_treino: 'Depois do treino',
  repouso: 'Em repouso',
}

/**
 * `avaliacoes_fisicas.altura` é `numeric` sem unidade combinada — o professor
 * tanto pode lançar 1.75 quanto 175. Acima de 3 só pode ser centímetro.
 */
export function alturaEmMetros(altura: number | null | undefined): number | null {
  if (!altura || altura <= 0) return null
  return altura > 3 ? altura / 100 : altura
}

export function calcularIMC(
  pesoKg: number,
  altura: number | null | undefined
): number | null {
  const metros = alturaEmMetros(altura)
  if (!metros) return null
  return pesoKg / (metros * metros)
}

/** Remove zeros à toa: 72.50 → "72,5", 72.00 → "72". */
function numeroBR(valor: number): string {
  return String(Number(valor.toFixed(1))).replace('.', ',')
}

export function formatarValorIndicador(
  tipo: IndicadorTipo,
  valorPrincipal: number,
  valorSecundario?: number | null
): string {
  if (tipo === 'pressao' && valorSecundario != null) {
    return `${valorPrincipal}/${valorSecundario}`
  }
  if (tipo === 'peso') return `${numeroBR(valorPrincipal)} kg`
  return numeroBR(valorPrincipal)
}

/**
 * Aceita vírgula (é o que o teclado brasileiro entrega) e devolve `null`
 * quando o texto não é um número utilizável.
 */
export function lerNumero(texto: string): number | null {
  const limpo = texto.replace(',', '.').trim()
  if (limpo === '') return null
  const numero = Number(limpo)
  return Number.isFinite(numero) ? numero : null
}

export interface RegistroIndicador {
  id: string
  tipo: IndicadorTipo
  valorPrincipal: number
  valorSecundario: number | null
  valorFormatado: string
  status: SemaforoStatus
  /** Texto extra do card — hoje só o peso usa, para mostrar o IMC. */
  badge: string
  /** Só no peso, quando há altura: posiciona a faixa do semáforo. */
  imc: number | null
  momento: IndicadorMomento | null
  observacao: string | null
  registradoEm: string
}

/**
 * O gatilho do banco grava `status_semaforo`, mas ele calcula o peso como
 * sempre verde — o semáforo real do peso é o IMC, que depende da altura.
 * Por isso o peso é resolvido aqui e os demais só confiam no banco.
 */
export function resumirIndicador(
  indicador: Indicador,
  altura: number | null
): RegistroIndicador {
  const base = {
    id: indicador.id,
    tipo: indicador.tipo,
    valorPrincipal: indicador.valor_principal,
    valorSecundario: indicador.valor_secundario ?? null,
    valorFormatado: formatarValorIndicador(
      indicador.tipo,
      indicador.valor_principal,
      indicador.valor_secundario
    ),
    momento: indicador.momento ?? null,
    observacao: indicador.observacao ?? null,
    registradoEm: indicador.created_at,
  }

  if (indicador.tipo === 'peso') {
    const imc = calcularIMC(indicador.valor_principal, altura)

    return {
      ...base,
      status: imc ? calcularSemaforo('peso', imc) : 'verde',
      badge: imc ? `IMC ${numeroBR(imc)}` : 'Sem altura',
      imc,
    }
  }

  return {
    ...base,
    // Recalcula se o gatilho não gravou (registro antigo ou importado).
    status:
      indicador.status_semaforo ??
      calcularSemaforo(
        indicador.tipo,
        indicador.valor_principal,
        indicador.valor_secundario
      ),
    badge: '',
    imc: null,
  }
}
