import type { DashboardAlunoData, IndicadorTipo, SaudacaoData } from '@/lib/types'
import { SEMAFORO_CONFIG } from './semaforo'
import { horaCheiaAtual } from './datas'

/**
 * Cada indicador com seu gênero: "Sua glicemia está ótima" mas "Seu peso
 * está ótimo". Sem isso a frase concorda no feminino com todo mundo.
 */
const NA_FRASE: Record<IndicadorTipo, { posse: string; nome: string; adjetivo: string }> = {
  pressao: { posse: 'Sua', nome: 'pressão arterial', adjetivo: 'ótima' },
  glicemia: { posse: 'Sua', nome: 'glicemia', adjetivo: 'ótima' },
  peso: { posse: 'Seu', nome: 'peso', adjetivo: 'ótimo' },
  fc: { posse: 'Sua', nome: 'frequência cardíaca', adjetivo: 'ótima' },
  saturacao: { posse: 'Sua', nome: 'saturação', adjetivo: 'ótima' },
}

function getPeriodoDia(): string {
  // Hora da academia, não do servidor — em produção o Node roda em UTC.
  const hora = horaCheiaAtual()
  if (hora < 12) return 'Bom dia'
  if (hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

export function gerarSaudacao(data: DashboardAlunoData): SaudacaoData {
  const { profile, indicadores, treinosNaSemana, remediosPendentes, humorHoje, treinoHoje } = data

  const registrados = Object.values(indicadores)
  const vermelhos = registrados.filter((i) => i.status === 'vermelho')
  // O mais recente entre os tipos — é dele que a frase positiva fala.
  const maisRecente = registrados.reduce<(typeof registrados)[number] | undefined>(
    (melhor, atual) =>
      !melhor || atual.registradoEm > melhor.registradoEm ? atual : melhor,
    undefined
  )
  const periodo = getPeriodoDia()
  const nomeSimples = profile.nome.split(' ')[0]
  const alertas: string[] = []
  let frase = ''

  // ── Alertas prioritários ──────────────────────────────────────
  if (remediosPendentes.length > 0) {
    alertas.push(
      `💊 ${remediosPendentes.length === 1
        ? `Você ainda não confirmou seu ${remediosPendentes[0].nome}`
        : `${remediosPendentes.length} medicamentos pendentes de confirmação`}`
    )
  }

  /*
    Todos os vermelhos, não só o último registro: quem mede o peso depois de
    uma glicemia de 211 não deixou de ter uma glicemia de 211.
  */
  for (const indicador of vermelhos) {
    const { posse, nome } = NA_FRASE[indicador.tipo]
    alertas.push(
      `${SEMAFORO_CONFIG.vermelho.emoji} ${posse} ${nome} (${indicador.valorFormatado}) precisa de atenção`
    )
  }

  // ── Frase personalizada ───────────────────────────────────────
  if (!humorHoje) {
    frase = 'Como você está se sentindo hoje?'
  } else if (maisRecente?.status === 'verde' && vermelhos.length === 0) {
    // Só elogia quando não há nada no vermelho — senão a tela se contradiz.
    const { posse, nome, adjetivo } = NA_FRASE[maisRecente.tipo]
    frase = `${posse} ${nome} está ${adjetivo} 🟢. Continue assim!`
  } else if (treinosNaSemana >= 4) {
    frase = `Você treinou ${treinosNaSemana} vezes essa semana. Incrível! 💪`
  } else if (treinosNaSemana === 0) {
    frase = 'Que tal começar a semana com seu treino de hoje?'
  } else if (treinoHoje) {
    frase = `Seu treino de hoje já está pronto. Vamos lá?`
  } else {
    const frases = [
      'Cada dia de cuidado conta. O que vamos fazer hoje?',
      'Pequenos passos constroem grandes resultados.',
      'Você está sendo cuidado. O que precisa hoje?',
    ]
    frase = frases[Math.floor(Math.random() * frases.length)]
  }

  return {
    saudacao: `${periodo}, ${nomeSimples}!`,
    frase,
    alertas,
  }
}

export const HUMOR_CONFIG = {
  otimo: { emoji: '😄', label: 'Ótimo', cor: '#16A34A' },
  disposto: { emoji: '😊', label: 'Disposto', cor: '#00B4CB' },
  cansado: { emoji: '😔', label: 'Cansado', cor: '#D97706' },
  dormiu_mal: { emoji: '😴', label: 'Dormi mal', cor: '#5C6466' },
  enfermo: { emoji: '🤒', label: 'Com enfermidade', cor: '#DC2626' },
  // Tom quente de propósito: ansiedade abre alerta para o professor.
  ansioso: { emoji: '😰', label: 'Ansioso', cor: '#EA580C' },
}
