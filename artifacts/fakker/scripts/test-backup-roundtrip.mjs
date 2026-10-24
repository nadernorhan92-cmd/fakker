import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { indexedDB } from 'fake-indexeddb';
import { test } from 'node:test';

const compilerOptions = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 };
const transpile = source => ts.transpileModule(source, { compilerOptions }).outputText;
const dataModule = source => `data:text/javascript;base64,${Buffer.from(transpile(source)).toString('base64')}`;
const loadSource = path => readFile(new URL(path, import.meta.url), 'utf8');

const backupModule = await import(dataModule(await loadSource('../src/lib/backup.ts')));
const reviewSource = await loadSource('../src/lib/spaced-review.ts');
const reviewModule = await import(dataModule(reviewSource));

globalThis.indexedDB = indexedDB;
globalThis.window = { indexedDB };
let dbSource = await loadSource('../src/lib/study-db.ts');
dbSource = dbSource
  .replace(
    /^import \{ backgroundEnabled.*from '\.\/background-reminders';$/m,
    'const backgroundEnabled = () => false; const disableBackgroundReminders = async () => {}; const syncBackgroundReminders = async () => {}; const withReminderLock = work => work();',
  )
  .replace(
    /^import \{ completedFocusSession.*from '\.\/focus-timer';$/m,
    'const completedFocusSession = () => null; const initialFocusTimer = () => ({}); const transitionTimer = value => value; const validateFocusTimer = value => value;',
  )
  .replace(
    /^import \{ mergeImportedReviewPlans.*from '\.\/spaced-review';$/m,
    `const { mergeImportedReviewPlans, planReviewChange } = await import(${JSON.stringify(dataModule(reviewSource))});`,
  );
const studyDb = await import(dataModule(dbSource));

test('backup v2 preserves managed review plans, task links, and still reads legacy v1', () => {
  const subject = { id: 'math', name: 'الرياضيات', color: '#8879c4' };
  const source = { id: 'source', title: 'الفصل الأول', subjectId: subject.id, type: 'study', dueAt: '2026-11-01T12:00:00.000Z', priority: 'medium', status: 'not-started' };
  const plan = { id: 'series', lesson: source.title, subjectId: subject.id, sourceTaskId: source.id, baseAt: '2026-10-24T12:00:00.000Z', intervals: [1, 3, 7] };
  const linked = { ...source, id: 'series-day-1', reviewPlanId: plan.id, reviewOffsetDays: 1 };
  const exported = backupModule.makeBackup([subject], [source, linked], [plan]);
  const parsed = backupModule.parseBackup(JSON.stringify(exported));
  assert.equal(parsed.version, 2);
  assert.deepEqual(parsed.reviewPlans, [plan]);
  assert.equal(parsed.tasks[1].reviewPlanId, plan.id);
  assert.equal(parsed.tasks[1].reviewOffsetDays, 1);

  const legacy = { ...exported, version: 1, tasks: [source] };
  delete legacy.reviewPlans;
  assert.deepEqual(backupModule.parseBackup(JSON.stringify(legacy)).reviewPlans, []);
  assert.equal(backupModule.parseBackup(JSON.stringify(legacy)).tasks.length, 1);

  const withoutPlans = backupModule.makeBackup([subject], [source, linked], [plan], false);
  assert.deepEqual(withoutPlans.reviewPlans, []);
  assert.equal(withoutPlans.tasks[1].reviewPlanId, undefined);
  assert.throws(() => backupModule.parseBackup(JSON.stringify({ ...exported, reviewPlans: [] })));
});

test('restored plans remain editable and cancelable without removing student tasks or duplicating a series', async () => {
  studyDb.setStudyAccount(`backup-test-${crypto.randomUUID()}`);
  const subject = { id: 'backup-math', name: 'الرياضيات', color: '#8879c4' };
  const source = { id: 'backup-source', title: 'الفصل الأول', subjectId: subject.id, type: 'study', dueAt: new Date(Date.now() + 30 * 86400000).toISOString(), priority: 'medium', status: 'not-started' };
  const draft = {
    lesson: source.title, subjectId: subject.id, sourceTaskId: source.id,
    baseAt: new Date(Date.now() + 86400000).toISOString(), intervals: [1, 3, 7],
  };
  const plan = { ...draft, id: 'restored-series' };
  const generated = reviewModule.previewReviews(draft).map(({ offsetDays, dueAt }) => ({
    id: `${plan.id}-day-${offsetDays}`, title: `مراجعة: ${draft.lesson}`, subjectId: subject.id,
    type: 'study', dueAt, priority: 'medium', status: 'not-started',
    reviewPlanId: plan.id, reviewOffsetDays: offsetDays,
  }));
  const history = [
    { id: 'completed-review', title: 'مراجعة مكتملة', subjectId: subject.id, type: 'study', dueAt: new Date(Date.now() - 86400000).toISOString(), priority: 'medium', status: 'completed', completedAt: new Date().toISOString(), reviewPlanId: plan.id, reviewOffsetDays: 20 },
    { id: 'late-review', title: 'مراجعة فائتة', subjectId: subject.id, type: 'study', dueAt: new Date(Date.now() - 3600000).toISOString(), priority: 'medium', status: 'not-started', reviewPlanId: plan.id, reviewOffsetDays: 21 },
  ];
  const payload = { subjects: [subject], tasks: [source, ...generated, ...history], reviewPlans: [plan], includeReviewPlans: true };

  assert.deepEqual(await studyDb.mergeStudyData(payload), { subjects: 1, tasks: 6, reviewPlans: 1 });
  assert.deepEqual(await studyDb.mergeStudyData(payload), { subjects: 0, tasks: 0, reviewPlans: 0 });
  const duplicateId = 'restored-series-copy';
  const duplicatePayload = {
    ...payload,
    reviewPlans: [{ ...plan, id: duplicateId }],
    tasks: payload.tasks.map(task => task.reviewPlanId === plan.id
      ? { ...task, id: task.id.replace(plan.id, duplicateId), reviewPlanId: duplicateId }
      : task),
  };
  assert.deepEqual(await studyDb.mergeStudyData(duplicatePayload), { subjects: 0, tasks: 0, reviewPlans: 0 });
  assert.equal((await studyDb.loadReviewPlans()).length, 1);

  await studyDb.saveReviewPlan({ ...draft, intervals: [2, 4, 8] }, plan.id);
  const edited = await studyDb.loadStudyData();
  assert.deepEqual((await studyDb.loadReviewPlans())[0].intervals, [2, 4, 8]);
  assert.deepEqual(edited.tasks.filter(task => task.reviewPlanId === plan.id).map(task => task.reviewOffsetDays).sort((a, b) => a - b), [2, 4, 8, 20, 21]);

  await studyDb.cancelReviewPlan(plan.id);
  const cancelled = await studyDb.loadStudyData();
  assert.equal((await studyDb.loadReviewPlans())[0].cancelled, true);
  assert.deepEqual(cancelled.tasks.map(task => task.id).sort(), [source.id, 'completed-review', 'late-review'].sort());

  studyDb.setStudyAccount(`backup-optout-${crypto.randomUUID()}`);
  const optedOut = await studyDb.mergeStudyData({ ...payload, includeReviewPlans: false });
  assert.deepEqual(optedOut, { subjects: 1, tasks: 6, reviewPlans: 0 });
  assert.deepEqual(await studyDb.loadReviewPlans(), []);
  assert.ok((await studyDb.loadStudyData()).tasks.every(task => !task.reviewPlanId && !task.reviewOffsetDays));

  studyDb.setStudyAccount(`backup-no-plans-${crypto.randomUUID()}`);
  assert.deepEqual(await studyDb.mergeStudyData({ subjects: payload.subjects, tasks: payload.tasks }), { subjects: 1, tasks: 6, reviewPlans: 0 });
  assert.deepEqual(await studyDb.loadReviewPlans(), []);
  assert.ok((await studyDb.loadStudyData()).tasks.every(task => !task.reviewPlanId && !task.reviewOffsetDays));

  studyDb.setStudyAccount(`backup-source-conflict-${crypto.randomUUID()}`);
  await studyDb.saveSubject(subject);
  await studyDb.saveTask({ ...source, title: 'درس محلي مختلف' });
  assert.deepEqual(await studyDb.mergeStudyData(payload), { subjects: 0, tasks: 5, reviewPlans: 1 });
  assert.equal((await studyDb.loadReviewPlans())[0].sourceTaskId, undefined);
  assert.equal((await studyDb.loadStudyData()).tasks.find(task => task.id === source.id).title, 'درس محلي مختلف');
});
