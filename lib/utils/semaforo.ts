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
