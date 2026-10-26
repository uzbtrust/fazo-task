import { clearSession } from "@/lib/auth";
import { api, checkOrigin } from "@/lib/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return api(async () => {
    checkOrigin(request);
    await clearSession();
    return { ok: true };
  });
}
