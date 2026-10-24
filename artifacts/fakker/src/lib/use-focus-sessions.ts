import { useEffect, useState } from 'react';
import { getStudyAccount, loadFocusSessions } from './study-db';
import type { FocusSession } from './focus-timer';

export function useFocusSessions() {
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let pending = false;
    let refreshRequested = false;
    const refresh = async () => {
      if (pending) { refreshRequested = true; return; }
      pending = true;
      try {
        do {
          refreshRequested = false;
          const next = await loadFocusSessions();
          if (active) { setSessions(next); setError(null); }
        } while (active && refreshRequested);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'تعذّر تحميل سجل جلسات التركيز.');
      } finally {
        pending = false;
        if (active) setLoading(false);
      }
    };
    const channel = 'BroadcastChannel' in window
      ? new BroadcastChannel(`fakker-focus-${getStudyAccount() ?? 'guest'}`)
      : null;
    channel?.addEventListener('message', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    void refresh();
    return () => {
      active = false;
      channel?.close();
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  return { sessions, loading, error };
}
