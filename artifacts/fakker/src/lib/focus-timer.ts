export type FocusTimerState = {
  version: 1;
  phase: 'focus' | 'break';
  status: 'idle' | 'running' | 'paused' | 'completed';
  focusMinutes: number;
  breakMinutes: number;
  taskId: string | null;
  remainingMs: number;
  endsAt: number | null;
};

export type TimerAction =
  | { type: 'configure'; focusMinutes: number; breakMinutes: number; taskId: string | null }
  | { type: 'start' | 'pause' | 'reset' | 'next' | 'reconcile' };

export const initialFocusTimer = (): FocusTimerState => ({
  version: 1, phase: 'focus', status: 'idle', focusMinutes: 25,
  breakMinutes: 5, taskId: null, remainingMs: 25 * 60_000, endsAt: null,
});

export function validateFocusTimer(value: unknown): FocusTimerState {
  const s = value as FocusTimerState | null;
  if (!s || s.version !== 1 || !['focus', 'break'].includes(s.phase)
    || !['idle', 'running', 'paused', 'completed'].includes(s.status)
    || !Number.isInteger(s.focusMinutes) || s.focusMinutes < 1 || s.focusMinutes > 120
    || !Number.isInteger(s.breakMinutes) || s.breakMinutes < 1 || s.breakMinutes > 60
    || !(s.taskId === null || typeof s.taskId === 'string')
    || !Number.isFinite(s.remainingMs) || s.remainingMs < 0
    || s.remainingMs > (s.phase === 'focus' ? s.focusMinutes : s.breakMinutes) * 60_000
    || (s.status === 'running'
      ? typeof s.endsAt !== 'number' || !Number.isFinite(s.endsAt) || s.endsAt <= 0
      : s.endsAt !== null)) {
    throw new Error('تعذّرت قراءة حالة المؤقّت المحفوظة. لم تتغير مهامك أو موادك.');
  }
  return s;
}

export function remainingTime(state: FocusTimerState, now: number): number {
  return state.status === 'running' ? Math.max(0, state.endsAt! - now) : state.remainingMs;
}

export function transitionTimer(state: FocusTimerState, action: TimerAction, now: number): FocusTimerState {
  let s = state;
  if (s.status === 'running' && remainingTime(s, now) === 0) {
    s = { ...s, status: 'completed', remainingMs: 0, endsAt: null };
  }
  switch (action.type) {
    case 'reconcile': return s;
    case 'configure':
      if (s.status !== 'idle') return s;
      return validateFocusTimer({
        ...s, focusMinutes: action.focusMinutes, breakMinutes: action.breakMinutes,
        taskId: action.taskId, remainingMs: action.focusMinutes * 60_000,
      });
    case 'start':
      return s.status === 'idle' || s.status === 'paused'
        ? { ...s, status: 'running', endsAt: now + s.remainingMs } : s;
    case 'pause':
      return s.status === 'running'
        ? { ...s, status: 'paused', remainingMs: remainingTime(s, now), endsAt: null } : s;
    case 'reset':
      return { ...s, phase: 'focus', status: 'idle', remainingMs: s.focusMinutes * 60_000, endsAt: null };
    case 'next': {
      if (s.status !== 'completed') return s;
      const phase = s.phase === 'focus' ? 'break' : 'focus';
      const remainingMs = (phase === 'focus' ? s.focusMinutes : s.breakMinutes) * 60_000;
      return { ...s, phase, status: 'running', remainingMs, endsAt: now + remainingMs };
    }
  }
}
