import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import botRouter from "./bot.js";
import settingsRouter from "./settings.js";
import warningsRouter from "./warnings.js";
import activityRouter from "./activity.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(botRouter);
router.use(settingsRouter);
router.use(warningsRouter);
router.use(activityRouter);

export default router;
