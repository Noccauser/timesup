/* Time's Up nocca: keeps a copy of the game so it opens without internet.
   - The game page: internet first (so updates still arrive), the saved copy if there is no connection
     or if it takes more than 4 seconds.
   - Icon, fonts and libraries: the saved copy first, refreshed in the background. */
const CACHE = "tu-nocca-v1";
const PAGE = "./";
const PRECACHE = ["./", "./icon.png"];
const LIBS = [
  "https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js",
  "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js"
];
const CDN_HOSTS = ["cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(PRECACHE);
    // Libraries for the phone mode: nice to have, never block the install.
    await Promise.all(LIBS.map((u) => fetch(u).then((r) => r.ok && c.put(u, r)).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

function isPage(req, url) {
  return req.mode === "navigate" || (url.origin === location.origin && /\/(index\.html)?$/.test(url.pathname));
}

async function pageFirstNetwork(req) {
  const c = await caches.open(CACHE);
  const net = fetch(req).then((res) => {
    if (res.ok) c.put(PAGE, res.clone());
    return res;
  });
  const slow = new Promise((resolve) => setTimeout(resolve, 4000));
  try {
    const res = await Promise.race([net, slow.then(() => null)]);
    if (res) return res;
  } catch (e) { /* offline: use the saved copy */ }
  const saved = await c.match(PAGE, { ignoreSearch: true });
  return saved || net;
}

async function savedFirst(req) {
  const c = await caches.open(CACHE);
  const saved = await c.match(req, { ignoreSearch: req.url.startsWith(location.origin) });
  const net = fetch(req).then((res) => {
    if (res.ok || res.type === "opaque") c.put(req, res.clone());
    return res;
  }).catch(() => saved);
  return saved || net;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // The app's own "is there a new version?" check must always ask GitHub.
  if (url.origin === location.origin && url.searchParams.has("check")) return;
  if (isPage(req, url) && url.origin === location.origin) { e.respondWith(pageFirstNetwork(req)); return; }
  if (url.origin === location.origin || CDN_HOSTS.includes(url.hostname)) e.respondWith(savedFirst(req));
});
