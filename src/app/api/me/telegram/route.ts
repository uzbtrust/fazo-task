import { requireUser } from "@/lib/auth";
import { api, checkOrigin } from "@/lib/server";
import { telegramEnabled } from "@/lib/telegram/api";
import { botLink, createToken, telegramOf, unlinkMember } from "@/lib/telegram/accounts";
export const runtime = "nodejs";

export async function GET() {
  return api(async () => {
    const user = await requireUser();
    const telegram = telegramEnabled() ? await telegramOf(user.id) : null;
    return { enabled: telegramEnabled(), telegram: telegram && { name: telegram.name, username: telegram.username } };
  });
}

/** Saytdan botga: bir martalik havola, bot uni ochganda Telegram shu hisobga ulanadi. */
export async function POST(request: Request) {
  return api(async () => {
    checkOrigin(request);
    const user = await requireUser();
    return { url: await botLink(`c_${await createToken("connect", { memberId: user.id })}`) };
  });
}

export async function DELETE(request: Request) {
  return api(async () => {
    checkOrigin(request);
    const user = await requireUser();
    await unlinkMember(user.id, "Telegram hisobingizdan ajratildi. Qayta kirish uchun /start ni bosing.");
    return { ok: true };
  });
}
