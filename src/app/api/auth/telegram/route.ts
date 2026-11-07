import { clearSession, createSession, currentUser } from "@/lib/auth";
import { api, ApiError, checkOrigin, readBody } from "@/lib/server";
import { memberByTelegram, telegramName, verifyInitData } from "@/lib/telegram/accounts";
import { loadInitial } from "@/lib/initial";
export const runtime = "nodejs";

/** Web-app ochilganda: Telegram foydalanuvchisi bog‘langan bo‘lsa, shu zahoti sessiya ochiladi. */
export async function POST(request: Request) {
  return api(async () => {
    checkOrigin(request);
    const body = await readBody(request);
    const user = verifyInitData(body.initData);
    if (!user) throw new ApiError(401, "Telegram ma’lumoti tasdiqlanmadi. Ilovani qayta oching.");
    const member = await memberByTelegram(user.id);
    if (!member) {
      // Eski sessiya boshqa hisobniki bo‘lishi mumkin: bog‘lanmagan Telegram kirgan holda qolmaydi.
      await clearSession();
      return { status: "unlinked", telegram: { name: telegramName(user) } };
    }
    if ((await currentUser())?.id !== member.id) await createSession(member.id, body.embedded === true);
    // Web-app sahifani qayta yuklamasdan ochiladi: kerakli ma’lumot shu javobda.
    return { status: "signed-in", ...(body.load === true ? { user: member, initial: await loadInitial(member) } : {}) };
  });
}
