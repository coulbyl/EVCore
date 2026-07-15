// EVCore — Service Worker minimal
// Cache statique uniquement. Pas de cache métier (données API exclues).

const CACHE_NAME = 'evcore-static'
const IS_DEV_HOST =
  self.location.hostname === 'localhost' ||
  self.location.hostname === '127.0.0.1'

// Assets mis en cache à l'installation
const PRECACHE_ASSETS = ['/favicon.ico', '/icons/icon.svg']

self.addEventListener('install', event => {
  if (IS_DEV_HOST) {
    event.waitUntil(self.skipWaiting())
    return
  }

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', event => {
  if (IS_DEV_HOST) {
    event.waitUntil(
      caches
        .keys()
        .then(keys => Promise.all(keys.map(key => caches.delete(key))))
        .then(() => self.clients.claim()),
    )
    return
  }

  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

// Payload is the JSON string built by PushService: { title, body, url }.
self.addEventListener('push', event => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    return
  }

  const { title, body, url } = payload
  event.waitUntil(
    self.registration.showNotification(title ?? 'EVCore', {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon.svg',
      data: { url: url ?? '/dashboard' },
    }),
  )
})

// Focuses an already-open EVCore tab on that route if one exists, otherwise
// opens a new one — standard "notification click" behavior.
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const targetUrl = event.notification.data?.url ?? '/dashboard'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          const clientUrl = new URL(client.url)
          if (clientUrl.pathname === targetUrl && 'focus' in client) {
            return client.focus()
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl)
        }
      }),
  )
})

self.addEventListener('fetch', event => {
  if (IS_DEV_HOST) return

  const { request } = event

  // GET uniquement, même origine uniquement
  if (request.method !== 'GET') return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }

  if (url.origin !== self.location.origin) return

  // Exclure les routes API et les données dynamiques
  if (url.pathname.startsWith('/api/')) return

  // Cache-first pour les assets statiques Next.js et les icônes
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/favicon.ico'

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then(
        cached =>
          cached ??
          fetch(request).then(response => {
            if (response.ok) {
              const clone = response.clone()
              caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
            }
            return response
          }),
      ),
    )
  }
})
