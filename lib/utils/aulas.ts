/*
  Aulas com hora marcada. A grade é semanal (`aulas_horarios`) e o que
  acontece por data é a inscrição do aluno. Client-safe.
*/

// Nome diferente do DIAS_SEMANA de `datas.ts`, que usa as siglas do treino.
export const DIAS_DA_GRADE = [
  { valor: 0, curto: 'Dom', longo: 'Domingo' },
  { valor: 1, curto: 'Seg', longo: 'Segunda' },
  { valor: 2, curto: 'Ter', longo: 'Terça' },
  { valor: 3, curto: 'Qua', longo: 'Quarta' },
  { valor: 4, curto: 'Qui', longo: 'Quinta' },
  { valor: 5, curto: 'Sex', longo: 'Sexta' },
  { valor: 6, curto: 'Sáb', longo: 'Sábado' },
] as const

/** "18:00:00" vira "18:00". */
export function horaCurta(hora: string): string {
  return hora.slice(0, 5)
}

/** Fim da aula a partir do começo e da duração: "18:00" + 50 = "18:50". */
export function horaFim(hora: string, duracaoMin: number): string {
  const [h, m] = horaCurta(hora).split(':').map(Number)
  const total = h * 60 + m + duracaoMin
  const hh = Math.floor(total / 60) % 24
  return `${String(hh).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function vagasRestantes(vagas: number, ocupadas: number): number {
  return Math.max(0, vagas - ocupadas)
}

/**
 * O erro do gatilho do banco em português. O aluno precisa saber se perdeu
 * a vaga, se a aula foi cancelada ou se o horário já passou.
 */
export function traduzirErroAula(mensagem?: string): string {
  const texto = mensagem ?? ''
  if (texto.includes('AULA_LOTADA')) {
    return 'Alguém pegou a última vaga antes de você. Escolha outro horário.'
  }
  if (texto.includes('AULA_CANCELADA')) return 'Esta aula foi cancelada pelo centro.'
  if (texto.includes('AULA_JA_PASSOU')) return 'Esse horário já passou.'
  if (texto.includes('AULA_INDISPONIVEL')) return 'Essa aula saiu da grade.'
  if (texto.includes('duplicate key')) return 'Você já está inscrito nessa aula.'
  return 'Não conseguimos marcar agora. Tente de novo.'
}

/** Quanto tempo antes da aula o aluno ainda pode desmarcar. */
export const HORAS_PARA_DESMARCAR = 2
