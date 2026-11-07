import { after } from "next/server";
import { createSession, requireUser } from "@/lib/auth";
import { api, ApiError, checkOrigin, readBody } from "@/lib/server";
import { linkTelegram, memberByTelegram, readToken, spendToken } from "@/lib/telegram/accounts";
import { afterLinked } from "@/lib/telegram/bot";
export const runtime = "nodejs";

const expired = () => new ApiError(410, "Havola eskirgan. Botda qayta bosing.");

/**
 * Bir martalik havola shu yerda ishlatiladi (GET emas: havolani oldindan ko‘rish uni yeb qo‘ymaydi).
 * browser — kirgan hisobga Telegram ulanadi; open — bog‘langan Telegram brauzerga parolsiz kiradi.
 */
export async function POST(request: Request) {
  return api(async () => {
    checkOrigin(request);
    const { token } = await readBody(request);
    const row = await readToken(token);
    if (!row?.telegramId || (row.kind !== "browser" && row.kind !== "open")) throw expired();
    if (row.kind === "open") {
      const member = await memberByTelegram(row.telegramId);
      if (!member || member.id !== row.memberId || !(await spendToken(String(token)))) throw expired();
      await createSession(member.id);
      return { status: "signed-in" };
    }
    const user = await requireUser();
    if (!(await spendToken(String(token)))) throw expired();
    await linkTelegram({ id: row.telegramId, name: row.telegramName, username: row.telegramUsername }, user.id);
    after(() => afterLinked(row.telegramId!, user));
    return { status: "linked" };
  });
}
