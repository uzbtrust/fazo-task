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
  // Rol va holatlar kodda tekshiriladi: yangi kasb yoki bosqich qo‘shilganda
  // jadvalni qayta qurish shart emas. Eski users/tasks/employees jadvallariga tegilmaydi.
  // Sovuq startda hammasi bitta so‘rovda: jadvallar va administrator borligi.
  const setup = await client.batch(
    [
      `CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, username TEXT NOT NULL COLLATE NOCASE,
      role TEXT NOT NULL, password_hash TEXT, created_at TEXT NOT NULL,
      activated_at TEXT, deleted_at TEXT
    )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS members_username
      ON members(username COLLATE NOCASE) WHERE deleted_at IS NULL`,
      `CREATE TABLE IF NOT EXISTS member_sessions (
      token_hash TEXT PRIMARY KEY, member_id TEXT NOT NULL, expires_at TEXT NOT NULL
    )`,
      `CREATE TABLE IF NOT EXISTS login_attempts (
      key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL
    )`,
      // assignee_id NULL — ochiq vazifa: hali hech bir dizayner olmagan.
      `CREATE TABLE IF NOT EXISTS assignments (
      number INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
      brief TEXT NOT NULL DEFAULT '', image_count INTEGER NOT NULL, priority INTEGER,
      due_date TEXT, status TEXT NOT NULL DEFAULT 'todo', assignee_id TEXT,
      created_by TEXT NOT NULL, result_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, claimed_at TEXT, submitted_at TEXT,
      completed_at TEXT
    )`,
      `CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY, assignment_id TEXT, owner_id TEXT NOT NULL, kind TEXT NOT NULL,
      name TEXT NOT NULL, size INTEGER NOT NULL, mime TEXT NOT NULL, data TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
      `CREATE TABLE IF NOT EXISTS assignment_links (
      id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL, url TEXT NOT NULL, created_at TEXT NOT NULL
    )`,
      "CREATE INDEX IF NOT EXISTS assignment_links_assignment ON assignment_links(assignment_id)",
      `CREATE TABLE IF NOT EXISTS assignment_events (
      id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL, member_id TEXT NOT NULL,
      action TEXT NOT NULL, message TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
    )`,
      "CREATE INDEX IF NOT EXISTS member_sessions_expiry ON member_sessions(expires_at)",
      "CREATE INDEX IF NOT EXISTS assignments_assignee ON assignments(assignee_id,status)",
      "CREATE INDEX IF NOT EXISTS attachments_assignment ON attachments(assignment_id)",
      "CREATE INDEX IF NOT EXISTS assignment_events_assignment ON assignment_events(assignment_id,created_at)",
      "SELECT COUNT(*) AS count FROM members WHERE role='admin' AND deleted_at IS NULL",
    ],
    "write",
  );
  if (!Number(setup[setup.length - 1].rows[0].count)) await seedAdmin(client);
  return client;
}

/** Birinchi ishga tushirish: avvalgi versiyadagi administrator (paroli bilan) ko‘chiriladi, bo‘lmasa admin/admin. */
async function seedAdmin(client: Client) {
  const legacy = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='users'",
  );
  if (legacy.rows.length) {
    const admins = (await client.execute("SELECT * FROM users WHERE role='admin'")).rows;
    for (const row of admins) {
      if (!row.active || row.deleted_at) continue;
      await client.execute({
        sql: `INSERT OR IGNORE INTO members(id,name,username,role,password_hash,created_at,activated_at)
          VALUES (?,?,?,'admin',?,?,?)`,
        args: [row.id, row.name, row.username, row.password_hash, row.created_at, row.created_at],
      });
    }
  }
  const now = new Date().toISOString();
  await client.execute({
    sql: `INSERT INTO members(id,name,username,role,password_hash,created_at,activated_at)
      SELECT 'initial-admin','Administrator','admin','admin',?,?,?
      WHERE NOT EXISTS (SELECT 1 FROM members WHERE role='admin' AND deleted_at IS NULL)`,
    args: [passwordHash(process.env.ADMIN_INITIAL_PASSWORD || "admin"), now, now],
  });
}

export type Database = Client | Transaction;

/** Bir nechta o‘qish so‘rovini bitta tarmoq aylanishida bajaradi (tranzaksiya ichida ham). */
export function readBatch(database: Database, statements: InStatement[]) {
  return "commit" in database ? database.batch(statements) : database.batch(statements, "read");
}
export type { Row, InStatement };
