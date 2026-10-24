import type { Subject, Task } from './study-db';
import type { ReviewPlan } from './spaced-review';

export type StudyBackup = {
  format: 'fakker-backup'; version: 2; createdAt: string;
  subjects: Subject[]; tasks: Task[]; reviewPlans: ReviewPlan[];
};
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

export function makeBackup(
  subjects: Subject[], tasks: Task[], reviewPlans: ReviewPlan[] = [], includeReviewPlans = true,
): StudyBackup {
  const backupTasks = includeReviewPlans ? tasks : tasks.map(({ reviewPlanId: _planId, reviewOffsetDays: _offset, ...task }) => task);
  return {
    format: 'fakker-backup', version: 2, createdAt: new Date().toISOString(),
    subjects, tasks: backupTasks, reviewPlans: includeReviewPlans ? reviewPlans : [],
  };
}

export function parseBackup(raw: string): StudyBackup {
  if (new TextEncoder().encode(raw).byteLength > 5 * 1024 * 1024) throw new Error('حجم النسخة أكبر من الحد المسموح: ٥ ميجابايت.');
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return fail(); }
  const value = record(parsed);
  if (value.format !== 'fakker-backup' || ![1, 2].includes(value.version as number) || !Array.isArray(value.subjects) ||
    !Array.isArray(value.tasks) || value.subjects.length > 10000 || value.tasks.length > 10000) return fail();
  const version = value.version as number;
  if (version === 2 && (!Array.isArray(value.reviewPlans) || value.reviewPlans.length > 10000)) return fail();
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
    let reviewPlanId: string | undefined;
    let reviewOffsetDays: number | undefined;
    if (version === 2 && t.reviewPlanId !== undefined) {
      reviewPlanId = text(t.reviewPlanId, 100);
      if (!Number.isInteger(t.reviewOffsetDays) || (t.reviewOffsetDays as number) < 1 || (t.reviewOffsetDays as number) > 365) return fail();
      reviewOffsetDays = t.reviewOffsetDays as number;
    } else if (version === 2 && t.reviewOffsetDays !== undefined) return fail();
    return {
      id: text(t.id, 100), title: text(t.title, 120), description: optionalText(t.description, 500), subjectId,
      type: oneOf(t.type, ['homework', 'study', 'project', 'exam'] as const), dueAt: date(t.dueAt),
      priority: oneOf(t.priority, ['low', 'medium', 'high'] as const), status,
      completedAt: status === 'completed' ? optionalDate(t.completedAt) : undefined,
      reminderAt: optionalDate(t.reminderAt), studyStart, studyEnd,
      reviewPlanId, reviewOffsetDays,
    };
  });
  if (new Set(tasks.map(t => t.id)).size !== tasks.length) return fail();
  const reviewPlans: ReviewPlan[] = version === 1 ? [] : (value.reviewPlans as unknown[]).map(item => {
    const p = record(item);
    if (!Array.isArray(p.intervals) || !p.intervals.length || p.intervals.length > 12 ||
        typeof p.cancelled !== 'undefined' && typeof p.cancelled !== 'boolean') return fail();
    const intervals = p.intervals.map(offset => {
      if (!Number.isInteger(offset) || (offset as number) < 1 || (offset as number) > 365) return fail();
      return offset as number;
    });
    if (new Set(intervals).size !== intervals.length) return fail();
    const sourceTaskId = optionalText(p.sourceTaskId, 100);
    if (sourceTaskId && !tasks.some(task => task.id === sourceTaskId && !task.reviewPlanId)) return fail();
    const subjectId = text(p.subjectId, 100);
    if (!subjectIds.has(subjectId)) return fail();
    return {
      id: text(p.id, 100), lesson: text(p.lesson, 120), subjectId, sourceTaskId,
      baseAt: date(p.baseAt), intervals: [...intervals].sort((a, b) => a - b),
      ...(p.cancelled === true ? { cancelled: true } : {}),
    };
  });
  if (new Set(reviewPlans.map(plan => plan.id)).size !== reviewPlans.length) return fail();
  const planIds = new Set(reviewPlans.map(plan => plan.id));
  if (tasks.some(task => task.reviewPlanId !== undefined && !planIds.has(task.reviewPlanId))) return fail();
  return { format: 'fakker-backup', version: 2, createdAt: date(value.createdAt), subjects, tasks, reviewPlans };
}
