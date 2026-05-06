import { Router } from "express";
import { warnings, saveWarnings, settings } from "../bot/state.js";

const router = Router();

router.get("/warnings", (_req, res) => {
  const entries = Object.entries(warnings).map(([key, record]) => {
    const parts = key.split("@");
    const userId = parts.pop() ?? key;
    const groupId = parts.join("@");
    return {
      key,
      groupId,
      userId,
      count: record.count,
      lastWarn: record.lastWarn,
    };
  });
  res.json(entries);
});

router.delete("/warnings", (_req, res) => {
  for (const key in warnings) delete warnings[key];
  saveWarnings();
  res.json({ success: true, message: "All warnings cleared" });
});

router.delete("/warnings/:warningKey", (req, res) => {
  const key = decodeURIComponent(req.params.warningKey);
  if (warnings[key]) {
    delete warnings[key];
    saveWarnings();
    res.json({ success: true, message: "Warning cleared" });
  } else {
    res.status(404).json({ success: false, message: "Warning not found" });
  }
});

export default router;
