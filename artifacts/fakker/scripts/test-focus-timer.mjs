import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { IDBObjectStore, indexedDB } from 'fake-indexeddb';
import ts from 'typescript';
import { test } from 'node:test';

const transpile = source => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(transpile(source)).toString('base64')}`;
const focusTimerSource = readFileSync(new URL('../src/lib/focus-timer.ts', import.meta.url), 'utf8');
const focusTimerModule = await import(moduleUrl(focusTimerSource));
const { initialFocusTimer, validateFocusTimer, remainingTime, transitionTimer, completedFocusSession } = focusTimerModule;
const now = 1_800_000_000_000;
const act = (s, type, at = now) => transitionTimer(s, { type }, at);
const roundtrip = s => validateFocusTimer(JSON.parse(JSON.stringify(s)));

// Exercise the production IndexedDB module with only unrelated collaborators
// stubbed; the database transaction and timer logic remain real.
let studyDbSource = readFileSync(new URL('../src/lib/study-db.ts', import.meta.url), 'utf8');
studyDbSource = studyDbSource
  .replace(
    "import { backgroundEnabled, disableBackgroundReminders, syncBackgroundReminders, withReminderLock } from './background-reminders';",
    'const backgroundEnabled = () => false; const disableBackgroundReminders = async () => {}; const syncBackgroundReminders = async () => {}; const withReminderLock = work => work();',
  )
  .replace(
    "import { completedFocusSession, initialFocusTimer, transitionTimer, validateFocusTimer, type FocusSession, type FocusTimerState, type TimerAction } from './focus-timer';",
    `const { completedFocusSession, initialFocusTimer, transitionTimer, validateFocusTimer } = await import('${moduleUrl(focusTimerSource)}');`,
  )
  .replace(
    "import { mergeImportedReviewPlans, planReviewChange, type ReviewDraft, type ReviewPlan } from './spaced-review';",
    'const mergeImportedReviewPlans = () => { throw new Error("backup imports are outside this test"); }; const planReviewChange = () => { throw new Error("spaced reviews are outside this test"); };',
  );
const studyDb = await import(moduleUrl(studyDbSource));

globalThis.indexedDB = indexedDB;
globalThis.window = globalThis;
globalThis.document = { addEventListener() {}, removeEventListener() {} };
let clock = now;
Date.now = () => clock;
globalThis.setInterval = () => 0;
globalThis.clearInterval = () => {};
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};

const channels = new Map();
class TestBroadcastChannel {
  constructor(name) {
    this.name = name;
    this.onmessage = null;
    this.listeners = new Set();
    const peers = channels.get(name) ?? new Set();
    peers.add(this);
    channels.set(name, peers);
  }
  postMessage(data) {
    for (const peer of channels.get(this.name) ?? []) {
      if (peer !== this) {
        peer.onmessage?.({ data });
        for (const listener of peer.listeners) listener({ data });
      }
    }
  }
  addEventListener(type, listener) { if (type === 'message') this.listeners.add(listener); }
  removeEventListener(type, listener) { this.listeners.delete(listener); }
  close() { channels.get(this.name)?.delete(this); }
}
globalThis.BroadcastChannel = TestBroadcastChannel;

function createReactHookRuntime() {
  const states = [];
  const refs = [];
  const callbacks = [];
  const effects = [];
  let stateCursor = 0;
  let refCursor = 0;
  let callbackCursor = 0;
  let effectCursor = 0;
  const sameDeps = (a, b) => a && b && a.length === b.length && a.every((item, i) => Object.is(item, b[i]));
  return {
    react: {
      useState(initial) {
        const index = stateCursor++;
        if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
        return [states[index], value => {
          states[index] = typeof value === 'function' ? value(states[index]) : value;
        }];
      },
      useRef(initial) {
        const index = refCursor++;
        if (!(index in refs)) refs[index] = { current: initial };
        return refs[index];
      },
      useCallback(callback, deps) {
        const index = callbackCursor++;
        if (!callbacks[index] || !sameDeps(callbacks[index].deps, deps)) callbacks[index] = { callback, deps };
        return callbacks[index].callback;
      },
      useEffect(effect, deps) {
        const index = effectCursor++;
        if (!effects[index] || !sameDeps(effects[index].deps, deps)) {
          effects[index]?.cleanup?.();
          effects[index] = { deps, cleanup: effect() };
        }
      },
    },
    resetCursors() {
      stateCursor = 0;
      refCursor = 0;
      callbackCursor = 0;
      effectCursor = 0;
    },
    cleanup() { for (const effect of effects) effect?.cleanup?.(); },
  };
}

const hookSource = readFileSync(new URL('../src/lib/use-focus-timer.ts', import.meta.url), 'utf8')
  .replace(
    "import { useCallback, useEffect, useRef, useState } from 'react';",
    'const useCallback = (...args) => globalThis.__focusTimerReact.useCallback(...args); const useEffect = (...args) => globalThis.__focusTimerReact.useEffect(...args); const useRef = (...args) => globalThis.__focusTimerReact.useRef(...args); const useState = (...args) => globalThis.__focusTimerReact.useState(...args);',
  )
  .replace(
    "import { getStudyAccount, updateFocusTimer } from './study-db';",
    'const { getStudyAccount, updateFocusTimer } = globalThis.__focusTimerDb;',
  )
  .replace(
    "import { remainingTime, type FocusTimerState, type TimerAction } from './focus-timer';",
    'const { remainingTime } = globalThis.__focusTimerModel;',
  );
globalThis.__focusTimerDb = studyDb;
globalThis.__focusTimerModel = focusTimerModule;
const useFocusTimer = (await import(moduleUrl(hookSource))).useFocusTimer;

function mountTimerTab() {
  const runtime = createReactHookRuntime();
  globalThis.__focusTimerReact = runtime.react;
  let current;
  const render = () => {
    runtime.resetCursors();
    current = useFocusTimer();
    return current;
  };
  render();
  return { runtime, render, get current() { return current; }, unmount: () => runtime.cleanup() };
}
const settle = async (...tabs) => {
  for (let i = 0; i < 8; i++) {
    await new Promise(resolve => setTimeout(resolve, 0));
    for (const tab of tabs) tab.render();
  }
};
test('configuration is validated and links a task without changing it', () => {
  const s = transitionTimer(initialFocusTimer(), {
    type: 'configure', focusMinutes: 40, breakMinutes: 10, taskId: 'optional-task',
  }, now);
  assert.equal(s.remainingMs, 40 * 60_000);
  assert.equal(s.taskId, 'optional-task');
  for (const focusMinutes of [0, 121, 2.5, NaN]) {
    assert.throws(() => transitionTimer(s, { type: 'configure', focusMinutes, breakMinutes: 5, taskId: null }, now));
  }
  for (const breakMinutes of [0, 61, 2.5]) {
    assert.throws(() => transitionTimer(s, { type: 'configure', focusMinutes: 25, breakMinutes, taskId: null }, now));
  }
});

test('running timer restores its absolute deadline after reload and hidden-tab delays', () => {
  const initial = initialFocusTimer();
  const running = act(initial, 'start');
  assert.equal(initial.status, 'idle');
  assert.equal(remainingTime(roundtrip(running), now + 50_125), 1_449_875);
  assert.equal(act(roundtrip(running), 'reconcile', now + 1_600_000).status, 'completed');
  assert.equal(remainingTime(running, now + 2_000_000), 0);
});

test('pause freezes the exact time; resume and repeated clicks do not restart a timer', () => {
  const running = act(initialFocusTimer(), 'start');
  assert.deepEqual(act(running, 'start', now + 5_000), running);
  const paused = act(running, 'pause', now + 15_213);
  assert.equal(paused.remainingMs, 1_484_787);
  assert.equal(paused.endsAt, null);
  assert.equal(remainingTime(roundtrip(paused), now + 300_000), paused.remainingMs);
  const resumed = act(paused, 'start', now + 300_000);
  assert.equal(resumed.endsAt, now + 300_000 + paused.remainingMs);
  assert.deepEqual(act(resumed, 'reset'), { ...initialFocusTimer() });
});

test('completion persists until an explicit next action, then break and focus alternate', () => {
  const running = act(initialFocusTimer(), 'start');
  const completed = act(running, 'pause', running.endsAt);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.remainingMs, 0);
  assert.equal(completed.endsAt, null);
  assert.deepEqual(act(roundtrip(completed), 'reconcile', now + 999_999_999), completed);
  assert.deepEqual(act(completed, 'start'), completed);
  const rest = act(completed, 'next', now + 2_000_000);
  assert.equal(rest.phase, 'break');
  assert.equal(rest.remainingMs, 300_000);
  const restDone = act(rest, 'reconcile', rest.endsAt);
  assert.equal(restDone.status, 'completed');
  const focus = act(restDone, 'next', rest.endsAt + 50_000);
  assert.equal(focus.phase, 'focus');
  assert.equal(focus.status, 'running');
  assert.equal(focus.remainingMs, 1_500_000);
});

test('only a fully elapsed focus phase creates a session with its optional task and completion time', () => {
  const configured = transitionTimer(initialFocusTimer(), {
    type: 'configure', focusMinutes: 40, breakMinutes: 10, taskId: 'task-1',
  }, now);
  const running = act(configured, 'start');
  assert.equal(completedFocusSession(running, running.endsAt - 1, 'session-1'), null);
  assert.deepEqual(completedFocusSession(running, running.endsAt, 'session-1'), {
    id: 'session-1', taskId: 'task-1', durationMs: 40 * 60_000, completedAt: running.endsAt,
  });
  assert.equal(completedFocusSession(act(initialFocusTimer(), 'start'), now, 'session-2'), null);
  const breakRunning = transitionTimer(
    transitionTimer(initialFocusTimer(), { type: 'start' }, now),
    { type: 'next' },
    now + 1,
  );
  assert.equal(completedFocusSession(breakRunning, now + 1, 'session-3'), null);
});

test('active configuration stays locked and reset keeps preferences and optional link', () => {
  const configured = transitionTimer(initialFocusTimer(), {
    type: 'configure', focusMinutes: 50, breakMinutes: 15, taskId: 'task',
  }, now);
  const running = act(configured, 'start');
  assert.deepEqual(transitionTimer(running, {
    type: 'configure', focusMinutes: 20, breakMinutes: 5, taskId: null,
  }, now), running);
  assert.deepEqual(act(running, 'next'), running);
  assert.deepEqual(act(running, 'reset'), configured);
});

test('corrupt data fails explicitly rather than silently overwriting the timer', () => {
  for (const value of [null, {}, { ...initialFocusTimer(), endsAt: 123 },
    { ...initialFocusTimer(), remainingMs: -1 }, { ...initialFocusTimer(), taskId: 3 },
    { ...initialFocusTimer(), status: 'running', endsAt: null }]) {
    assert.throws(() => validateFocusTimer(value));
  }
});

test('IndexedDB timer writes preserve plan records and stay separated by account', async () => {
  studyDb.setStudyAccount(null);
  const guestSubject = { id: 'guest-subject', name: 'رياضيات', color: '#c80' };
  const guestTask = {
    id: 'guest-task', title: 'واجب الجبر', subjectId: guestSubject.id,
    type: 'homework', dueAt: '2026-10-25T10:00:00.000Z', priority: 'high', status: 'not-started',
  };
  const guestSettings = { studentName: 'طالبة', notificationsEnabled: true, reminderLeadMinutes: 45 };
  await studyDb.saveSubject(guestSubject);
  await studyDb.saveTask(guestTask);
  await studyDb.saveSettings(guestSettings);
  const beforeTimer = await studyDb.loadStudyData();

  await studyDb.updateFocusTimer({ type: 'configure', focusMinutes: 35, breakMinutes: 8, taskId: guestTask.id });
  await studyDb.updateFocusTimer({ type: 'start' });
  assert.deepEqual(await studyDb.loadStudyData(), beforeTimer);

  studyDb.setStudyAccount('focus-account-a');
  const accountTimer = await studyDb.updateFocusTimer({ type: 'reconcile' });
  assert.deepEqual(accountTimer.state, initialFocusTimer());
  const accountSubject = { id: 'account-subject', name: 'علوم', color: '#08c' };
  await studyDb.saveSubject(accountSubject);
  await studyDb.updateFocusTimer({ type: 'configure', focusMinutes: 20, breakMinutes: 5, taskId: null });

  studyDb.setStudyAccount(null);
  const guestTimer = await studyDb.updateFocusTimer({ type: 'reconcile' });
  assert.equal(guestTimer.state.status, 'running');
  assert.equal(guestTimer.state.focusMinutes, 35);
  assert.deepEqual(await studyDb.loadStudyData(), beforeTimer);
  assert.deepEqual(await studyDb.readGuestPlan(), {
    subjects: [guestSubject],
    tasks: [{ ...guestTask, completedAt: undefined }],
  });

  studyDb.setStudyAccount('focus-account-a');
  assert.equal((await studyDb.updateFocusTimer({ type: 'reconcile' })).state.focusMinutes, 20);
  assert.deepEqual((await studyDb.loadStudyData()).subjects, [accountSubject]);
  studyDb.setStudyAccount(null);
});

test('two open timer tabs serialize start, pause and reset, then restore the deadline after reload', async () => {
  studyDb.setStudyAccount('focus-two-tabs');
  const firstTab = mountTimerTab();
  const secondTab = mountTimerTab();
  await settle(firstTab, secondTab);
  assert.equal(firstTab.current.state.status, 'idle');
  assert.equal(secondTab.current.state.status, 'idle');

  const starts = await Promise.all([firstTab.current.start(), secondTab.current.start()]);
  assert.deepEqual(starts, [true, true]);
  await settle(firstTab, secondTab);
  assert.equal(firstTab.current.state.status, 'running');
  assert.equal(secondTab.current.state.status, 'running');
  assert.equal(firstTab.current.state.endsAt, secondTab.current.state.endsAt);

  clock += 15_000;
  assert.equal(await secondTab.current.pause(), true);
  await settle(firstTab, secondTab);
  assert.equal(firstTab.current.state.status, 'paused');
  assert.equal(firstTab.current.state.remainingMs, 25 * 60_000 - 15_000);

  assert.equal(await firstTab.current.start(), true);
  await settle(firstTab, secondTab);
  assert.equal(secondTab.current.state.status, 'running');
  assert.equal(secondTab.current.state.endsAt, clock + 25 * 60_000 - 15_000);
  assert.equal(await secondTab.current.reset(), true);
  await settle(firstTab, secondTab);
  assert.equal(firstTab.current.state.status, 'idle');
  assert.equal(secondTab.current.state.status, 'idle');

  assert.equal(await firstTab.current.start(), true);
  await settle(firstTab, secondTab);
  const saved = await studyDb.updateFocusTimer({ type: 'reconcile' });
  const savedDeadline = saved.state.endsAt;
  firstTab.unmount();
  secondTab.unmount();

  const reloadedTab = mountTimerTab();
  await settle(reloadedTab);
  assert.equal(reloadedTab.current.state.status, 'running');
  assert.equal(reloadedTab.current.state.endsAt, savedDeadline);
  clock += 10_000;
  assert.equal(await reloadedTab.current.pause(), true);
  reloadedTab.render();
  assert.equal(reloadedTab.current.state.remainingMs, 25 * 60_000 - 10_000);
  reloadedTab.unmount();
  studyDb.setStudyAccount(null);
});

test('a failed timer write keeps the previous state and a manual retry commits it only after success', async () => {
  studyDb.setStudyAccount('focus-write-failure');
  const tab = mountTimerTab();
  await settle(tab);
  const originalPut = IDBObjectStore.prototype.put;
  const quotaFailure = new Error('محاكاة تعذّر التخزين');
  IDBObjectStore.prototype.put = function(value, ...args) {
    if (value?.key === 'focus-timer') throw quotaFailure;
    return originalPut.call(this, value, ...args);
  };
  try {
    assert.equal(await tab.current.start(), false);
    tab.render();
    assert.equal(tab.current.state.status, 'idle');
    assert.match(tab.current.error, /محاكاة تعذّر التخزين/);
    assert.match(tab.current.error, /الحالة السابقة للمؤقّت ما زالت محفوظة/);
    assert.equal((await studyDb.updateFocusTimer({ type: 'reconcile' })).state.status, 'idle');
    tab.render();
    assert.ok(tab.current.error, 'a background reload must not dismiss the failed-change notice');

    IDBObjectStore.prototype.put = originalPut;
    assert.equal(await tab.current.retry(), true);
    tab.render();
    assert.equal(tab.current.state.status, 'running');
    assert.equal(tab.current.error, null);
    assert.equal((await studyDb.updateFocusTimer({ type: 'reconcile' })).state.status, 'running');

    clock += 25 * 60_000;
    IDBObjectStore.prototype.put = function(value, ...args) {
      if (value?.key === 'focus-sessions') throw quotaFailure;
      return originalPut.call(this, value, ...args);
    };
    assert.equal(await tab.current.retry(), false);
    tab.render();
    assert.equal(tab.current.state.status, 'running', 'completion must not appear before the session transaction commits');
    assert.equal((await studyDb.loadFocusSessions()).length, 0);

    IDBObjectStore.prototype.put = originalPut;
    assert.equal(await tab.current.retry(), true);
    tab.render();
    assert.equal(tab.current.state.status, 'completed');
    assert.equal(tab.current.error, null);
    assert.equal((await studyDb.loadFocusSessions()).length, 1);
  } finally {
    IDBObjectStore.prototype.put = originalPut;
    tab.unmount();
    studyDb.setStudyAccount(null);
  }
});

test('clearing history preserves plan, review plans and active timer, and isolates account / guest histories', async () => {
  const populate = async account => {
    studyDb.setStudyAccount(account);
    await studyDb.updateFocusTimer({ type: 'start' });
    clock += 26 * 60_000;
    await studyDb.updateFocusTimer({ type: 'reconcile' });
    return studyDb.loadFocusSessions();
  };
  const guestSessions = await populate(null);
  const otherSessions = await populate('clear-other-account');
  await populate('clear-current-account');
  await studyDb.saveSubject({ id: 'preserved-subject', name: 'رياضيات', color: '#c80' });
  await studyDb.saveTask({ id: 'preserved-task', title: 'مراجعة', type: 'study', dueAt: '2026-10-25T10:00:00Z', priority: 'high', status: 'not-started' });
  await studyDb.saveSettings({ studentName: 'طالبة', notificationsEnabled: true, reminderLeadMinutes: 45 });
  const beforePlan = await studyDb.loadStudyData();
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('fakker-study-planner-account-clear-current-account', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const reviewPlans = [{ id: 'preserved-review', title: 'مراجعة محلية' }];
  await new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').put({ key: 'review-plans', value: reviewPlans });
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
  });
  await studyDb.updateFocusTimer({ type: 'next' });
  const beforeTimer = (await studyDb.updateFocusTimer({ type: 'start' })).state;
  await studyDb.clearFocusSessions();
  assert.deepEqual(await studyDb.loadFocusSessions(), []);
  assert.deepEqual(await studyDb.loadStudyData(), beforePlan);
  assert.deepEqual((await studyDb.updateFocusTimer({ type: 'reconcile' })).state, beforeTimer);
  const savedReviews = await new Promise((resolve, reject) => {
    const request = db.transaction('settings', 'readonly').objectStore('settings').get('review-plans');
    request.onsuccess = () => resolve(request.result.value);
    request.onerror = () => reject(request.error);
  });
  assert.deepEqual(savedReviews, reviewPlans);
  db.close();
  await studyDb.clearFocusSessions();
  studyDb.setStudyAccount('clear-other-account');
  assert.deepEqual(await studyDb.loadFocusSessions(), otherSessions);
  studyDb.setStudyAccount(null);
  assert.deepEqual(await studyDb.loadFocusSessions(), guestSessions);
  await studyDb.clearFocusSessions();
  studyDb.setStudyAccount('clear-other-account');
  assert.deepEqual(await studyDb.loadFocusSessions(), otherSessions);
  studyDb.setStudyAccount(null);
});

test('aborted history deletion rejects without losing history or plan data', async () => {
  studyDb.setStudyAccount('clear-failure-account');
  await studyDb.updateFocusTimer({ type: 'start' });
  clock += 26 * 60_000;
  await studyDb.updateFocusTimer({ type: 'reconcile' });
  const before = await studyDb.loadFocusSessions();
  const plan = await studyDb.loadStudyData();
  assert.equal(before.length, 1);
  const originalDelete = IDBObjectStore.prototype.delete;
  IDBObjectStore.prototype.delete = function(key) {
    const request = originalDelete.call(this, key);
    if (key === 'focus-sessions') this.transaction.abort();
    return request;
  };
  try {
    await assert.rejects(studyDb.clearFocusSessions());
    assert.deepEqual(await studyDb.loadFocusSessions(), before);
    assert.deepEqual(await studyDb.loadStudyData(), plan);
  } finally {
    IDBObjectStore.prototype.delete = originalDelete;
    studyDb.setStudyAccount(null);
  }
});
