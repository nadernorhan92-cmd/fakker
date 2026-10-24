import { createECDH, createHash, ECDH, hkdfSync, randomBytes } from "node:crypto";
import webpush from "web-push";
import { pool } from "@workspace/db";
import { logger } from "./logger";
import type { PushPlan } from "@workspace/api-zod";

// Derive a stable, domain-separated VAPID key without exposing the session secret.
// Rotating SESSION_SECRET invalidates existing subscriptions; users must re-enable.
const secret = process.env.SESSION_SECRET;
if (!secret) throw new Error("SESSION_SECRET is required for Web Push");
const privateKey = Buffer.from(hkdfSync("sha256", secret, "fakker-web-push", "vapid-p256-v1", 32));
const ecdh = createECDH("prime256v1");
ecdh.setPrivateKey(privateKey);
export const publicKey = ecdh.getPublicKey().toString("base64url");
const vapidKeys = { publicKey, privateKey: privateKey.toString("base64url") };

export const ownerHash = (token: string) => createHash("sha256").update(token).digest("hex");
export function validSubscription(subscription: PushPlan["subscription"]): boolean {
  try {
    const url = new URL(subscription.endpoint);
    const allowed = ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"];
    const hostAllowed = allowed.includes(url.hostname) || url.hostname.endsWith(".notify.windows.com");
    const key = Buffer.from(subscription.keys.p256dh, "base64url");
    ECDH.convertKey(key, "prime256v1"); // Reject off-curve keys before scheduling.
    return url.protocol === "https:" && !url.port && !url.username && !url.password && hostAllowed
      && /^[A-Za-z0-9_-]+={0,2}$/.test(subscription.keys.p256dh)
      && /^[A-Za-z0-9_-]+={0,2}$/.test(subscription.keys.auth)
      && key.length === 65 && key[0] === 4
      && Buffer.from(subscription.keys.auth, "base64url").length === 16;
  } catch { return false; }
}

// All changes and sends for a device take the same database lock, including
// across server instances. A successful cancellation cannot race a later send.
export async function deviceTransaction<T>(owner: string, work: (client: Pick<typeof pool, "query">) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [owner]);
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function savePlan(owner: string, plan: PushPlan, subject: string) {
  return deviceTransaction(owner, async client => {
    const claimed = await client.query("SELECT owner FROM push_devices WHERE endpoint=$1", [plan.subscription.endpoint]);
    if (claimed.rows[0] && claimed.rows[0].owner !== owner) return false;
    await client.query(`INSERT INTO push_devices(owner,endpoint,subscription) VALUES($1,$2,$3)
      ON CONFLICT(owner) DO UPDATE SET endpoint=$2,subscription=$3,updated_at=now()`,
    [owner, plan.subscription.endpoint, JSON.stringify({ ...plan.subscription, subject })]);
    const ids = plan.reminders.map(r => r.id);
    await client.query("DELETE FROM push_reminders WHERE owner=$1 AND NOT(task_id=ANY($2::text[]))", [owner, ids]);
    for (const reminder of plan.reminders) {
      const previous = await client.query("SELECT id,remind_at FROM push_reminders WHERE owner=$1 AND task_id=$2", [owner, reminder.id]);
      if (previous.rows[0] && new Date(previous.rows[0].remind_at).getTime() === new Date(reminder.remindAt).getTime()) {
        await client.query("UPDATE push_reminders SET title=$2,due_at=$3 WHERE id=$1", [previous.rows[0].id, reminder.title, reminder.dueAt]);
      } else {
        await client.query("DELETE FROM push_reminders WHERE owner=$1 AND task_id=$2", [owner, reminder.id]);
        await client.query(`INSERT INTO push_reminders(owner,task_id,title,remind_at,due_at,receipt)
          VALUES($1,$2,$3,$4,$5,$6)`, [owner, reminder.id, reminder.title, reminder.remindAt, reminder.dueAt, randomBytes(32).toString("base64url")]);
      }
    }
    return true;
  });
}

export const deletePlan = (owner: string) => deviceTransaction(owner, async client => {
  await client.query("DELETE FROM push_devices WHERE owner=$1", [owner]);
});

type Send = typeof webpush.sendNotification;
// The transport is injectable only for deterministic server tests, not via HTTP.
export async function dispatchDue(send: Send = webpush.sendNotification, onlyOwner?: string) {
  const owners = await pool.query(`SELECT DISTINCT owner FROM push_reminders
    WHERE sent_at IS NULL AND remind_at<=now() AND retry_at<=now() AND due_at>now()
    AND ($1::text IS NULL OR owner=$1) LIMIT 100`, [onlyOwner ?? null]);
  for (const { owner } of owners.rows) {
    await deviceTransaction(owner, async client => {
      const jobs = await client.query(`SELECT r.*,d.subscription FROM push_reminders r
        JOIN push_devices d USING(owner) WHERE r.owner=$1 AND r.sent_at IS NULL
        AND r.remind_at<=now() AND r.retry_at<=now() AND r.due_at>now()
        ORDER BY r.remind_at LIMIT 50`, [owner]);
      for (const job of jobs.rows) {
        try {
          const { subject, ...subscription } = job.subscription;
          await send(subscription, JSON.stringify({ id: job.id, receipt: job.receipt }), {
            vapidDetails: { ...vapidKeys, subject },
            TTL: Math.max(0, Math.min(3600, Math.floor((new Date(job.due_at).getTime() - Date.now()) / 1000))),
            urgency: "high", timeout: 10_000,
          });
          await client.query("UPDATE push_reminders SET sent_at=now() WHERE id=$1", [job.id]);
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await client.query("DELETE FROM push_devices WHERE owner=$1", [owner]);
            break;
          }
          // Log only status, never endpoint/key material or task contents.
          logger.warn({ status }, "Push delivery failed; will retry");
          await client.query(`UPDATE push_reminders SET attempts=attempts+1,
            retry_at=now()+least(3600,60*power(2,least(attempts,6)))*interval '1 second' WHERE id=$1`, [job.id]);
          // Do not hold the cancellation lock through a whole batch of network
          // timeouts; let a waiting delete proceed after this failed attempt.
          break;
        }
      }
    });
  }
  if (!onlyOwner) {
    await pool.query("DELETE FROM push_reminders WHERE due_at < now()-interval '1 day'");
    await pool.query(`DELETE FROM push_devices d WHERE updated_at < now()-interval '180 days'
      AND NOT EXISTS(SELECT 1 FROM push_reminders r WHERE r.owner=d.owner AND r.due_at>now())`);
  }
}

export function startPushScheduler() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await dispatchDue(); }
    catch { logger.error("Push scheduler failed; retrying on next tick"); }
    finally { running = false; }
  };
  void tick();
  const timer = setInterval(() => void tick(), 15_000);
  timer.unref();
}
