import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import apiRouter from "./api";
import supportRouter from "./support";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/", supportRouter);
router.use("/", apiRouter);

export default router;
