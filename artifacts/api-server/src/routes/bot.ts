import { Router } from "express";
import { botState } from "../bot/state.js";
import { restartBot, logoutBot, getPairingCode } from "../bot/bot.js";
import { RequestPairingCodeBody } from "@workspace/api-zod";

const router = Router();

router.get("/bot/status", (req, res) => {
  const uptime =
    botState.startedAt ? Math.floor((Date.now() - botState.startedAt) / 1000) : null;
  res.json({
    connected: botState.connected,
    qr: botState.qr,
    phoneNumber: botState.phoneNumber,
    uptime,
  });
});

router.post("/bot/restart", async (_req, res) => {
  restartBot().catch(() => {});
  res.json({ success: true, message: "Bot restart initiated" });
});

router.post("/bot/logout", async (_req, res) => {
  logoutBot().catch(() => {});
  res.json({ success: true, message: "Bot logged out and restarting" });
});

router.post("/bot/pair", async (req, res) => {
  const parsed = RequestPairingCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "phoneNumber is required" });
    return;
  }
  if (botState.connected) {
    res.status(400).json({ success: false, message: "Bot is already connected" });
    return;
  }
  try {
    const code = await getPairingCode(parsed.data.phoneNumber);
    res.json({ success: true, code, message: "Enter this code in WhatsApp > Linked Devices > Link with phone number" });
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message ?? "Failed to generate pairing code" });
  }
});

export default router;
