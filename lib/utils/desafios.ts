import { Activity, Droplets, Dumbbell, Heart, MapPin, Pill, type LucideIcon } from 'lucide-react'

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
