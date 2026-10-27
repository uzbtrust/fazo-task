import { db } from "@/lib/db";
import { checkPassword, createSession, DUMMY_HASH, loginLimit } from "@/lib/auth";
import { api, ApiError, checkOrigin, publicAccount, readBody, text } from "@/lib/server";

export const runtime = "nodejs";
export async function POST(request: Request) {
  return api(async () => {
    checkOrigin(request);
    const body = await readBody(request);
    const username = text(body.username, "Loginni", 32).toLowerCase();
    if (typeof body.password !== "string" || !body.password || body.password.length > 128)
      throw new ApiError(400, "Parolni kiriting.");
    await loginLimit(request, username);
    const row = (
      await (await db()).execute({
        sql: "SELECT * FROM members WHERE username=? COLLATE NOCASE AND deleted_at IS NULL",
        args: [username],
      })
    ).rows[0];
    // Always perform a password derivation, including unknown usernames.
    const valid = checkPassword(body.password, row?.password_hash ? String(row.password_hash) : DUMMY_HASH);
    if (row && row.password_hash === null)
      throw new ApiError(
        409,
        "Bu hisob uchun hali parol yaratilmagan. «Ro‘yxatdan o‘tish» bo‘limida parol yarating.",
      );
    if (!row || !valid) throw new ApiError(401, "Login yoki parol noto‘g‘ri.");
    await createSession(String(row.id));
    return { user: publicAccount(row) };
  });
}
