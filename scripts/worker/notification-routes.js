// Notification route module. Injected at the beginning of Worker.fetch.
const __notificationsUrl = new URL(r.url);
if (__notificationsUrl.pathname === '/api/admin/notifications' && r.method === 'GET') return getAdminNotifications(r, e);
if (__notificationsUrl.pathname === '/api/admin/notifications' && r.method === 'POST') return createAdminNotification(r, e);
if (__notificationsUrl.pathname.startsWith('/api/admin/notifications/')) {
  const __parts = __notificationsUrl.pathname.split('/').filter(Boolean);
  const __action = __parts[__parts.length - 1];
  const __base = __parts.length === 4;
  const __id = clean(__parts[__parts.length - 1]);
  if (__base && r.method === 'GET') return getAdminNotification(r, e, __id);
  if (__base && r.method === 'PUT') return updateAdminNotification(r, e, __id);
  if (__base && r.method === 'DELETE') return deleteAdminNotification(r, e, __id);
  if (__action === 'publish' && r.method === 'POST') return publishAdminNotification(r, e, __parts[__parts.length - 2]);
  if (__action === 'disable' && r.method === 'POST') return disableAdminNotification(r, e, __parts[__parts.length - 2]);
  if (__action === 'archive' && r.method === 'POST') return archiveAdminNotification(r, e, __parts[__parts.length - 2]);
  if (__action === 'duplicate' && r.method === 'POST') return duplicateAdminNotification(r, e, __parts[__parts.length - 2]);
}
if (__notificationsUrl.pathname === '/api/notifications' && r.method === 'GET') return platformUserNotifications(r, e);
if (__notificationsUrl.pathname === '/api/notifications/unread' && r.method === 'GET') return platformUnreadNotifications(r, e);
if (__notificationsUrl.pathname === '/api/notifications/read-all' && r.method === 'POST') return platformMarkAllNotificationsRead(r, e);
if (__notificationsUrl.pathname.startsWith('/api/notifications/') && r.method === 'POST') return platformMarkNotificationRead(r, e, clean(__notificationsUrl.pathname.split('/').pop()));
