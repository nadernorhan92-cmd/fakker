import type { Task } from './study-db';

export function reminderTime(task: Task, leadMinutes: number): number {
  return task.reminderAt ? Date.parse(task.reminderAt) : Date.parse(task.dueAt) - leadMinutes * 60_000;
}
export function reminderKey(task: Task, leadMinutes: number): string {
  return `${task.id}:${reminderTime(task, leadMinutes)}`;
}
export function getDueReminders(tasks: Task[], leadMinutes: number, notified: ReadonlySet<string>, now = Date.now()): Task[] {
  return tasks.filter(task => {
    const time = reminderTime(task, leadMinutes);
    return task.status !== 'completed' && Number.isFinite(time) && time <= now &&
      Date.parse(task.dueAt) >= now && !notified.has(reminderKey(task, leadMinutes));
  }).sort((a, b) => reminderTime(a, leadMinutes) - reminderTime(b, leadMinutes));
}
