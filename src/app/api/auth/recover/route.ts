import { loadInitial } from "@/lib/initial";
import { resetWithCode, sendRecoveryCode } from "@/lib/recover";
import { api, checkOrigin, readBody } from "@/lib/server";
export const runtime = "nodejs";

/** Parolni tiklash: kod so‘rash (faqat login) yoki kod bilan yangi parol o‘rnatish. */
export async function POST(request: Request) {
  return api(async () => {
    checkOrigin(request);
    const body = await readBody(request);
    if (body.code === undefined) return { sent: true, ...(await sendRecoveryCode(request, body.username)) };
    const user = await resetWithCode(request, body);
    return { user, initial: await loadInitial(user) };
  });
}
