import { Router } from "express";
import { getAuth } from "@clerk/express";
import { and, eq } from "drizzle-orm";
import { db, studyPlans } from "@workspace/db";
import { GetStudyPlanResponse, PutStudyPlanBody } from "@workspace/api-zod";

const router = Router();
router.use("/study-plan", (req, res, next) => {
  if (!getAuth(req).userId) { res.status(401).json({ error: "يلزم تسجيل الدخول." }); return; }
  if (req.get("X-Study-Account") !== getAuth(req).userId) {
    res.status(403).json({ error: "تغيّر الحساب. أعد تحميل الصفحة." }); return;
  }
  res.setHeader("Cache-Control", "no-store");
  next();
});
router.get("/study-plan", async (req, res): Promise<void> => {
  const [row] = await db.select().from(studyPlans).where(eq(studyPlans.userId, getAuth(req).userId!));
  res.json(GetStudyPlanResponse.parse(row ?? { revision: 0, plan: { subjects: [], tasks: [] } }));
});
router.put("/study-plan", async (req, res): Promise<void> => {
  const parsed = PutStudyPlanBody.safeParse(req.body);
  if (!parsed.success || parsed.data.consent !== true) {
    res.status(400).json({ error: "الخطة غير صالحة أو لم توافق على رفعها." }); return;
  }
  const { revision, plan } = parsed.data;
  for (const records of [plan.subjects, plan.tasks]) {
    if (new Set(records.map(r => r.id)).size !== records.length) {
      res.status(400).json({ error: "توجد معرفات مكررة." }); return;
    }
  }
  const userId = getAuth(req).userId!;
  // Compare-and-swap is atomic, including two devices creating their first plan.
  const rows = revision === 0
    ? await db.insert(studyPlans).values({ userId, revision: 1, plan }).onConflictDoNothing().returning()
    : await db.update(studyPlans).set({ plan, revision: revision + 1, updatedAt: new Date() })
      .where(and(eq(studyPlans.userId, userId), eq(studyPlans.revision, revision))).returning();
  if (!rows.length) { res.status(409).json({ error: "تغيّرت الخطة على جهاز آخر. راجع التعارضات ثم أعد المزامنة." }); return; }
  res.json(GetStudyPlanResponse.parse(rows[0]));
});
export default router;
