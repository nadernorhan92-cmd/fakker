import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { test } from 'node:test';

const source = readFileSync(new URL('../src/lib/spaced-review.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
});
const { previewReviews, planReviewChange } =
  await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const analyticsSource = readFileSync(new URL('../src/lib/review-analytics.ts', import.meta.url), 'utf8');
const { outputText: analyticsOutput } = ts.transpileModule(analyticsSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
});
const { trackReviewEvent } =
  await import(`data:text/javascript;base64,${Buffer.from(analyticsOutput).toString('base64')}`);
const now = new Date('2026-10-24T08:00:00Z').getTime();
const draft = { lesson: 'الفصل الأول', subjectId: 'math', baseAt: '2026-10-24T10:00:00Z', intervals: [1, 3, 7, 14] };
const change = (tasks = [], plans = [], value = draft, planId = 'plan', at = now) =>
  planReviewChange(tasks, plans, value, planId, ['math'], at);
const ordinary = { id: 'student-task', title: 'واجب', type: 'homework', dueAt: '2026-10-25T10:00:00Z', status: 'not-started', priority: 'high' };

test('preview uses offsets from base, sorted without mutating input', () => {
  const value = { ...draft, intervals: [14, 1, 7, 3] };
  assert.deepEqual(previewReviews(value).map(date => date.dueAt), [
    '2026-10-25T10:00:00.000Z', '2026-10-27T10:00:00.000Z',
    '2026-10-31T10:00:00.000Z', '2026-11-07T10:00:00.000Z',
  ]);
  assert.deepEqual(value.intervals, [14, 1, 7, 3]);
});

test('review analytics sends only the aggregate count and never disrupts app behavior', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const calls = [];
  try {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { umami: { track: (...args) => calls.push(args) } },
    });
    trackReviewEvent('spaced_review_previewed', 4);
    assert.deepEqual(calls, [['spaced_review_previewed', { review_count: 4 }]]);

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { umami: { track: () => { throw new Error('analytics unavailable'); } } },
    });
    assert.doesNotThrow(() => trackReviewEvent('spaced_review_saved', 3));

    Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
    assert.doesNotThrow(() => trackReviewEvent('spaced_review_cancelled', 0));
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete globalThis.window;
  }
});

test('invalid, repeated or excessive intervals cannot be confirmed', () => {
  for (const intervals of [[], [1, 1], [0], [-1], [1.5], [366], [NaN], Array.from({ length: 13 }, (_, i) => i + 1)]) {
    assert.throws(() => previewReviews({ ...draft, intervals }));
  }
  for (const partial of [{ lesson: '' }, { subjectId: '' }, { baseAt: 'invalid' }]) {
    assert.throws(() => previewReviews({ ...draft, ...partial }));
  }
});

test('generated study tasks keep subject and survive JSON roundtrip', () => {
  const result = change([ordinary]);
  assert.equal(result.tasks.length, 5);
  assert.strictEqual(result.tasks[0], ordinary);
  for (const task of result.tasks.slice(1)) {
    assert.equal(task.type, 'study');
    assert.equal(task.subjectId, 'math');
    assert.equal(task.reviewPlanId, 'plan');
  }
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
});

test('repeated create prevented by lesson or source task, edits do not multiply tasks', () => {
  const result = change();
  assert.throws(() => change(result.tasks, result.plans, { ...draft, lesson: '  الفصل   الأول ' }, 'another'), /توجد خطة/);
  const edited = change(result.tasks, result.plans);
  assert.equal(edited.tasks.length, 4);
  assert.equal(new Set(edited.tasks.map(task => task.id)).size, 4);
  const sourced = change([ordinary], [], { ...draft, sourceTaskId: ordinary.id });
  assert.throws(() => change(sourced.tasks, sourced.plans, { ...draft, lesson: 'عنوان مختلف', sourceTaskId: ordinary.id }, 'other'), /توجد خطة/);
});

test('edit and cancellation preserve other tasks, completed and overdue reviews', () => {
  const original = change([ordinary]);
  const tasks = original.tasks.map(task => task.reviewOffsetDays === 7 ? { ...task, status: 'completed', completedAt: new Date(now).toISOString() } : task);
  const at = new Date('2026-10-26T10:00:00Z').getTime();
  const edited = change(tasks, original.plans, { ...draft, intervals: [1, 5, 7, 20] }, 'plan', at);
  assert.strictEqual(edited.tasks.find(task => task.id === ordinary.id), ordinary);
  assert.strictEqual(edited.tasks.find(task => task.reviewOffsetDays === 1), tasks.find(task => task.reviewOffsetDays === 1));
  assert.strictEqual(edited.tasks.find(task => task.reviewOffsetDays === 7), tasks.find(task => task.reviewOffsetDays === 7));
  assert.deepEqual(edited.tasks.filter(task => task.reviewPlanId).map(task => task.reviewOffsetDays).sort((a,b) => a-b), [1,5,7,20]);
  const cancelled = change(edited.tasks, edited.plans, null, 'plan', at);
  assert.deepEqual(cancelled.tasks.map(task => task.id).sort(), [ordinary.id, 'plan-day-1', 'plan-day-7'].sort());
  assert.equal(cancelled.plans[0].cancelled, true);
});

test('missing sources/subjects and all-past schedules fail explicitly', () => {
  assert.throws(() => change([], [], { ...draft, sourceTaskId: 'gone' }), /المهمة الأصلية/);
  assert.throws(() => change([], [], { ...draft, subjectId: 'gone' }), /المادة/);
  assert.throws(() => change([], [], draft, 'plan', now + 40 * 86400000), /لا توجد مراجعات مقبلة/);
});

test('cancelling a series leaves a different series unchanged', () => {
  const first = change([ordinary]);
  const second = change(first.tasks, first.plans, { ...draft, lesson: 'الفصل الثاني' }, 'plan-two');
  const cancelled = change(second.tasks, second.plans, null);
  assert.deepEqual(cancelled.tasks, second.tasks.filter(task => task.reviewPlanId !== 'plan'));
  assert.throws(() => change(cancelled.tasks, cancelled.plans, null), /لم تعد خطة/);
});

test('a restored ordinary task with a colliding identifier is never overwritten', () => {
  assert.throws(() => change([{ ...ordinary, id: 'plan-day-1' }]), /تعارضت/);
  const long = change([], [], { ...draft, lesson: 'م'.repeat(120) });
  assert.ok(long.tasks.every(task => task.title.length <= 120));
});
