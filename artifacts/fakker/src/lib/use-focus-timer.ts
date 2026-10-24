import { useCallback, useEffect, useRef, useState } from 'react';
import { getStudyAccount, updateFocusTimer } from './study-db';
import { remainingTime, type FocusTimerState, type TimerAction } from './focus-timer';

export function useFocusTimer() {
  const [state, setState] = useState<FocusTimerState | null>(null);
  const [now, setNow] = useState(Date.now);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const mounted = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const run = useCallback(async (action: TimerAction) => {
    if (pending.current) return false;
    pending.current = true;
    const interactive = action.type !== 'reconcile';
    if (interactive) setBusy(true);
    try {
      const result = await updateFocusTimer(action);
      if (mounted.current) { setState(result.state); setNow(Date.now()); setError(null); }
      if (action.type !== 'reconcile' || result.sessionRecorded) channel.current?.postMessage('changed');
      return true;
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'تعذّر حفظ المؤقّت.');
      return false;
    } finally {
      pending.current = false;
      if (mounted.current && interactive) setBusy(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    if ('BroadcastChannel' in window) {
      channel.current = new BroadcastChannel(`fakker-focus-${getStudyAccount() ?? 'guest'}`);
      channel.current.onmessage = () => { void run({ type: 'reconcile' }); };
    }
    const reconcile = () => { void run({ type: 'reconcile' }); };
    reconcile();
    // The deadline, not this interval, is the clock. Re-reading also catches
    // data clearing and changes in other tabs when BroadcastChannel is absent.
    const sync = window.setInterval(reconcile, 2000);
    const tick = window.setInterval(() => setNow(Date.now()), 250);
    window.addEventListener('focus', reconcile);
    document.addEventListener('visibilitychange', reconcile);
    return () => {
      mounted.current = false;
      window.clearInterval(sync); window.clearInterval(tick);
      window.removeEventListener('focus', reconcile);
      document.removeEventListener('visibilitychange', reconcile);
      channel.current?.close(); channel.current = null;
    };
  }, [run]);
  const remainingMs = state ? remainingTime(state, now) : 0;
  useEffect(() => {
    if (state?.status === 'running' && remainingMs === 0 && !busy && !error) void run({ type: 'reconcile' });
  }, [state, remainingMs, busy, error, run]);

  return {
    state, remainingMs, busy, error,
    start: () => run({ type: 'start' }),
    pause: () => run({ type: 'pause' }),
    reset: () => run({ type: 'reset' }),
    next: () => run({ type: 'next' }),
    configure: (focusMinutes: number, breakMinutes: number, taskId: string | null) =>
      run({ type: 'configure', focusMinutes, breakMinutes, taskId }),
  };
}
