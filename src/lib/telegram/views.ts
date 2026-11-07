import { dueLabel } from "../dates";
import { roleInfo } from "../roles";
import type { Account, Role, Task } from "../types";
import { REVIEW_STEP, statusLabels } from "../workflow";
import { action, escapeHtml, webApp, type Keyboard } from "./api";

export type ListKind = "mine" | "open" | "live" | "done";

export const LISTS: Record<ListKind, { title: string; empty: string }> = {
  mine: { title: "Mening vazifalarim", empty: "Hozir amaldagi vazifangiz yo‘q." },
  open: { title: "Ochiq vazifalar", empty: "Ochiq vazifa yo‘q. Yangisi qo‘yilganda shu yerga xabar keladi." },
  live: { title: "Hozirgi vazifalar", empty: "Hozir ochiq ish yo‘q." },
  done: { title: "Tugagan vazifalar", empty: "Tugagan vazifa hali yo‘q." },
};

/** Pastki doimiy menyu: har rolning o‘z tugmalari. */
export function mainKeyboard(role: Role) {
  const rows: Record<Role, string[][]> = {
    designer: [["Mening vazifalarim", "Ochiq vazifalar"], ["Statistika", "Hisob"]],
    pm: [["Hozirgi vazifalar", "Yangi vazifa"], ["Dizaynerlar", "Statistika"], ["Hisob"]],
    admin: [["Jamoa", "Statistika"], ["Hisob"]],
  };
  return {
    keyboard: rows[role].map((row) => row.map((text) => ({ text }))),
    resize_keyboard: true,
    is_persistent: true,
  };
}

const stars = (value: number | null) => (value ? "★".repeat(value) + "☆".repeat(5 - value) : "");
const number = (task: Task) => `#${String(task.number).padStart(3, "0")}`;
const cut = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value);

export function dueText(task: Pick<Task, "dueDate" | "dueTime" | "status">) {
  return task.dueDate ? dueLabel(task.dueDate, task.status, task.dueTime).text : "";
}

/** Vazifa kartasi. lead — tepadagi qator: «Yangi vazifa», «Vazifa o‘zgartirildi» va hokazo. */
export function taskText(task: Task, lead?: string) {
  const facts = [
    `${task.imageCount} ta rasm`,
    dueText(task) && `Muddat: ${dueText(task)}`,
    stars(task.priority),
  ].filter(Boolean);
  const people = [
    `PM: ${escapeHtml(task.creatorName)}`,
    task.assigneeName && `Dizayner: ${escapeHtml(task.assigneeName)}`,
  ].filter(Boolean);
  const extras = [
    task.briefFiles.length && `${task.briefFiles.length} ta fayl`,
    task.referenceFiles.length && `${task.referenceFiles.length} ta namuna`,
    task.links.length && `${task.links.length} ta havola`,
    task.resultFiles.length && `${task.resultFiles.length} ta natija`,
  ].filter(Boolean);
  const brief = task.brief.trim();
  const blocks = [
    lead ? `<b>${escapeHtml(lead)}</b>` : "",
    `<b>${escapeHtml(task.title)}</b>\n${number(task)} · ${statusLabels[task.status]}`,
    `${facts.join(" · ")}\n${people.join(" · ")}`,
    brief ? `<blockquote expandable>${escapeHtml(cut(brief, 1500))}</blockquote>` : "",
    extras.join(" · "),
    task.resultNote ? `Izoh: ${escapeHtml(cut(task.resultNote, 400))}` : "",
  ];
  return blocks.filter(Boolean).join("\n\n");
}

const fileCount = (task: Task) => task.briefFiles.length + task.referenceFiles.length + task.resultFiles.length;

/** Karta tugmalari: kim ko‘rayotgani va vazifa holatiga qarab. */
export function taskKeyboard(task: Task, account: Pick<Account, "id" | "role">, back?: ListKind): Keyboard {
  const rows: Keyboard = [];
  if (account.role === "designer") {
    if (task.status === "todo" && !task.assigneeId) rows.push([action("Men olaman", `claim:${task.id}`, "success")]);
    if (task.status === "in_progress" && task.assigneeId === account.id) {
      if (!REVIEW_STEP) rows.push([action("Tugatdim", `done:${task.id}`, "success")]);
      rows.push([action("Bo‘shatish", `rel:${task.id}`)]);
    }
  }
  if (account.role === "pm") {
    const manage = [];
    if (task.status === "in_progress") manage.push(action("Bo‘shatish", `rel:${task.id}`));
    if (["todo", "in_progress", "in_review"].includes(task.status))
      manage.push(action("Bekor qilish", `can:${task.id}`, "danger"));
    if (task.status === "cancelled") manage.push(action("Qayta ochish", `re:${task.id}`));
    if (manage.length) rows.push(manage);
  }
  rows.push([
    ...(fileCount(task) ? [action(`Fayllar (${fileCount(task)})`, `f:${task.id}`)] : []),
    webApp("Ilovada ochish", `/tg?task=${task.id}`),
  ]);
  if (back) rows.push([action("Orqaga", `l:${back}:0`)]);
  return rows;
}

/** Ro‘yxatdagi bitta tugma: nom va muddat. */
export function taskButton(task: Task, kind: ListKind) {
  const due = dueText(task);
  return [action(`${cut(task.title, 34)}${due ? ` · ${due}` : ""}`, `t:${task.id}:${kind}`)];
}

export const accountLine = (account: Account) => `@${escapeHtml(account.username)} · ${roleInfo[account.role].label}`;
