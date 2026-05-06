import { logger } from "../lib/logger.js";
import {
  settings,
  warnings,
  mutes,
  botState,
  addActivity,
  saveWarnings,
  saveMutes,
  isMuted,
  stats,
} from "./state.js";

let sock: any = null;
let isStarting = false;
let sockReady = false;
let reconnectAttempts = 0;

// When set, the bot will auto-request a pairing code after each reconnect
let pendingPairPhone: string | null = null;

export async function startBot() {
  if (isStarting) return;
  isStarting = true;
  logger.info("Starting DLS WhatsApp Bot...");

  try {
    const baileys = await import("@whiskeysockets/baileys");
    // CJS default export wraps all named exports under .default in ESM dynamic import
    const mod = (baileys.default ?? baileys) as any;
    const makeWASocket = mod.default ?? mod.makeWASocket ?? mod;
    const DisconnectReason = mod.DisconnectReason;
    const useMultiFileAuthState = mod.useMultiFileAuthState;
    const fetchLatestBaileysVersion = mod.fetchLatestBaileysVersion;
    const { Boom } = await import("@hapi/boom");
    const QRCode = await import("qrcode");

    const { state, saveCreds } = await useMultiFileAuthState("./auth_info");

    const { version } = await fetchLatestBaileysVersion();
    logger.info({ version }, "Using WhatsApp version");

    sock = makeWASocket({
      logger: (await import("pino")).default({ level: "silent" }),
      printQRInTerminal: false,
      auth: state,
      browser: ["Ubuntu", "Chrome", "22.24.79"],
      version,
      getMessage: async () => ({}),
    });

    // If we were in pairing mode, auto-request the code on this new socket
    if (pendingPairPhone) {
      // Give the socket a moment to reach a connectable state
      setTimeout(async () => {
        if (pendingPairPhone && sock && !botState.connected) {
          try {
            const code: string = await sock.requestPairingCode(pendingPairPhone);
            botState.pairingCode = code;
            botState.qr = null;
            logger.info({ code }, "Pairing code refreshed after reconnect");
          } catch (e: any) {
            logger.warn({ err: e.message }, "Failed to re-request pairing code");
          }
        }
      }, 3000);
    }

    sock.ev.on("connection.update", async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        // Only show QR if we're not in phone-number pairing mode
        if (!pendingPairPhone) {
          try {
            botState.qr = await QRCode.default.toDataURL(qr);
            botState.pairingCode = null;
            botState.connected = false;
            logger.info("QR code generated");
          } catch (e) {
            logger.warn("Failed to generate QR data URL");
          }
        }
      }

      if (connection === "open") {
        sockReady = true;
      }

      if (connection === "close") {
        sockReady = false;
        const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
        botState.connected = false;
        botState.phoneNumber = null;
        botState.startedAt = null;

        addActivity({
          timestamp: Date.now(),
          type: "disconnected",
          groupId: "",
          userId: "",
          detail: `Disconnected (code: ${statusCode})`,
        });

        const isRegistered = state.creds?.registered ?? false;
        const wasLoggedOut = statusCode === DisconnectReason.loggedOut && isRegistered;

        if (!wasLoggedOut) {
          reconnectAttempts++;
          // Exponential backoff: 5s, 10s, 20s, 40s, 60s max
          // After 5 failed attempts, wait 5 minutes to avoid IP blocks
          const delay = reconnectAttempts > 5
            ? 5 * 60 * 1000
            : Math.min(5000 * Math.pow(2, reconnectAttempts - 1), 60000);
          logger.info(`Reconnecting in ${Math.round(delay / 1000)}s (attempt ${reconnectAttempts}, code: ${statusCode})...`);
          isStarting = false;
          setTimeout(startBot, delay);
        } else {
          logger.warn("Session logged out by WhatsApp. Use LOGOUT to get a new QR.");
          pendingPairPhone = null;
          botState.pairingCode = null;
          reconnectAttempts = 0;
          isStarting = false;
        }
      } else if (connection === "open") {
        botState.connected = true;
        botState.qr = null;
        botState.pairingCode = null;
        pendingPairPhone = null;
        reconnectAttempts = 0;
        botState.startedAt = Date.now();
        botState.phoneNumber = sock?.user?.id?.split(":")[0] ?? null;
        isStarting = false;
        logger.info({ phone: botState.phoneNumber }, "DLS Bot connected!");

        addActivity({
          timestamp: Date.now(),
          type: "connected",
          groupId: "",
          userId: "",
          detail: `Connected as ${botState.phoneNumber}`,
        });
      }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async (m: any) => {
      try {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith("@g.us");
        if (!isGroup) return;

        const sender = msg.key.participant || msg.key.remoteJid;
        const text =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption ||
          "";

        const lowerText = text.toLowerCase();
        const groupMeta = await sock.groupMetadata(from);
        const groupAdmins = groupMeta.participants
          .filter((p: any) => p.admin)
          .map((p: any) => p.id);
        const isAdmin = groupAdmins.includes(sender);
        const isBotAdmin = groupAdmins.includes(sock.user.id);

        if (isAdmin && text.startsWith("!")) {
          const args = text.slice(1).trim().split(" ");
          const cmd = args[0].toLowerCase();
          stats.commandsUsed++;

          addActivity({
            timestamp: Date.now(),
            type: "command_used",
            groupId: from,
            userId: sender,
            detail: `!${cmd}`,
          });

          if (cmd === "antilink") {
            settings.antilink = args[1] === "on";
            const { saveSettings } = await import("./state.js");
            saveSettings();
            await sock.sendMessage(from, {
              text: `Anti-link: ${settings.antilink ? "ON" : "OFF"}`,
            });
            return;
          }
          if (cmd === "antiword") {
            settings.antiword = args[1] === "on";
            const { saveSettings } = await import("./state.js");
            saveSettings();
            await sock.sendMessage(from, {
              text: `Anti-word: ${settings.antiword ? "ON" : "OFF"}`,
            });
            return;
          }
          if (cmd === "warnlimit") {
            const limit = parseInt(args[1]);
            if (limit > 0) {
              settings.warnKick = limit;
              const { saveSettings } = await import("./state.js");
              saveSettings();
              await sock.sendMessage(from, {
                text: `Users kicked after ${limit} warnings`,
              });
            }
            return;
          }
          if (cmd === "addword") {
            const word = args.slice(1).join(" ").toLowerCase();
            if (word && !settings.badwords.includes(word)) {
              settings.badwords.push(word);
              const { saveSettings } = await import("./state.js");
              saveSettings();
              await sock.sendMessage(from, {
                text: `Added banned word: "${word}"`,
              });
            }
            return;
          }
          if (cmd === "removeword") {
            const word = args.slice(1).join(" ").toLowerCase();
            settings.badwords = settings.badwords.filter((w) => w !== word);
            const { saveSettings } = await import("./state.js");
            saveSettings();
            await sock.sendMessage(from, {
              text: `Removed banned word: "${word}"`,
            });
            return;
          }
          if (cmd === "listwords") {
            await sock.sendMessage(from, {
              text: `Banned words: ${settings.badwords.join(", ")}`,
            });
            return;
          }
          if (cmd === "warn") {
            if (!isBotAdmin) {
              await sock.sendMessage(from, { text: "I need to be an admin to issue warnings." });
              return;
            }
            const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
              ?? ((args[1]?.replace("@", "") ?? "") + "@s.whatsapp.net");
            const reason = args.slice(2).join(" ") || "No reason given";
            if (!target || target === "@s.whatsapp.net") {
              await sock.sendMessage(from, { text: "Usage: !warn @user [reason]" });
              return;
            }
            const key = `${from}@${target}`;
            if (!warnings[key]) warnings[key] = { count: 0, lastWarn: 0 };
            warnings[key].count++;
            warnings[key].lastWarn = Date.now();
            saveWarnings();
            stats.wordsWarned++;
            stats.totalWarnings++;
            const warnCount = warnings[key].count;
            if (warnCount >= settings.warnKick) {
              await sock.sendMessage(from, {
                text: `⚠️ @${target.split("@")[0]} has reached ${settings.warnKick} warnings (reason: ${reason}). Kicking...`,
                mentions: [target],
              });
              await sock.groupParticipantsUpdate(from, [target], "remove");
              delete warnings[key];
              saveWarnings();
              stats.usersKicked++;
              addActivity({
                timestamp: Date.now(),
                type: "user_kicked",
                groupId: from,
                userId: target,
                detail: `Kicked after ${settings.warnKick} warnings — last reason: ${reason}`,
              });
            } else {
              await sock.sendMessage(from, {
                text: `⚠️ @${target.split("@")[0]} warned (${warnCount}/${settings.warnKick})\nReason: ${reason}`,
                mentions: [target],
              });
              addActivity({
                timestamp: Date.now(),
                type: "word_warned",
                groupId: from,
                userId: target,
                detail: `Manual warning ${warnCount}/${settings.warnKick} — ${reason}`,
              });
            }
            return;
          }
          if (cmd === "delwarn") {
            const user = (args[1]?.replace("@", "") ?? "") + "@s.whatsapp.net";
            const key = `${from}@${user}`;
            delete warnings[key];
            saveWarnings();
            await sock.sendMessage(from, {
              text: `Cleared warnings for @${user.split("@")[0]}`,
              mentions: [user],
            });
            return;
          }
          if (cmd === "warnings") {
            const user =
              (args[1]?.replace("@", "") ?? sender.split("@")[0]) +
              "@s.whatsapp.net";
            const key = `${from}@${user}`;
            const count = warnings[key]?.count || 0;
            await sock.sendMessage(from, {
              text: `@${user.split("@")[0]} has ${count}/${settings.warnKick} warnings`,
              mentions: [user],
            });
            return;
          }
          if (cmd === "mute") {
            if (!isBotAdmin) {
              await sock.sendMessage(from, { text: "I need to be an admin to mute members." });
              return;
            }
            const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
              ?? ((args[1]?.replace("@", "") ?? "") + "@s.whatsapp.net");
            const minutes = parseInt(args[2] ?? args[1] ?? "10");
            if (!target || target === "@s.whatsapp.net" || isNaN(minutes) || minutes <= 0) {
              await sock.sendMessage(from, { text: "Usage: !mute @user <minutes>" });
              return;
            }
            const expiresAt = Date.now() + minutes * 60_000;
            mutes[`${from}@${target}`] = expiresAt;
            saveMutes();
            await sock.sendMessage(from, {
              text: `🔇 @${target.split("@")[0]} has been muted for ${minutes} minute${minutes === 1 ? "" : "s"}. Their messages will be deleted.`,
              mentions: [target],
            });
            addActivity({
              timestamp: Date.now(),
              type: "user_muted",
              groupId: from,
              userId: target,
              detail: `Muted for ${minutes} minute${minutes === 1 ? "" : "s"}`,
            });
            // Auto-announce when mute expires
            setTimeout(async () => {
              const key = `${from}@${target}`;
              if (mutes[key]) {
                delete mutes[key];
                saveMutes();
                try {
                  await sock.sendMessage(from, {
                    text: `🔊 @${target.split("@")[0]}'s mute has expired.`,
                    mentions: [target],
                  });
                } catch (_) {}
              }
            }, minutes * 60_000);
            return;
          }
          if (cmd === "unmute") {
            const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
              ?? ((args[1]?.replace("@", "") ?? "") + "@s.whatsapp.net");
            if (!target || target === "@s.whatsapp.net") {
              await sock.sendMessage(from, { text: "Usage: !unmute @user" });
              return;
            }
            const key = `${from}@${target}`;
            if (mutes[key]) {
              delete mutes[key];
              saveMutes();
              await sock.sendMessage(from, {
                text: `🔊 @${target.split("@")[0]} has been unmuted.`,
                mentions: [target],
              });
              addActivity({
                timestamp: Date.now(),
                type: "user_unmuted",
                groupId: from,
                userId: target,
                detail: "Manually unmuted by admin",
              });
            } else {
              await sock.sendMessage(from, {
                text: `@${target.split("@")[0]} is not currently muted.`,
                mentions: [target],
              });
            }
            return;
          }
          if (cmd === "kick") {
            if (!isBotAdmin) {
              await sock.sendMessage(from, { text: "I need to be an admin to kick members." });
              return;
            }
            // Accept @mention (participant tag) or plain number
            const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
              ?? ((args[1]?.replace("@", "") ?? "") + "@s.whatsapp.net");
            if (!target || target === "@s.whatsapp.net") {
              await sock.sendMessage(from, { text: "Usage: !kick @user" });
              return;
            }
            try {
              await sock.groupParticipantsUpdate(from, [target], "remove");
              await sock.sendMessage(from, {
                text: `@${target.split("@")[0]} has been kicked.`,
                mentions: [target],
              });
              stats.usersKicked++;
              addActivity({
                timestamp: Date.now(),
                type: "user_kicked",
                groupId: from,
                userId: target,
                detail: `Manually kicked by admin`,
              });
            } catch (e: any) {
              await sock.sendMessage(from, { text: `Failed to kick: ${e.message}` });
            }
            return;
          }
          if (cmd === "status") {
            const uptimeMs = botState.startedAt ? Date.now() - botState.startedAt : 0;
            const uptimeStr = uptimeMs > 0
              ? (() => {
                  const h = Math.floor(uptimeMs / 3_600_000);
                  const m = Math.floor((uptimeMs % 3_600_000) / 60_000);
                  const s = Math.floor((uptimeMs % 60_000) / 1_000);
                  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
                })()
              : "just started";
            const activeGroupCount = stats.activeGroups.size;
            const statusText = [
              `*DLS Bot Status*`,
              ``,
              `🟢 *Connected:* ${botState.connected ? "Yes" : "No"}`,
              `⏱️ *Uptime:* ${uptimeStr}`,
              `📱 *Number:* ${botState.phoneNumber ?? "unknown"}`,
              ``,
              `📊 *Stats (this session)*`,
              `🔗 Links deleted: ${stats.linksDeleted}`,
              `⚠️ Warnings issued: ${stats.wordsWarned}`,
              `🚫 Users kicked: ${stats.usersKicked}`,
              `🤖 Commands used: ${stats.commandsUsed}`,
              `👥 Active groups: ${activeGroupCount}`,
              ``,
              `⚙️ *Settings*`,
              `Anti-link: ${settings.antilink ? "ON" : "OFF"}`,
              `Anti-word: ${settings.antiword ? "ON" : "OFF"}`,
              `Warn limit: ${settings.warnKick}`,
            ].join("\n");
            await sock.sendMessage(from, { text: statusText });
            return;
          }
          if (cmd === "help") {
            const helpText = `*DLS BOT COMMANDS*\n\n!antilink on/off - Toggle link deletion\n!antiword on/off - Toggle word filter\n!warnlimit <num> - Set warnings before kick\n!warnings @user - Check user warnings\n!delwarn @user - Reset user warnings\n!addword <word> - Add banned word\n!removeword <word> - Remove banned word\n!listwords - Show banned words\n!status - Show bot stats & settings\n!kick @user - Remove a member from the group\n!mute @user <minutes> - Silence a member (deletes their messages)\n!unmute @user - Remove a mute early\n!warn @user [reason] - Manually issue a warning`;
            await sock.sendMessage(from, { text: helpText });
            return;
          }
        }

        if (!isBotAdmin || isAdmin) return;

        // Auto-delete messages from muted users
        if (isMuted(from, sender)) {
          await sock.sendMessage(from, { delete: msg.key });
          return;
        }

        const linkRegex =
          /https?:\/\/|www\.|wa\.me\/|t\.me\/|chat\.whatsapp\.com|discord\.gg/i;
        if (settings.antilink && linkRegex.test(lowerText)) {
          await sock.sendMessage(from, { delete: msg.key });
          await sock.sendMessage(from, {
            text: `@${sender.split("@")[0]} Links are not allowed!`,
            mentions: [sender],
          });
          stats.linksDeleted++;
          addActivity({
            timestamp: Date.now(),
            type: "link_deleted",
            groupId: from,
            userId: sender,
            detail: text.slice(0, 60),
          });
          return;
        }

        if (settings.antiword) {
          const foundWord = settings.badwords.find((word) =>
            lowerText.includes(word)
          );
          if (foundWord) {
            const key = `${from}@${sender}`;
            if (!warnings[key]) warnings[key] = { count: 0, lastWarn: 0 };
            warnings[key].count++;
            warnings[key].lastWarn = Date.now();
            saveWarnings();
            stats.wordsWarned++;
            stats.totalWarnings++;

            const warnCount = warnings[key].count;
            await sock.sendMessage(from, { delete: msg.key });

            if (warnCount >= settings.warnKick) {
              await sock.sendMessage(from, {
                text: `@${sender.split("@")[0]} reached ${settings.warnKick} warnings. Kicking...`,
                mentions: [sender],
              });
              await sock.groupParticipantsUpdate(from, [sender], "remove");
              delete warnings[key];
              saveWarnings();
              stats.usersKicked++;
              addActivity({
                timestamp: Date.now(),
                type: "user_kicked",
                groupId: from,
                userId: sender,
                detail: `Kicked after ${settings.warnKick} warnings`,
              });
            } else {
              await sock.sendMessage(from, {
                text: `@${sender.split("@")[0]} Warning ${warnCount}/${settings.warnKick} - No swearing!`,
                mentions: [sender],
              });
              addActivity({
                timestamp: Date.now(),
                type: "word_warned",
                groupId: from,
                userId: sender,
                detail: `Warning ${warnCount}/${settings.warnKick} — matched word`,
              });
            }
          }
        }
      } catch (e: any) {
        logger.error({ err: e.message }, "Message handler error");
      }
    });
  } catch (e: any) {
    logger.error({ err: e.message }, "Failed to start bot");
    isStarting = false;
    setTimeout(startBot, 10000);
  }
}

export async function getPairingCode(phoneNumber: string): Promise<string> {
  if (!sock) {
    throw new Error("Bot socket not initialized yet — wait a moment and try again");
  }
  if (botState.connected) {
    throw new Error("Bot is already connected");
  }
  const clean = phoneNumber.replace(/\D/g, "");
  // Store phone so reconnects auto-refresh the code
  pendingPairPhone = clean;
  const code: string = await sock.requestPairingCode(clean);
  botState.pairingCode = code;
  botState.qr = null;
  logger.info({ code }, "Pairing code generated");
  return code;
}

export async function restartBot() {
  if (sock) {
    try {
      await sock.end();
    } catch (_) {}
    sock = null;
  }
  pendingPairPhone = null;
  botState.connected = false;
  botState.qr = null;
  botState.pairingCode = null;
  isStarting = false;
  sockReady = false;
  await startBot();
}

export async function logoutBot() {
  if (sock) {
    try {
      await sock.logout();
    } catch (_) {}
    sock = null;
  }
  pendingPairPhone = null;
  botState.connected = false;
  botState.qr = null;
  botState.pairingCode = null;
  botState.phoneNumber = null;
  isStarting = false;
  sockReady = false;

  const fs = await import("node:fs");
  if (fs.existsSync("./auth_info")) {
    fs.rmSync("./auth_info", { recursive: true, force: true });
  }

  await startBot();
}
