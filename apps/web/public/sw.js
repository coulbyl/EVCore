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
