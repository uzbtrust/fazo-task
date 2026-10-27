import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isMemberRole, memberRoles } from "@/lib/roles";
import { api, ApiError, checkOrigin, readBody, text, username } from "@/lib/server";
import { getMembers } from "@/lib/tasks";
export const runtime = "nodejs";

export async function GET() {
  return api(async () => {
    const user = await requireUser("admin", "pm");
    // PM vazifa berish uchun faqat dizaynerlarni ko‘radi.
    const roles = user.role === "admin" ? [...memberRoles] : ["designer" as const];
    return { members: await getMembers(await db(), roles) };
  });
}

export async function POST(request: Request) {
  return api(async () => {
    checkOrigin(request);
    await requireUser("admin");
    const body = await readBody(request);
    const name = text(body.name, "Ism va familiyani", 80);
    const login = username(body.username);
    if (!isMemberRole(body.role)) throw new ApiError(400, "Rolni tanlang.");
    const database = await db();
    const id = randomUUID();
    try {
      await database.execute({
        sql: "INSERT INTO members(id,name,username,role,created_at) VALUES (?,?,?,?,?)",
        args: [id, name, login, body.role, new Date().toISOString()],
      });
    } catch (error) {
      if (error instanceof Error && /UNIQUE|CONSTRAINT/i.test(error.message))
        throw new ApiError(409, "Bu login band. Boshqa login tanlang.");
      throw error;
    }
    const [member] = (await getMembers(database, [body.role])).filter((m) => m.id === id);
    return { member };
  }, 201);
}
