export interface FaseRespiracao {
  rotulo: string
  segundos: number
  /** Quanto o círculo ocupa da área durante a fase, de 0 a 1. */
  escala: number
}

export interface ExercicioRespiracao {
  chave: string
  nome: string
  descricao: string
  /** Para quem esse ritmo é indicado — texto curto, sem promessa clínica. */
  indicacao: string
  ciclos: number
  fases: FaseRespiracao[]
}

/**
 * Ritmos consagrados de respiração lenta. Nenhum substitui orientação médica,
 * e nenhum pede apneia longa — gestante, hipertenso e cardiopata treinam com
 * as mesmas contagens, sem retenção forçada.
 */
export const RESPIRACOES: ExercicioRespiracao[] = [
  {
    chave: 'calmante',
    nome: 'Respiração calmante',
    descricao: 'Inspire em 4, segure 4, solte em 6.',
    indicacao: 'Para desacelerar antes de dormir ou depois de um susto.',
    ciclos: 6,
    fases: [
      { rotulo: 'Inspire pelo nariz', segundos: 4, escala: 1 },
      { rotulo: 'Segure', segundos: 4, escala: 1 },
      { rotulo: 'Solte pela boca', segundos: 6, escala: 0.45 },
    ],
  },
  {
    chave: 'quadrada',
    nome: 'Respiração quadrada',
    descricao: 'Quatro tempos iguais: 4, 4, 4, 4.',
    indicacao: 'Para recuperar o foco no meio do dia.',
    ciclos: 6,
    fases: [
      { rotulo: 'Inspire', segundos: 4, escala: 1 },
      { rotulo: 'Segure', segundos: 4, escala: 1 },
      { rotulo: 'Solte', segundos: 4, escala: 0.45 },
      { rotulo: 'Pausa', segundos: 4, escala: 0.45 },
    ],
  },
  {
    chave: 'pre_treino',
    nome: 'Antes do treino',
    descricao: 'Inspire em 4, solte em 4, sem segurar.',
    indicacao: 'Prepara o corpo sem elevar a pressão.',
    ciclos: 8,
    fases: [
      { rotulo: 'Inspire', segundos: 4, escala: 1 },
      { rotulo: 'Solte', segundos: 4, escala: 0.45 },
    ],
  },
]

export interface PassoAterramento {
  titulo: string
  instrucao: string
  quantidade: number
}

/**
 * A técnica 5-4-3-2-1: ancora a atenção nos sentidos quando a ansiedade
 * aperta. É o recurso que o centro entrega para crise, não para rotina.
 */
export const ATERRAMENTO: PassoAterramento[] = [
  {
    titulo: 'Cinco coisas que você vê',
    instrucao: 'Olhe em volta e nomeie cinco coisas, em voz alta se puder.',
    quantidade: 5,
  },
  {
    titulo: 'Quatro coisas que você sente',
    instrucao:
      'O chão nos pés, a roupa na pele, a temperatura do ar, o apoio da cadeira.',
    quantidade: 4,
  },
  {
    titulo: 'Três sons',
    instrucao: 'Preste atenção em três sons diferentes ao seu redor.',
    quantidade: 3,
  },
  {
    titulo: 'Dois cheiros',
    instrucao: 'Procure dois cheiros. Se não achar, lembre-se de dois.',
    quantidade: 2,
  },
  {
    titulo: 'Um gosto',
    instrucao: 'Um gole de água conta. Sinta o gosto com calma.',
    quantidade: 1,
  },
]

export interface AudioBemEstar {
  chave: string
  titulo: string
  descricao: string
  /** Voz de quem gravou — o vínculo com o centro é metade do valor. */
  voz: string
  duracaoSegundos: number
  url: string
}

/**
 * As meditações com a voz dos sócios. Suba os arquivos no bucket público
 * `exercicios` e cole aqui a URL pública de cada um — o player já está
 * pronto e a biblioteca aparece sozinha assim que houver a primeira faixa.
 */
export const AUDIOS: AudioBemEstar[] = []
