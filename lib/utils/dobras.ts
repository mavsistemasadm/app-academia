/**
 * Composição corporal por dobras cutâneas — Jackson & Pollock, 7 dobras,
 * com o % de gordura pela equação de Siri.
 *
 * Funções puras, sem React nem Supabase: a tela do professor usa para a
 * prévia ao vivo e o resultado é o mesmo que vai para o banco.
 */

export type Sexo = 'masculino' | 'feminino'

export const DOBRAS = [
  { id: 'dobra_peitoral', rotulo: 'Peitoral' },
  { id: 'dobra_axilar_media', rotulo: 'Axilar média' },
  { id: 'dobra_triceps', rotulo: 'Tríceps' },
  { id: 'dobra_subescapular', rotulo: 'Subescapular' },
  { id: 'dobra_abdominal', rotulo: 'Abdominal' },
  { id: 'dobra_suprailiaca', rotulo: 'Supra-ilíaca' },
  { id: 'dobra_coxa', rotulo: 'Coxa' },
] as const

export type DobraId = (typeof DOBRAS)[number]['id']

/** Faixa de idade em que o protocolo foi validado. */
export const IDADE_VALIDADA = { min: 18, max: 61 } as const

/** Fora disso a medida provavelmente foi digitada errado (mm). */
const DOBRA_PLAUSIVEL = { min: 2, max: 70 } as const

export interface ResultadoDobras {
  soma: number
  densidade: number
  percentualGordura: number
  /** Só quando há peso. */
  massaGorda: number | null
  massaMagra: number | null
}

/** Densidade corporal (g/cm³) pela soma das 7 dobras em mm. */
export function densidadeJP7(soma: number, idade: number, sexo: Sexo): number {
  if (sexo === 'masculino') {
    return 1.112 - 0.00043499 * soma + 0.00000055 * soma * soma - 0.00028826 * idade
  }
  return 1.097 - 0.00046971 * soma + 0.00000056 * soma * soma - 0.00012828 * idade
}

/** % de gordura pela equação de Siri. */
export function percentualSiri(densidade: number): number {
  return (4.95 / densidade - 4.5) * 100
}

export function calcularDobras(
  dobras: number[],
  idade: number,
  sexo: Sexo,
  peso: number | null
): ResultadoDobras {
  const soma = dobras.reduce((s, v) => s + v, 0)
  const densidade = densidadeJP7(soma, idade, sexo)
  const percentualGordura = percentualSiri(densidade)
  const massaGorda = peso ? (peso * percentualGordura) / 100 : null

  return {
    soma,
    densidade,
    percentualGordura,
    massaGorda,
    massaMagra: peso && massaGorda !== null ? peso - massaGorda : null,
  }
}

/** Avisos para o professor conferir antes de gravar. Não impedem salvar. */
export function avisosDobras({
  valores,
  idade,
  sexo,
  peso,
  resultado,
}: {
  valores: Partial<Record<DobraId, number | null>>
  idade: number | null
  sexo: Sexo | null
  peso: number | null
  resultado: ResultadoDobras | null
}): string[] {
  const avisos: string[] = []

  const faltando = DOBRAS.filter(({ id }) => valores[id] == null)
  if (faltando.length > 0) {
    avisos.push(
      faltando.length === 1
        ? `Falta a dobra ${faltando[0].rotulo.toLowerCase()}.`
        : `Faltam ${faltando.length} dobras: ${faltando.map((d) => d.rotulo.toLowerCase()).join(', ')}.`
    )
  }

  for (const { id, rotulo } of DOBRAS) {
    const valor = valores[id]
    if (valor != null && (valor < DOBRA_PLAUSIVEL.min || valor > DOBRA_PLAUSIVEL.max)) {
      avisos.push(`${rotulo}: ${String(valor).replace('.', ',')} mm parece fora do normal. Confira a medida.`)
    }
  }

  if (!sexo) avisos.push('Escolha o sexo: a equação muda entre homens e mulheres.')

  if (idade === null) {
    avisos.push('Informe a idade.')
  } else if (idade < IDADE_VALIDADA.min || idade > IDADE_VALIDADA.max) {
    avisos.push(
      `O protocolo é validado para ${IDADE_VALIDADA.min} a ${IDADE_VALIDADA.max} anos. Com ${idade} anos o resultado é só uma estimativa.`
    )
  }

  if (!peso) avisos.push('Sem o peso não dá para calcular massa gorda e massa magra.')

  if (resultado && (resultado.percentualGordura < 3 || resultado.percentualGordura > 50)) {
    avisos.push('O % de gordura saiu fora do esperado. Confira as dobras, a idade e o sexo.')
  }

  return avisos
}

/** Idade em anos completos numa data `YYYY-MM-DD`. */
export function idadeNaData(nascimento: string, dataISO: string): number | null {
  const [an, mn, dn] = nascimento.split('-').map(Number)
  const [a, m, d] = dataISO.split('-').map(Number)
  if (!an || !mn || !dn || !a || !m || !d) return null
  const idade = a - an - (m < mn || (m === mn && d < dn) ? 1 : 0)
  return idade >= 0 ? idade : null
}
