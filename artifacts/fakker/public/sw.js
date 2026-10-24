/* No offline caching: the worker's only role is receiving study reminders. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    if (!event.data) return;
    try {
      const receipt = event.data.json();
      // Revalidate queued messages so deleted/completed tasks and revoked
      // subscriptions cannot display stale reminders.
      const response = await fetch('/api/push/delivery', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(receipt), cache: 'no-store',
      });
      if (!response.ok) return;
      const reminder = await response.json();
      await self.registration.showNotification('تذكير من فَكّر', {
        body: `حان وقت ${reminder.title}`, dir: 'rtl', lang: 'ar',
        tag: `fakker-${receipt.id}`,
        data: { taskId: reminder.taskId },
      });
    } catch {
      // No stale content or invented success when network validation fails.
    }
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = new URL('tasks', self.registration.scope).href;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => client.url.startsWith(self.registration.scope));
    if (existing) { await existing.navigate(target); await existing.focus(); }
    else await self.clients.openWindow(target);
  })());
});
