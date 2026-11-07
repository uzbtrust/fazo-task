import { db } from "../db";
import { remove, removeMany } from "./api";

/*
 * Botda chat toza turadi: bitta bosh menyu (doim), bitta ish xabari (ishlaganda) va xabarnomalar.
 * Ish xabari oxirgi amaldan 10 daqiqa o‘tib, xabarnoma ko‘rilgandan 10 daqiqa o‘tib o‘chadi.
 * Bot xabar o‘qilganini bilmaydi: foydalanuvchi botda biror narsa bossa yoki yozsa — ko‘rgan hisoblanadi.
 */
export const LINGER = 10 * 60_000;
/** Hech qachon ko‘rilmagan xabarnoma ham bir kundan keyin o‘chadi. */
const MAX_AGE = 24 * 3600_000;

export type Kind = "new" | "note" | "code";

export interface Screen {
  homeId: number | null;
  homeSig: string | null;
  workId: number | null;
  workPhoto: boolean;
  workAt: string | null;
  cleaned: boolean;
}

export async function getScreen(chat: number | string): Promise<Screen> {
  const row = (
    await (await db()).execute({ sql: "SELECT * FROM telegram_screens WHERE telegram_id=?", args: [String(chat)] })
  ).rows[0];
  return {
    homeId: row?.home_id ? Number(row.home_id) : null,
    homeSig: row?.home_sig ? String(row.home_sig) : null,
    workId: row?.work_id ? Number(row.work_id) : null,
    workPhoto: Number(row?.work_photo || 0) === 1,
    workAt: row?.work_at ? String(row.work_at) : null,
    cleaned: Number(row?.cleaned || 0) === 1,
  };
}

export async function saveScreen(chat: number | string, patch: Partial<Screen>) {
  const next = { ...(await getScreen(chat)), ...patch };
  await (await db()).execute({
    sql: `INSERT INTO telegram_screens(telegram_id,home_id,home_sig,work_id,work_photo,work_at,cleaned) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(telegram_id) DO UPDATE SET home_id=excluded.home_id,home_sig=excluded.home_sig,work_id=excluded.work_id,
      work_photo=excluded.work_photo,work_at=excluded.work_at,cleaned=excluded.cleaned`,
    args: [String(chat), next.homeId, next.homeSig, next.workId, next.workPhoto ? 1 : 0, next.workAt, next.cleaned ? 1 : 0],
  });
}

/** Xabarnomani yozib qo‘yadi: o‘chirish va vazifa olinganda yig‘ishtirish uchun. */
export async function track(chat: number | string, messageId: number, kind: Kind, taskId: string | null = null, deleteAt: number | null = null) {
  await (await db()).execute({
    sql: `INSERT INTO telegram_messages(chat,message_id,kind,task_id,sent_at,delete_at) VALUES (?,?,?,?,?,?)
      ON CONFLICT(chat,message_id) DO UPDATE SET kind=excluded.kind,task_id=excluded.task_id,delete_at=excluded.delete_at`,
    args: [String(chat), messageId, kind, taskId, new Date().toISOString(), deleteAt ? new Date(deleteAt).toISOString() : null],
  });
}

/** Foydalanuvchi botga qaytdi: ko‘rilmagan xabarnomalar 10 daqiqadan keyin o‘chadi. */
export async function seen(chat: number | string) {
  await (await db()).execute({
    sql: "UPDATE telegram_messages SET delete_at=? WHERE chat=? AND delete_at IS NULL",
    args: [new Date(Date.now() + LINGER).toISOString(), String(chat)],
  });
}

/** Xabar bilan ishlandi: oddiy xabarga aylanadi va 10 daqiqadan keyin o‘chadi. */
export async function expire(chat: number | string, messageId: number) {
  await track(chat, messageId, "note", null, Date.now() + LINGER);
}

/** Vazifa olindi yoki bekor bo‘ldi: «Yangi vazifa» xabarlari hammadan darhol olib tashlanadi. */
export async function dropNotices(taskId: string) {
  const database = await db();
  const rows = (
    await database.execute({ sql: "SELECT chat,message_id FROM telegram_messages WHERE task_id=? AND kind='new'", args: [taskId] })
  ).rows;
  for (const row of rows) await remove(String(row.chat), Number(row.message_id));
  if (rows.length) await database.execute({ sql: "DELETE FROM telegram_messages WHERE task_id=? AND kind='new'", args: [taskId] });
}

/** Vaqti kelgan xabarlarni o‘chiradi. Tunda ham ishlaydi: o‘chirish hech kimni bezovta qilmaydi. */
export async function cleanup(now = Date.now()) {
  const database = await db();
  const due = (
    await database.execute({
      sql: `SELECT chat,message_id FROM telegram_messages
        WHERE (delete_at IS NOT NULL AND delete_at<=?) OR (delete_at IS NULL AND sent_at<=?)`,
      args: [new Date(now).toISOString(), new Date(now - MAX_AGE).toISOString()],
    })
  ).rows;
  const byChat = new Map<string, number[]>();
  for (const row of due) byChat.set(String(row.chat), [...(byChat.get(String(row.chat)) || []), Number(row.message_id)]);
  for (const [chat, ids] of byChat) {
    await removeMany(chat, ids);
    await database.execute({
      sql: `DELETE FROM telegram_messages WHERE chat=? AND message_id IN (${ids.map(() => "?").join(",")})`,
      args: [chat, ...ids],
    });
  }
  const idle = (
    await database.execute({
      sql: "SELECT telegram_id,work_id FROM telegram_screens WHERE work_id IS NOT NULL AND work_at<=?",
      args: [new Date(now - LINGER).toISOString()],
    })
  ).rows;
  for (const row of idle) {
    await remove(String(row.telegram_id), Number(row.work_id));
    await database.execute({
      sql: "UPDATE telegram_screens SET work_id=NULL,work_at=NULL WHERE telegram_id=? AND work_id=?",
      args: [String(row.telegram_id), Number(row.work_id)],
    });
  }
  return due.length + idle.length;
}
