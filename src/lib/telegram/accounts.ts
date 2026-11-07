import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "../db";
import { publicAccount } from "../server";
import type { Account } from "../types";
import { botToken, botUsername, appUrl, say } from "./api";

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export const telegramName = (user: Pick<TelegramUser, "first_name" | "last_name" | "username">) =>
  [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || "Telegram";

/** Web-app ochilishi 1 kun amal qiladi: eski initData bilan kirib bo‘lmaydi. */
const INIT_DATA_MAX_AGE = 24 * 3600;

function hashMatches(pairs: [string, string][], secret: Buffer, expected: Buffer) {
  const check = pairs
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const actual = createHmac("sha256", secret).update(check).digest();
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Web-app ma’lumotini bot tokeni bilan tekshiradi. To‘g‘ri bo‘lsa, Telegram foydalanuvchisini qaytaradi. */
export function verifyInitData(initData: unknown): TelegramUser | null {
  if (typeof initData !== "string" || !initData || initData.length > 8192 || !botToken()) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash || !/^[a-f0-9]{64}$/.test(hash)) return null;
  const pairs = [...params.entries()].filter(([key]) => key !== "hash");
  const secret = createHmac("sha256", "WebAppData").update(botToken()).digest();
  const expected = Buffer.from(hash, "hex");
  // `signature` maydoni hujjatda aniq yozilmagan; ikkalasi ham bot tokeni bilan imzolangan bo‘ladi.
  const valid =
    hashMatches(pairs, secret, expected) ||
    hashMatches(pairs.filter(([key]) => key !== "signature"), secret, expected);
  if (!valid) return null;
  const age = Date.now() / 1000 - Number(params.get("auth_date"));
  if (!Number.isFinite(age) || age > INIT_DATA_MAX_AGE) return null;
  try {
    const user = JSON.parse(params.get("user") || "null") as TelegramUser | null;
    return user && Number.isSafeInteger(user.id) ? user : null;
  } catch {
    return null;
  }
}

/** Telegram'ga bog‘langan, faol hisob. Parol tiklangan yoki hodim o‘chirilgan bo‘lsa, topilmaydi. */
export async function memberByTelegram(telegramId: number | string): Promise<Account | null> {
  const row = (
    await (await db()).execute({
      sql: `SELECT m.* FROM telegram_accounts t JOIN members m ON m.id=t.member_id
        WHERE t.telegram_id=? AND m.deleted_at IS NULL AND m.password_hash IS NOT NULL`,
      args: [String(telegramId)],
    })
  ).rows[0];
  return row ? publicAccount(row) : null;
}

export async function telegramOf(memberId: string) {
  const row = (
    await (await db()).execute({ sql: "SELECT * FROM telegram_accounts WHERE member_id=?", args: [memberId] })
  ).rows[0];
  return row
    ? { id: String(row.telegram_id), name: String(row.name), username: row.username ? String(row.username) : null }
    : null;
}

/** Bog‘lash: bitta Telegram bitta hisobda. Oldingi bog‘lanish bo‘lsa, almashadi. */
export async function linkTelegram(
  user: { id: number | string; name: string; username?: string | null },
  memberId: string,
) {
  const database = await db();
  const telegramId = String(user.id);
  const previous = await telegramOf(memberId);
  await database.batch(
    [
      { sql: "DELETE FROM telegram_accounts WHERE telegram_id=? OR member_id=?", args: [telegramId, memberId] },
      {
        sql: "INSERT INTO telegram_accounts(telegram_id,member_id,name,username,linked_at) VALUES (?,?,?,?,?)",
        args: [telegramId, memberId, user.name, user.username || null, new Date().toISOString()],
      },
    ],
    "write",
  );
  if (previous && previous.id !== telegramId)
    await say(previous.id, "Hisobingiz boshqa Telegram'ga ulandi. Bu yerdagi kirish yopildi.", { remove_keyboard: true });
}

/** Hisobdan Telegram'ni ajratadi (parol o‘zgarganda, hodim o‘chirilganda yoki o‘zi chiqqanda). */
export async function unlinkMember(memberId: string, notice?: string) {
  const current = await telegramOf(memberId);
  if (!current) return false;
  await (await db()).execute({ sql: "DELETE FROM telegram_accounts WHERE member_id=?", args: [memberId] });
  if (notice) await say(current.id, notice, { remove_keyboard: true });
  return true;
}

/* ---- Bir martalik havolalar ------------------------------------------- */
export type TokenKind =
  | "browser" // Telegram → brauzer: brauzerdagi hisobga bog‘lash
  | "open" // bog‘langan Telegram → brauzerga parolsiz kirish
  | "connect" // sayt → bot: kirgan hisobga Telegram'ni ulash
  | "web-login"; // sayt → bot: brauzerga Telegram orqali kirish

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const MINUTE = 60_000;
const lifetime: Record<TokenKind, number> = {
  browser: 60 * MINUTE,
  open: 15 * MINUTE,
  connect: 15 * MINUTE,
  "web-login": 10 * MINUTE,
};

export interface TokenRow {
  kind: TokenKind;
  telegramId: string | null;
  telegramName: string;
  telegramUsername: string | null;
  memberId: string | null;
  device: string;
  status: string;
}

export async function createToken(
  kind: TokenKind,
  fields: {
    telegram?: { id: number | string; name: string; username?: string | null };
    memberId?: string;
    browser?: string;
    device?: string;
  },
) {
  const token = randomBytes(24).toString("base64url");
  const now = Date.now();
  await (await db()).batch(
    [
      { sql: "DELETE FROM telegram_tokens WHERE expires_at<?", args: [new Date(now).toISOString()] },
      {
        sql: `INSERT INTO telegram_tokens(token_hash,kind,telegram_id,telegram_name,telegram_username,member_id,browser_hash,device,expires_at)
          VALUES (?,?,?,?,?,?,?,?,?)`,
        args: [
          hash(token),
          kind,
          fields.telegram ? String(fields.telegram.id) : null,
          fields.telegram?.name || null,
          fields.telegram?.username || null,
          fields.memberId || null,
          fields.browser ? hash(fields.browser) : null,
          fields.device || null,
          new Date(now + lifetime[kind]).toISOString(),
        ],
      },
    ],
    "write",
  );
  return token;
}

const toRow = (row: Record<string, unknown>): TokenRow => ({
  kind: row.kind as TokenKind,
  telegramId: row.telegram_id ? String(row.telegram_id) : null,
  telegramName: String(row.telegram_name || ""),
  telegramUsername: row.telegram_username ? String(row.telegram_username) : null,
  memberId: row.member_id ? String(row.member_id) : null,
  device: String(row.device || ""),
  status: String(row.status),
});

/** O‘qiydi, lekin ishlatmaydi: sahifa ochilganda yoki havola oldindan ko‘rilganda token saqlanib qoladi. */
export async function readToken(token: unknown): Promise<TokenRow | null> {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const row = (
    await (await db()).execute({
      sql: "SELECT * FROM telegram_tokens WHERE token_hash=? AND expires_at>? AND status='pending'",
      args: [hash(token), new Date().toISOString()],
    })
  ).rows[0];
  return row ? toRow(row) : null;
}

/** Tokenni ishlatadi: bir vaqtda ikki so‘rov kelsa, faqat bittasi o‘tadi. */
export async function spendToken(token: string, status = "used") {
  const result = await (await db()).execute({
    sql: "UPDATE telegram_tokens SET status=? WHERE token_hash=? AND status='pending' AND expires_at>?",
    args: [status, hash(token), new Date().toISOString()],
  });
  return result.rowsAffected === 1;
}

export async function approveWebLogin(token: string, memberId: string) {
  const result = await (await db()).execute({
    sql: `UPDATE telegram_tokens SET status='approved',member_id=?
      WHERE token_hash=? AND kind='web-login' AND status='pending' AND expires_at>?`,
    args: [memberId, hash(token), new Date().toISOString()],
  });
  return result.rowsAffected === 1;
}

/** Brauzer o‘z so‘rovini cookie orqali tekshiradi: havolani bilgan boshqa odam kira olmaydi. */
export async function webLoginStatus(browser: string) {
  const database = await db();
  const row = (
    await database.execute({
      sql: "SELECT * FROM telegram_tokens WHERE browser_hash=? AND kind='web-login' AND expires_at>?",
      args: [hash(browser), new Date().toISOString()],
    })
  ).rows[0];
  if (!row) return null;
  if (row.status !== "approved") return { status: String(row.status), memberId: null };
  const spent = await database.execute({
    sql: "UPDATE telegram_tokens SET status='used' WHERE token_hash=? AND status='approved'",
    args: [row.token_hash],
  });
  return spent.rowsAffected === 1 ? { status: "approved", memberId: String(row.member_id) } : null;
}

/* ---- Havolalar --------------------------------------------------------- */
export const browserLink = (token: string) => `${appUrl()}/telegram?t=${token}`;
export const botLink = async (start?: string) =>
  `https://t.me/${await botUsername()}${start ? `?start=${start}` : ""}`;

/** Foydalanuvchi qurilmasi: bot «kim kiryapti?» deb so‘raganda ko‘rsatiladi. */
export function deviceName(userAgent: string | null) {
  const ua = userAgent || "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Brauzer";
  const system = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return system ? `${browser}, ${system}` : browser;
}
