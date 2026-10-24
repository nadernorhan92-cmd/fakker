import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@clerk/react';
import { setStudyAccount } from '@/lib/study-db';
import { backgroundEnabled, disableBackgroundReminders, withReminderLock } from '@/lib/background-reminders';

// A document keeps one local namespace for its entire lifetime. Reloading on
// auth transitions prevents in-flight writes from ever landing in another DB.
export default function AccountWorkspace({ children }: { children: ReactNode }) {
  const { isLoaded, userId } = useAuth();
  const initialized = useRef(false);
  const account = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    // The original, no-account workspace must not depend on Clerk's network
    // availability. A remembered account still waits for verified identity.
    if (!isLoaded && localStorage.getItem('fakker-last-account')) return;
    const next = userId ?? null;
    if (initialized.current) {
      if (next !== account.current) {
        void withReminderLock(async () => {
          if (backgroundEnabled()) await disableBackgroundReminders();
          // Remember the destination before reloading; otherwise an optimistic
          // guest mount could repeat the transition on every Clerk load.
          localStorage.setItem('fakker-last-account', next ?? '');
          window.location.reload();
        }).catch(() => setError('تعذّر إيقاف تذكيرات الحساب السابق. اتصل بالإنترنت وأعد المحاولة لفتح المساحة بأمان.'));
      }
      return;
    }
    let cancelled = false;
    void withReminderLock(async () => {
      const previous = localStorage.getItem('fakker-last-account') ?? '';
      if (previous !== (next ?? '') && backgroundEnabled()) await disableBackgroundReminders();
      if (cancelled) return;
      setStudyAccount(next);
      localStorage.setItem('fakker-last-account', next ?? '');
      account.current = next; initialized.current = true; setReady(true);
    }).catch(() => setError('تعذّر إيقاف تذكيرات الحساب السابق. اتصل بالإنترنت وأعد المحاولة لفتح المساحة بأمان.'));
    return () => { cancelled = true; };
  }, [isLoaded, userId, retry]);
  if (error) return <main className="page" dir="rtl"><p role="alert">{error}</p><button className="btn" onClick={() => { setError(''); setRetry(x => x + 1); }}>إعادة المحاولة</button></main>;
  if (!ready || (isLoaded && (userId ?? null) !== account.current)) return <p role="status" dir="rtl">جارٍ فتح مساحة الحفظ…</p>;
  return children;
}
