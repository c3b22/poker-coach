// Service worker template. The build (see vite.config.ts) fills in PRECACHE and VERSION and emits sw.js.
const VERSION = '__VERSION__'
const PRECACHE = __PRECACHE__
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Anuphan:wght@400;500;600;700&display=swap'
const CACHE = `poker-coach-${VERSION}`
const FONT_CACHE = 'poker-coach-fonts'

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      await cache.addAll(PRECACHE.map((p) => new Request(p, { cache: 'reload' })))
      try {
        const fonts = await caches.open(FONT_CACHE)
        const res = await fetch(FONT_CSS)
        const css = await res.clone().text()
        await fonts.put(FONT_CSS, res)
        const urls = [...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1])
        await Promise.all(urls.map((u) => fonts.add(u).catch(() => {})))
      } catch {
        // offline at install time: the app falls back to system fonts
      }
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE && k !== FONT_CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then(async (c) => {
        const hit = await c.match(req.url)
        if (hit) return hit
        const res = await fetch(req)
        if (res.ok) c.put(req.url, res.clone())
        return res
      }),
    )
    return
  }

  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match(new URL('./', self.registration.scope).href)) ?? Response.error()),
    )
    return
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ??
        fetch(req).then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()))
          return res
        }),
    ),
  )
})
