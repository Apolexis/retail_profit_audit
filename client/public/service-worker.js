const CACHE_NAME = "rybny-analytics-shell-v1";
const APP_SHELL = ["/", "/manifest.webmanifest", "/manus-storage/rybny_analytics_app_icon_909727b4.png"];

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
    icon: payload.icon || "/manus-storage/rybny_analytics_app_icon_909727b4.png",
    badge: payload.badge || "/manus-storage/rybny_analytics_app_icon_909727b4.png",
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
