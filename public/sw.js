/*
  Service worker da Central de Saúde Conectada.

  Deliberadamente enxuto: o app é todo dado clínico vivo, e cachear resposta
  de indicador ou de medicamento faria o aluno ver informação velha achando que é
  a de agora. O que fica offline é só a casca — o resto vai à rede sempre.
*/

// v2: ícones trocados pela marca Atitude Vital — o número novo descarta os velhos.
const CACHE = 'saude-conectada-v2'

// Só o que é estático e nunca muda de significado.
const ESSENCIAIS = [
  '/offline',
  '/icones/icone-192.png',
  '/icones/icone-512.png',
  '/marca/logo.png',
]

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ESSENCIAIS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) =>
        Promise.all(
          chaves.filter((chave) => chave !== CACHE).map((chave) => caches.delete(chave))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (evento) => {
  const { request } = evento

  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Navegação sem rede cai numa página que explica, em vez do dino do Chrome.
  if (request.mode === 'navigate') {
    evento.respondWith(
      fetch(request).catch(() => caches.match('/offline'))
    )
    return
  }

  // Ícones e imagens podem vir do cache; dado nunca.
  if (url.pathname.startsWith('/icones/') || url.pathname.startsWith('/marca/')) {
    evento.respondWith(
      caches.match(request).then((resposta) => resposta ?? fetch(request))
    )
  }
})

// ── Notificações push ────────────────────────────────────────────

self.addEventListener('push', (evento) => {
  let dados = {}

  try {
    dados = evento.data ? evento.data.json() : {}
  } catch {
    dados = { titulo: 'Central de Saúde Conectada', corpo: evento.data?.text() }
  }

  const titulo = dados.titulo || 'Central de Saúde Conectada'

  evento.waitUntil(
    self.registration.showNotification(titulo, {
      body: dados.corpo || '',
      icon: '/icones/icone-192.png',
      badge: '/icones/icone-192.png',
      tag: dados.tag || 'geral',
      // Lembrete de medicamento substitui o anterior em vez de empilhar.
      renotify: Boolean(dados.tag),
      requireInteraction: dados.urgente === true,
      data: { url: dados.url || '/home' },
      actions: dados.acoes || [],
    })
  )
})

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()

  const destino = evento.notification.data?.url || '/home'

  evento.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((janelas) => {
        // Reaproveita uma aba aberta em vez de abrir outra.
        for (const janela of janelas) {
          if (janela.url.includes(destino) && 'focus' in janela) {
            return janela.focus()
          }
        }
        return self.clients.openWindow(destino)
      })
  )
})
