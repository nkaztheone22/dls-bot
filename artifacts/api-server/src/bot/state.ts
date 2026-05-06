import fs from "node:fs";
import path from "node:path";
import { logger } from "../lib/logger.js";

const DATA_DIR = path.resolve(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const WARNINGS_FILE = path.join(DATA_DIR, "warnings.json");
const MUTES_FILE = path.join(DATA_DIR, "mutes.json");

export interface BotSettings {
  antilink: boolean;
  antiword: boolean;
  welcome: boolean;
  warnKick: number;
  badwords: string[];
}

export interface WarningRecord {
  count: number;
  lastWarn: number;
}

export interface ActivityEntry {
  id: string;
  timestamp: number;
  type: "link_deleted" | "word_warned" | "user_kicked" | "user_muted" | "user_unmuted" | "command_used" | "connected" | "disconnected";
  groupId: string;
  userId: string;
  detail: string;
}

export interface BotStats {
  totalWarnings: number;
  linksDeleted: number;
  wordsWarned: number;
  usersKicked: number;
  commandsUsed: number;
  activeGroups: Set<string>;
}

const defaultSettings: BotSettings = {
  antilink: true,
  antiword: true,
  welcome: false,
  warnKick: 3,
  badwords: ["fuck", "shit", "pussy", "nude", "poes", "naai"],
};

function loadSettings(): BotSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    }
  } catch (e) {
    logger.warn("Failed to load settings, using defaults");
  }
  return { ...defaultSettings };
}

function loadWarnings(): Record<string, WarningRecord> {
  try {
    if (fs.existsSync(WARNINGS_FILE)) {
      return JSON.parse(fs.readFileSync(WARNINGS_FILE, "utf-8"));
    }
  } catch (e) {
    logger.warn("Failed to load warnings");
  }
  return {};
}

function loadMutes(): Record<string, number> {
  try {
    if (fs.existsSync(MUTES_FILE)) {
      return JSON.parse(fs.readFileSync(MUTES_FILE, "utf-8"));
    }
  } catch (e) {
    logger.warn("Failed to load mutes");
  }
  return {};
}

export const settings: BotSettings = loadSettings();
export const warnings: Record<string, WarningRecord> = loadWarnings();
// mutes: key = "groupId@userId", value = expiry timestamp (ms)
export const mutes: Record<string, number> = loadMutes();
export const activityLog: ActivityEntry[] = [];
export const stats: BotStats = {
  totalWarnings: 0,
  linksDeleted: 0,
  wordsWarned: 0,
  usersKicked: 0,
  commandsUsed: 0,
  activeGroups: new Set(),
};

export const botState = {
  connected: false,
  qr: null as string | null,
  pairingCode: null as string | null,
  phoneNumber: null as string | null,
  startedAt: null as number | null,
};

export function saveSettings() {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

export function saveWarnings() {
  fs.writeFileSync(WARNINGS_FILE, JSON.stringify(warnings, null, 2));
}

export function saveMutes() {
  fs.writeFileSync(MUTES_FILE, JSON.stringify(mutes, null, 2));
}

export function isMuted(groupId: string, userId: string): boolean {
  const key = `${groupId}@${userId}`;
  if (!mutes[key]) return false;
  if (Date.now() > mutes[key]) {
    delete mutes[key];
    saveMutes();
    return false;
  }
  return true;
}

export function addActivity(entry: Omit<ActivityEntry, "id">) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  activityLog.unshift({ ...entry, id });
  if (activityLog.length > 200) activityLog.splice(200);

  if (entry.groupId) stats.activeGroups.add(entry.groupId);
}

export function clearOldWarnings() {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  for (const key in warnings) {
    if (now - warnings[key].lastWarn > oneDay) delete warnings[key];
  }
  saveWarnings();
}

setInterval(clearOldWarnings, 60 * 60 * 1000);
