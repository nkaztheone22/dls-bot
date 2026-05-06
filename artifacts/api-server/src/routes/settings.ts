import { Router } from "express";
import { settings, saveSettings } from "../bot/state.js";
import { UpdateSettingsBody, AddBadwordBody, RemoveBadwordBody } from "@workspace/api-zod";

const router = Router();

router.get("/settings", (_req, res) => {
  res.json(settings);
});

router.put("/settings", (req, res) => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const { antilink, antiword, welcome, warnKick } = parsed.data;
  if (antilink !== undefined) settings.antilink = antilink;
  if (antiword !== undefined) settings.antiword = antiword;
  if (welcome !== undefined) settings.welcome = welcome;
  if (warnKick !== undefined) settings.warnKick = warnKick;
  saveSettings();
  res.json(settings);
});

router.post("/settings/badwords", (req, res) => {
  const parsed = AddBadwordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const word = parsed.data.word.toLowerCase().trim();
  if (word && !settings.badwords.includes(word)) {
    settings.badwords.push(word);
    saveSettings();
  }
  res.json(settings);
});

router.delete("/settings/badwords", (req, res) => {
  const parsed = RemoveBadwordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const word = parsed.data.word.toLowerCase().trim();
  settings.badwords = settings.badwords.filter((w) => w !== word);
  saveSettings();
  res.json(settings);
});

export default router;
