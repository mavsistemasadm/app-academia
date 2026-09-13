import type { Exame, ExameTipo } from '@/lib/types'

/*
  Constantes e helpers do módulo de exames. Client-safe de propósito: o
  formulário do aluno e a página pública usam os mesmos rótulos.
*/

export const TIPOS_EXAME: { value: ExameTipo; label: string }[] = [
  { value: 'laboratorial', label: 'Exames laboratoriais' },
  { value: 'ressonancia', label: 'Ressonância' },
  { value: 'ultrassom', label: 'Ultrassom' },
  { value: 'raio_x', label: 'Raio-X' },
  { value: 'tomografia', label: 'Tomografia' },
  { value: 'eletrocardiograma', label: 'Eletrocardiograma' },
  { value: 'ecocardiograma', label: 'Ecocardiograma' },
  { value: 'densitometria', label: 'Densitometria' },
  { value: 'outros', label: 'Outros' },
]

const ROTULO_TIPO = Object.fromEntries(
  TIPOS_EXAME.map(({ value, label }) => [value, label])
) as Record<ExameTipo, string>

/** "Ressonância", ou o que o aluno escreveu quando escolheu "Outros". */
export function rotuloTipoExame(exame: Pick<Exame, 'tipo' | 'tipo_outro'>): string {
  if (exame.tipo === 'outros') return exame.tipo_outro?.trim() || 'Outro exame'
  return ROTULO_TIPO[exame.tipo] ?? exame.tipo
}

/** Precisa bater com `file_size_limit` do bucket na migração 007. */
export const TAMANHO_MAXIMO_EXAME = 20 * 1024 * 1024

/** Precisa bater com `allowed_mime_types` do bucket na migração 007. */
const MIME_POR_EXTENSAO: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
}

export const MIMES_EXAME = Array.from(new Set(Object.values(MIME_POR_EXTENSAO)))

export const ACCEPT_EXAME = [
  ...MIMES_EXAME,
  ...Object.keys(MIME_POR_EXTENSAO).map((ext) => `.${ext}`),
].join(',')

/**
 * O tipo do arquivo, ou `null` se não for aceito. Alguns celulares mandam
 * HEIC com `type` vazio — aí vale a extensão.
 */
export function mimeDoArquivo(arquivo: { name: string; type: string }): string | null {
  if (MIMES_EXAME.includes(arquivo.type)) return arquivo.type
  const extensao = arquivo.name.split('.').pop()?.toLowerCase() ?? ''
  return MIME_POR_EXTENSAO[extensao] ?? null
}

export function ehPdf(mime?: string | null) {
  return mime === 'application/pdf'
}

/** "Hemograma Março.pdf" → "hemograma-marco.pdf" — seguro para caminho de storage. */
export function nomeSeguro(nome: string): string {
  const partes = nome.split('.')
  const extensao = partes.length > 1 ? partes.pop()!.toLowerCase().replace(/[^a-z0-9]/g, '') : ''
  const base =
    partes
      .join('.')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'exame'
  return extensao ? `${base}.${extensao.slice(0, 5)}` : base
}

export function formatarTamanho(bytes?: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

/** Token do link público: 32 bytes aleatórios em base64url (43 caracteres). */
export function gerarTokenCompartilhamento(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let binario = ''
  bytes.forEach((b) => (binario += String.fromCharCode(b)))
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const FORMATO_TOKEN = /^[A-Za-z0-9_-]{43}$/

export const VALIDADES_LINK = [7, 30, 90] as const

export function caminhoCompartilhamento(token: string) {
  return `/exames/compartilhado/${token}`
}
