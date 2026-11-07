import { cookies } from "next/headers";
import { after } from "next/server";
import { checkPassword, passwordHash, requireUser, SESSION_COOKIE, tokenHash } from "@/lib/auth";
import { db } from "@/lib/db";
import { api, ApiError, checkOrigin, newPassword, readBody, username } from "@/lib/server";
import { getTheme } from "@/lib/settings";
import { action, inline, say, telegramEnabled } from "@/lib/telegram/api";
import { telegramOf, unlinkMember } from "@/lib/telegram/accounts";
import { refreshHomes } from "@/lib/telegram/home";
import { track } from "@/lib/telegram/screens";
export const runtime = "nodejs";

export async function GET() {
  return api(async () => {
    const user = await requireUser();
    return { user, theme: await getTheme(user.id) };
  });
}

/** Login yoki parolni almashtirish: ikkalasi ham joriy parol bilan tasdiqlanadi. */
export async function PATCH(request: Request) {
  return api(async () => {
    checkOrigin(request);
    const user = await requireUser();
    const body = await readBody(request);
    const nextPassword = body.newPassword === undefined ? null : newPassword(body.newPassword);
    const nextUsername = body.newUsername === undefined ? null : username(body.newUsername);
    if (!nextPassword && !nextUsername) throw new ApiError(400, "Nimani almashtirish kerakligini yozing.");
    const database = await db();
    const transaction = await database.transaction("write");
    try {
      const row = (await transaction.execute({ sql: "SELECT password_hash FROM members WHERE id=?", args: [user.id] })).rows[0];
      if (typeof body.currentPassword !== "string" || !checkPassword(body.currentPassword, String(row.password_hash)))
        throw new ApiError(400, "Joriy parol noto‘g‘ri.");
      if (nextUsername && nextUsername !== user.username) {
        const taken = (
          await transaction.execute({
            sql: "SELECT 1 FROM members WHERE username=? COLLATE NOCASE AND deleted_at IS NULL AND id<>?",
            args: [nextUsername, user.id],
          })
        ).rows[0];
        if (taken) throw new ApiError(409, "Bu login band. Boshqa login tanlang.");
        await transaction.execute({ sql: "UPDATE members SET username=? WHERE id=?", args: [nextUsername, user.id] });
      }
      if (nextPassword) {
        // Boshqa qurilmalardagi kirishlar yopiladi; shu sessiya qoladi.
        const token = (await cookies()).get(SESSION_COOKIE)?.value || "";
        await transaction.execute({
          sql: "DELETE FROM member_sessions WHERE member_id=? AND token_hash<>?",
          args: [user.id, tokenHash(token)],
        });
        await transaction.execute({ sql: "UPDATE members SET password_hash=? WHERE id=?", args: [passwordHash(nextPassword), user.id] });
      }
      await transaction.commit();
    } catch (error) {
      if (!transaction.closed) await transaction.rollback();
      throw error;
    }
    if (nextPassword && body.unlinkTelegram === true)
      await unlinkMember(user.id, "Parolingiz o‘zgardi va Telegram hisobdan ajratildi. Qayta kirish uchun /start ni bosing.");
    else if (telegramEnabled())
      after(async () => {
        const telegram = await telegramOf(user.id);
        if (!telegram) return;
        const what = nextPassword && nextUsername ? "Login va parolingiz" : nextPassword ? "Parolingiz" : "Loginingiz";
        const notice = await say(telegram.id, `${what} o‘zgartirildi.`, inline([[action("Yopish", "x")]]));
        if (notice) await track(telegram.id, notice.message_id, "note");
        if (nextUsername) await refreshHomes([user.id], true);
      });
    return { user: { ...user, username: nextUsername || user.username } };
  });
}
