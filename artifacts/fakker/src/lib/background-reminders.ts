import type { StudyData } from './study-db';
import type { PushPlan, PushConfig, PushStatus } from '@workspace/api-client-react';
import { reminderTime } from './reminders';

const TOKEN = 'fakker-push-device';
const ENABLED = 'fakker-push-enabled';
const api = '/api/push';
export const pushSupported = () => window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const backgroundEnabled = () => localStorage.getItem(ENABLED) === 'true';
function setEnabled(active: boolean) {
  if (active) localStorage.setItem(ENABLED, 'true');
  else localStorage.removeItem(ENABLED);
  window.dispatchEvent(new Event('fakker-push-changed'));
}
let pending: Promise<unknown> = Promise.resolve();
// Serialize the entire read -> remote update -> local write, including across
// tabs, so focus/reconnect reconciliation cannot restore a deleted reminder.
export async function withReminderLock<T>(work: () => Promise<T>): Promise<T> {
  if (navigator.locks) return navigator.locks.request('fakker-reminder-data', work);
  const result = pending.then(work, work);
  pending = result.catch(() => undefined);
  return result;
}
function token() {
  let value = localStorage.getItem(TOKEN);
  if (!value) {
    value = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(TOKEN, value);
  }
  return value;
}
async function request(path: string, init: RequestInit = {}) {
  let response: Response;
  try {
    response = await fetch(`${api}${path}`, {
      ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}`, ...init.headers },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Error('تعذّر الاتصال بخادم التذكيرات. تحقّق من الإنترنت ثم أعد المحاولة؛ لم يُؤكّد التغيير.');
  }
  if (!response.ok) throw new Error('تعذّر الاتصال بخادم التذكيرات. أعد المحاولة مع اتصال بالإنترنت؛ لم يُؤكّد التغيير.');
  return response;
}
async function registration() {
  return navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL });
}
async function readyRegistration() {
  await registration();
  return navigator.serviceWorker.ready;
}
function schedule(data: StudyData): PushPlan['reminders'] {
  if (!data.settings.notificationsEnabled) return [];
  return data.tasks.filter(task => task.status !== 'completed' && Date.parse(task.dueAt) > Date.now())
    .map(task => ({
      id: task.id, title: task.title,
      remindAt: new Date(reminderTime(task, data.settings.reminderLeadMinutes)).toISOString(),
      dueAt: task.dueAt,
    }));
}
async function upload(subscription: PushSubscription, data: StudyData) {
  const serialized = subscription.toJSON();
  const plan: PushPlan = {
    subscription: { endpoint: subscription.endpoint, keys: { p256dh: serialized.keys!.p256dh, auth: serialized.keys!.auth } },
    reminders: schedule(data),
  };
  await request('/subscription', { method: 'PUT', body: JSON.stringify(plan) });
}
export async function syncBackgroundReminders(data: StudyData) {
  if (!backgroundEnabled()) return;
  if (!pushSupported() || Notification.permission !== 'granted') {
    await request('/subscription', { method: 'DELETE' });
    setEnabled(false);
    throw new Error('توقفت إشعارات الخلفية. تبقى التذكيرات داخل التطبيق متاحة؛ فعّل الإشعارات مجددًا من الإعدادات.');
  }
  const subscription = await (await readyRegistration()).pushManager.getSubscription();
  if (!subscription) {
    await request('/subscription', { method: 'DELETE' });
    setEnabled(false);
    throw new Error('انتهى اشتراك الخلفية. فعّله مجددًا من الإعدادات.');
  }
  await upload(subscription, data);
}
export async function enableBackgroundReminders(data: StudyData, permissionRequest: Promise<NotificationPermission>) {
  if (!pushSupported()) throw new Error('إشعارات الخلفية غير مدعومة هنا. افتح فَكّر في متصفح داعم عبر اتصال آمن.');
  // Only called directly from the explicit enable button, before any await.
  const permission = await permissionRequest;
  if (permission !== 'granted') throw new Error('لم يُمنح إذن الإشعارات. تبقى التذكيرات داخل التطبيق متاحة دون هذا الإذن.');
  const config: PushConfig = await (await request('/config')).json();
  const bytes = Uint8Array.from(atob(config.publicKey.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
  const reg = await readyRegistration();
  let subscription = await reg.pushManager.getSubscription();
  // A changed server key requires a fresh browser subscription.
  if (subscription?.options.applicationServerKey && btoa(String.fromCharCode(...new Uint8Array(subscription.options.applicationServerKey))).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_') !== config.publicKey) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
  try {
    await upload(subscription, data);
    setEnabled(true);
  } catch (error) {
    await subscription.unsubscribe();
    throw error;
  }
}
export async function disableBackgroundReminders() {
  // Cancel on the server first. Do not claim success when cancellation is offline.
  await request('/subscription', { method: 'DELETE' });
  setEnabled(false);
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
      const subscription = await reg?.pushManager.getSubscription();
      if (subscription) await subscription.unsubscribe();
      const notifications = await reg?.getNotifications();
      notifications?.forEach(notification => notification.close());
    } catch {
      throw new Error('أُلغيت المواعيد على الخادم. تعذّر تنظيف اشتراك المتصفح محليًا؛ يمكنك إغلاق الصفحة وإعادة فتحها.');
    }
  }
}
export const backgroundStatus = () => withReminderLock(async () => {
  if (!backgroundEnabled()) return false;
  const result: PushStatus = await (await request('/subscription')).json();
  if (!result.active) setEnabled(false);
  return result.active;
});
