import { createHash } from "node:crypto";
import { isOverdue, todayEyebrow, todayISO } from "../dates";
import { db } from "../db";
import { givenName, memberRoles } from "../roles";
import { publicAccount } from "../server";
import { themesOf, getTheme, type Theme } from "../settings";
import { getMembers, getTasks } from "../tasks";
import type { Account, Task } from "../types";
import { action, editPhoto, inline, remove, sendPhoto, webApp, type Keyboard } from "./api";
import { homeImage, noticeImage, type Fact, type ListGroup } from "./images";
import { getScreen, saveScreen } from "./screens";

const SHOWN = 3;

const deadline = (t: Task) => (t.dueDate ? `${t.dueDate}T${t.dueTime || "24:00"}` : "9999");
const byDeadline = (a: Task, b: Task) => deadline(a).localeCompare(deadline(b)) || (b.priority || 0) - (a.priority || 0);
const late = (t: Task) => isOverdue(t.dueDate, t.status, t.dueTime);
const live = (t: Task) => t.status !== "done" && t.status !== "cancelled";

interface HomeView {
  sig: string;
  keyboard: Keyboard;
  render: (theme: Theme) => Promise<Buffer>;
}

/** Bosh menyu: saytdagi ish stolining o‘zi — salom, raqamlar, hozirgi ishlar va pastda tugmalar. */
export async function homeView(account: Account, all?: Task[]): Promise<HomeView> {
  const today = todayEyebrow();
  const head = { accent: today.date, eyebrow: today.weekday, title: `Salom, ${givenName(account.name)}.` };
  let facts: Fact[] = [];
  let groups: ListGroup[] = [];
  let dim = "";
  let more = 0;
  let keyboard: Keyboard;
  if (account.role === "admin") {
    const members = await getMembers(await db(), [...memberRoles]);
    facts = [
      { label: "Hodim", value: String(members.length), tone: "accent" },
      { label: "Project manager", value: String(members.filter((m) => m.role === "pm").length) },
      { label: "Dizayner", value: String(members.filter((m) => m.role === "designer").length) },
    ];
    dim = "Jamoa bir qarashda.";
    keyboard = [
      [action("Jamoa", "m:team"), action("Statistika", "m:stats")],
      [action("Hisob", "m:acct"), webApp("Ilovani ochish", "/tg")],
    ];
  } else {
    const tasks = all ?? (await getTasks(await db(), account.role === "designer" ? { visibleTo: account.id } : {}));
    const pool = tasks.filter((t) => t.status === "todo" && !t.assigneeId).sort(byDeadline);
    if (account.role === "designer") {
      const mine = tasks.filter((t) => t.assigneeId === account.id && (t.status === "in_progress" || t.status === "in_review")).sort(byDeadline);
      const lateCount = mine.filter(late).length;
      facts = [
        { label: "Jarayonda", value: String(mine.length), tone: "accent" },
        { label: "Ochiq", value: String(pool.length) },
        ...(lateCount ? [{ label: "Muddati o‘tgan", value: String(lateCount), tone: "bad" as const }] : []),
      ];
      const list = mine.length ? mine : pool;
      groups = [{ title: mine.length ? "Jarayonda" : "Ochiq vazifalar", items: list.slice(0, SHOWN), count: list.length }];
      more = Math.max(0, list.length - SHOWN);
      dim = mine.length ? `${mine.length} ta vazifa jarayonda.` : pool.length ? `${pool.length} ta ochiq vazifa bor.` : "Hozircha ish yo‘q.";
      keyboard = [
        [action(`Vazifalarim${mine.length ? ` · ${mine.length}` : ""}`, "m:mine"), action(`Ochiq${pool.length ? ` · ${pool.length}` : ""}`, "m:open")],
        [action("Statistika", "m:stats"), action("Hisob", "m:acct")],
        [webApp("Ilovani ochish", "/tg")],
      ];
    } else {
      const current = tasks.filter(live).sort((a, b) => Number(late(b)) - Number(late(a)) || byDeadline(a, b));
      const lateCount = current.filter(late).length;
      facts = [
        { label: "Jarayonda", value: String(current.filter((t) => t.status !== "todo").length), tone: "accent" },
        { label: "Ochiq", value: String(pool.length) },
        ...(lateCount ? [{ label: "Muddati o‘tgan", value: String(lateCount), tone: "bad" as const }] : []),
      ];
      groups = [{ title: "Hozirgi vazifalar", items: current.slice(0, SHOWN), count: current.length }];
      more = Math.max(0, current.length - SHOWN);
      dim = current.length ? `${current.length} ta ish ochiq.` : "Hozir ochiq ish yo‘q.";
      keyboard = [
        [action(`Hozirgi${current.length ? ` · ${current.length}` : ""}`, "m:live"), action("Yangi vazifa", "m:new", "primary")],
        [action("Dizaynerlar", "m:team"), action("Statistika", "m:stats")],
        [action("Hisob", "m:acct"), webApp("Ilovani ochish", "/tg")],
      ];
    }
  }
  const person = account.role === "designer" ? ("creator" as const) : ("assignee" as const);
  const shown = groups.flatMap((g) => g.items.map((t) => [t.id, t.status, t.dueDate, t.dueTime, t.title, t.priority, t.imageCount, t.assigneeName]));
  const sig = createHash("sha256")
    .update(JSON.stringify([todayISO(), head.title, dim, facts, shown, more, keyboard.flat().map((b) => b.text)]))
    .digest("hex")
    .slice(0, 24);
  return {
    sig,
    keyboard,
    render: (theme) => homeImage({ ...head, dim, facts, groups, more, person, theme }),
  };
}

const themed = async (account: Account) => (await getTheme(account.id)) ?? "dark";

/**
 * Bosh menyuni chiqaradi. fresh — eski bosh menyu va ish xabari olib tashlanib, yangisi yuboriladi (/start).
 * Aks holda mavjud xabar joyida yangilanadi: foydalanuvchiga bildirilmaydi.
 */
export async function showHome(chat: number | string, account: Account, fresh = false, theme?: Theme, silent = false) {
  const screen = await getScreen(chat);
  const view = await homeView(account);
  const image = await view.render(theme ?? (await themed(account)));
  if (!fresh && screen.homeId) {
    try {
      await editPhoto(Number(chat), screen.homeId, image, "", view.keyboard);
      await saveScreen(chat, { homeSig: view.sig });
      return screen.homeId;
    } catch {
      // Xabar o‘chirilgan yoki eskirgan: yangisi yuboriladi.
    }
  }
  await remove(chat, screen.homeId);
  if (fresh) await remove(chat, screen.workId);
  const sent = await sendPhoto(chat, image, "", inline(view.keyboard), silent);
  await saveScreen(chat, { homeId: sent.message_id, homeSig: view.sig, ...(fresh ? { workId: null, workAt: null } : {}) });
  return sent.message_id;
}

/** Kirish ekrani: bog‘lanmagan Telegram uchun bosh menyu o‘rnida. */
export async function showSignInHome(chat: number | string, keyboard: Keyboard, notice?: string) {
  const screen = await getScreen(chat);
  const image = await noticeImage({
    title: "Fazo Task.",
    dim: "Hisobingizga kiring.",
    text: notice || "Bir marta kirsangiz, bot va ilova sizni o‘zi taniydi. Vazifalar, eslatmalar va statistika shu yerda.",
  });
  await remove(chat, screen.homeId);
  await remove(chat, screen.workId);
  const sent = await sendPhoto(chat, image, "", inline(keyboard));
  await saveScreen(chat, { homeId: sent.message_id, homeSig: null, workId: null, workAt: null });
}

/**
 * Hamma bosh menyularni yangilaydi (vazifa o‘zgarganda, mavzu almashganda, kun boshida).
 * Ma’lumot o‘zgarmagan bo‘lsa, rasm qayta chizilmaydi.
 */
export async function refreshHomes(only?: string[], force = false) {
  const database = await db();
  const rows = (
    await database.execute(`SELECT m.*,s.telegram_id AS chat,s.home_id,s.home_sig FROM telegram_screens s
      JOIN telegram_accounts t ON t.telegram_id=s.telegram_id JOIN members m ON m.id=t.member_id
      WHERE s.home_id IS NOT NULL AND m.deleted_at IS NULL AND m.password_hash IS NOT NULL`)
  ).rows.filter((row) => !only || only.includes(String(row.id)));
  if (!rows.length) return;
  const tasks = await getTasks(database);
  const themes = await themesOf(rows.map((row) => String(row.id)));
  for (const row of rows) {
    const account = publicAccount(row);
    const visible = account.role === "designer" ? tasks.filter((t) => t.assigneeId === account.id || (!t.assigneeId && t.status === "todo")) : tasks;
    try {
      const view = await homeView(account, visible);
      if (!force && view.sig === String(row.home_sig || "")) continue;
      const image = await view.render(themes.get(account.id) ?? "dark");
      await editPhoto(Number(row.chat), Number(row.home_id), image, "", view.keyboard).catch(async () => {
        const sent = await sendPhoto(String(row.chat), image, "", inline(view.keyboard), true);
        await remove(String(row.chat), Number(row.home_id));
        await saveScreen(String(row.chat), { homeId: sent.message_id });
      });
      await saveScreen(String(row.chat), { homeSig: view.sig });
    } catch (error) {
      console.error("Telegram bosh menyu:", error instanceof Error ? error.message : "xato");
    }
  }
}
