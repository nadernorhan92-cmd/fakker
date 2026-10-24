import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';

const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
function worker(response = { ok: true, json: async () => ({ title: 'مراجعة', taskId: 'task' }) }) {
  const handlers = {};
  const shown = [];
  const opened = [];
  const requests = [];
  const self = {
    addEventListener: (name, handler) => { handlers[name] = handler; },
    skipWaiting: async () => {},
    registration: {
      scope: 'https://fakker.test/',
      showNotification: async (title, options) => shown.push({ title, ...options }),
    },
    clients: { claim: async () => {}, matchAll: async () => [], openWindow: async url => opened.push(url) },
  };
  vm.runInNewContext(source, {
    self, URL,
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (response instanceof Error) throw response;
      return response;
    },
  });
  async function push(data = { id: 'delivery-id', receipt: 'receipt' }) {
    let work;
    handlers.push({ data: { json: () => data }, waitUntil: value => { work = value; } });
    await work;
  }
  return { self, handlers, shown, opened, requests, push };
}
test('worker shows a validated reminder without any open app pages', async () => {
  const w = worker();
  await w.push();
  assert.equal(w.shown.length, 1);
  assert.equal(w.shown[0].body, 'حان وقت مراجعة');
  assert.equal(w.shown[0].dir, 'rtl');
  assert.equal(w.requests[0].url, '/api/push/delivery');
  assert.equal(w.requests[0].options.cache, 'no-store');
});
test('deleted task or unsubscribed receipt does not display a stale reminder', async () => {
  const w = worker({ ok: false, status: 404 });
  await w.push();
  assert.equal(w.shown.length, 0);
});
test('offline validation never displays unverified task content', async () => {
  const w = worker(new Error('offline'));
  await w.push();
  assert.equal(w.shown.length, 0);
});
test('clicking a notification opens the tasks route under the worker scope', async () => {
  const w = worker();
  let work;
  let closed = false;
  w.handlers.notificationclick({
    notification: { close: () => { closed = true; } },
    waitUntil: value => { work = value; },
  });
  await work;
  assert.equal(closed, true);
  assert.equal(w.opened[0], 'https://fakker.test/tasks');
});
