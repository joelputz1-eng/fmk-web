/*
 * Service Worker von Hand — bewusst ohne Workbox.
 *
 * Der Bedarf ist klein: die App-Huelle offline verfuegbar halten, damit die
 * Spieldaten aus IndexedDB auch ohne Netz erreichbar sind. Alles Weitere
 * (Push, Background-Sync, Offline-Browsen der Promi-Packs) ist ausdruecklich
 * nicht Aufgabe dieser Datei.
 *
 * Kein skipWaiting: eine neue Fassung uebernimmt erst, wenn alle Tabs zu sind.
 * Sonst koennte mitten in einer laufenden Runde der Unterbau ausgetauscht
 * werden — und eine halbfertige Runde ist weg.
 *
 * DIESE DATEI IST EINE VORLAGE. Ausgeliefert wird public/sw.js, das
 * scripts/build-sw.mjs nach jedem `next build` daraus erzeugt — die
 * Platzhalter unten bekommen dabei die Build-ID und die echte Asset-Liste.
 * public/sw.js von Hand zu bearbeiten bringt nichts, es wird ueberschrieben.
 */

/**
 * Die Build-ID wandert in den Cache-Namen UND in diese Datei — beides ist
 * noetig: ohne Aenderung am Worker-Inhalt bemerkt der Browser keine neue
 * Fassung und installiert nie nach.
 */
const BUILD_ID = '__BUILD_ID__';
const CACHE_NAME = `fmk-${BUILD_ID}`;

/**
 * Seiten und Assets, die beim Installieren geholt werden.
 *
 * Die Route-Chunks muessen mit rein: Next benennt sie inhaltsgehasht, und wer
 * eine Seite offline oeffnet, deren Chunk nie geladen wurde, bekommt sonst
 * einen ChunkLoadError und eine weisse Seite. Die Liste kommt deshalb aus dem
 * Build-Manifest, nicht aus dem Kopf.
 */
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // addAll bricht komplett ab, wenn eine einzige Adresse fehlschlaegt —
      // deshalb jede fuer sich, ein fehlender Eintrag ist kein Drama.
      Promise.all(
        PRECACHE.map((url) => cache.add(url).catch(() => undefined)),
      ),
    ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

/** Inhaltsgehashte Next-Assets und Icons — unveraenderlich, also zuerst Cache. */
function isImmutable(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname === '/manifest.webmanifest' ||
    /^\/(icon|apple-touch-icon)[\w.-]*\.(png|svg)$/.test(url.pathname)
  );
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

/**
 * Netz zuerst, Cache als Auffangnetz. Andersherum wuerde eine alte Seite
 * kleben bleiben — und ein kaputter Cache-Eintrag waere nicht mehr loszuwerden.
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Nichts im Cache und kein Netz: lieber die Startseite als ein Browserfehler.
    const fallback = await caches.match('/');
    if (fallback) return fallback;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  /*
   * TMDB-Routen nie cachen. Die Alterssicherung (FEATURES.md 4.6) darf nicht
   * aus einer alten Antwort bedient werden, und gecachte Packs waeren still
   * veraltet. Ohne Netz schlagen sie fehl — die Seite sagt das dann auch.
   */
  if (url.pathname.startsWith('/api/')) return;

  if (isImmutable(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
  }
});
