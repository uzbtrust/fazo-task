import {
  createClient,
  type Client,
  type InStatement,
  type Row,
  type Transaction,
} from "@libsql/client";
import { randomBytes, scryptSync } from "node:crypto";

let client: Client | undefined;
let ready: Promise<Client> | undefined;

export function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export async function db(): Promise<Client> {
  if (!ready) {
    ready = initialize().catch((error) => {
      ready = undefined;
      throw error;
    });
  }
  return ready;
}

async function initialize(): Promise<Client> {
  const url = process.env.TURSO_DATABASE_URL || "file:./fazo.db";
  if (process.env.VERCEL && url.startsWith("file:")) {
    throw new Error("Production requires a durable remote TURSO_DATABASE_URL.");
  }
  client ??= createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  await client.batch(
    [
      // The single sign-in account lives here. Older databases also hold
      // retired creator/designer rows; only role='admin' can sign in.
      `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'admin',
      active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, deleted_at TEXT
    )`,
      `CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    )`,
      `CREATE TABLE IF NOT EXISTS login_attempts (
      key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL
    )`,
      `CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, position TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL, deleted_at TEXT
    )`,
      `CREATE TABLE IF NOT EXISTS team_tasks (
      number INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      priority INTEGER NOT NULL DEFAULT 1 CHECK(priority BETWEEN 1 AND 3),
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo','in_progress','done')),
      assignee_id TEXT NOT NULL REFERENCES employees(id),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT
    )`,
      "CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at)",
      "CREATE INDEX IF NOT EXISTS team_tasks_assignee ON team_tasks(assignee_id,status)",
    ],
    "write",
  );
  // Introspect and migrate under a write lock: concurrent cold starts cannot
  // both decide to add the same column, and existing records are preserved.
  const migration = await client.transaction("write");
  try {
    const columns = await migration.execute("PRAGMA table_info(users)");
    if (!columns.rows.some((column) => column.name === "deleted_at")) {
      await migration.execute("ALTER TABLE users ADD COLUMN deleted_at TEXT");
    }
    await migration.commit();
  } catch (error) {
    if (!migration.closed) await migration.rollback();
    throw error;
  }
  await client.execute({
    sql: `INSERT OR IGNORE INTO users (id,name,username,password_hash,role,active,created_at)
      VALUES ('initial-admin','Administrator','admin',?,'admin',1,?)`,
    args: [
      passwordHash(process.env.ADMIN_INITIAL_PASSWORD || "admin"),
      new Date().toISOString(),
    ],
  });
  return client;
}

export type Database = Client | Transaction;
export type { Row, InStatement };
