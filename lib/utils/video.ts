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

  // Link colado sem "https://" (youtu.be/abc) também vale.
  let endereco: URL
  try {
    endereco = new URL(/^https?:\/\//i.test(limpo) ? limpo : `https://${limpo}`)
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
    // vimeo.com/123 · vimeo.com/123/abcdef (não listado, o hash é a chave)
    // · vimeo.com/showcase/1/video/123: o id é o último número do caminho.
    const partes = endereco.pathname.split('/').filter(Boolean)
    const posId = partes.map((p) => /^\d+$/.test(p)).lastIndexOf(true)
    if (posId < 0) return null
    const id = partes[posId]
    const hash = endereco.searchParams.get('h') ?? partes[posId + 1]
    const comHash = hash && /^[\da-f]+$/i.test(hash) ? `?h=${hash}` : ''
    return { tipo: 'vimeo', embedUrl: `https://player.vimeo.com/video/${id}${comHash}` }
  }

  // Arquivo só do nosso storage ou com extensão de vídeo: link de Drive ou
  // Instagram viraria um player quebrado.
  const ehStorage = host.endsWith('.supabase.co')
  const ehVideo = /\.(mp4|webm|mov|m4v)$/i.test(endereco.pathname)
  return ehStorage || ehVideo ? { tipo: 'arquivo', url: endereco.toString() } : null
}

function youtubeEmbed(id: string) {
  // `rel=0` evita sugerir vídeo de terceiro no fim — o aluno fica no treino.
  return `https://www.youtube.com/embed/${id}?rel=0`
}
