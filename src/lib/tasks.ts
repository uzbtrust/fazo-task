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
  DailyPoint,
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

/** PM yuklagan, hali hech qaysi vazifaga bog‘lanmagan fayllarni TZ yoki referens sifatida bog‘laydi. */
export async function linkFiles(
  database: Database,
  assignmentId: string,
  ids: string[],
  ownerId: string,
  kind: "brief" | "reference",
) {
  for (const id of ids) {
    const result = await database.execute({
      sql: `UPDATE attachments SET assignment_id=?, kind=?
        WHERE id=? AND owner_id=? AND assignment_id IS NULL`,
      args: [assignmentId, kind, id, ownerId],
    });
    if (result.rowsAffected !== 1)
      throw new ApiError(400, "Fayl topilmadi yoki allaqachon boshqa vazifaga biriktirilgan.");
  }
}

/** Referens havolalari: faqat http(s), ko‘pi bilan 20 ta. */
export function linkUrls(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 20)
    throw new ApiError(400, "Ko‘pi bilan 20 ta havola qo‘shish mumkin.");
  const urls = value.map((item) => {
    if (typeof item !== "string" || item.length > 600) throw new ApiError(400, "Havola noto‘g‘ri.");
    try {
      const url = new URL(item.trim());
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
      return url.toString();
    } catch {
      throw new ApiError(400, `Havola noto‘g‘ri: ${item.slice(0, 80)}`);
    }
  });
  return [...new Set(urls)];
}

export async function saveLinks(database: Database, assignmentId: string, urls: string[]) {
  await database.execute({ sql: "DELETE FROM assignment_links WHERE assignment_id=?", args: [assignmentId] });
  const now = new Date().toISOString();
  for (const url of urls)
    await database.execute({
      sql: "INSERT INTO assignment_links(id,assignment_id,url,created_at) VALUES (?,?,?,?)",
      args: [randomUUID(), assignmentId, url, now],
    });
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
  // Vazifalar, fayl ma’lumotlari, havolalar va tarix — bitta tarmoq aylanishida.
  const [taskResult, fileResult, eventResult, linkResult] = await readBatch(database, [
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
    {
      sql: `SELECT l.id,l.assignment_id,l.url FROM assignment_links l
        JOIN assignments a ON a.id=l.assignment_id${clause} ORDER BY l.created_at,l.rowid`,
      args,
    },
  ]);
  const rows = taskResult.rows;
  const files = fileResult.rows;
  const events = eventResult.rows;
  const links = linkResult.rows;
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
      referenceFiles: own.filter((f) => f.kind === "reference").map(fileMeta),
      links: links
        .filter((l) => l.assignment_id === row.id)
        .map((l) => ({ id: String(l.id), url: String(l.url) })),
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

/** Toshkent vaqti bo‘yicha sana (YYYY-MM-DD). */
const tashkentDay = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date(iso));

/**
 * Statistika. Admin — butun jamoa; PM — o‘zi qo‘ygan vazifalar; dizayner — o‘zi bajargan ishlar.
 * «Vaqtida» — dizayner muddat kuni tugaguncha (Toshkent vaqti) tugatgan yoki topshirgan bo‘lsa.
 * Davr — vazifa bajarilgan (statistikaga kiradigan) sana bo‘yicha.
 */
export async function getStats(
  database: Database,
  period: Stats["period"],
  viewer: { id: string; role: Role },
): Promise<Stats> {
  const days = period === "all" ? 90 : Number(period);
  const since = period === "all" ? "" : new Date(Date.now() - days * 864e5).toISOString();
  const [taskResult, returnResult, memberResult] = await readBatch(database, [
    "SELECT id,status,assignee_id,created_by,image_count,due_date,created_at,claimed_at,submitted_at,completed_at FROM assignments",
    "SELECT assignment_id,member_id,created_at FROM assignment_events WHERE action='return'",
    "SELECT id,name,role FROM members WHERE deleted_at IS NULL AND role IN ('designer','pm') ORDER BY created_at",
  ]);
  // Ko‘rish doirasi: kim qaysi vazifalarni ko‘radi.
  const tasks = taskResult.rows.filter((t) =>
    viewer.role === "admin" ? true : viewer.role === "pm" ? t.created_by === viewer.id : t.assignee_id === viewer.id,
  );
  const returns = returnResult.rows;
  const members = memberResult.rows.filter((m) =>
    viewer.role === "admin" ? true : viewer.role === "pm" ? m.role === "designer" || m.id === viewer.id : m.id === viewer.id,
  );
  const inPeriod = (date: unknown) => !since || (typeof date === "string" && date >= since);
  const onTime = (row: Row) =>
    !!row.submitted_at && new Date(String(row.submitted_at)) <= new Date(`${row.due_date}T23:59:59+05:00`);
  const hoursOf = (rows: Row[]) => {
    const hours = rows
      .filter((t) => t.claimed_at && t.submitted_at)
      .map((t) => (Date.parse(String(t.submitted_at)) - Date.parse(String(t.claimed_at))) / 36e5);
    return hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : null;
  };
  const doneRows = tasks.filter((t) => t.status === "done" && inPeriod(t.completed_at));

  // Kunlik qator: bo‘sh kunlar ham 0 bilan ko‘rinadi.
  const today = tashkentDay(new Date().toISOString());
  const dayList = Array.from({ length: days }, (_, i) => {
    const [y, m, d] = today.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d - (days - 1 - i))).toISOString().slice(0, 10);
  });
  const series = (rows: Row[]): DailyPoint[] => {
    const map = new Map(dayList.map((date) => [date, { date, images: 0, tasks: 0 }]));
    for (const t of rows) {
      if (t.status !== "done" || !t.completed_at) continue;
      const point = map.get(tashkentDay(String(t.completed_at)));
      if (!point) continue;
      point.images += Number(t.image_count);
      point.tasks += 1;
    }
    return [...map.values()];
  };

  const row = (m: Row): StatsRow => {
    const id = String(m.id);
    const done = doneRows.filter((t) => t.assignee_id === id);
    const timed = done.filter((t) => t.due_date);
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
      avgHours: hoursOf(done),
      created: tasks.filter((t) => t.created_by === id && inPeriod(t.created_at)).length,
      accepted: doneRows.filter((t) => t.created_by === id).length,
    };
  };
  const timed = doneRows.filter((t) => t.due_date);
  const designers = members.filter((m) => m.role === "designer");
  return {
    period,
    scope: viewer.role,
    totals: {
      created: tasks.filter((t) => inPeriod(t.created_at)).length,
      open: tasks.filter((t) => t.status === "todo").length,
      inProgress: tasks.filter((t) => t.status === "in_progress").length,
      inReview: tasks.filter((t) => t.status === "in_review").length,
      done: doneRows.length,
      images: doneRows.reduce((sum, t) => sum + Number(t.image_count), 0),
      onTime: timed.filter(onTime).length,
      late: timed.filter((t) => !onTime(t)).length,
      avgHours: hoursOf(doneRows),
    },
    // PM faqat o‘z vazifalarida ishlagan dizaynerlarni ko‘radi.
    designers: designers
      .map(row)
      .filter((r) => viewer.role !== "pm" || r.done + r.inProgress + r.inReview > 0),
    managers: members.filter((m) => m.role === "pm").map(row),
    daily: series(tasks),
    dailyBy:
      viewer.role === "admin"
        ? Object.fromEntries(designers.map((m) => [String(m.id), series(tasks.filter((t) => t.assignee_id === m.id))]))
        : {},
  };
}
