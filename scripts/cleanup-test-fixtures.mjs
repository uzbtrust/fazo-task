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
  // Includes soft-deleted members: the suite hides them, this removes them.
  const members = (
    await tx.execute({
      sql: "SELECT id FROM members WHERE username LIKE ? AND name LIKE ? AND role<>'admin'",
      args: [`${prefix}.%`, `QA ${prefix} %`],
    })
  ).rows.map((row) => String(row.id));
  const marks = members.map(() => "?").join(",") || "''";
  const tasks = (
    await tx.execute({
      sql: `SELECT id,title FROM assignments WHERE created_by IN (${marks}) OR assignee_id IN (${marks})`,
      args: [...members, ...members],
    })
  ).rows;
  if (tasks.some((row) => !String(row.title).startsWith(`QA ${prefix} `))) {
    throw new Error("A fixture member touched a real task. Nothing was deleted.");
  }
  for (const task of tasks) {
    for (const table of ["attachments", "assignment_events"])
      await tx.execute({ sql: `DELETE FROM ${table} WHERE assignment_id=?`, args: [task.id] });
    await tx.execute({ sql: "DELETE FROM assignments WHERE id=?", args: [task.id] });
  }
  for (const id of members) {
    await tx.execute({ sql: "DELETE FROM attachments WHERE owner_id=? AND assignment_id IS NULL", args: [id] });
    await tx.execute({ sql: "DELETE FROM member_sessions WHERE member_id=?", args: [id] });
    await tx.execute({ sql: "DELETE FROM members WHERE id=?", args: [id] });
  }
  await tx.commit();
  console.log({ removedFixturePrefix: prefix, members: members.length, tasks: tasks.length });
} catch (error) {
  if (!tx.closed) await tx.rollback();
  throw error;
} finally {
  client.close();
}
