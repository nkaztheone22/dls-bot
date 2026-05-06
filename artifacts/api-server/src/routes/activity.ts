import { Router } from "express";
import { activityLog, stats, warnings } from "../bot/state.js";

const router = Router();

router.get("/activity", (_req, res) => {
  res.json(activityLog.slice(0, 100));
});

router.get("/stats", (_req, res) => {
  const totalWarnings = Object.values(warnings).reduce(
    (sum, w) => sum + w.count,
    0
  );
  res.json({
    totalWarnings,
    linksDeleted: stats.linksDeleted,
    wordsWarned: stats.wordsWarned,
    usersKicked: stats.usersKicked,
    commandsUsed: stats.commandsUsed,
    activeGroups: stats.activeGroups.size,
  });
});

export default router;
