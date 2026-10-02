// Loaded by the generated service worker (workbox importScripts) to show push notifications.
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  event.waitUntil(self.registration.showNotification(data.title || 'MKHub', {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/favicon-48.png',
    tag: data.tag,
    data: { url: data.url || '/' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const open = windows.find((client) => 'focus' in client)
    if (open) return open.navigate(url).then((client) => (client || open).focus())
    return self.clients.openWindow(url)
  }))
})
