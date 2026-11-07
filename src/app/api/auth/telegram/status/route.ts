import { cookies } from "next/headers";
import { createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadInitial } from "@/lib/initial";
import { publicAccount } from "@/lib/server";
import { api } from "@/lib/server";
import { webLoginStatus } from "@/lib/telegram/accounts";
export const runtime = "nodejs";

/** Sayt shu manzilni so‘rab turadi: bot tasdiqlashi bilan sessiya ochiladi. */
export async function GET() {
  return api(async () => {
    const jar = await cookies();
    const browser = jar.get("fazo_tg_login")?.value;
    const state = browser ? await webLoginStatus(browser) : null;
    if (!state) return { status: "expired" };
    if (state.status !== "approved") return { status: state.status === "denied" ? "denied" : "pending" };
    await createSession(state.memberId!);
    jar.delete("fazo_tg_login");
    const row = (await (await db()).execute({ sql: "SELECT * FROM members WHERE id=?", args: [state.memberId!] })).rows[0];
    const user = publicAccount(row);
    return { status: "signed-in", user, initial: await loadInitial(user) };
  });
}
