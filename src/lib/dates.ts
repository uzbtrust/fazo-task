import type { TaskStatus } from "./types";

/* Sana va soat: hammasi Toshkent vaqtida. Server ham, brauzer ham shu fayldan foydalanadi. */
export const months = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];
const monthShort = [
  "yan", "fev", "mar", "apr", "may", "iyn",
  "iyl", "avg", "sen", "okt", "noy", "dek",
];
const weekdays: Record<string, string> = {
  Monday: "Dushanba",
  Tuesday: "Seshanba",
  Wednesday: "Chorshanba",
  Thursday: "Payshanba",
  Friday: "Juma",
  Saturday: "Shanba",
  Sunday: "Yakshanba",
};
function dateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    weekday: "long",
    timeZone: "Asia/Tashkent",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return {
    day: get("day"),
    month: get("month"),
    year: get("year"),
    weekday: weekdays[get("weekday")] || "",
  };
}
function parseDay(value: string) {
  return new Date(value.length === 10 ? `${value}T12:00:00+05:00` : value);
}
export function todayISO() {
  const p = dateParts(new Date());
  return `${p.year}-${p.month}-${p.day}`;
}
export function addDaysISO(days: number) {
  const [y, m, d] = todayISO().split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
function dayDiff(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const [ty, tm, td] = todayISO().split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 864e5);
}
export function shortDate(value: string | null) {
  if (!value) return "Belgilanmagan";
  const date = parseDay(value);
  if (!Number.isFinite(date.getTime())) return "Belgilanmagan";
  const p = dateParts(date);
  return `${Number(p.day)}-${monthShort[Number(p.month) - 1]}`;
}
export function longDate(value: string) {
  const p = dateParts(parseDay(value));
  return `${Number(p.day)}-${months[Number(p.month) - 1]}, ${p.year}`;
}
const clock = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Tashkent",
  }).format(date);
/** Hozirgi soat (HH:MM), Toshkent vaqti. */
export const nowTime = () => clock(new Date());
export function dateTime(value: string) {
  return `${shortDate(value)}, ${clock(new Date(value))}`;
}
export function todayEyebrow() {
  const p = dateParts(new Date());
  return { date: `${Number(p.day)}-${months[Number(p.month) - 1]}`, weekday: p.weekday };
}
export function isOverdue(dueDate: string | null, status: TaskStatus, dueTime: string | null = null) {
  if (!dueDate || status === "done" || status === "cancelled") return false;
  const today = todayISO();
  return dueDate < today || (dueDate === today && !!dueTime && dueTime < nowTime());
}
/** text — ro‘yxat uchun (soat bilan); note — to‘liq sana yonidagi izoh. */
export function dueLabel(dueDate: string, status: TaskStatus, dueTime: string | null = null) {
  const at = dueTime ? `, ${dueTime}` : "";
  const diff = dayDiff(dueDate);
  if (status === "done" || status === "cancelled") return { text: `${shortDate(dueDate)}${at}`, note: "", tone: "" };
  if (diff < 0) return { text: `${-diff} kun kechikdi`, note: `${-diff} kun kechikdi`, tone: "bad" };
  if (isOverdue(dueDate, status, dueTime)) return { text: `Kechikdi${at}`, note: "Kechikdi", tone: "bad" };
  if (diff === 0) return { text: `Bugun${at}`, note: "Bugun", tone: "warn" };
  if (diff === 1) return { text: `Ertaga${at}`, note: "", tone: "" };
  return { text: `${shortDate(dueDate)}${at}`, note: "", tone: "" };
}
