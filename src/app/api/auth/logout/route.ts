import { clearSession, currentUser } from "@/lib/auth";
import { api, checkOrigin, readBody } from "@/lib/server";
import { memberByTelegram, unlinkMember, verifyInitData } from "@/lib/telegram/accounts";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return api(async () => {
    checkOrigin(request);
    // Web-app ichidan chiqilsa, Telegram ham ajratiladi: aks holda keyingi ochilishda o‘zi kirib ketadi.
    const telegram = verifyInitData((await readBody(request).catch(() => ({} as Record<string, unknown>))).initData);
    const user = await currentUser();
    if (telegram && user && (await memberByTelegram(telegram.id))?.id === user.id)
      await unlinkMember(user.id, "Ilovadan chiqdingiz. Qayta kirish uchun /start ni bosing.");
    await clearSession();
    return { ok: true };
  });
}
