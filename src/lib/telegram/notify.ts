import { db } from "../db";
import type { Account, Task } from "../types";
import { inline, say, telegramEnabled } from "./api";
import { taskKeyboard, taskText } from "./views";

async function designers(except?: string | null) {
  const rows = (
    await (await db()).execute(`SELECT t.telegram_id,m.id FROM telegram_accounts t JOIN members m ON m.id=t.member_id
      WHERE m.role='designer' AND m.deleted_at IS NULL AND m.password_hash IS NOT NULL`)
  ).rows;
  return rows
    .filter((row) => row.id !== except)
    .map((row) => ({ chat: String(row.telegram_id), id: String(row.id) }));
}

async function chatOf(memberId: string | null) {
  if (!memberId) return null;
  const row = (
    await (await db()).execute({ sql: "SELECT telegram_id FROM telegram_accounts WHERE member_id=?", args: [memberId] })
  ).rows[0];
  return row ? String(row.telegram_id) : null;
}

/** Bitta odamga vazifa kartasi. Bog‘lanmagan bo‘lsa yoki amalni o‘zi qilgan bo‘lsa, xabar yuborilmaydi. */
async function tell(memberId: string | null, role: "pm" | "designer", task: Task, lead: string, actor: Account) {
  if (!memberId || memberId === actor.id) return;
  const chat = await chatOf(memberId);
  if (chat) await say(chat, taskText(task, lead), inline(taskKeyboard(task, { id: memberId, role })));
}

async function tellDesigners(task: Task, lead: string, except?: string | null) {
  const list = await designers(except);
  await Promise.all(
    list.map((designer) =>
      say(designer.chat, taskText(task, lead), inline(taskKeyboard(task, { id: designer.id, role: "designer" }))),
    ),
  );
}

/** Vazifa o‘zgarganda kimga nima deyiladi. Xabar yuborilmasa ham ish to‘xtamaydi. */
export async function notifyTask(action: string, before: Task, task: Task, actor: Account, message = "") {
  if (!telegramEnabled()) return;
  const reason = message ? `\nIzoh: ${message}` : "";
  try {
    switch (action) {
      case "created":
        await tellDesigners(task, "Yangi vazifa");
        break;
      case "reopen":
        await tellDesigners(task, "Vazifa qayta ochildi");
        break;
      case "claim":
        await tell(task.createdBy, "pm", task, `${actor.name} vazifani oldi`, actor);
        break;
      case "complete":
      case "submit":
        await tell(task.createdBy, "pm", task, `${actor.name} ishni tugatdi`, actor);
        break;
      case "release":
        await tell(task.createdBy, "pm", task, `${actor.name} vazifani bo‘shatdi`, actor);
        await tell(before.assigneeId, "designer", task, "Vazifa ochiq ro‘yxatga qaytarildi", actor);
        await tellDesigners(task, "Vazifa yana ochiq", before.assigneeId);
        break;
      case "cancel":
        await tell(before.assigneeId, "designer", task, `Vazifa bekor qilindi${reason}`, actor);
        break;
      case "edit":
        await tell(task.assigneeId, "designer", task, "Vazifa o‘zgartirildi", actor);
        break;
      case "return":
        await tell(task.assigneeId, "designer", task, `Vazifa qayta ishlashga qaytdi${reason}`, actor);
        break;
      case "accept":
        await tell(task.assigneeId, "designer", task, "Ishingiz qabul qilindi", actor);
        break;
    }
  } catch (error) {
    console.error("Telegram xabarnoma:", error instanceof Error ? error.message : "xato");
  }
}
