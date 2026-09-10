const CACHE_NAME = "rybny-analytics-shell-v4";
const CACHE_NAME = "rybny-analytics-shell-v8";
const APP_SHELL = ["/", "/manifest.webmanifest?v=8", "/manifest-dark.webmanifest?v=8", "/manifest-light.webmanifest?v=8", "/manus-storage/rybny_circle_dark_transparent_v8_03811f3b.png?v=8", "/manus-storage/rybny_circle_light_transparent_v8_bb483d15.png?v=8"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || event.request.url.includes("/api/")) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/")));
  }
});

self.addEventListener("push", event => {
  const payload = event.data?.json?.() || { title: "Аналитика «Рыбный»", body: "Новое уведомление" };
  event.waitUntil(self.registration.showNotification(payload.title || "Аналитика «Рыбный»", {
    body: payload.body || "Новое уведомление",
    icon: payload.icon || "/manus-storage/rybny_circle_dark_transparent_v8_03811f3b.png?v=8",
    badge: payload.badge || "/manus-storage/rybny_circle_dark_transparent_v8_03811f3b.png?v=8",
    data: payload.data || { url: "/notifications" },
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const destination = event.notification.data?.url || "/notifications";
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(windows => {
    const client = windows[0];
    return client ? client.focus().then(() => client.navigate(destination)) : clients.openWindow(destination);
  }));
});
