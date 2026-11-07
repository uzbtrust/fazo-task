import { createHash, randomInt } from "node:crypto";
import { after } from "next/server";
import { createSession, loginLimit } from "./auth";
import { db, passwordHash } from "./db";
import { ApiError, newPassword, publicAccount, text } from "./server";
import { getTheme } from "./settings";
import { action, inline, remove, say, sendPhoto, telegramEnabled } from "./telegram/api";
import { telegramOf } from "./telegram/accounts";
import { codeImage } from "./telegram/images";
import { track } from "./telegram/screens";

/*
 * Parolni tiklash: hisobga ulangan Telegram'ga bir martalik kod boradi.
 * Kod 10 daqiqa amal qiladi, 5 marta xato kiritilsa yaroqsiz bo‘ladi.
 */
const LIFETIME = 10 * 60_000;
const ATTEMPTS = 5;
const codeHash = (memberId: string, code: string) => createHash("sha256").update(`${memberId}:${code}`).digest("hex");

async function findMember(request: Request, value: unknown) {
  const username = text(value, "Loginni", 32).toLowerCase();
  await loginLimit(request, username);
  const row = (
    await (await db()).execute({
      sql: "SELECT * FROM members WHERE username=? COLLATE NOCASE AND deleted_at IS NULL",
      args: [username],
    })
  ).rows[0];
  if (!row) throw new ApiError(404, "Bu login topilmadi.");
  if (row.password_hash === null)
    throw new ApiError(409, "Bu hisob hali ro‘yxatdan o‘tmagan. «Ro‘yxatdan o‘tish» bo‘limida parol yarating.");
  return row;
}

/** 1-qadam: kod Telegram'ga yuboriladi. Javobda Telegram nomi: foydalanuvchi qayerga qarashni biladi. */
export async function sendRecoveryCode(request: Request, username: unknown) {
  const row = await findMember(request, username);
  const memberId = String(row.id);
  const telegram = telegramEnabled() ? await telegramOf(memberId) : null;
  if (!telegram) throw new ApiError(409, "Bu hisobga Telegram ulanmagan. Parolni administrator tiklaydi.");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await (await db()).execute({
    sql: `INSERT INTO password_resets(member_id,code_hash,attempts,expires_at) VALUES (?,?,0,?)
      ON CONFLICT(member_id) DO UPDATE SET code_hash=excluded.code_hash,attempts=0,expires_at=excluded.expires_at`,
    args: [memberId, codeHash(memberId, code), new Date(Date.now() + LIFETIME).toISOString()],
  });
  const markup = inline([[action("Yopish", "x")]]);
  const caption = "<b>Parolni tiklash kodi</b>";
  const image = await codeImage({ code, name: String(row.name), theme: (await getTheme(memberId)) ?? "dark" }).catch(() => null);
  const sent = image
    ? await sendPhoto(telegram.id, image, caption, markup).catch(() => null)
    : await say(telegram.id, `${caption}\n\n<code>${code}</code>\n\nKod 10 daqiqa amal qiladi.`, markup);
  if (!sent) throw new ApiError(502, "Kodni Telegram'ga yuborib bo‘lmadi. Botni ochib, /start bosing va qayta urinib ko‘ring.");
  await track(telegram.id, sent.message_id, "code", null, Date.now() + LIFETIME);
  return { telegram: telegram.username ? `@${telegram.username}` : telegram.name };
}

/** 2-qadam: kod to‘g‘ri bo‘lsa, yangi parol o‘rnatiladi, boshqa kirishlar yopiladi va shu brauzer kiradi. */
export async function resetWithCode(request: Request, body: Record<string, unknown>) {
  const row = await findMember(request, body.username);
  const memberId = String(row.id);
  const database = await db();
  const reset = (await database.execute({ sql: "SELECT * FROM password_resets WHERE member_id=?", args: [memberId] })).rows[0];
  if (!reset || Date.parse(String(reset.expires_at)) < Date.now()) throw new ApiError(410, "Kod eskirgan. Yangisini so‘rang.");
  if (Number(reset.attempts) >= ATTEMPTS) throw new ApiError(429, "Urinishlar tugadi. Yangi kod so‘rang.");
  const code = typeof body.code === "string" ? body.code.replace(/\D/g, "") : "";
  if (codeHash(memberId, code) !== String(reset.code_hash)) {
    await database.execute({ sql: "UPDATE password_resets SET attempts=attempts+1 WHERE member_id=?", args: [memberId] });
    throw new ApiError(400, "Kod noto‘g‘ri.");
  }
  const hash = passwordHash(newPassword(body.password));
  await database.batch(
    [
      { sql: "UPDATE members SET password_hash=? WHERE id=?", args: [hash, memberId] },
      { sql: "DELETE FROM password_resets WHERE member_id=?", args: [memberId] },
      { sql: "DELETE FROM member_sessions WHERE member_id=?", args: [memberId] },
    ],
    "write",
  );
  await createSession(memberId);
  const account = publicAccount(row);
  after(async () => {
    const telegram = await telegramOf(memberId);
    if (!telegram) return;
    const codes = (
      await database.execute({ sql: "SELECT message_id FROM telegram_messages WHERE chat=? AND kind='code'", args: [telegram.id] })
    ).rows;
    for (const message of codes) await remove(telegram.id, Number(message.message_id));
    await database.execute({ sql: "DELETE FROM telegram_messages WHERE chat=? AND kind='code'", args: [telegram.id] });
    const notice = await say(telegram.id, "Parolingiz tiklandi. Boshqa qurilmalardagi kirishlar yopildi.", inline([[action("Yopish", "x")]]));
    if (notice) await track(telegram.id, notice.message_id, "note");
  });
  return account;
}
