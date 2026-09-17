import type { Role } from '@/lib/types'

/** Primeira tela de cada papel depois de entrar. */
export function destinoDoPapel(role: Role | string | null | undefined): string {
  if (role === 'professor') return '/dashboard'
  if (role === 'familiar') return '/acompanhar'
  return '/home'
}

/**
 * O que a conta de familiar pode abrir. O resto do app é do aluno: o
 * middleware devolve o familiar para /acompanhar.
 */
export const ROTAS_DO_FAMILIAR = ['/acompanhar']

/** Mesmo alfabeto de `gerarCodigoConvite`: sem 0/O e 1/I. */
export const FORMATO_CODIGO_FAMILIAR = /^[A-HJ-NP-Z2-9]{6}$/
