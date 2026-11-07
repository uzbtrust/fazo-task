import { db } from "../db";
import type { Account, Task } from "../types";
import { inline, say, sendPhoto, telegramEnabled, type Keyboard } from "./api";
import { taskSheetImage, type Lead } from "./images";
import { taskCaption, taskKeyboard, taskText } from "./views";

export interface Recipient {
  chat: string;
  id: string;
  role: "pm" | "designer";
}

export async function designers(except?: string | null): Promise<Recipient[]> {
  const rows = (
    await (await db()).execute(`SELECT t.telegram_id,m.id FROM telegram_accounts t JOIN members m ON m.id=t.member_id
      WHERE m.role='designer' AND m.deleted_at IS NULL AND m.password_hash IS NOT NULL`)
  ).rows;
  return rows
    .filter((row) => row.id !== except)
    .map((row) => ({ chat: String(row.telegram_id), id: String(row.id), role: "designer" }));
}

export async function recipient(memberId: string | null, role: "pm" | "designer"): Promise<Recipient | null> {
  if (!memberId) return null;
  const row = (
    await (await db()).execute({ sql: "SELECT telegram_id FROM telegram_accounts WHERE member_id=?", args: [memberId] })
  ).rows[0];
  return row ? { chat: String(row.telegram_id), id: memberId, role } : null;
}

/**
 * Bitta vazifa oynasini bir nechta odamga yuboradi. Rasm bir marta chiziladi va yuklanadi,
 * qolganlarga Telegram'dagi nusxasi ketadi. Rasm chizilmasa, xabar oddiy matnda boradi.
 */
export async function sendTask(people: Recipient[], task: Task, lead: Lead, keyboardFor = defaultKeyboard) {
  if (!people.length) return;
  const image = await taskSheetImage(task, lead).catch((error) => {
    console.error("Telegram rasm:", error instanceof Error ? error.message : "xato");
    return null;
  });
  let photo: Buffer | string | null = image;
  for (const person of people) {
    const markup = inline(keyboardFor(task, person));
    try {
      if (!photo) throw new Error("rasm yo‘q");
      const sent = await sendPhoto(person.chat, photo, taskCaption(task, lead.text), markup);
      photo = sent.photo?.at(-1)?.file_id || photo;
    } catch {
      await say(person.chat, taskText(task, lead.text), markup);
    }
  }
}

function defaultKeyboard(task: Task, person: Recipient): Keyboard {
  return taskKeyboard(task, { id: person.id, role: person.role });
}

/** Vazifa o‘zgarganda kimga nima deyiladi. Xabar yuborilmasa ham ish to‘xtamaydi. */
export async function notifyTask(action: string, before: Task, task: Task, actor: Account, message = "") {
  if (!telegramEnabled()) return;
  const others = (person: Recipient | null) => (person && person.id !== actor.id ? [person] : []);
  const owner = async () => others(await recipient(task.createdBy, "pm"));
  const worker = async (id: string | null) => others(await recipient(id, "designer"));
  const reason = message ? `: ${message.slice(0, 60)}` : "";
  try {
    switch (action) {
      case "created":
        await sendTask(await designers(), task, { text: "Yangi vazifa", tone: "accent" });
        break;
      case "reopen":
        await sendTask(await designers(), task, { text: "Vazifa qayta ochildi", tone: "accent" });
        break;
      case "claim":
        await sendTask(await owner(), task, { text: `${actor.name} vazifani oldi`, tone: "accent" });
        break;
      case "complete":
      case "submit":
        await sendTask(await owner(), task, { text: `${actor.name} ishni tugatdi`, tone: "good" });
        break;
      case "release":
        await sendTask(await owner(), task, { text: `${actor.name} vazifani bo‘shatdi`, tone: "warn" });
        await sendTask(await worker(before.assigneeId), task, { text: "Vazifa ochiq ro‘yxatga qaytarildi", tone: "warn" });
        await sendTask(await designers(before.assigneeId), task, { text: "Vazifa yana ochiq", tone: "accent" });
        break;
      case "cancel":
        await sendTask(await worker(before.assigneeId), task, { text: `Vazifa bekor qilindi${reason}`, tone: "bad" });
        break;
      case "edit": {
        const moved = before.dueDate !== task.dueDate || before.dueTime !== task.dueTime;
        await sendTask(await worker(task.assigneeId), task, { text: moved ? "Muddat o‘zgardi" : "Vazifa o‘zgartirildi", tone: moved ? "warn" : "accent" });
        break;
      }
      case "return":
        await sendTask(await worker(task.assigneeId), task, { text: `Qayta ishlashga qaytdi${reason}`, tone: "warn" });
        break;
      case "accept":
        await sendTask(await worker(task.assigneeId), task, { text: "Ishingiz qabul qilindi", tone: "good" });
        break;
    }
  } catch (error) {
    console.error("Telegram xabarnoma:", error instanceof Error ? error.message : "xato");
  }
}
