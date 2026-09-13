/**
 * Duração do treino — client-safe (sem Supabase), usado na execução, na home
 * e na ficha do aluno.
 *
 * A migração 008 cria `iniciado_em`, `concluido_em` e `duracao_segundos`.
 * Enquanto ela não estiver aplicada (ou para execuções antigas), a duração é
 * estimada pelos `created_at` das séries: primeira série → última série.
 */

export interface ExecucaoComTempo {
  iniciado_em?: string | null
  concluido_em?: string | null
  duracao_segundos?: number | null
  created_at?: string | null
}

/** Instante de início: a coluna nova, senão a primeira série, senão a execução. */
export function inicioDaExecucao(
  execucao: ExecucaoComTempo,
  seriesCriadasEm: string[]
): string | null {
  if (execucao.iniciado_em) return execucao.iniciado_em
  const primeira = extremo(seriesCriadasEm, 'min')
  return primeira ?? execucao.created_at ?? null
}

/** Duração em segundos, ou `null` quando não há como saber. */
export function duracaoDaExecucao(
  execucao: ExecucaoComTempo,
  seriesCriadasEm: string[]
): number | null {
  if (typeof execucao.duracao_segundos === 'number') {
    return Math.max(0, execucao.duracao_segundos)
  }

  const inicio = inicioDaExecucao(execucao, seriesCriadasEm)
  const fim = execucao.concluido_em ?? extremo(seriesCriadasEm, 'max')
  if (!inicio || !fim) return null

  const segundos = Math.round((Date.parse(fim) - Date.parse(inicio)) / 1000)
  // Zero é "todas as séries no mesmo instante" (seed, importação): não é tempo real.
  return Number.isFinite(segundos) && segundos > 0 ? segundos : null
}

function extremo(datas: string[], qual: 'min' | 'max'): string | null {
  let escolhido: string | null = null
  let valor = qual === 'min' ? Infinity : -Infinity
  for (const d of datas) {
    const t = Date.parse(d)
    if (!Number.isFinite(t)) continue
    if (qual === 'min' ? t < valor : t > valor) {
      valor = t
      escolhido = d
    }
  }
  return escolhido
}

/** Cronômetro: `07:42`, e `1:07:42` depois de uma hora. */
export function formatarCronometro(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const resto = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(resto).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** Texto corrido: `42 min`, `1 h 05 min`, `1 h`. */
export function formatarDuracao(segundos: number): string {
  const minutos = Math.max(1, Math.round(segundos / 60))
  if (minutos < 60) return `${minutos} min`
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')} min`
}

/**
 * O PostgREST responde assim quando a coluna não existe (migração 008 ainda
 * não aplicada): `PGRST204` no insert/update, `42703` no select.
 */
export function ehColunaInexistente(
  erro: { code?: string; message?: string } | null | undefined
): boolean {
  if (!erro) return false
  if (erro.code === 'PGRST204' || erro.code === '42703') return true
  return /column|coluna/i.test(erro.message ?? '')
}
