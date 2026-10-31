import { useEffect, useState } from 'react';
import { clearFocusSessions, getStudyAccount, loadFocusSessions } from './study-db';
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
    window.addEventListener('fakker-focus-sessions-changed', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    void refresh();
    return () => {
      active = false;
      channel?.close();
      window.removeEventListener('fakker-focus-sessions-changed', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  const clearSessions = async () => {
    await clearFocusSessions();
    setSessions([]);
    setError(null);
    window.dispatchEvent(new Event('fakker-focus-sessions-changed'));
    // Notifications are best-effort: a committed deletion must not be reported
    // as a storage failure when a browser blocks cross-tab messaging.
    try {
      if ('BroadcastChannel' in window) {
        const channel = new BroadcastChannel(`fakker-focus-${getStudyAccount() ?? 'guest'}`);
        channel.postMessage('sessions-cleared');
        channel.close();
      }
    } catch { /* Other tabs refresh on focus / visibility change as well. */ }
  };

  return { sessions, loading, error, clearSessions };
}
