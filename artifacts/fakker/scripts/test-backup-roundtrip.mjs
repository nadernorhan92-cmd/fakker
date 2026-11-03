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
const planMergeSource = await loadSource('../src/lib/plan-merge.ts');
const planMergeModule = await import(dataModule(planMergeSource));

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
globalThis.__planDataIsolationStudyDb = studyDb;
let cloudSyncSource = await loadSource('../src/lib/cloud-sync.ts');
cloudSyncSource = cloudSyncSource
  .replace(
    /^import \{ applyCloudPlan, getStudyAccount, loadCloudBase, loadStudyData, type PlanRecords \} from '\.\/study-db';$/m,
    'const { applyCloudPlan, getStudyAccount, loadCloudBase, loadStudyData } = globalThis.__planDataIsolationStudyDb;',
  )
  .replace(
    /^import \{ withReminderLock \} from '\.\/background-reminders';$/m,
    'const withReminderLock = work => work();',
  )
  .replace(
    /^import \{ mergePlans, type Conflict \} from '\.\/plan-merge';$/m,
    `const { mergePlans } = await import(${JSON.stringify(dataModule(planMergeSource))});`,
  );
const cloudSyncModule = await import(dataModule(cloudSyncSource));

async function writeSetting(key, value) {
  const dbName = studyDb.getStudyAccount()
    ? `fakker-study-planner-account-${studyDb.getStudyAccount()}`
    : 'fakker-study-planner';
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').put({ key, value });
    tx.oncomplete = resolve;
    tx.onabort = tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function readSetting(key) {
  const dbName = studyDb.getStudyAccount()
    ? `fakker-study-planner-account-${studyDb.getStudyAccount()}`
    : 'fakker-study-planner';
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const value = await new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly');
    const request = tx.objectStore('settings').get(key);
    request.onsuccess = () => resolve(request.result?.value);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return value;
}

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

test('backup export and restore exclude focus data and preserve the local timer and history', async () => {
  studyDb.setStudyAccount(`backup-focus-isolation-${crypto.randomUUID()}`);
  await studyDb.loadStudyData();
  const localTimer = {
    phase: 'focus', status: 'running', focusMinutes: 25, breakMinutes: 5,
    taskId: null, remainingMs: 900_000, endsAt: Date.now() + 900_000,
  };
  const localSessions = [{
    id: 'device-only-focus-session', taskId: null, durationMs: 25 * 60_000, completedAt: Date.now(),
  }];
  await writeSetting('focus-timer', localTimer);
  await writeSetting('focus-sessions', localSessions);

  const plan = await studyDb.loadStudyData();
  const backup = backupModule.makeBackup(plan.subjects, plan.tasks, await studyDb.loadReviewPlans());
  const serialized = JSON.stringify(backup);
  assert.deepEqual(Object.keys(backup).sort(), ['createdAt', 'format', 'reviewPlans', 'subjects', 'tasks', 'version']);
  assert.doesNotMatch(serialized, /focus-timer|focus-sessions|device-only-focus-session/);

  const restored = backupModule.parseBackup(serialized);
  await studyDb.mergeStudyData({ ...restored, includeReviewPlans: true });
  assert.deepEqual(await readSetting('focus-timer'), localTimer);
  assert.deepEqual(await studyDb.loadFocusSessions(), localSessions);
});

test('cloud sync applies plan-only data, preserves focus records, and keeps upload consent explicit', async () => {
  const originalFetch = globalThis.fetch;
  try {
    studyDb.setStudyAccount(`cloud-focus-isolation-${crypto.randomUUID()}`);
    await studyDb.loadStudyData();
    const localTimer = {
      phase: 'focus', status: 'paused', focusMinutes: 40, breakMinutes: 10,
      taskId: null, remainingMs: 1_200_000, endsAt: null,
    };
    const localSessions = [{
      id: 'cloud-device-only-session', taskId: null, durationMs: 40 * 60_000, completedAt: Date.now(),
    }];
    await writeSetting('focus-timer', localTimer);
    await writeSetting('focus-sessions', localSessions);

    const remotePlan = {
      subjects: [{ id: 'cloud-math', name: 'الرياضيات', color: '#8879c4' }],
      tasks: [{
        id: 'cloud-task', title: 'درس من السحابة', subjectId: 'cloud-math',
        type: 'study', dueAt: '2026-11-01T12:00:00.000Z', priority: 'medium', status: 'not-started',
      }],
    };
    const requests = [];
    globalThis.fetch = async (_url, options) => {
      requests.push({ method: options.method, body: options.body ? JSON.parse(options.body) : undefined });
      return Response.json({ plan: remotePlan, revision: 'cloud-revision' });
    };
    await cloudSyncModule.synchronize(false, {});
    assert.deepEqual(requests.map(request => request.method), ['GET']);
    assert.deepEqual((await studyDb.loadStudyData()).subjects, remotePlan.subjects);
    assert.deepEqual((await studyDb.loadStudyData()).tasks, remotePlan.tasks);
    assert.deepEqual(await readSetting('focus-timer'), localTimer);
    assert.deepEqual(await studyDb.loadFocusSessions(), localSessions);

    studyDb.setStudyAccount(`cloud-upload-focus-isolation-${crypto.randomUUID()}`);
    await studyDb.loadStudyData();
    await writeSetting('focus-timer', localTimer);
    await writeSetting('focus-sessions', localSessions);
    const localSubject = { id: 'local-math', name: 'العلوم', color: '#aa7755' };
    const localTask = {
      id: 'local-task', title: 'درس محلي', subjectId: localSubject.id,
      type: 'study', dueAt: '2026-11-02T12:00:00.000Z', priority: 'medium', status: 'not-started',
    };
    await studyDb.saveSubject(localSubject);
    await studyDb.saveTask(localTask);
    requests.length = 0;
    const emptyPlan = { subjects: [], tasks: [] };
    globalThis.fetch = async (_url, options) => {
      requests.push({ method: options.method, body: options.body ? JSON.parse(options.body) : undefined });
      return Response.json({
        plan: options.method === 'PUT' ? options.body && JSON.parse(options.body).plan : emptyPlan,
        revision: options.method === 'PUT' ? 'saved-revision' : 'initial-revision',
      });
    };
    await cloudSyncModule.synchronize(true, {});
    assert.deepEqual(requests.map(request => request.method), ['GET', 'PUT']);
    assert.equal(requests[1].body.consent, true);
    assert.deepEqual(Object.keys(requests[1].body).sort(), ['consent', 'plan', 'revision']);
    assert.deepEqual(Object.keys(requests[1].body.plan).sort(), ['subjects', 'tasks']);
    assert.doesNotMatch(JSON.stringify(requests[1].body), /focus-timer|focus-sessions|cloud-device-only-session/);
    assert.deepEqual(await readSetting('focus-timer'), localTimer);
    assert.deepEqual(await studyDb.loadFocusSessions(), localSessions);
  } finally {
    globalThis.fetch = originalFetch;
  }
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
