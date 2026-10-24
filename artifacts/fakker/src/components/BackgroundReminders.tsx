import { useEffect, useState } from 'react';
import { loadStudyData, saveSettings } from '@/lib/study-db';
import {
  backgroundEnabled, backgroundStatus, disableBackgroundReminders,
  enableBackgroundReminders, pushSupported, withReminderLock,
} from '@/lib/background-reminders';

export default function BackgroundReminders({ onUpdated }: { onUpdated: () => Promise<void> }) {
  const [active, setActive] = useState(backgroundEnabled);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const supported = pushSupported();
  useEffect(() => {
    void backgroundStatus().then(setActive).catch(() => setMessage('تعذّر التحقق من الاشتراك. تحقّق من اتصالك وأعد المحاولة.'));
    const changed = () => setActive(backgroundEnabled());
    window.addEventListener('storage', changed);
    window.addEventListener('fakker-push-changed', changed);
    return () => {
      window.removeEventListener('storage', changed);
      window.removeEventListener('fakker-push-changed', changed);
    };
  }, []);
  async function toggle() {
    setBusy(true); setMessage('');
    try {
      if (active) await withReminderLock(disableBackgroundReminders);
      else {
        // Start the permission request during the user gesture, not after loading data.
        const permission = Notification.requestPermission();
        const data = await loadStudyData();
        await saveSettings({ ...data.settings, notificationsEnabled: true });
        await onUpdated();
        await withReminderLock(async () => enableBackgroundReminders(await loadStudyData(), permission));
      }
      setActive(backgroundEnabled());
      setMessage(active ? 'أُلغيت تذكيرات الخلفية وحُذفت المواعيد المجدولة من الخادم.' : 'فُعّلت تذكيرات الخلفية. تصل مواعيد المهام عندما يكون خيار «تذكيرات داخل التطبيق» مفعّلًا.');
    } catch (error) {
      setActive(backgroundEnabled());
      setMessage(error instanceof Error && /[\u0600-\u06ff]/.test(error.message) ? error.message : 'تعذّر تفعيل إشعارات الخلفية. قد يمنعها التصفح الخاص أو المعاينة داخل إطار؛ افتح التطبيق مباشرة في نافذة عادية بمتصفح داعم، وراجع إذن الإشعارات. تبقى التذكيرات داخل التطبيق متاحة.');
    }
    finally { setBusy(false); }
  }
  return <div>
    <div className="setting-row"><div className="setting-copy">
      <strong>تذكيرات بعد إغلاق الصفحة</strong>
      <small>عند التفعيل نرسل عنوان المهمة وموعدها واشتراك هذا المتصفح إلى الخادم لجدولة الإشعار، دون نقل موادك أو ملاحظاتك. يمكنك إلغاء الاشتراك وحذف هذه المواعيد من هنا.</small>
      <small>تحتاج اتصالًا بالإنترنت وخادمًا يعمل باستمرار ونافذة عادية؛ قد يمنعها التصفح الخاص أو المعاينة داخل إطار. قد تتأخر الإشعارات بسبب توفير الطاقة أو عدم الإزعاج أو إيقاف المتصفح والنظام لها؛ لا نضمن وصولها في هذه الحالات. على iPhone وiPad قد يلزم إضافة فَكّر إلى الشاشة الرئيسية وفتحه منها (iOS 16.4 أو أحدث).</small>
      {!supported && <small>هذا السياق لا يدعم إشعارات الخلفية. جرّب فتح التطبيق مباشرة خارج المعاينة في متصفح داعم؛ تبقى التذكيرات داخل التطبيق متاحة.</small>}
      {supported && Notification.permission === 'denied' && <small>الإذن مرفوض حاليًا. يمكنك السماح به من إعدادات الموقع في المتصفح ثم إعادة التفعيل. التذكيرات داخل التطبيق لا تحتاج هذا الإذن.</small>}
    </div><button className={`btn ${active ? 'danger' : 'soft'} small`} style={{ minWidth: 145, flexShrink: 0 }} data-testid={active ? 'button-disable-push' : 'button-enable-notifications'} disabled={busy || (!supported && !active)} onClick={() => void toggle()}>
      {busy ? 'جارٍ التحديث…' : active ? 'إلغاء اشتراك الخلفية' : 'تفعيل إشعارات الخلفية'}
    </button></div>
    <p className="quiet" role="status" data-testid="push-status">{message || (active ? 'اشتراك الخلفية مفعّل لهذا المتصفح.' : 'اشتراك الخلفية غير مفعّل.')}</p>
  </div>;
}
