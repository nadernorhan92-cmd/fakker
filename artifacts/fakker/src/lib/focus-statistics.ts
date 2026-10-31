import type { FocusSession } from './focus-timer';

export type FocusPeriod = 'week' | 'month' | 'custom' | 'all';
export type FocusRange = { start: string; end: string };

export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function focusRange(period: FocusPeriod, custom: FocusRange, now = new Date()): FocusRange | null {
  if (period === 'all') return null;
  if (period === 'custom') return custom;
  const start = new Date(now);
  start.setDate(start.getDate() - (period === 'week' ? 6 : 29));
  return { start: localDayKey(start), end: localDayKey(now) };
}

function validDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && localDayKey(date) === value;
}

export function focusRangeError(range: FocusRange | null): string | null {
  if (!range) return null;
  if (!validDay(range.start) || !validDay(range.end)) return 'اختر تاريخ البداية وتاريخ النهاية لعرض الإحصاءات.';
  if (range.start > range.end) return 'تاريخ البداية يجب أن يسبق تاريخ النهاية أو يساويه.';
  return null;
}

// Filtering is a read-only view. Never persist the filtered subset over the
// complete local session history or include it in plan/backup payloads.
export function summarizeFocus(sessions: FocusSession[], range: FocusRange | null) {
  const error = focusRangeError(range);
  const filtered = error ? [] : sessions.filter(session => {
    const day = localDayKey(new Date(session.completedAt));
    return !range || (day >= range.start && day <= range.end);
  }).sort((a, b) => b.completedAt - a.completedAt);
  const days = new Map<string, { key: string; count: number; totalMs: number }>();
  const tasks = new Map<string | null, { taskId: string | null; count: number; totalMs: number }>();
  let totalMs = 0;
  for (const session of filtered) {
    totalMs += session.durationMs;
    const key = localDayKey(new Date(session.completedAt));
    const day = days.get(key) ?? { key, count: 0, totalMs: 0 };
    day.count++;
    day.totalMs += session.durationMs;
    days.set(key, day);
    const task = tasks.get(session.taskId) ?? { taskId: session.taskId, count: 0, totalMs: 0 };
    task.count++;
    task.totalMs += session.durationMs;
    tasks.set(session.taskId, task);
  }
  return {
    error, sessions: filtered, totalMs,
    days: [...days.values()].sort((a, b) => a.key.localeCompare(b.key)),
    tasks: [...tasks.values()].sort((a, b) => b.totalMs - a.totalMs),
  };
}
