import {
  Activity,
  Droplets,
  Dumbbell,
  Footprints,
  Heart,
  MapPin,
  Pill,
  Timer,
  type LucideIcon,
} from 'lucide-react'

/*
  Regras do desafio. Cada hábito conta **uma vez por dia** e vale o que o
  professor definiu. Nada de carga ou intensidade: o desafio premia
  constância e cuidado, que é o que serve para todos os avatares.
*/

export type Habito =
  | 'presenca'
  | 'treino'
  | 'indicador'
  | 'agua'
  | 'medicamento'
  | 'humor'

export type Regras = Record<Habito, number>

export const HABITOS: {
  chave: Habito
  titulo: string
  descricao: string
  icone: LucideIcon
}[] = [
  { chave: 'presenca', titulo: 'Presença', descricao: 'Fazer check-in na academia', icone: MapPin },
  { chave: 'treino', titulo: 'Treino concluído', descricao: 'Terminar o treino do dia', icone: Dumbbell },
  { chave: 'indicador', titulo: 'Indicador medido', descricao: 'Registrar pressão, glicemia, peso…', icone: Activity },
  { chave: 'agua', titulo: 'Meta de água', descricao: 'Bater a meta do dia', icone: Droplets },
  { chave: 'medicamento', titulo: 'Medicamento', descricao: 'Confirmar a dose do dia', icone: Pill },
  { chave: 'humor', titulo: 'Humor', descricao: 'Dizer como foi o dia', icone: Heart },
]

export const REGRAS_PADRAO: Regras = {
  presenca: 10,
  treino: 15,
  indicador: 5,
  agua: 5,
  medicamento: 5,
  humor: 3,
}

export function lerRegras(bruto: unknown): Regras {
  const dados = (bruto ?? {}) as Record<string, unknown>
  return Object.fromEntries(
    HABITOS.map(({ chave }) => {
      const valor = Number(dados[chave])
      return [chave, Number.isFinite(valor) && valor >= 0 ? Math.trunc(valor) : 0]
    })
  ) as Regras
}

/*
  O desafio tem dois formatos:

  - `pontos`: cada hábito vale ponto por dia (as regras acima).
  - `meta`:   uma medida e um objetivo, tipo "5 km em 30 dias".

  Quatro medidas o app soma sozinho. Quilômetro ele não tem como saber, e
  por isso é a única em que o aluno registra na mão.
*/

export type Metrica = 'km' | 'minutos' | 'treinos' | 'presencas' | 'litros'

export const METRICAS: Record<
  Metrica,
  { titulo: string; unidade: string; manual: boolean; comoConta: string; icone: LucideIcon }
> = {
  km: {
    titulo: 'Quilômetros',
    unidade: 'km',
    manual: true,
    comoConta: 'O aluno registra no app quanto andou ou correu.',
    icone: Footprints,
  },
  minutos: {
    titulo: 'Minutos de treino',
    unidade: 'min',
    manual: false,
    comoConta: 'Conta sozinho pelo tempo dos treinos concluídos.',
    icone: Timer,
  },
  treinos: {
    titulo: 'Treinos concluídos',
    unidade: 'treinos',
    manual: false,
    comoConta: 'Conta sozinho cada treino terminado.',
    icone: Dumbbell,
  },
  presencas: {
    titulo: 'Presenças',
    unidade: 'presenças',
    manual: false,
    comoConta: 'Conta sozinho cada check-in na academia.',
    icone: MapPin,
  },
  litros: {
    titulo: 'Litros de água',
    unidade: 'L',
    manual: false,
    comoConta: 'Conta sozinho o que o aluno registra em Hidratação.',
    icone: Droplets,
  },
}

export type TipoDesafio = 'pontos' | 'meta'

/** "3,2 km", "12 treinos", "1.450 min". */
export function formatarQuantidade(valor: number, metrica: Metrica): string {
  const numero = Number.isInteger(valor)
    ? valor.toLocaleString('pt-BR')
    : valor.toFixed(1).replace('.', ',')
  return `${numero} ${METRICAS[metrica].unidade}`
}

export function porcentagem(valor: number, objetivo: number): number {
  if (objetivo <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((valor / objetivo) * 100)))
}

/*
  Modelos prontos: o professor escolhe um e o formulário abre preenchido.
  São só sugestões, tudo continua editável antes de salvar.
*/
export interface ModeloDesafio {
  chave: string
  nome: string
  descricao: string
  dias: number
  tipo: TipoDesafio
  metrica?: Metrica
  objetivo?: number
  regras?: Regras
}

export const MODELOS: ModeloDesafio[] = [
  {
    chave: '5km',
    nome: '5 km em 30 dias',
    descricao: 'Caminhando ou correndo, no seu ritmo. Você registra no app o que andou.',
    dias: 30,
    tipo: 'meta',
    metrica: 'km',
    objetivo: 5,
  },
  {
    chave: '12treinos',
    nome: '12 treinos no mês',
    descricao: 'Três treinos por semana, contados automaticamente.',
    dias: 30,
    tipo: 'meta',
    metrica: 'treinos',
    objetivo: 12,
  },
  {
    chave: '20presencas',
    nome: '20 presenças em 30 dias',
    descricao: 'Vale o check-in na entrada, mesmo em dia de treino leve.',
    dias: 30,
    tipo: 'meta',
    metrica: 'presencas',
    objetivo: 20,
  },
  {
    chave: '60litros',
    nome: '60 litros de água no mês',
    descricao: 'Dois litros por dia, somados pela tela de hidratação.',
    dias: 30,
    tipo: 'meta',
    metrica: 'litros',
    objetivo: 60,
  },
  {
    chave: 'constancia',
    nome: 'Constância de 30 dias',
    descricao: 'Pontos por aparecer, treinar, medir, beber água e tomar o medicamento.',
    dias: 30,
    tipo: 'pontos',
  },
  {
    chave: 'cuidado',
    nome: 'Semana do cuidado',
    descricao: 'Sete dias valorizando medir, hidratar e tomar o medicamento na hora.',
    dias: 7,
    tipo: 'pontos',
    regras: { presenca: 5, treino: 5, indicador: 15, agua: 10, medicamento: 15, humor: 5 },
  },
]

export type Situacao = 'agendado' | 'em_andamento' | 'encerrado'

export function situacaoDoDesafio(inicio: string, fim: string, hoje: string): Situacao {
  if (hoje < inicio) return 'agendado'
  if (hoje > fim) return 'encerrado'
  return 'em_andamento'
}

/** Quantos dias faltam para acabar (ou para começar), contando hoje. */
export function diasEntre(de: string, ate: string): number {
  const dia = 24 * 60 * 60 * 1000
  return Math.round(
    (new Date(`${ate}T12:00:00Z`).getTime() - new Date(`${de}T12:00:00Z`).getTime()) / dia
  )
}

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  agendado: 'Começa em breve',
  em_andamento: 'No ar',
  encerrado: 'Encerrado',
}
