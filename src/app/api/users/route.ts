import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { db, passwordHash } from "@/lib/db";
import {
  allow,
  api,
  ApiError,
  checkOrigin,
  newPassword,
  publicUser,
  readBody,
  role,
  text,
} from "@/lib/server";
export const runtime = "nodejs";

export async function GET() {
  return api(async () => {
    const user = await requireUser();
    const result = await (
      await db()
    ).execute(
      user.role === "admin"
        ? "SELECT * FROM users ORDER BY created_at"
        : "SELECT * FROM users WHERE active=1 ORDER BY created_at",
    );
    return { users: result.rows.map(publicUser) };
  });
}

export async function POST(request: Request) {
  return api(async () => {
    checkOrigin(request);
    allow(await requireUser(), ["admin"]);
    const body = await readBody(request);
    const name = text(body.name, "Ismni", 80);
    const username = text(body.username, "Loginni", 32).toLowerCase();
    if (!/^[a-z0-9_.-]{3,32}$/.test(username))
      throw new ApiError(
        400,
        "Login 3–32 ta lotin harfi, raqam, nuqta, chiziq yoki pastki chiziqdan iborat bo‘lsin.",
      );
    const password = newPassword(body.password);
    const userRole = role(body.role);
    const database = await db();
    const id = randomUUID();
    try {
      await database.execute({
        sql: "INSERT INTO users(id,name,username,password_hash,role,active,created_at) VALUES (?,?,?,?,?,1,?)",
        args: [
          id,
          name,
          username,
          passwordHash(password),
          userRole,
          new Date().toISOString(),
        ],
      });
    } catch (error) {
      if (
        error instanceof Error &&
        /UNIQUE constraint|SQLITE_CONSTRAINT_UNIQUE/i.test(error.message)
      )
        throw new ApiError(409, "Bu login band. Boshqa login tanlang.");
      throw error;
    }
    const created = (
      await database.execute({
        sql: "SELECT * FROM users WHERE id=?",
        args: [id],
      })
    ).rows[0];
    return { user: publicUser(created) };
  }, 201);
}
