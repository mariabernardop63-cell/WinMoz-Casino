import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import apiRouter from "./api";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/", apiRouter);

export default router;
