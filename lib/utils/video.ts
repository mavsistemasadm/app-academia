export type FonteVideo =
  | { tipo: 'youtube' | 'vimeo'; embedUrl: string }
  | { tipo: 'arquivo'; url: string }
  | null

/**
 * O professor cola qualquer link — YouTube, Vimeo ou o arquivo que subiu no
 * storage. Isso normaliza os três casos num formato que o player entende.
 */
export function interpretarVideo(url: string | null | undefined): FonteVideo {
  if (!url) return null

  const limpo = url.trim()
  if (!limpo) return null

  let endereco: URL
  try {
    endereco = new URL(limpo)
  } catch {
    return null
  }

  const host = endereco.hostname.replace(/^www\./, '')

  if (host === 'youtu.be') {
    const id = endereco.pathname.slice(1)
    return id ? { tipo: 'youtube', embedUrl: youtubeEmbed(id) } : null
  }

  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const id =
      endereco.searchParams.get('v') ??
      endereco.pathname.match(/\/(?:shorts|embed|live)\/([\w-]+)/)?.[1]

    return id ? { tipo: 'youtube', embedUrl: youtubeEmbed(id) } : null
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = endereco.pathname.match(/(\d+)/)?.[1]
    return id
      ? { tipo: 'vimeo', embedUrl: `https://player.vimeo.com/video/${id}` }
      : null
  }

  return { tipo: 'arquivo', url: limpo }
}

function youtubeEmbed(id: string) {
  // `rel=0` evita sugerir vídeo de terceiro no fim — o aluno fica no treino.
  return `https://www.youtube.com/embed/${id}?rel=0`
}
