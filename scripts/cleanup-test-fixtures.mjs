import { createClient } from "@libsql/client";

const prefix = process.argv[2];
if (!/^qa[a-z0-9]{12,40}$/.test(prefix || "")) {
  throw new Error("Pass the exact QA prefix printed by the integration suite.");
}
const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:./fazo.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const tx = await client.transaction("write");
try {
  // Includes soft-deleted employees: the suite hides them, this removes them.
  const employees = (
    await tx.execute({
      sql: "SELECT id FROM employees WHERE name LIKE ?",
      args: [`QA ${prefix} %`],
    })
  ).rows.map((row) => String(row.id));
  const tasks = (
    await tx.execute({
      sql: "SELECT id,assignee_id FROM team_tasks WHERE title LIKE ?",
      args: [`QA ${prefix} %`],
    })
  ).rows;
  if (tasks.some((row) => !employees.includes(String(row.assignee_id)))) {
    throw new Error("A fixture task belongs to a real employee. Nothing was deleted.");
  }
  for (const id of employees) {
    const outside = Number(
      (
        await tx.execute({
          sql: "SELECT COUNT(*) AS count FROM team_tasks WHERE assignee_id=? AND title NOT LIKE ?",
          args: [id, `QA ${prefix} %`],
        })
      ).rows[0].count,
    );
    if (outside) throw new Error("A fixture employee has unrelated tasks. Nothing was deleted.");
  }
  for (const task of tasks)
    await tx.execute({ sql: "DELETE FROM team_tasks WHERE id=?", args: [task.id] });
  for (const id of employees)
    await tx.execute({ sql: "DELETE FROM employees WHERE id=?", args: [id] });
  await tx.commit();
  console.log({ removedFixturePrefix: prefix, employees: employees.length, tasks: tasks.length });
} catch (error) {
  if (!tx.closed) await tx.rollback();
  throw error;
} finally {
  client.close();
}
