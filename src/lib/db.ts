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
      `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','creator','designer')),
      active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
    )`,
      `CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    )`,
      `CREATE TABLE IF NOT EXISTS login_attempts (
      key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL
    )`,
      `CREATE TABLE IF NOT EXISTS tasks (
      number INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '', priority TEXT NOT NULL DEFAULT 'medium',
      category TEXT NOT NULL DEFAULT 'Dizayn', due_date TEXT,
      status TEXT NOT NULL DEFAULT 'open', creator_id TEXT NOT NULL REFERENCES users(id),
      assignee_id TEXT REFERENCES users(id), submission_text TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`,
      `CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL,
      size INTEGER NOT NULL, mime TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL
    )`,
      `CREATE TABLE IF NOT EXISTS task_files (
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      file_id TEXT NOT NULL UNIQUE REFERENCES files(id), kind TEXT NOT NULL,
      PRIMARY KEY(task_id,file_id)
    )`,
      `CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id), message TEXT NOT NULL, created_at TEXT NOT NULL
    )`,
      `CREATE TABLE IF NOT EXISTS activity (
      id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL, message TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    )`,
      "CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at)",
      "CREATE INDEX IF NOT EXISTS tasks_status ON tasks(status,assignee_id)",
      "CREATE INDEX IF NOT EXISTS comments_task ON comments(task_id,created_at)",
      "CREATE INDEX IF NOT EXISTS activity_task ON activity(task_id,created_at)",
    ],
    "write",
  );
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
