import assert from "node:assert/strict";
import { randomBytes, createECDH } from "node:crypto";
import { once } from "node:events";
import app from "../src/app";
import { pool } from "@workspace/db";
import { dispatchDue, ownerHash } from "../src/lib/push";

// Isolate the HTTP tests from the running scheduler and all real user records.
const testSchema = `push_test_${randomBytes(8).toString("hex")}`;
pool.on("connect", client => { void client.query(`SET search_path TO "${testSchema}", public`); });
await pool.query(`CREATE SCHEMA "${testSchema}";
  CREATE TABLE "${testSchema}".push_devices (LIKE public.push_devices INCLUDING ALL);
  CREATE TABLE "${testSchema}".push_reminders (LIKE public.push_reminders INCLUDING ALL);
  ALTER TABLE "${testSchema}".push_reminders ADD FOREIGN KEY(owner)
    REFERENCES "${testSchema}".push_devices(owner) ON DELETE CASCADE`);
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address() as { port: number };
const base = `http://127.0.0.1:${address.port}/api/push`;
const token = randomBytes(32).toString("hex");
const owner = ownerHash(token);
const otherToken = randomBytes(32).toString("hex");
const otherOwner = ownerHash(otherToken);
const key = createECDH("prime256v1"); key.generateKeys();
const subscription = {
  endpoint: `https://fcm.googleapis.com/fcm/send/test-${randomBytes(16).toString("hex")}`,
  keys: { p256dh: key.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") },
};
const future = new Date(Date.now() + 3_600_000).toISOString();
const past = new Date(Date.now() - 2000).toISOString();
const reminder = { id: "test-task", title: "مراجعة الاختبار", remindAt: past, dueAt: future };
const plan = { subscription, reminders: [reminder] };
async function request(path: string, method = "GET", body?: unknown, bearer = token) {
  return fetch(base + path, {
    method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function jobs() { return (await pool.query("SELECT * FROM push_reminders WHERE owner=$1", [owner])).rows; }
const sent: { id: string; receipt: string }[] = [];
const send = async (_subscription: unknown, payload?: string | Buffer | null) => {
  sent.push(JSON.parse(String(payload)));
  return { statusCode: 201, headers: {}, body: "" };
};
try {
  assert.equal((await request("/subscription", "GET", undefined, "invalid")).status, 401);
  const config = await (await request("/config")).json();
  assert.equal(Buffer.from(config.publicKey, "base64url").length, 65);
  assert.equal((await request("/subscription", "PUT", { ...plan, subscription: { ...subscription, endpoint: "https://127.0.0.1/private" } })).status, 400);
  assert.equal((await request("/subscription", "PUT", { ...plan, subscription: { ...subscription, endpoint: "not-a-url" } })).status, 400);
  assert.equal((await request("/subscription", "PUT", { ...plan, subscription: { ...subscription, keys: { ...subscription.keys, p256dh: Buffer.alloc(65, 4).toString("base64url") } } })).status, 400);
  assert.equal((await request("/subscription", "PUT", { ...plan, reminders: [{ ...reminder, remindAt: future, dueAt: past }] })).status, 400);
  assert.equal((await request("/subscription", "PUT", { ...plan, reminders: [{ ...reminder, remindAt: "invalid" }] })).status, 400);
  assert.equal((await request("/subscription", "PUT", { ...plan, reminders: [{ ...reminder, remindAt: null }] })).status, 400);
  assert.equal((await request("/subscription", "PUT", { ...plan, reminders: [reminder, reminder] })).status, 400);
  assert.equal((await request("/subscription", "PUT", plan)).status, 204);
  assert.equal((await request("/subscription", "PUT", plan, otherToken)).status, 409);
  assert.equal((await request("/subscription", "GET", undefined, otherToken)).status, 200);
  assert.deepEqual(await (await request("/subscription", "GET", undefined, otherToken)).json(), { active: false });

  // Dispatcher has no page/client dependency. This is a transport stub, not
  // proof of receipt from FCM or the operating system.
  await dispatchDue(send, owner);
  assert.equal(sent.length, 1);
  assert.equal((await request("/delivery", "POST", sent[0])).status, 200);
  assert.equal((await (await request("/delivery", "POST", sent[0])).json()).title, reminder.title);
  assert.equal((await request("/subscription", "PUT", plan)).status, 204);
  await dispatchDue(send, owner);
  assert.equal(sent.length, 1, "refresh must not duplicate a sent reminder");
  assert.equal((await request("/subscription", "PUT", { ...plan, reminders: [] })).status, 204);
  assert.equal((await jobs()).length, 0);
  assert.equal((await request("/delivery", "POST", sent[0])).status, 404, "queued push must not reveal a deleted task");

  // Editing a reminder changes its identity and cancels a previously queued payload.
  await request("/subscription", "PUT", plan);
  await dispatchDue(send, owner);
  const edited = { ...plan, reminders: [{ ...reminder, remindAt: new Date(Date.now() - 1000).toISOString() }] };
  await request("/subscription", "PUT", edited);
  assert.equal((await request("/delivery", "POST", sent[1])).status, 404);
  await dispatchDue(send, owner);
  assert.equal(sent.length, 3);

  await request("/subscription", "DELETE");
  assert.equal((await jobs()).length, 0);
  assert.equal((await request("/delivery", "POST", sent[2])).status, 404);
  await dispatchDue(send, owner);
  assert.equal(sent.length, 3, "unsubscribe must prevent subsequent sends");
  assert.deepEqual(await (await request("/subscription")).json(), { active: false });

  await request("/subscription", "PUT", plan);
  await dispatchDue(async () => { throw { statusCode: 503 }; }, owner);
  assert.equal((await jobs())[0].attempts, 1);
  assert.equal((await jobs())[0].sent_at, null);
  await pool.query("UPDATE push_reminders SET retry_at=now() WHERE owner=$1", [owner]);
  await dispatchDue(async () => { throw { statusCode: 410 }; }, owner);
  assert.equal((await jobs()).length, 0, "expired subscriptions must be removed with their reminders");

  // Cancellation waits for an in-flight send, then invalidates its receipt.
  await request("/subscription", "PUT", plan);
  let release!: () => void;
  let started!: () => void;
  const sending = new Promise<void>(resolve => { started = resolve; });
  const held = new Promise<void>(resolve => { release = resolve; });
  let queued: unknown;
  const dispatch = dispatchDue(async (_sub, payload) => {
    queued = JSON.parse(String(payload));
    started(); await held;
    return { statusCode: 201, headers: {}, body: "" };
  }, owner);
  await sending;
  const cancelled = request("/subscription", "DELETE");
  release();
  await dispatch;
  assert.equal((await cancelled).status, 204);
  assert.equal((await request("/delivery", "POST", queued)).status, 404);
  assert.equal((await jobs()).length, 0);
  console.log("PASS: server scheduling, isolation, input validation, duplicate prevention, edits, deletion, unsubscribe, retries, expiry, and cancellation race.");
} finally {
  await pool.query("DELETE FROM push_devices WHERE owner=ANY($1::text[])", [[owner, otherOwner]]);
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await pool.query(`DROP SCHEMA "${testSchema}" CASCADE`);
  await pool.end();
}
