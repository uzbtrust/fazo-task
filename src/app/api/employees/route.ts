import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { api, checkOrigin, readBody } from "@/lib/server";
import { employee, employeeFields } from "@/lib/tasks";
export const runtime = "nodejs";

export async function GET() {
  return api(async () => {
    await requireUser();
    const rows = (
      await (await db()).execute(
        "SELECT * FROM employees WHERE deleted_at IS NULL ORDER BY created_at",
      )
    ).rows;
    return { employees: rows.map(employee) };
  });
}

export async function POST(request: Request) {
  return api(async () => {
    checkOrigin(request);
    await requireUser();
    const fields = employeeFields(await readBody(request));
    const id = randomUUID();
    const database = await db();
    await database.execute({
      sql: "INSERT INTO employees(id,name,position,created_at) VALUES (?,?,?,?)",
      args: [id, fields.name, fields.position, new Date().toISOString()],
    });
    const created = (
      await database.execute({ sql: "SELECT * FROM employees WHERE id=?", args: [id] })
    ).rows[0];
    return { employee: employee(created) };
  }, 201);
}
