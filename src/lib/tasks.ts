import { randomUUID } from "node:crypto";
import { readBatch, type Database, type Row } from "./db";
import { ApiError, text, todayISO } from "./server";
import type {
  FileKind,
  FileMeta,
  Member,
  MemberStats,
  Priority,
  Role,
  Stats,
  StatsRow,
  Task,
  TaskStatus,
} from "./types";

export function taskFields(body: Record<string, unknown>) {
  const title = text(body.title, "Vazifa nomini", 160);
  const brief = text(body.brief, "TZ matnini", 20000, false);
  const imageCount = body.imageCount;
  if (
    typeof imageCount !== "number" || !Number.isInteger(imageCount) || imageCount < 1 || imageCount > 100
  )
    throw new ApiError(400, "Nechta rasm kerakligini 1 dan 100 gacha son bilan kiriting.");
  const priority = body.priority ?? null;
  if (
    priority !== null &&
    (typeof priority !== "number" || !Number.isInteger(priority) || priority < 1 || priority > 5)
  )
    throw new ApiError(400, "Muhimlik 1 dan 5 gacha yulduz bo‘lishi kerak.");
  const dueDate =
    body.dueDate === undefined || body.dueDate === null || body.dueDate === ""
      ? null
      : body.dueDate;
  if (dueDate !== null) {
    if (typeof dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate))
      throw new ApiError(400, "Muddat sanasi noto‘g‘ri.");
    const parsed = new Date(`${dueDate}T00:00:00Z`);
    if (
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== dueDate
    )
      throw new ApiError(400, "Muddat sanasi noto‘g‘ri.");
  }
  return {
    title,
    brief,
    imageCount,
    priority: priority as Priority | null,
    dueDate: dueDate as string | null,
  };
}

export function fileIds(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (
    !Array.isArray(value) ||
    value.length > 30 ||
    value.some((x) => typeof x !== "string" || x.length > 64)
  )
    throw new ApiError(400, "Fayllar ro‘yxati noto‘g‘ri.");
  return [...new Set(value as string[])];
}

/** PM yuklagan, hali hech qaysi vazifaga bog‘lanmagan fayllarni TZ sifatida bog‘laydi. */
export async function linkBriefFiles(
  database: Database,
  assignmentId: string,
  ids: string[],
  ownerId: string,
) {
  for (const id of ids) {
    const result = await database.execute({
      sql: `UPDATE attachments SET assignment_id=?, kind='brief'
        WHERE id=? AND owner_id=? AND assignment_id IS NULL`,
      args: [assignmentId, id, ownerId],
    });
    if (result.rowsAffected !== 1)
      throw new ApiError(400, "Fayl topilmadi yoki allaqachon boshqa vazifaga biriktirilgan.");
  }
}

export async function addEvent(
  database: Database,
  assignmentId: string,
  memberId: string,
  action: string,
  message = "",
) {
  await database.execute({
    sql: "INSERT INTO assignment_events(id,assignment_id,member_id,action,message,created_at) VALUES (?,?,?,?,?,?)",
    args: [randomUUID(), assignmentId, memberId, action, message, new Date().toISOString()],
  });
}

export function fileMeta(row: Row): FileMeta {
  return {
    id: String(row.id),
    kind: row.kind as FileKind,
    name: String(row.name),
    size: Number(row.size),
    mime: String(row.mime),
    ownerId: String(row.owner_id),
    url: `/api/files/${row.id}`,
  };
}

export async function getTasks(
  database: Database,
  filter: { id?: string; visibleTo?: string } = {},
): Promise<Task[]> {
  const where: string[] = [];
  const args: string[] = [];
  if (filter.id) {
    where.push("a.id=?");
    args.push(filter.id);
  }
  // Dizayner: o‘zi olgan vazifalar va hali hech kim olmagan ochiq vazifalar.
  if (filter.visibleTo) {
    where.push("(a.assignee_id=? OR (a.assignee_id IS NULL AND a.status='todo'))");
    args.push(filter.visibleTo);
  }
  const clause = where.length ? ` WHERE ${where.join(" AND ")}` : "";
  // Vazifalar, fayl ma’lumotlari va tarix — bitta tarmoq aylanishida.
  const [taskResult, fileResult, eventResult] = await readBatch(database, [
    {
      sql: `SELECT a.*,d.name AS assignee_name,p.name AS creator_name FROM assignments a
        LEFT JOIN members d ON d.id=a.assignee_id LEFT JOIN members p ON p.id=a.created_by
        ${clause} ORDER BY a.number DESC`,
      args,
    },
    {
      sql: `SELECT f.id,f.assignment_id,f.owner_id,f.kind,f.name,f.size,f.mime FROM attachments f
        JOIN assignments a ON a.id=f.assignment_id${clause} ORDER BY f.created_at`,
      args,
    },
    {
      sql: `SELECT e.*,m.name AS member_name FROM assignment_events e
        JOIN assignments a ON a.id=e.assignment_id LEFT JOIN members m ON m.id=e.member_id
        ${clause} ORDER BY e.created_at,e.rowid`,
      args,
    },
  ]);
  const rows = taskResult.rows;
  const files = fileResult.rows;
  const events = eventResult.rows;
  return rows.map((row) => {
    const own = files.filter((f) => f.assignment_id === row.id);
    return {
      id: String(row.id),
      number: Number(row.number),
      title: String(row.title),
      brief: String(row.brief),
      imageCount: Number(row.image_count),
      priority: row.priority === null ? null : (Number(row.priority) as Priority),
      dueDate: row.due_date ? String(row.due_date) : null,
      status: row.status as TaskStatus,
      assigneeId: row.assignee_id ? String(row.assignee_id) : null,
      assigneeName: row.assignee_id ? String(row.assignee_name ?? "Dizayner") : null,
      createdBy: String(row.created_by),
      creatorName: row.creator_name ? String(row.creator_name) : "Project manager",
      resultNote: String(row.result_note),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      claimedAt: row.claimed_at ? String(row.claimed_at) : null,
      submittedAt: row.submitted_at ? String(row.submitted_at) : null,
      completedAt: row.completed_at ? String(row.completed_at) : null,
      briefFiles: own.filter((f) => f.kind === "brief").map(fileMeta),
      resultFiles: own.filter((f) => f.kind === "result").map(fileMeta),
      events: events
        .filter((e) => e.assignment_id === row.id)
        .map((e) => ({
          id: String(e.id),
          memberId: String(e.member_id),
          memberName: e.member_name ? String(e.member_name) : "Hodim",
          action: String(e.action),
          message: String(e.message),
          createdAt: String(e.created_at),
        })),
    };
  });
}

export async function getMembers(database: Database, roles: Role[]): Promise<Member[]> {
  const marks = roles.map(() => "?").join(",");
  const [memberResult, countResult, createdResult] = await readBatch(database, [
    {
      sql: `SELECT * FROM members WHERE deleted_at IS NULL AND role IN (${marks}) ORDER BY created_at`,
      args: roles,
    },
    {
      sql: `SELECT assignee_id,status,COUNT(*) AS count,
        SUM(CASE WHEN due_date<? AND status NOT IN ('done','cancelled') THEN 1 ELSE 0 END) AS overdue
        FROM assignments GROUP BY assignee_id,status`,
      args: [todayISO()],
    },
    "SELECT created_by,COUNT(*) AS count FROM assignments GROUP BY created_by",
  ]);
  const rows = memberResult.rows;
  const counts = countResult.rows;
  const created = createdResult.rows;
  return rows.map((row) => {
    const own = counts.filter((c) => c.assignee_id === row.id);
    const count = (status: TaskStatus) =>
      Number(own.find((c) => c.status === status)?.count || 0);
    const stats: MemberStats = {
      inProgress: count("in_progress"),
      inReview: count("in_review"),
      done: count("done"),
      overdue: own.reduce((sum, c) => sum + Number(c.overdue || 0), 0),
      created: Number(created.find((c) => c.created_by === row.id)?.count || 0),
    };
    return {
      id: String(row.id),
      name: String(row.name),
      username: String(row.username),
      role: row.role as Role,
      activated: row.password_hash !== null,
      createdAt: String(row.created_at),
      activatedAt: row.activated_at ? String(row.activated_at) : null,
      stats,
    };
  });
}

/**
 * Admin statistikasi. Davr — vazifa qabul qilingan (yoki berilgan) sana bo‘yicha.
 * «Vaqtida» — dizayner oxirgi marta muddat kuni tugaguncha topshirgan bo‘lsa.
 */
export async function getStats(database: Database, period: Stats["period"]): Promise<Stats> {
  const since = period === "all" ? "" : new Date(Date.now() - Number(period) * 864e5).toISOString();
  const [taskResult, returnResult, memberResult] = await readBatch(database, [
    "SELECT id,status,assignee_id,created_by,image_count,due_date,created_at,claimed_at,submitted_at,completed_at FROM assignments",
    "SELECT assignment_id,member_id,created_at FROM assignment_events WHERE action='return'",
    "SELECT id,name,role FROM members WHERE deleted_at IS NULL AND role IN ('designer','pm') ORDER BY created_at",
  ]);
  const tasks = taskResult.rows;
  const returns = returnResult.rows;
  const members = memberResult.rows;
  const inPeriod = (date: unknown) => !since || (typeof date === "string" && date >= since);
  // Muddat Toshkent vaqti bilan kun oxirigacha (UTC+5).
  const onTime = (row: Row) =>
    !!row.submitted_at && new Date(String(row.submitted_at)) <= new Date(`${row.due_date}T23:59:59+05:00`);
  const doneRows = tasks.filter((t) => t.status === "done" && inPeriod(t.completed_at));
  const row = (m: Row): StatsRow => {
    const id = String(m.id);
    const done = doneRows.filter((t) => t.assignee_id === id);
    const timed = done.filter((t) => t.due_date);
    const hours = done
      .filter((t) => t.claimed_at && t.submitted_at)
      .map((t) => (Date.parse(String(t.submitted_at)) - Date.parse(String(t.claimed_at))) / 36e5);
    const ownTasks = new Set(tasks.filter((t) => t.assignee_id === id).map((t) => String(t.id)));
    return {
      id,
      name: String(m.name),
      role: m.role as Role,
      done: done.length,
      images: done.reduce((sum, t) => sum + Number(t.image_count), 0),
      onTime: timed.filter(onTime).length,
      late: timed.filter((t) => !onTime(t)).length,
      noDeadline: done.length - timed.length,
      returns: returns.filter((e) => ownTasks.has(String(e.assignment_id)) && inPeriod(e.created_at)).length,
      inProgress: tasks.filter((t) => t.assignee_id === id && t.status === "in_progress").length,
      inReview: tasks.filter((t) => t.assignee_id === id && t.status === "in_review").length,
      avgHours: hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : null,
      created: tasks.filter((t) => t.created_by === id && inPeriod(t.created_at)).length,
      accepted: doneRows.filter((t) => t.created_by === id).length,
    };
  };
  const timed = doneRows.filter((t) => t.due_date);
  return {
    period,
    totals: {
      created: tasks.filter((t) => inPeriod(t.created_at)).length,
      open: tasks.filter((t) => t.status === "todo").length,
      inProgress: tasks.filter((t) => t.status === "in_progress").length,
      inReview: tasks.filter((t) => t.status === "in_review").length,
      done: doneRows.length,
      images: doneRows.reduce((sum, t) => sum + Number(t.image_count), 0),
      onTime: timed.filter(onTime).length,
      late: timed.filter((t) => !onTime(t)).length,
    },
    designers: members.filter((m) => m.role === "designer").map(row),
    managers: members.filter((m) => m.role === "pm").map(row),
  };
}
