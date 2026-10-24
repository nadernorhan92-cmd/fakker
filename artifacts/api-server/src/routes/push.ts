import { Router, type Request } from "express";
import { pool } from "@workspace/db";
import { PushConfigResponse, PushStatusResponse, SavePushSubscriptionBody, PushDeliveryBody, PushDeliveryResponse } from "@workspace/api-zod";
import { deletePlan, ownerHash, publicKey, savePlan, validSubscription } from "../lib/push";

const router = Router();
function owner(req: Request) {
  const token = req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  return token ? ownerHash(token) : null;
}
router.use("/push", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
router.get("/push/config", (_req, res) => { res.json(PushConfigResponse.parse({ publicKey })); });
router.get("/push/subscription", async (req, res): Promise<void> => {
  const device = owner(req);
  if (!device) { res.sendStatus(401); return; }
  const result = await pool.query("SELECT 1 FROM push_devices WHERE owner=$1", [device]);
  res.json(PushStatusResponse.parse({ active: result.rowCount !== 0 }));
});
router.put("/push/subscription", async (req, res): Promise<void> => {
  const device = owner(req);
  if (!device) { res.sendStatus(401); return; }
  // The generated Date coercion accepts numbers/null; the wire contract does not.
  if (!Array.isArray(req.body?.reminders) || req.body.reminders.some((r: { remindAt?: unknown; dueAt?: unknown } | null) =>
    !r || typeof r.remindAt !== "string" || typeof r.dueAt !== "string"
    || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(r.remindAt)
    || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(r.dueAt))) { res.sendStatus(400); return; }
  const parsed = SavePushSubscriptionBody.safeParse(req.body);
  if (!parsed.success) { res.sendStatus(400); return; }
  const plan = parsed.data;
  if (!validSubscription(plan.subscription) || new Set(plan.reminders.map(r => r.id)).size !== plan.reminders.length
    || plan.reminders.some(r => !Number.isFinite(new Date(r.remindAt).getTime()) || !Number.isFinite(new Date(r.dueAt).getTime())
      || new Date(r.remindAt) > new Date(r.dueAt))) { res.sendStatus(400); return; }
  try {
    const origin = req.get("origin");
    const subject = origin && /^https?:\/\/[^/]+$/.test(origin) ? origin : `https://${req.hostname}`;
    if (!(await savePlan(device, plan, subject))) { res.sendStatus(409); return; }
  } catch (error) {
    if ((error as { code?: string }).code === "23505") { res.sendStatus(409); return; }
    throw error;
  }
  res.sendStatus(204);
});
router.delete("/push/subscription", async (req, res): Promise<void> => {
  const device = owner(req);
  if (!device) { res.sendStatus(401); return; }
  await deletePlan(device);
  res.sendStatus(204);
});
router.post("/push/delivery", async (req, res): Promise<void> => {
  const parsed = PushDeliveryBody.safeParse(req.body);
  if (!parsed.success) { res.sendStatus(400); return; }
  const result = await pool.query(`SELECT title,task_id FROM push_reminders
    WHERE id=$1 AND receipt=$2 AND remind_at<=now() AND due_at>now()`, [parsed.data.id, parsed.data.receipt]);
  const reminder = result.rows[0];
  if (!reminder) { res.sendStatus(404); return; }
  res.json(PushDeliveryResponse.parse({ title: reminder.title, taskId: reminder.task_id }));
});
export default router;
