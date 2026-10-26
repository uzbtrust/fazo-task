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
  const users = (
    await tx.execute({
      sql: "SELECT id FROM users WHERE username LIKE ? AND name LIKE ?",
      args: [`${prefix}%`, `QA ${prefix} %`],
    })
  ).rows;
  const userIds = users.map((row) => String(row.id));
  const tasks = (
    await tx.execute({
      sql: "SELECT id,creator_id FROM tasks WHERE title LIKE ?",
      args: [`QA ${prefix} %`],
    })
  ).rows;
  if (tasks.some((row) => !userIds.includes(String(row.creator_id)))) {
    throw new Error("Fixture ownership does not match. Nothing was deleted.");
  }
  for (const task of tasks) {
    for (const table of ["comments", "activity", "task_files"]) {
      await tx.execute({
        sql: `DELETE FROM ${table} WHERE task_id=?`,
        args: [task.id],
      });
    }
    await tx.execute({ sql: "DELETE FROM tasks WHERE id=?", args: [task.id] });
  }
  for (const id of userIds) {
    const outside = (
      await tx.execute({
        sql: "SELECT COUNT(*) AS count FROM tasks WHERE creator_id=? OR assignee_id=?",
        args: [id, id],
      })
    ).rows[0];
    if (Number(outside.count))
      throw new Error("QA account has an unrelated task. Nothing was deleted.");
    await tx.execute({
      sql: "DELETE FROM sessions WHERE user_id=?",
      args: [id],
    });
    await tx.execute({ sql: "DELETE FROM files WHERE owner_id=?", args: [id] });
    await tx.execute({ sql: "DELETE FROM users WHERE id=?", args: [id] });
  }
  await tx.commit();
  console.log({
    removedFixturePrefix: prefix,
    users: users.length,
    tasks: tasks.length,
  });
} catch (error) {
  if (!tx.closed) await tx.rollback();
  throw error;
} finally {
  client.close();
}
