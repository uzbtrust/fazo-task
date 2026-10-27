import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isMemberRole, memberRoles } from "@/lib/roles";
import { api, ApiError, checkOrigin, readBody, text, username } from "@/lib/server";
import { getMembers } from "@/lib/tasks";
import type { Database } from "@/lib/db";
export const runtime = "nodejs";

async function findMember(database: Database, id: string) {
  const row = (
    await database.execute({
      sql: "SELECT * FROM members WHERE id=? AND deleted_at IS NULL AND role<>'admin'",
      args: [id],
    })
  ).rows[0];
  if (!row) throw new ApiError(404, "Hodim topilmadi.");
  return row;
}

async function openWork(database: Database, id: string) {
  return Number(
    (
      await database.execute({
        sql: "SELECT COUNT(*) AS count FROM assignments WHERE assignee_id=? AND status IN ('in_progress','in_review')",
        args: [id],
      })
    ).rows[0].count,
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    checkOrigin(request);
    await requireUser("admin");
    const { id } = await context.params;
    const body = await readBody(request);
    const database = await db();
    const row = await findMember(database, id);
    const name = body.name === undefined ? String(row.name) : text(body.name, "Ism va familiyani", 80);
    const login = body.username === undefined ? String(row.username) : username(body.username);
    const role = body.role === undefined ? String(row.role) : body.role;
    if (!isMemberRole(role)) throw new ApiError(400, "Rolni tanlang.");
    if (role !== row.role && row.role === "designer") {
      const open = await openWork(database, id);
      if (open)
        throw new ApiError(
          409,
          `Dizaynerda ${open} ta tugallanmagan vazifa bor. Rolni almashtirishdan oldin ular yakunlansin.`,
        );
    }
    try {
      await database.execute({
        sql: "UPDATE members SET name=?,username=?,role=? WHERE id=?",
        args: [name, login, role, id],
      });
    } catch (error) {
      if (error instanceof Error && /UNIQUE|CONSTRAINT/i.test(error.message))
        throw new ApiError(409, "Bu login band. Boshqa login tanlang.");
      throw error;
    }
    if (role !== row.role)
      await database.execute({ sql: "DELETE FROM member_sessions WHERE member_id=?", args: [id] });
    const [member] = (await getMembers(database, [...memberRoles])).filter((m) => m.id === id);
    return { member };
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    checkOrigin(request);
    await requireUser("admin");
    const { id } = await context.params;
    const database = await db();
    await findMember(database, id);
    const open = await openWork(database, id);
    if (open)
      throw new ApiError(
        409,
        `Dizaynerda ${open} ta tugallanmagan vazifa bor. Avval PM ularni ochiq vazifalarga qaytarsin yoki dizayner topshirsin.`,
      );
    // Yumshoq o‘chirish: ism vazifalar tarixida qoladi, login esa bo‘shaydi.
    await database.batch(
      [
        { sql: "UPDATE members SET deleted_at=? WHERE id=?", args: [new Date().toISOString(), id] },
        { sql: "DELETE FROM member_sessions WHERE member_id=?", args: [id] },
      ],
      "write",
    );
    return { ok: true };
  });
}
