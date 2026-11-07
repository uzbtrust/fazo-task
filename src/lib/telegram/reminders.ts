import { nowTime, todayEyebrow, todayISO } from "../dates";
import { db } from "../db";
import { givenName } from "../roles";
import { getTasks } from "../tasks";
import type { Task } from "../types";
import { inline, say, sendPhoto, telegramEnabled } from "./api";
import { taskListImage, type Lead } from "./images";
import { designers, recipient, sendTask, type Recipient } from "./notify";
import { taskButton } from "./views";

const HOUR = 3600_000;
const DAY = 24 * HOUR;
/** Tunda bezovta qilinmaydi: eslatma ertalab yetib boradi. */
const WORK_FROM = "09:00";
const WORK_TO = "22:00";
const SWEEP_EVERY = 5 * 60_000;

export const deadlineOf = (task: Pick<Task, "dueDate" | "dueTime">) =>
  task.dueDate ? Date.parse(`${task.dueDate}T${task.dueTime || "23:59"}:00+05:00`) : null;

export interface Reminder {
  /** Bir marta yuborilishi uchun kalit: muddat o‘zgarsa, eslatma qayta ishlaydi. */
  key: string;
  task: Task;
  lead: Lead;
  to: ("assignee" | "creator" | "designers")[];
}

function leftText(left: number) {
  if (left < HOUR) return "1 soatdan kam qoldi";
  return `${Math.ceil(left / HOUR)} soat qoldi`;
}

/** Hozir qaysi eslatmalar vaqti kelgan. Sof funksiya: faqat vazifalar va vaqtga qaraydi. */
export function dueReminders(tasks: Task[], now: number): Reminder[] {
  const list: Reminder[] = [];
  for (const task of tasks) {
    const deadline = deadlineOf(task);
    const stamp = `${task.id}:${task.dueDate}T${task.dueTime || ""}`;
    const left = deadline === null ? null : deadline - now;
    if (task.status === "in_progress" || task.status === "in_review") {
      if (left === null) continue;
      const held = now - Date.parse(task.claimedAt || task.updatedAt);
      if (left <= 0) list.push({ key: `late:${stamp}`, task, lead: { text: "Muddat o‘tdi", tone: "bad" }, to: ["assignee", "creator"] });
      else if (left <= 3 * HOUR) {
        if (held >= HOUR) list.push({ key: `soon:${stamp}`, task, lead: { text: leftText(left), tone: "warn" }, to: ["assignee"] });
      } else if (left <= DAY && held >= 4 * HOUR)
        list.push({ key: `day:${stamp}`, task, lead: { text: task.dueDate === todayISO() ? "Muddat bugun" : "Muddat ertaga", tone: "warn" }, to: ["assignee"] });
      continue;
    }
    if (task.status !== "todo" || task.assigneeId) continue;
    if (left !== null && left <= 0)
      list.push({ key: `open-late:${stamp}`, task, lead: { text: "Muddat o‘tdi, hech kim olmagan", tone: "bad" }, to: ["creator"] });
    else if (left !== null && left <= DAY)
      list.push({ key: `open-due:${stamp}`, task, lead: { text: "Muddat yaqin, hali hech kim olmagan", tone: "warn" }, to: ["designers", "creator"] });
    else {
      const age = now - Date.parse(task.updatedAt);
      if (age >= 3 * HOUR && age < 3 * DAY)
        list.push({ key: `open-wait:${task.id}:${task.updatedAt}`, task, lead: { text: "Bu vazifa sizni kutmoqda", tone: "accent" }, to: ["designers"] });
    }
  }
  return list;
}

async function mutedChats() {
  const rows = (await (await db()).execute("SELECT telegram_id FROM telegram_muted")).rows;
  return new Set(rows.map((row) => String(row.telegram_id)));
}

export async function isMuted(telegramId: number | string) {
  const row = (
    await (await db()).execute({ sql: "SELECT 1 FROM telegram_muted WHERE telegram_id=?", args: [String(telegramId)] })
  ).rows[0];
  return !!row;
}

export async function setMuted(telegramId: number | string, muted: boolean) {
  await (await db()).execute({
    sql: muted
      ? "INSERT OR IGNORE INTO telegram_muted(telegram_id) VALUES (?)"
      : "DELETE FROM telegram_muted WHERE telegram_id=?",
    args: [String(telegramId)],
  });
}

/** Kalitni band qiladi: faqat birinchi kelgan so‘rov yuboradi. */
async function once(key: string) {
  const result = await (await db()).execute({
    sql: "INSERT OR IGNORE INTO telegram_reminders(key,sent_at) VALUES (?,?)",
    args: [key, new Date().toISOString()],
  });
  return result.rowsAffected === 1;
}

async function deliver(reminder: Reminder, muted: Set<string>) {
  const { task, to } = reminder;
  const people: Recipient[] = [];
  const add = (person: Recipient | null) => {
    if (person && !muted.has(person.chat) && !people.some((p) => p.chat === person.chat)) people.push(person);
  };
  if (to.includes("assignee")) add(await recipient(task.assigneeId, "designer"));
  if (to.includes("creator")) add(await recipient(task.createdBy, "pm"));
  if (to.includes("designers")) (await designers()).forEach(add);
  if (people.length) await sendTask(people, task, reminder.lead);
  return people.length;
}

const LIST_ROWS = 5;

/** Ertalabki xulosa: har kimga bugungi ishlari ilova ko‘rinishida. */
async function morningDigest(tasks: Task[], muted: Set<string>) {
  const today = todayISO();
  const rows = (
    await (await db()).execute(`SELECT t.telegram_id,m.id,m.name,m.role FROM telegram_accounts t JOIN members m ON m.id=t.member_id
      WHERE m.role IN ('designer','pm') AND m.deleted_at IS NULL AND m.password_hash IS NOT NULL`)
  ).rows;
  const eyebrow = todayEyebrow();
  const late = (t: Task) => (deadlineOf(t) ?? Infinity) < Date.now();
  const dueToday = (t: Task) => t.dueDate === today && !late(t);
  let sent = 0;
  for (const row of rows) {
    const chat = String(row.telegram_id);
    if (muted.has(chat)) continue;
    const id = String(row.id);
    const designer = row.role === "designer";
    const mine = tasks.filter((t) =>
      designer ? t.assigneeId === id && (t.status === "in_progress" || t.status === "in_review") : t.status !== "done" && t.status !== "cancelled",
    );
    const pool = designer ? tasks.filter((t) => t.status === "todo" && !t.assigneeId) : [];
    if (!mine.length && !pool.length) continue;
    if (!(await once(`digest:${id}:${today}`))) continue;
    const lateItems = mine.filter(late);
    const todayItems = mine.filter(dueToday);
    const restItems = mine.filter((t) => !late(t) && !dueToday(t));
    const shown = [...lateItems, ...todayItems, ...restItems, ...(mine.length ? [] : pool)].slice(0, LIST_ROWS);
    const pick = (items: Task[]) => items.filter((t) => shown.includes(t));
    const dim = lateItems.length
      ? `${lateItems.length} ta ish muddati o‘tgan.`
      : todayItems.length
        ? `Bugun ${todayItems.length} ta muddat bor.`
        : mine.length
          ? `${mine.length} ta ish davom etmoqda.`
          : `${pool.length} ta ochiq vazifa bor.`;
    const name = givenName(String(row.name));
    const kind = mine.length ? (designer ? "mine" : "live") : "open";
    const image = await taskListImage({
      accent: eyebrow.date,
      eyebrow: eyebrow.weekday,
      title: `Xayrli tong, ${name}.`,
      dim,
      person: designer ? "creator" : "assignee",
      groups: [
        { title: "Muddati o‘tgan", items: pick(lateItems) },
        { title: "Bugun", items: pick(todayItems) },
        { title: "Keyingi", items: pick(restItems) },
        { title: "Ochiq", items: mine.length ? [] : shown },
      ],
    }).catch(() => null);
    const markup = inline(shown.map((task) => taskButton(task, kind)));
    const caption = `<b>Xayrli tong, ${name}.</b>\n${dim}`;
    if (image) await sendPhoto(chat, image, caption, markup).catch(() => say(chat, caption, markup));
    else await say(chat, caption, markup);
    sent += 1;
  }
  return sent;
}

/**
 * Eslatmalarni tekshiradi. Tashqaridan ochiq chaqirilishi xavfsiz: yuboriladigan narsa faqat vaqti
 * kelgan eslatma, har biri bir marta, tekshiruv esa 5 daqiqada ko‘pi bilan bir marta ishlaydi.
 */
export async function sweep() {
  if (!telegramEnabled()) return { sent: 0, skipped: "off" };
  const database = await db();
  const now = Date.now();
  const slot = await database.execute({
    sql: `INSERT INTO telegram_reminders(key,sent_at) VALUES ('sweep',?)
      ON CONFLICT(key) DO UPDATE SET sent_at=excluded.sent_at WHERE sent_at<?`,
    args: [new Date(now).toISOString(), new Date(now - SWEEP_EVERY).toISOString()],
  });
  if (slot.rowsAffected !== 1) return { sent: 0, skipped: "recent" };
  const clock = nowTime();
  if (clock < WORK_FROM || clock >= WORK_TO) return { sent: 0, skipped: "night" };
  const tasks = await getTasks(database);
  const muted = await mutedChats();
  let sent = 0;
  for (const reminder of dueReminders(tasks, now)) if (await once(reminder.key)) sent += await deliver(reminder, muted);
  if (todayEyebrow().weekday !== "Yakshanba") sent += await morningDigest(tasks, muted);
  await database.execute({
    sql: "DELETE FROM telegram_reminders WHERE sent_at<? AND key<>'sweep'",
    args: [new Date(now - 60 * DAY).toISOString()],
  });
  return { sent };
}
