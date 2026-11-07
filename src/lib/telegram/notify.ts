import { db } from "../db";
import { themesOf, type Theme } from "../settings";
import type { Account, Task } from "../types";
import { inline, say, sendPhoto, telegramEnabled, type Keyboard } from "./api";
import { refreshHomes } from "./home";
import { taskSheetImage, type Lead } from "./images";
import { dropNotices, track, type Kind } from "./screens";
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
 * Vazifa oynasini bir nechta odamga yuboradi. Rasm har mavzu uchun bir marta chiziladi va yuklanadi,
 * qolganlarga Telegram'dagi nusxasi ketadi. Rasm chizilmasa, xabar oddiy matnda boradi.
 * kind «new» — vazifa olinganda hammadan olib tashlanadi.
 */
export async function sendTask(people: Recipient[], task: Task, lead: Lead, kind: Kind = "note", keyboardFor = defaultKeyboard) {
  if (!people.length) return 0;
  const themes = await themesOf(people.map((p) => p.id));
  const photos = new Map<Theme, Buffer | string | null>();
  let sent = 0;
  for (const person of people) {
    const theme = themes.get(person.id) ?? "dark";
    if (!photos.has(theme))
      photos.set(
        theme,
        await taskSheetImage(task, lead, theme, 4).catch((error) => {
          console.error("Telegram rasm:", error instanceof Error ? error.message : "xato");
          return null;
        }),
      );
    const markup = inline(keyboardFor(task, person));
    const photo = photos.get(theme);
    try {
      if (!photo) throw new Error("rasm yo‘q");
      const message = await sendPhoto(person.chat, photo, taskCaption(task, lead.text), markup);
      photos.set(theme, message.photo?.at(-1)?.file_id || photo);
      await track(person.chat, message.message_id, kind, task.id);
      sent += 1;
    } catch {
      const message = await say(person.chat, taskText(task, lead.text), markup);
      if (message) {
        await track(person.chat, message.message_id, kind, task.id);
        sent += 1;
      }
    }
  }
  return sent;
}

function defaultKeyboard(task: Task, person: Recipient): Keyboard {
  return taskKeyboard(task, { id: person.id, role: person.role });
}

/** Vazifa o‘zgarganda kimga nima deyiladi. Keyin hammaning bosh menyusi jimgina yangilanadi. */
export async function notifyTask(action: string, before: Task, task: Task, actor: Account, message = "") {
  if (!telegramEnabled()) return;
  const others = (person: Recipient | null) => (person && person.id !== actor.id ? [person] : []);
  const owner = async () => others(await recipient(task.createdBy, "pm"));
  const worker = async (id: string | null) => others(await recipient(id, "designer"));
  const reason = message ? `: ${message.slice(0, 60)}` : "";
  try {
    // Olingan yoki yopilgan vazifaning «Yangi vazifa» xabari hech kimda qolmaydi.
    if (["claim", "cancel", "deleted"].includes(action)) await dropNotices(task.id);
    switch (action) {
      case "created":
        await sendTask(await designers(), task, { text: "Yangi vazifa", tone: "accent" }, "new");
        break;
      case "reopen":
        await sendTask(await designers(), task, { text: "Vazifa qayta ochildi", tone: "accent" }, "new");
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
        await sendTask(await designers(before.assigneeId), task, { text: "Vazifa yana ochiq", tone: "accent" }, "new");
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
    await refreshHomes();
  } catch (error) {
    console.error("Telegram xabarnoma:", error instanceof Error ? error.message : "xato");
  }
}
