// Route/DB regression tests with a test-only verified-auth stand-in.
// Real Clerk sign-in and cookie authentication are exercised by browser tests.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import express from "express";
import router from "../src/routes/study-plan";
import { pool } from "@workspace/db";

const users = [`sync_test_${randomUUID()}`, `sync_test_${randomUUID()}`];
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  const userId = req.get("Test-Verified-User") ?? null;
  req.auth = Object.assign(
    () => ({ userId, tokenType: "session_token", isAuthenticated: !!userId }),
    { [Symbol.for("@clerk/express.auth")]: true },
  ) as never;
  next();
});
app.use(router);
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
if (!address || typeof address === "string") throw new Error("Missing test port");
const base = `http://127.0.0.1:${address.port}/study-plan`;
const plan = { subjects: [{ id: "math", name: "رياضيات", color: "#a75e43" }], tasks: [] };
async function request(user?: string, method = "GET", body?: unknown, account = user) {
  return fetch(base, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { "Test-Verified-User": user } : {}), ...(account ? { "X-Study-Account": account } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
try {
  assert.equal((await request()).status, 401);
  assert.equal((await request(users[1], "GET", undefined, users[0])).status, 403);
  assert.deepEqual(await (await request(users[0])).json(), { revision: 0, plan: { subjects: [], tasks: [] } });
  assert.equal((await request(users[0], "PUT", { revision: 0, plan, consent: false })).status, 400);
  assert.equal((await request(users[0], "PUT", { revision: 0, plan })).status, 400);
  assert.equal((await request(users[0], "PUT", { revision: 0, plan, consent: true })).status, 200);
  assert.deepEqual((await (await request(users[0])).json()).plan, plan, "same account can restore its plan");
  assert.deepEqual(await (await request(users[1])).json(), { revision: 0, plan: { subjects: [], tasks: [] } }, "other account never reads owner's plan");
  assert.equal((await request(users[1], "PUT", { revision: 1, plan, consent: true })).status, 409, "other account cannot update an owner's revision");
  assert.equal((await request(users[0], "PUT", { revision: 0, plan, consent: true })).status, 409, "stale initial revision cannot overwrite data");
  const races = await Promise.all([request(users[0], "PUT", { revision: 1, plan, consent: true }), request(users[0], "PUT", { revision: 1, plan, consent: true })]);
  assert.deepEqual(races.map(r => r.status).sort(), [200, 409], "concurrent writes have exactly one winner");
  const creates = await Promise.all([request(users[1], "PUT", { revision: 0, plan, consent: true }), request(users[1], "PUT", { revision: 0, plan, consent: true })]);
  assert.deepEqual(creates.map(r => r.status).sort(), [200, 409], "concurrent initial imports have exactly one winner");
  const duplicate = { subjects: [plan.subjects[0], plan.subjects[0]], tasks: [] };
  assert.equal((await request(users[0], "PUT", { revision: 2, plan: duplicate, consent: true })).status, 400);
  process.stdout.write("Study API checks passed: consent, authenticated ownership, restoration, duplicate rejection and atomic revisions.\n");
} finally {
  server.close();
  await pool.query("DELETE FROM study_plans WHERE user_id = ANY($1)", [users]);
  await pool.end();
}
