import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/focus-statistics.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const { focusRange, focusRangeError, summarizeFocus, localDayKey } =
  await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const session = (id, at, minutes = 25, taskId = 'task-a') => ({
  id, completedAt: new Date(at).getTime(), durationMs: minutes * 60_000, taskId,
});

test('week and month are inclusive local calendar ranges, crossing months and years', () => {
  const now = new Date('2026-01-03T23:59:59');
  assert.deepEqual(focusRange('week', {}, now), { start: '2025-12-28', end: '2026-01-03' });
  assert.deepEqual(focusRange('month', {}, now), { start: '2025-12-05', end: '2026-01-03' });
  assert.equal(focusRange('all', {}, now), null);
});

test('custom range includes both complete boundary days, excluding adjacent days', () => {
  const sessions = [
    session('before', '2026-10-01T23:59:59.999'),
    session('start', '2026-10-02T00:00:00.000', 25),
    session('end', '2026-10-04T23:59:59.999', 35, null),
    session('after', '2026-10-05T00:00:00.000'),
  ];
  const summary = summarizeFocus(sessions, { start: '2026-10-02', end: '2026-10-04' });
  assert.deepEqual(summary.sessions.map(s => s.id), ['end', 'start']);
  assert.equal(summary.totalMs, 60 * 60_000);
  assert.deepEqual(summary.days.map(d => d.key), ['2026-10-02', '2026-10-04']);
  assert.equal(summary.days.reduce((sum, d) => sum + d.totalMs, 0), summary.totalMs);
  assert.equal(summary.tasks.reduce((sum, t) => sum + t.totalMs, 0), summary.totalMs);
});

test('one-day range groups multiple sessions and tasks without mutating the full history', () => {
  const sessions = [
    session('old', '2025-12-31T12:00:00'),
    session('a', '2026-01-01T10:00:00', 10),
    session('b', '2026-01-01T11:00:00', 20),
    session('c', '2026-01-01T12:00:00', 30, 'deleted-task'),
    session('d', '2026-01-01T13:00:00', 40, null),
  ];
  const original = JSON.stringify(sessions);
  sessions.forEach(Object.freeze);
  Object.freeze(sessions);
  const filtered = summarizeFocus(sessions, { start: '2026-01-01', end: '2026-01-01' });
  assert.equal(filtered.sessions.length, 4);
  assert.equal(filtered.days.length, 1);
  assert.equal(filtered.days[0].count, 4);
  assert.equal(filtered.totalMs, 100 * 60_000);
  assert.equal(filtered.tasks.find(t => t.taskId === 'task-a').totalMs, 30 * 60_000);
  assert.equal(filtered.tasks.find(t => t.taskId === null).count, 1);
  assert.equal(summarizeFocus(sessions, null).sessions.length, 5);
  assert.equal(JSON.stringify(sessions), original);
});

test('missing, impossible, and reversed dates report errors instead of all-time results', () => {
  const sessions = [session('a', '2026-01-01T12:00:00')];
  for (const range of [
    { start: '', end: '2026-01-01' },
    { start: '2026-01-01', end: '' },
    { start: '2026-02-30', end: '2026-03-01' },
    { start: '2026-01-02', end: '2026-01-01' },
  ]) {
    assert.ok(focusRangeError(range));
    const summary = summarizeFocus(sessions, range);
    assert.equal(summary.sessions.length, 0);
    assert.equal(summary.totalMs, 0);
    assert.equal(summary.days.length, 0);
    assert.equal(summary.tasks.length, 0);
  }
  assert.equal(focusRangeError({ start: '2028-02-29', end: '2028-02-29' }), null);
});

test('empty ranges are valid and new sessions are reflected without changing the range', () => {
  const range = { start: '2026-10-02', end: '2026-10-04' };
  assert.equal(summarizeFocus([], range).error, null);
  assert.equal(summarizeFocus([session('outside', '2026-10-05T12:00:00')], range).totalMs, 0);
  assert.equal(summarizeFocus([session('new', '2026-10-03T12:00:00')], range).sessions.length, 1);
});

test('local dates, including daylight-saving transitions, are not UTC day buckets', () => {
  const previousTZ = process.env.TZ;
  try {
    process.env.TZ = 'America/New_York';
    assert.equal(localDayKey(new Date('2026-03-08T04:30:00Z')), '2026-03-07');
    const range = { start: '2026-03-08', end: '2026-03-08' };
    const sessions = [
      session('before', '2026-03-08T04:59:59.999Z'),
      session('start', '2026-03-08T05:00:00.000Z'),
      session('end', '2026-03-09T03:59:59.999Z'),
      session('after', '2026-03-09T04:00:00.000Z'),
    ];
    assert.deepEqual(summarizeFocus(sessions, range).sessions.map(s => s.id), ['end', 'start']);
    assert.deepEqual(focusRange('week', {}, new Date('2026-03-10T12:00:00')), {
      start: '2026-03-04', end: '2026-03-10',
    });
  } finally {
    if (previousTZ === undefined) delete process.env.TZ;
    else process.env.TZ = previousTZ;
  }
});
