import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { test } from 'node:test';

const source = readFileSync(new URL('../src/lib/focus-timer.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
});
const { initialFocusTimer, validateFocusTimer, remainingTime, transitionTimer } =
  await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const now = 1_800_000_000_000;
const act = (s, type, at = now) => transitionTimer(s, { type }, at);
const roundtrip = s => validateFocusTimer(JSON.parse(JSON.stringify(s)));

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
