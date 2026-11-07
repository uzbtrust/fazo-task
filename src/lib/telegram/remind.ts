import { db } from "../db";
import { ApiError } from "../server";
import { getTasks } from "../tasks";
import type { Account } from "../types";
import { designers, recipient, sendTask } from "./notify";

const GAP = 10 * 60_000;

/**
 * PM qo‘lda eslatadi: olingan vazifa — dizaynerga, ochiq vazifa — hamma dizaynerlarga.
 * Bitta vazifa 10 daqiqada bir martadan ko‘p eslatilmaydi.
 */
export async function remindTask(pm: Account, id: string) {
  if (pm.role !== "pm") throw new ApiError(403, "Bu amal sizning rolingiz uchun emas.");
  const database = await db();
  const task = (await getTasks(database, { id }))[0];
  if (!task) throw new ApiError(404, "Vazifa topilmadi.");
  const open = task.status === "todo" && !task.assigneeId;
  const working = (task.status === "in_progress" || task.status === "in_review") && task.assigneeId;
  if (!open && !working) throw new ApiError(409, "Bu vazifa tugagan yoki bekor qilingan: eslatish kerak emas.");
  const key = `nudge:${id}`;
  const last = (await database.execute({ sql: "SELECT sent_at FROM telegram_reminders WHERE key=?", args: [key] })).rows[0];
  if (last && Date.now() - Date.parse(String(last.sent_at)) < GAP)
    throw new ApiError(429, "Bu vazifa hozirgina eslatildi. 10 daqiqadan keyin qayta urinib ko‘ring.");
  const people = open ? await designers() : [await recipient(task.assigneeId, "designer")].filter((p) => p !== null);
  if (!people.length)
    throw new ApiError(
      409,
      open ? "Hech bir dizayner Telegram'ni ulamagan." : "Dizayner Telegram'ni ulamagan. Unga boshqa yo‘l bilan ayting.",
    );
  const sent = await sendTask(people, task, { text: `${pm.name} eslatmoqda`, tone: "warn" }, open ? "new" : "note");
  await database.execute({
    sql: "INSERT INTO telegram_reminders(key,sent_at) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET sent_at=excluded.sent_at",
    args: [key, new Date().toISOString()],
  });
  return sent;
}
