import type { IndicadorTipo, SemaforoStatus } from '@/lib/types'

interface FaixaClinica {
  verde: string
  amarelo: string
  vermelho: string
  unidade: string
  label: string
}

export const FAIXAS_CLINICAS: Record<IndicadorTipo, FaixaClinica> = {
  pressao: {
    verde: '< 130/85 mmHg',
    amarelo: '130–160 / 85–100 mmHg',
    vermelho: '> 160/100 mmHg',
    unidade: 'mmHg',
    label: 'Pressão Arterial',
  },
  glicemia: {
    verde: '70–125 mg/dL',
    amarelo: '126–199 mg/dL',
    vermelho: '> 200 ou < 70 mg/dL',
    unidade: 'mg/dL',
    label: 'Glicemia',
  },
  peso: {
    verde: 'IMC < 25',
    amarelo: 'IMC 25–29,9',
    vermelho: 'IMC ≥ 30',
    unidade: 'kg',
    label: 'Peso',
  },
  fc: {
    verde: '50–90 bpm',
    amarelo: '91–100 bpm',
    vermelho: '> 100 ou < 50 bpm',
    unidade: 'bpm',
    label: 'Frequência Cardíaca',
  },
  saturacao: {
    verde: '≥ 95%',
    amarelo: '90–94%',
    vermelho: '< 90%',
    unidade: '%',
    label: 'Saturação O₂',
  },
}

/*
  Faixa visual do semáforo (a barra verde/amarela/vermelha com um ponto).
  `cortes` tem um valor a mais que `cores`: cada cor ocupa de um corte ao
  seguinte, e a largura desenhada é proporcional ao intervalo real — a faixa
  é uma régua, não três pedaços iguais. As pontas são só onde a régua acaba.
*/
interface EscalaFaixa {
  cortes: number[]
  cores: SemaforoStatus[]
}

export const ESCALAS_FAIXA: Record<IndicadorTipo, EscalaFaixa> = {
  glicemia: { cortes: [40, 70, 126, 200, 280], cores: ['vermelho', 'verde', 'amarelo', 'vermelho'] },
  // Sistólica desenha a régua; a diastólica é encaixada nos mesmos trechos.
  pressao: { cortes: [90, 130, 160, 190], cores: ['verde', 'amarelo', 'vermelho'] },
  fc: { cortes: [35, 50, 91, 101, 140], cores: ['vermelho', 'verde', 'amarelo', 'vermelho'] },
  saturacao: { cortes: [80, 90, 95, 100], cores: ['vermelho', 'amarelo', 'verde'] },
  // Peso é posicionado pelo IMC.
  peso: { cortes: [16, 25, 30, 40], cores: ['verde', 'amarelo', 'vermelho'] },
}

const CORTES_DIASTOLICA = [50, 85, 100, 120]

/** Em qual trecho da régua o valor cai, e quanto dele já andou (0 a 1). */
function trecho(cortes: number[], valor: number) {
  const ultimo = cortes.length - 2
  for (let i = 0; i <= ultimo; i++) {
    if (valor < cortes[i + 1] || i === ultimo) {
      const fracao = (valor - cortes[i]) / (cortes[i + 1] - cortes[i])
      return { indice: i, fracao: Math.min(1, Math.max(0, fracao)) }
    }
  }
  return { indice: 0, fracao: 0 }
}

/** Larguras de cada trecho, em fração da régua inteira. */
export function largurasFaixa(tipo: IndicadorTipo): number[] {
  const { cortes } = ESCALAS_FAIXA[tipo]
  const total = cortes[cortes.length - 1] - cortes[0]
  return cortes.slice(1).map((corte, i) => (corte - cortes[i]) / total)
}

/** Posição do ponto na faixa, de 0 a 1. Pressão usa a pior das duas medidas. */
export function posicaoNaFaixa(
  tipo: IndicadorTipo,
  valor: number,
  valorSecundario?: number | null
): number {
  const larguras = largurasFaixa(tipo)
  const paraPosicao = ({ indice, fracao }: { indice: number; fracao: number }) =>
    larguras.slice(0, indice).reduce((soma, l) => soma + l, 0) + larguras[indice] * fracao

  const principal = paraPosicao(trecho(ESCALAS_FAIXA[tipo].cortes, valor))
  if (tipo !== 'pressao' || valorSecundario == null) return principal

  return Math.max(principal, paraPosicao(trecho(CORTES_DIASTOLICA, valorSecundario)))
}

export function calcularSemaforo(
  tipo: IndicadorTipo,
  valorPrincipal: number,
  valorSecundario?: number
): SemaforoStatus {
  switch (tipo) {
    case 'pressao':
      if (valorPrincipal >= 160 || (valorSecundario && valorSecundario >= 100))
        return 'vermelho'
      if (valorPrincipal >= 130 || (valorSecundario && valorSecundario >= 85))
        return 'amarelo'
      return 'verde'

    case 'glicemia':
      if (valorPrincipal >= 200 || valorPrincipal < 70) return 'vermelho'
      if (valorPrincipal >= 126) return 'amarelo'
      return 'verde'

    case 'peso':
      // Recebe IMC
      if (valorPrincipal >= 30) return 'vermelho'
      if (valorPrincipal >= 25) return 'amarelo'
      return 'verde'

    case 'saturacao':
      if (valorPrincipal < 90) return 'vermelho'
      if (valorPrincipal < 95) return 'amarelo'
      return 'verde'

    case 'fc':
      if (valorPrincipal > 100 || valorPrincipal < 50) return 'vermelho'
      if (valorPrincipal > 90) return 'amarelo'
      return 'verde'

    default:
      return 'verde'
  }
}

export const SEMAFORO_CONFIG = {
  verde: {
    cor: '#16A34A',
    bg: '#DCFCE7',
    border: '#86EFAC',
    emoji: '🟢',
    label: 'Ótimo',
    mensagem: 'Dentro da faixa ideal',
  },
  amarelo: {
    cor: '#D97706',
    bg: '#FEF3C7',
    border: '#FCD34D',
    emoji: '🟡',
    label: 'Atenção',
    mensagem: 'Fora do ideal — fique atento',
  },
  vermelho: {
    cor: '#DC2626',
    bg: '#FEE2E2',
    border: '#FCA5A5',
    emoji: '🔴',
    label: 'Cuidado',
    mensagem: 'Seu professor foi notificado',
  },
}

export function getMensagemAlerta(
  tipo: IndicadorTipo,
  status: SemaforoStatus,
  valor: number,
  valor2?: number
): string {
  if (status !== 'vermelho') return ''

  switch (tipo) {
    case 'pressao':
      return `Pressão ${valor}/${valor2} mmHg está acima do limite seguro para treino. Aguarde orientação do seu professor.`
    case 'glicemia':
      if (valor < 70)
        return `Glicemia ${valor} mg/dL está baixa. Coma algo antes de treinar e informe seu professor.`
      return `Glicemia ${valor} mg/dL está elevada. Evite treino intenso e consulte seu professor.`
    case 'saturacao':
      return `Saturação ${valor}% está abaixo do seguro. Não treine hoje e procure orientação médica.`
    case 'fc':
      return `Frequência cardíaca ${valor} bpm fora do padrão. Seu professor foi notificado.`
    default:
      return 'Indicador fora do padrão. Seu professor foi notificado.'
  }
}
