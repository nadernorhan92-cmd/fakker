import { Router, type IRouter } from "express";
import healthRouter from "./health";
import pushRouter from "./push";
import studyPlanRouter from "./study-plan";

const router: IRouter = Router();

router.use(healthRouter);
router.use(pushRouter);
router.use(studyPlanRouter);

export default router;
