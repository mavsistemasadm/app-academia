/**
 * Tudo que é "hoje" / "agora" no app é do ponto de vista da academia, não do
 * servidor. Sem isso a Vercel (que roda em UTC) erra o dia e a saudação.
 */
export const TIMEZONE = 'America/Sao_Paulo'

export type DiaSemana = 'dom' | 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab'

export const DIAS_SEMANA: DiaSemana[] = [
  'dom',
  'seg',
  'ter',
  'qua',
  'qui',
  'sex',
  'sab',
]

const formatador = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function partes(quando: Date) {
  const mapa = new Map(
    formatador.formatToParts(quando).map((p) => [p.type, p.value])
  )
  return {
    ano: mapa.get('year')!,
    mes: mapa.get('month')!,
    dia: mapa.get('day')!,
    // 'pt-BR' com hour12:false devolve 24 para a meia-noite.
    hora: mapa.get('hour') === '24' ? '00' : mapa.get('hour')!,
    minuto: mapa.get('minute')!,
  }
}

/** Data de hoje na academia, no formato `YYYY-MM-DD` usado nas colunas `date`. */
export function hojeISO(quando = new Date()): string {
  const { ano, mes, dia } = partes(quando)
  return `${ano}-${mes}-${dia}`
}

/** Hora atual na academia, `HH:MM` — comparável com `medicamentos.horarios`. */
export function horaAtual(quando = new Date()): string {
  const { hora, minuto } = partes(quando)
  return `${hora}:${minuto}`
}

/**
 * Uma `Date` "de parede": os campos locais dela batem com o relógio da
 * academia, seja qual for o fuso de quem roda (Vercel em UTC, celular em
 * viagem). Serve só para exibir com o `format` do date-fns — não use para
 * comparar instantes nem salvar no banco.
 */
export function naAcademia(quando: Date | string): Date {
  const { ano, mes, dia, hora, minuto } = partes(new Date(quando))
  return new Date(Number(ano), Number(mes) - 1, Number(dia), Number(hora), Number(minuto))
}

export function horaCheiaAtual(quando = new Date()): number {
  return Number(partes(quando).hora)
}

/**
 * Meio-dia UTC evita que horário de verão empurre a data para o dia anterior
 * na hora de fazer conta com dias.
 */
function comoData(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`)
}

export function diaSemanaAtual(quando = new Date()): DiaSemana {
  return DIAS_SEMANA[comoData(hojeISO(quando)).getUTCDay()]
}

/** Soma (ou subtrai, com número negativo) dias a uma data `YYYY-MM-DD`. */
export function somarDiasISO(iso: string, dias: number): string {
  const data = comoData(iso)
  data.setUTCDate(data.getUTCDate() + dias)
  return data.toISOString().slice(0, 10)
}

/** Segunda-feira da semana corrente, `YYYY-MM-DD`. */
export function inicioDaSemanaISO(quando = new Date()): string {
  const data = comoData(hojeISO(quando))
  const diaDaSemana = data.getUTCDay()
  const recuo = diaDaSemana === 0 ? 6 : diaDaSemana - 1 // semana começa na segunda
  data.setUTCDate(data.getUTCDate() - recuo)
  return data.toISOString().slice(0, 10)
}

/**
 * `treinos.dia_semana` é `text[]` livre e o módulo do professor ainda não
 * existe, então aceitamos as formas mais prováveis ('seg', 'segunda',
 * 'Segunda-feira') reduzindo tudo às três primeiras letras sem acento.
 */
export function normalizarDiaSemana(valor: string): DiaSemana | null {
  const limpo = valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .slice(0, 3)

  return DIAS_SEMANA.includes(limpo as DiaSemana) ? (limpo as DiaSemana) : null
}

export function ehHoje(dias: string[] | null | undefined, hoje: DiaSemana) {
  // Sem dias definidos, o item vale para todo dia.
  if (!dias || dias.length === 0) return true
  return dias.some((d) => normalizarDiaSemana(d) === hoje)
}
