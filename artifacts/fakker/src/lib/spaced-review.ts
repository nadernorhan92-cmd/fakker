import type { Task } from './study-db';

export type ReviewDraft = {
  lesson: string; subjectId: string; sourceTaskId?: string; baseAt: string; intervals: number[];
};
export type ReviewPlan = ReviewDraft & { id: string; cancelled?: boolean };
export const isUpcomingReview = (task: Task, now = Date.now()) =>
  Boolean(task.reviewPlanId) && task.status !== 'completed' && new Date(task.dueAt).getTime() > now;

export function normalizeReviewDraft(draft: ReviewDraft): ReviewDraft {
  const lesson = draft.lesson.trim();
  if (!lesson || lesson.length > 120) throw new Error('اكتب اسم درس لا يتجاوز ١٢٠ حرفًا.');
  if (!draft.subjectId) throw new Error('اختر مادة لربط المراجعات بها.');
  if (!Number.isFinite(new Date(draft.baseAt).getTime())) throw new Error('اختر تاريخ بداية صحيحًا.');
  if (!draft.intervals.length || draft.intervals.length > 12 ||
      draft.intervals.some(day => !Number.isInteger(day) || day < 1 || day > 365)) {
    throw new Error('أدخل من فاصلة واحدة إلى ١٢ فاصلة، بأيام صحيحة بين ١ و٣٦٥.');
  }
  if (new Set(draft.intervals).size !== draft.intervals.length) throw new Error('فواصل المراجعة مكررة؛ استخدم عدد أيام مختلفًا لكل مراجعة.');
  return { ...draft, lesson, baseAt: new Date(draft.baseAt).toISOString(), intervals: [...draft.intervals].sort((a, b) => a - b) };
}

export function previewReviews(draft: ReviewDraft): { offsetDays: number; dueAt: string }[] {
  const normalized = normalizeReviewDraft(draft);
  return normalized.intervals.map(offsetDays => {
    const date = new Date(normalized.baseAt);
    // Calendar days preserve the student's local time across daylight-saving changes.
    date.setDate(date.getDate() + offsetDays);
    return { offsetDays, dueAt: date.toISOString() };
  });
}

const lessonKey = (value: string) => value.trim().replace(/\s+/g, ' ').normalize('NFKC').toLocaleLowerCase('ar');

export function sameReviewSeries(a: ReviewPlan, b: ReviewPlan): boolean {
  return a.subjectId === b.subjectId && lessonKey(a.lesson) === lessonKey(b.lesson);
}

export function sameReviewPlan(a: ReviewPlan, b: ReviewPlan): boolean {
  return a.id === b.id && sameReviewSeries(a, b) && a.sourceTaskId === b.sourceTaskId &&
    a.baseAt === b.baseAt && [...a.intervals].sort((x, y) => x - y).join(',') ===
    [...b.intervals].sort((x, y) => x - y).join(',') && Boolean(a.cancelled) === Boolean(b.cancelled);
}

// Existing plans win during restore; an identical plan ID is safe to finish
// restoring missing task links, while a duplicate lesson/source is not a new series.
export function mergeImportedReviewPlans(
  current: ReviewPlan[], incoming: ReviewPlan[],
): { plans: ReviewPlan[]; acceptedIds: Set<string> } {
  const plans = [...current];
  const acceptedIds = new Set<string>();
  for (const candidate of incoming) {
    const sameId = plans.find(plan => plan.id === candidate.id);
    if (sameId) {
      if (sameReviewPlan(sameId, candidate)) acceptedIds.add(candidate.id);
      continue;
    }
    const duplicate = plans.some(plan => !plan.cancelled && !candidate.cancelled &&
      ((candidate.sourceTaskId && plan.sourceTaskId === candidate.sourceTaskId) ||
       sameReviewSeries(plan, candidate)));
    if (duplicate) continue;
    plans.push(candidate);
    acceptedIds.add(candidate.id);
  }
  return { plans, acceptedIds };
}

export function planReviewChange(
  tasks: Task[], plans: ReviewPlan[], draft: ReviewDraft | null, planId: string,
  subjectIds: string[], now = Date.now(),
): { tasks: Task[]; plans: ReviewPlan[] } {
  const previous = plans.find(plan => plan.id === planId);
  if (!draft && (!previous || previous.cancelled)) throw new Error('لم تعد خطة المراجعة نشطة. حدّث الصفحة.');
  if (draft && previous?.cancelled) throw new Error('أُلغيت هذه الخطة بالفعل. أنشئ خطة جديدة.');
  const normalized = draft ? normalizeReviewDraft(draft) : null;
  if (normalized) {
    if (!subjectIds.includes(normalized.subjectId)) throw new Error('لم تعد المادة موجودة. اختر مادة أخرى.');
    if (normalized.sourceTaskId && !tasks.some(task => task.id === normalized.sourceTaskId && !task.reviewPlanId)) {
      throw new Error('لم تعد المهمة الأصلية موجودة. اختر مهمة أخرى أو اكتب الدرس يدويًا.');
    }
    if (plans.some(plan => plan.id !== planId && !plan.cancelled &&
      ((normalized.sourceTaskId && plan.sourceTaskId === normalized.sourceTaskId) ||
       (plan.subjectId === normalized.subjectId && lessonKey(plan.lesson) === lessonKey(normalized.lesson))))) {
      throw new Error('توجد خطة مراجعة لهذا الدرس بالفعل. عدّل الخطة الحالية بدل تكرارها.');
    }
  }
  // Never remove overdue/completed reviews or unrelated student tasks.
  const kept = tasks.filter(task => task.reviewPlanId !== planId || !isUpcomingReview(task, now));
  const preserved = kept.filter(task => task.reviewPlanId === planId);
  const dates = normalized ? previewReviews(normalized).filter(date =>
    new Date(date.dueAt).getTime() > now &&
    !preserved.some(task => task.reviewOffsetDays === date.offsetDays || task.dueAt === date.dueAt)) : [];
  if (normalized && !dates.length) throw new Error('لا توجد مراجعات مقبلة جديدة بهذه الفواصل. اختر بداية أو فواصل لاحقة، أو ألغِ المراجعات المقبلة.');
  const generated: Task[] = dates.map(({ offsetDays, dueAt }) => ({
    id: `${planId}-day-${offsetDays}`, title: `مراجعة: ${normalized!.lesson}`.slice(0, 120),
    subjectId: normalized!.subjectId, type: 'study', dueAt, priority: 'medium', status: 'not-started',
    reviewPlanId: planId, reviewOffsetDays: offsetDays,
    description: `مراجعة متباعدة بعد ${offsetDays} يومًا من تاريخ البداية.`,
  }));
  if (generated.some(task => kept.some(existing => existing.id === task.id))) {
    throw new Error('تعارضت المراجعة مع مهمة محفوظة. لم تتغير مهامك؛ أعد تحميل الصفحة.');
  }
  const plan: ReviewPlan = normalized ? { ...normalized, id: planId } : { ...previous!, cancelled: true };
  return { tasks: [...kept, ...generated], plans: [...plans.filter(item => item.id !== planId), plan] };
}
