import { Router, type IRouter } from "express";
import healthRouter from "./health";
import matchesRouter from "./matches";
import playersRouter from "./players";
import betsRouter from "./bets";
import rankingRouter from "./ranking";
import reportsRouter from "./reports";
import withdrawalsRouter from "./withdrawals";
import statsRouter from "./stats";
import adminRouter from "./admin";
import activityLogsRouter from "./activityLogs";
import balanceAdjustmentsRouter from "./balanceAdjustments";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

router.use(healthRouter);
router.use(matchesRouter);
router.use(playersRouter);
router.use(betsRouter);
router.use(rankingRouter);
router.use(reportsRouter);
router.use(withdrawalsRouter);
router.use(statsRouter);
router.use(adminRouter);
router.use(activityLogsRouter);
router.use(balanceAdjustmentsRouter);
router.use(notificationsRouter);

export default router;
