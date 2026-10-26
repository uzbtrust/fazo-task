import { db } from "@/lib/db";
import { checkPassword, createSession, loginLimit } from "@/lib/auth";
import {
  api,
  ApiError,
  checkOrigin,
  publicUser,
  readBody,
  text,
} from "@/lib/server";

export const runtime = "nodejs";
export async function POST(request: Request) {
  return api(async () => {
    checkOrigin(request);
    const body = await readBody(request);
    const username = text(body.username, "Loginni", 32).toLowerCase();
    if (
      typeof body.password !== "string" ||
      !body.password ||
      body.password.length > 128
    )
      throw new ApiError(400, "Parolni kiriting (ko‘pi bilan 128 belgi).");
    const password = body.password;
    await loginLimit(request, username);
    const result = await (
      await db()
    ).execute({
      sql: "SELECT * FROM users WHERE username=? COLLATE NOCASE",
      args: [username],
    });
    const row = result.rows[0];
    // Always perform a password derivation, including unknown usernames.
    const valid = checkPassword(
      password,
      row ? String(row.password_hash) : `${"0".repeat(32)}:${"0".repeat(128)}`,
    );
    if (!row || !row.active || !valid)
      throw new ApiError(401, "Login yoki parol noto‘g‘ri.");
    await createSession(String(row.id));
    return { user: publicUser(row) };
  });
}
