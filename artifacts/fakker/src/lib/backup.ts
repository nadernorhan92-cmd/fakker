import type { Subject, Task } from './study-db';

export type StudyBackup = { format: 'fakker-backup'; version: 1; createdAt: string; subjects: Subject[]; tasks: Task[] };
const fail = (): never => { throw new Error('الملف ليس نسخة احتياطية صالحة لفَكّر. لم تتغير بياناتك.'); };
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : fail();
const text = (value: unknown, max: number): string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max ? value : fail();
const optionalText = (value: unknown, max: number): string | undefined =>
  value === undefined || value === null || value === '' ? undefined : text(value, max);
const date = (value: unknown): string => {
  const result = text(value, 60);
  return Number.isFinite(Date.parse(result)) ? result : fail();
};
const optionalDate = (value: unknown): string | undefined =>
  value === undefined || value === null || value === '' ? undefined : date(value);
const oneOf = <T extends string>(value: unknown, choices: readonly T[]): T =>
  typeof value === 'string' && choices.includes(value as T) ? value as T : fail();

export function makeBackup(subjects: Subject[], tasks: Task[]): StudyBackup {
  return { format: 'fakker-backup', version: 1, createdAt: new Date().toISOString(), subjects, tasks };
}

export function parseBackup(raw: string): StudyBackup {
  if (new TextEncoder().encode(raw).byteLength > 5 * 1024 * 1024) throw new Error('حجم النسخة أكبر من الحد المسموح: ٥ ميجابايت.');
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return fail(); }
  const value = record(parsed);
  if (value.format !== 'fakker-backup' || value.version !== 1 || !Array.isArray(value.subjects) ||
    !Array.isArray(value.tasks) || value.subjects.length > 10000 || value.tasks.length > 10000) return fail();
  const subjects = value.subjects.map(item => {
    const s = record(item);
    const color = text(s.color, 7);
    if (!/^#[0-9a-f]{6}$/i.test(color)) return fail();
    return { id: text(s.id, 100), name: text(s.name, 80), color, teacher: optionalText(s.teacher, 80), description: optionalText(s.description, 300) };
  });
  const subjectIds = new Set(subjects.map(s => s.id));
  if (subjectIds.size !== subjects.length) return fail();
  const tasks = value.tasks.map(item => {
    const t = record(item);
    const subjectId = optionalText(t.subjectId, 100);
    if (subjectId && !subjectIds.has(subjectId)) return fail();
    const studyStart = optionalDate(t.studyStart), studyEnd = optionalDate(t.studyEnd);
    if (Boolean(studyStart) !== Boolean(studyEnd) || (studyStart && studyEnd && Date.parse(studyEnd) <= Date.parse(studyStart))) return fail();
    const status = oneOf(t.status, ['not-started', 'in-progress', 'completed'] as const);
    return {
      id: text(t.id, 100), title: text(t.title, 120), description: optionalText(t.description, 500), subjectId,
      type: oneOf(t.type, ['homework', 'study', 'project', 'exam'] as const), dueAt: date(t.dueAt),
      priority: oneOf(t.priority, ['low', 'medium', 'high'] as const), status,
      completedAt: status === 'completed' ? optionalDate(t.completedAt) : undefined,
      reminderAt: optionalDate(t.reminderAt), studyStart, studyEnd,
    };
  });
  if (new Set(tasks.map(t => t.id)).size !== tasks.length) return fail();
  return { format: 'fakker-backup', version: 1, createdAt: date(value.createdAt), subjects, tasks };
}
