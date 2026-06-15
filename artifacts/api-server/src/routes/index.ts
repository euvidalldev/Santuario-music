import { Router, type IRouter } from "express";
import healthRouter from "./health";
import foldersRouter from "./folders";
import tracksRouter from "./tracks";
import downloadsRouter from "./downloads";
import statsRouter from "./stats";
import uploadRouter from "./upload";

const router: IRouter = Router();

router.use(healthRouter);
router.use(foldersRouter);
router.use(uploadRouter);
router.use(tracksRouter);
router.use(downloadsRouter);
router.use(statsRouter);

export default router;
