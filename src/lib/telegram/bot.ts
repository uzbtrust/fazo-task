import { attemptLimit, checkPassword, DUMMY_HASH } from "../auth";
import { addDaysISO, nowTime, todayISO } from "../dates";
import { db } from "../db";
import { givenName, memberRoles, roleInfo } from "../roles";
import { ApiError, publicAccount } from "../server";
import { postTask, runTaskAction } from "../task-actions";
import { getMembers, getStats, getTasks } from "../tasks";
import type { Account, Stats, Task } from "../types";
import {
  action,
  edit,
  escapeHtml,
  inline,
  link,
  say,
  sendFile,
  tg,
  webApp,
  type Keyboard,
} from "./api";
import {
  approveWebLogin,
  browserLink,
  createToken,
  linkTelegram,
  memberByTelegram,
  readToken,
  spendToken,
  telegramName,
  unlinkMember,
  type TelegramUser,
} from "./accounts";
import { accountLine, LISTS, mainKeyboard, taskButton, taskKeyboard, taskText, type ListKind } from "./views";

interface Message {
  message_id: number;
  text?: string;
  from?: TelegramUser;
  chat: { id: number; type: string };
}
interface Callback {
  id: string;
  data?: string;
  from: TelegramUser;
  message?: Message;
}
export interface Update {
  message?: Message;
  callback_query?: Callback;
}

/* ---- Suhbat holati ------------------------------------------------------ */
type Draft = Record<string, unknown>;
const STATE_TTL = 3600_000;

async function getState(telegramId: number) {
  const row = (
    await (await db()).execute({ sql: "SELECT * FROM telegram_chats WHERE telegram_id=?", args: [String(telegramId)] })
  ).rows[0];
  if (!row || Date.now() - Date.parse(String(row.updated_at)) > STATE_TTL) return null;
  return { step: String(row.step), data: JSON.parse(String(row.data)) as Draft };
}
async function setState(telegramId: number, step: string, data: Draft = {}) {
  await (await db()).execute({
    sql: `INSERT INTO telegram_chats(telegram_id,step,data,updated_at) VALUES (?,?,?,?)
      ON CONFLICT(telegram_id) DO UPDATE SET step=excluded.step,data=excluded.data,updated_at=excluded.updated_at`,
    args: [String(telegramId), step, JSON.stringify(data), new Date().toISOString()],
  });
}
async function clearState(telegramId: number) {
  await (await db()).execute({ sql: "DELETE FROM telegram_chats WHERE telegram_id=?", args: [String(telegramId)] });
}

const profile = (user: TelegramUser) => ({ id: user.id, name: telegramName(user), username: user.username });
const cancelRow = [action("Bekor qilish", "cancel")];

/* ---- Kirish -------------------------------------------------------------- */
async function showSignIn(chat: number, user: TelegramUser, notice?: string) {
  const token = await createToken("browser", { telegram: profile(user) });
  const lines = [
    notice || "<b>Fazo Task</b>\nVazifalarni shu yerning o‘zida oling va boshqaring.",
    "Hisobingizga kiring. Bir marta kirsangiz, bot va ilova o‘zi taniydi.",
  ];
  await say(
    chat,
    lines.join("\n\n"),
    inline([
      [webApp("Ilovada kirish", "/tg")],
      [link("Brauzer orqali kirish", browserLink(token))],
      [action("Login va parol", "login")],
      [webApp("Ro‘yxatdan o‘tish", "/tg?mode=register")],
    ]),
  );
}

async function counts(account: Account) {
  if (account.role === "admin") return "";
  const tasks = await visibleTasks(account);
  if (account.role === "designer") {
    const mine = tasks.filter(isMine(account)).length;
    const open = tasks.filter(isOpen).length;
    return `Jarayonda: ${mine} · Ochiq: ${open}`;
  }
  return `Jarayonda: ${tasks.filter((t) => t.status === "in_progress").length} · Ochiq: ${tasks.filter(isOpen).length}`;
}

async function showHome(chat: number, account: Account, heading?: string) {
  const line = await counts(account);
  await say(
    chat,
    [heading || `Salom, ${escapeHtml(givenName(account.name))}.`, line].filter(Boolean).join("\n\n"),
    mainKeyboard(account.role),
  );
}

/** Istalgan yo‘l bilan kirilgandan keyin: salomlashadi va kutib turgan so‘rovni davom ettiradi. */
export async function afterLinked(telegramId: number | string, account: Account) {
  const id = Number(telegramId);
  const state = await getState(id);
  await clearState(id);
  await showHome(id, account, `Kirdingiz, ${escapeHtml(givenName(account.name))}.\n${accountLine(account)}`);
  if (typeof state?.data.pending === "string") await askWebLogin(id, state.data.pending.slice(2), account);
}

async function passwordStep(message: Message, user: TelegramUser, data: Draft) {
  const chat = message.chat.id;
  // Parol chatda qolmasin.
  await tg("deleteMessage", { chat_id: chat, message_id: message.message_id }).catch(() => {});
  const username = String(data.username);
  await attemptLimit([
    [`user:${username}`, 10],
    [`tg:${user.id}`, 10],
  ]);
  const row = (
    await (await db()).execute({
      sql: "SELECT * FROM members WHERE username=? COLLATE NOCASE AND deleted_at IS NULL",
      args: [username],
    })
  ).rows[0];
  const valid = checkPassword(message.text || "", row?.password_hash ? String(row.password_hash) : DUMMY_HASH);
  if (row && row.password_hash === null) {
    await clearState(user.id);
    await say(
      chat,
      "Bu hisob uchun hali parol yaratilmagan. Ro‘yxatdan o‘ting, keyin bot o‘zi kiradi.",
      inline([[webApp("Ro‘yxatdan o‘tish", "/tg?mode=register")]]),
    );
    return;
  }
  if (!row || !valid) {
    await setState(user.id, "login:username", { pending: data.pending });
    await say(chat, "Login yoki parol noto‘g‘ri. Loginni qayta yozing.", inline([cancelRow]));
    return;
  }
  const account = publicAccount(row);
  await linkTelegram(profile(user), account.id);
  await setState(user.id, "linked", { pending: data.pending });
  await afterLinked(user.id, account);
}

/* ---- /start havolalari --------------------------------------------------- */
async function askWebLogin(chat: number, token: string, account: Account) {
  const row = await readToken(token);
  if (!row || row.kind !== "web-login") {
    await say(chat, "Bu so‘rov eskirgan. Saytda «Telegram orqali kirish»ni qayta bosing.");
    return;
  }
  await say(
    chat,
    `<b>Brauzerga kirish so‘raldi</b>\n${escapeHtml(row.device)}\n\nHisob: ${accountLine(account)}\n\nBu sizmisiz? Bilmasangiz, «Yo‘q»ni bosing.`,
    inline([[action("Ha, kirish", `wl:y:${token}`, "success"), action("Yo‘q", `wl:n:${token}`, "danger")]]),
  );
}

async function startParam(chat: number, user: TelegramUser, param: string, account: Account | null) {
  const token = param.slice(2);
  if (param.startsWith("c_")) {
    const row = await readToken(token);
    if (!row || row.kind !== "connect" || !row.memberId || !(await spendToken(token))) {
      await say(chat, "Bu havola eskirgan. Saytda «Telegram'ni ulash»ni qayta bosing.");
      return;
    }
    await linkTelegram(profile(user), row.memberId);
    const linked = await memberByTelegram(user.id);
    if (linked) await afterLinked(user.id, linked);
    return;
  }
  if (param.startsWith("w_")) {
    if (account) return askWebLogin(chat, token, account);
    await setState(user.id, "pending", { pending: param });
    return showSignIn(chat, user, "<b>Brauzerga kirish</b>\nAvval shu yerda hisobingizga kiring, keyin brauzer o‘zi ochiladi.");
  }
  return account ? showHome(chat, account) : showSignIn(chat, user);
}

/* ---- Vazifalar ------------------------------------------------------------ */
const isOpen = (t: Task) => t.status === "todo" && !t.assigneeId;
const isMine = (account: Account) => (t: Task) =>
  t.assigneeId === account.id && (t.status === "in_progress" || t.status === "in_review");
const isFinished = (t: Task) => t.status === "done" || t.status === "cancelled";

async function visibleTasks(account: Account, id?: string) {
  return getTasks(await db(), {
    ...(id ? { id } : {}),
    ...(account.role === "designer" ? { visibleTo: account.id } : {}),
  });
}

const PAGE = 8;

async function showList(chat: number, account: Account, kind: ListKind, page: number, messageId?: number) {
  const tasks = await visibleTasks(account);
  const filters: Record<ListKind, (t: Task) => boolean> = {
    mine: isMine(account),
    open: isOpen,
    live: (t) => !isFinished(t),
    done: (t) => isFinished(t) && (account.role !== "designer" || t.assigneeId === account.id),
  };
  const list = tasks.filter(filters[kind]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const current = Math.min(Math.max(page, 0), pages - 1);
  const rows: Keyboard = list.slice(current * PAGE, (current + 1) * PAGE).map((t) => taskButton(t, kind));
  if (pages > 1)
    rows.push([
      ...(current > 0 ? [action("Oldingi", `l:${kind}:${current - 1}`)] : []),
      ...(current < pages - 1 ? [action("Keyingi", `l:${kind}:${current + 1}`)] : []),
    ]);
  const text = list.length
    ? `<b>${LISTS[kind].title}</b> · ${list.length} ta${pages > 1 ? `\nSahifa ${current + 1}/${pages}` : ""}`
    : LISTS[kind].empty;
  if (messageId) await edit(chat, messageId, text, rows);
  else await say(chat, text, inline(rows));
}

async function loadTask(account: Account, id: string) {
  const task = (await visibleTasks(account, id))[0];
  if (!task) throw new ApiError(404, "Vazifa topilmadi yoki boshqa dizayner oldi.");
  return task;
}

async function showTask(chat: number, messageId: number, account: Account, task: Task, back?: ListKind, lead?: string) {
  await edit(chat, messageId, taskText(task, lead), taskKeyboard(task, account, back));
}

async function sendTaskFiles(chat: number, task: Task) {
  const files = [...task.briefFiles, ...task.referenceFiles, ...task.resultFiles].slice(0, 10);
  if (!files.length) return;
  const rows = (
    await (await db()).execute({
      sql: `SELECT name,mime,data FROM attachments WHERE id IN (${files.map(() => "?").join(",")})`,
      args: files.map((f) => f.id),
    })
  ).rows;
  for (const row of rows)
    await sendFile(chat, String(row.name), String(row.mime), Buffer.from(String(row.data), "base64"));
}

/* ---- Statistika va hisob --------------------------------------------------- */
const percent = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)}%` : "—");

async function showStats(chat: number, account: Account, period: Stats["period"], messageId?: number) {
  const { totals: t } = await getStats(await db(), period, account);
  const label = period === "all" ? "Butun davr" : `So‘nggi ${period} kun`;
  const lines =
    account.role === "designer"
      ? [
          `Bajarilgan vazifa: ${t.done}`,
          `Tayyorlagan dizayn: ${t.images}`,
          `Vaqtida: ${percent(t.onTime, t.onTime + t.late)}`,
          `Hozir qo‘lda: ${t.inProgress}`,
        ]
      : [
          ...(account.role === "pm" ? [`Bergan task: ${t.created}`] : []),
          `Bajarilgan vazifa: ${t.done}`,
          `Tayyor dizayn: ${t.images}`,
          `Jarayonda: ${t.inProgress}`,
          `Hozir ochiq: ${t.open}`,
        ];
  const rows: Keyboard = [
    (["7", "30", "all"] as const).map((p) => action(p === "all" ? "Hammasi" : `${p} kun`, `s:${p}`)),
    ...(account.role === "admin" ? [] : [[action("Tugagan vazifalar", "l:done:0")]]),
    [webApp("Ilovada ko‘rish", "/tg?view=statistika")],
  ];
  const text = `<b>Statistika</b> · ${label}\n\n${lines.join("\n")}`;
  if (messageId) await edit(chat, messageId, text, rows);
  else await say(chat, text, inline(rows));
}

async function showTeam(chat: number, account: Account) {
  const members = await getMembers(await db(), account.role === "admin" ? [...memberRoles] : ["designer"]);
  const lines = members.map((m) => {
    const s = m.stats;
    const state = m.role === "designer" ? `${s.inProgress} jarayonda · ${s.done} bajarildi` : `${s.created} ta vazifa`;
    return `<b>${escapeHtml(m.name)}</b>\n${account.role === "admin" ? `${roleInfo[m.role].label} · ` : ""}${state}${m.activated ? "" : " · Ro‘yxatdan o‘tmagan"}`;
  });
  await say(
    chat,
    lines.length ? lines.join("\n\n") : "Hali hech kim yo‘q.",
    inline([[webApp(account.role === "admin" ? "Jamoani boshqarish" : "Ilovada ko‘rish", account.role === "admin" ? "/tg" : "/tg?view=dizaynerlar")]]),
  );
}

async function showAccount(chat: number, user: TelegramUser, account: Account) {
  const token = await createToken("open", { telegram: profile(user), memberId: account.id });
  await say(
    chat,
    `<b>${escapeHtml(account.name)}</b>\n${accountLine(account)}\n\nTelegram shu hisobga ulangan. Bot va ilova o‘zi kiradi.`,
    inline([
      [webApp("Ilovani ochish", "/tg")],
      [link("Brauzerda ochish", browserLink(token))],
      [action("Chiqish", "out", "danger")],
    ]),
  );
}

/* ---- PM: yangi vazifa ------------------------------------------------------ */
const askTitle = (chat: number) =>
  say(
    chat,
    "<b>Yangi vazifa</b>\n\nVazifa nomini yozing. Fayl qo‘shish uchun ilovada to‘ldiring.",
    inline([[webApp("Ilovada to‘ldirish", "/tg?view=yangi-vazifa")], cancelRow]),
  );

function askCount(chat: number) {
  return say(
    chat,
    "Nechta rasm kerak? Tugmani bosing yoki sonini yozing.",
    inline([[1, 2, 3, 5, 10].map((n) => action(String(n), `n:count:${n}`)), cancelRow]),
  );
}
function askDate(chat: number) {
  return say(
    chat,
    "Muddat qachon?",
    inline([
      [action("Bugun", "n:date:0"), action("Ertaga", "n:date:1")],
      [action("3 kun", "n:date:3"), action("1 hafta", "n:date:7")],
      [action("Muddatsiz", "n:date:none")],
      cancelRow,
    ]),
  );
}
function askHour(chat: number, date: string) {
  const now = nowTime();
  const hours = ["10:00", "12:00", "15:00", "18:00", "20:00", "22:00"].filter((h) => date !== todayISO() || h > now);
  return say(
    chat,
    "Soat nechigacha? Tugmani bosing yoki yozing, masalan 17:30.",
    inline([...[hours.slice(0, 3), hours.slice(3)].filter((r) => r.length).map((r) => r.map((h) => action(h, `n:hour:${h.replace(":", "-")}`))), [action("Kun oxirigacha", "n:hour:none")], cancelRow]),
  );
}
function askPriority(chat: number) {
  return say(
    chat,
    "Muhimligi qanday?",
    inline([
      [1, 2, 3, 4, 5].map((n) => action("★".repeat(n), `n:pri:${n}`)),
      [action("O‘tkazib yuborish", "n:pri:none")],
      cancelRow,
    ]),
  );
}
async function askConfirm(chat: number, user: TelegramUser, data: Draft) {
  await setState(user.id, "new:confirm", data);
  const due = data.dueDate ? `\nMuddat: ${data.dueDate}${data.dueTime ? `, ${data.dueTime}` : ""}` : "";
  const stars = data.priority ? `\nMuhimlik: ${"★".repeat(Number(data.priority))}` : "";
  await say(
    chat,
    `<b>${escapeHtml(String(data.title))}</b>\n${data.imageCount} ta rasm${due}${stars}\n\n<blockquote expandable>${escapeHtml(String(data.brief).slice(0, 1500))}</blockquote>\n\nOchiq vazifalarga qo‘yilsinmi?`,
    inline([[action("Vazifani qo‘yish", "n:post", "success")], cancelRow]),
  );
}

async function wizardText(chat: number, user: TelegramUser, step: string, data: Draft, text: string) {
  if (step === "new:title") {
    if (text.length > 160) return say(chat, "Nom 160 belgidan oshmasin. Qisqaroq yozing.");
    await setState(user.id, "new:brief", { ...data, title: text });
    return say(chat, "Taskni yozing: nima kerak, o‘lcham, uslub, matnlar.", inline([cancelRow]));
  }
  if (step === "new:brief") {
    await setState(user.id, "new:count", { ...data, brief: text });
    return askCount(chat);
  }
  if (step === "new:count") {
    const count = Number(text);
    if (!Number.isInteger(count) || count < 1 || count > 100) return say(chat, "1 dan 100 gacha son yozing.");
    await setState(user.id, "new:date", { ...data, imageCount: count });
    return askDate(chat);
  }
  if (step === "new:hour") {
    const match = /^([01]?\d|2[0-3])[:.]([0-5]\d)$/.exec(text);
    if (!match) return say(chat, "Soatni shunday yozing: 17:30.");
    await setState(user.id, "new:priority", { ...data, dueTime: `${match[1].padStart(2, "0")}:${match[2]}` });
    return askPriority(chat);
  }
  return say(chat, "Yuqoridagi tugmalardan birini bosing.");
}

async function wizardCallback(chat: number, user: TelegramUser, account: Account, kind: string, value: string) {
  if (account.role !== "pm") throw new ApiError(403, "Bu amal sizning rolingiz uchun emas.");
  const state = await getState(user.id);
  if (!state?.step.startsWith("new:")) throw new ApiError(409, "Bu qadam eskirgan. «Yangi vazifa»ni qayta bosing.");
  const data = state.data;
  if (kind === "count") {
    await setState(user.id, "new:date", { ...data, imageCount: Number(value) });
    return askDate(chat);
  }
  if (kind === "date") {
    if (value === "none") {
      await setState(user.id, "new:priority", { ...data, dueDate: null, dueTime: null });
      return askPriority(chat);
    }
    const dueDate = addDaysISO(Number(value));
    await setState(user.id, "new:hour", { ...data, dueDate });
    return askHour(chat, dueDate);
  }
  if (kind === "hour") {
    await setState(user.id, "new:priority", { ...data, dueTime: value === "none" ? null : value.replace("-", ":") });
    return askPriority(chat);
  }
  if (kind === "pri") return askConfirm(chat, user, { ...data, priority: value === "none" ? null : Number(value) });
  if (kind === "post") {
    if (state.step !== "new:confirm") throw new ApiError(409, "Bu qadam eskirgan.");
    const task = await postTask(account, data);
    await clearState(user.id);
    await say(chat, taskText(task, "Vazifa ochiq vazifalarga qo‘yildi"), inline(taskKeyboard(task, account)));
  }
}

/* ---- Xabarlar -------------------------------------------------------------- */
async function menu(chat: number, user: TelegramUser, account: Account, text: string) {
  const open = (kind: ListKind) => showList(chat, account, kind, 0);
  const role = account.role;
  const routes: Record<string, () => Promise<unknown>> = {
    "Statistika": () => showStats(chat, account, "30"),
    "/statistika": () => showStats(chat, account, "30"),
    "Hisob": () => showAccount(chat, user, account),
    "/hisob": () => showAccount(chat, user, account),
    ...(role === "designer"
      ? {
          "Mening vazifalarim": () => open("mine"),
          "/vazifalar": () => open("mine"),
          "Ochiq vazifalar": () => open("open"),
          "/ochiq": () => open("open"),
        }
      : {}),
    ...(role === "pm"
      ? {
          "Hozirgi vazifalar": () => open("live"),
          "/vazifalar": () => open("live"),
          "Dizaynerlar": () => showTeam(chat, account),
          "Yangi vazifa": async () => {
            await setState(user.id, "new:title");
            await askTitle(chat);
          },
          "/yangi": async () => {
            await setState(user.id, "new:title");
            await askTitle(chat);
          },
        }
      : {}),
    ...(role === "admin" ? { "Jamoa": () => showTeam(chat, account) } : {}),
  };
  const route = routes[text];
  if (!route) return false;
  // Boshqa bo‘limga o‘tilsa, yarim qolgan suhbat yopiladi («Yangi vazifa» o‘zi boshlaydi).
  if (text !== "Yangi vazifa" && text !== "/yangi") await clearState(user.id);
  await route();
  return true;
}

async function onMessage(message: Message) {
  const user = message.from;
  if (!user || message.chat.type !== "private") return;
  const chat = message.chat.id;
  const text = message.text?.trim() || "";
  const account = await memberByTelegram(user.id);
  try {
    if (text === "/start" || text.startsWith("/start ")) {
      await clearState(user.id);
      return await startParam(chat, user, text.slice(7).trim(), account);
    }
    if (text === "/bekor") {
      await clearState(user.id);
      return account ? await showHome(chat, account, "Bekor qilindi.") : await showSignIn(chat, user);
    }
    const state = await getState(user.id);
    if (!account) {
      if (state?.step === "login:username" && text) {
        await setState(user.id, "login:password", { ...state.data, username: text.toLowerCase().slice(0, 32) });
        return await say(chat, "Parolingizni yozing. Xabar darhol o‘chiriladi.", inline([cancelRow]));
      }
      if (state?.step === "login:password" && text) return await passwordStep(message, user, state.data);
      return await showSignIn(chat, user);
    }
    if (await menu(chat, user, account, text)) return;
    if (state?.step === "comment" && text) {
      const id = String(state.data.id);
      const task = await runTaskAction(account, id, { action: "complete", message: text });
      await clearState(user.id);
      return await say(chat, taskText(task, "Ish tugatildi"), inline(taskKeyboard(task, account)));
    }
    if (state?.step.startsWith("new:") && text) return await wizardText(chat, user, state.step, state.data, text);
    return await showHome(chat, account);
  } catch (error) {
    if (error instanceof ApiError) return void (await say(chat, escapeHtml(error.message)));
    throw error;
  }
}

/* ---- Tugmalar -------------------------------------------------------------- */
async function confirmAsk(chat: number, messageId: number, task: Task, text: string, yes: string, back: string) {
  await edit(chat, messageId, `<b>${escapeHtml(task.title)}</b>\n\n${text}`, [
    [action("Ha", yes, "danger"), action("Yo‘q", back)],
  ]);
}

async function onCallback(query: Callback) {
  const user = query.from;
  const data = query.data || "";
  const chat = query.message?.chat.id;
  const messageId = query.message?.message_id;
  const answer = (text?: string, alert = false) =>
    tg("answerCallbackQuery", { callback_query_id: query.id, ...(text ? { text, show_alert: alert } : {}) }).catch(() => {});
  if (!chat || !messageId || query.message?.chat.type !== "private") return answer();
  const [head, first, second] = data.split(":");
  const account = await memberByTelegram(user.id);
  try {
    if (head === "cancel") {
      await clearState(user.id);
      await answer("Bekor qilindi");
      await edit(chat, messageId, "Bekor qilindi.");
      return;
    }
    if (head === "login") {
      if (account) return await showHome(chat, account).then(() => answer());
      const state = await getState(user.id);
      await setState(user.id, "login:username", { pending: state?.data.pending });
      await answer();
      await say(chat, "Loginingizni yozing.", inline([cancelRow]));
      return;
    }
    if (!account) {
      await answer("Avval hisobingizga kiring", true);
      return await showSignIn(chat, user);
    }
    switch (head) {
      case "l":
        await answer();
        return await showList(chat, account, first as ListKind, Number(second) || 0, messageId);
      case "t":
        await answer();
        return await showTask(chat, messageId, account, await loadTask(account, first), second as ListKind);
      case "s":
        await answer();
        return await showStats(chat, account, first as Stats["period"], messageId);
      case "f": {
        await answer("Fayllar yuborilmoqda");
        return await sendTaskFiles(chat, await loadTask(account, first));
      }
      case "claim": {
        const task = await runTaskAction(account, first, { action: "claim" });
        await answer("Vazifa sizniki. Omad!");
        return await showTask(chat, messageId, account, task, undefined, "Vazifa sizda");
      }
      case "done": {
        const task = await loadTask(account, first);
        await setState(user.id, "comment", { id: first });
        await answer();
        return await edit(
          chat,
          messageId,
          `<b>${escapeHtml(task.title)}</b>\n\nIzoh yoki havola bo‘lsa, yozing. Bo‘lmasa, shu tugmani bosing.`,
          [[action("Izohsiz tugatish", `fin:${first}`, "success")], [action("Orqaga", `t:${first}:mine`)]],
        );
      }
      case "fin": {
        const task = await runTaskAction(account, first, { action: "complete" });
        await clearState(user.id);
        await answer("Ish tugatildi");
        return await showTask(chat, messageId, account, task, undefined, "Ish tugatildi");
      }
      case "rel": {
        const task = await loadTask(account, first);
        await answer();
        return await confirmAsk(chat, messageId, task, "Vazifa ochiq ro‘yxatga qaytadi, yuklangan natija o‘chadi.", `rel!:${first}`, `t:${first}:mine`);
      }
      case "rel!": {
        const task = await runTaskAction(account, first, { action: "release" });
        await answer("Vazifa bo‘shatildi");
        return await showTask(chat, messageId, account, task, undefined, "Vazifa ochiq ro‘yxatga qaytdi");
      }
      case "can": {
        const task = await loadTask(account, first);
        await answer();
        return await confirmAsk(chat, messageId, task, "Vazifa bekor qilinsinmi?", `can!:${first}`, `t:${first}:live`);
      }
      case "can!": {
        const task = await runTaskAction(account, first, { action: "cancel" });
        await answer("Vazifa bekor qilindi");
        return await showTask(chat, messageId, account, task, undefined, "Vazifa bekor qilindi");
      }
      case "re": {
        const task = await runTaskAction(account, first, { action: "reopen" });
        await answer("Vazifa qayta ochildi");
        return await showTask(chat, messageId, account, task, undefined, "Vazifa qayta ochildi");
      }
      case "n":
        await answer();
        return await wizardCallback(chat, user, account, first, second);
      case "wl": {
        if (first === "y") {
          const ok = await approveWebLogin(second, account.id);
          await answer(ok ? "Brauzerga kirildi" : "So‘rov eskirgan", !ok);
          return await edit(chat, messageId, ok ? "Brauzerga kirish tasdiqlandi." : "Bu so‘rov eskirgan.");
        }
        await spendToken(second, "denied");
        await answer("Rad etildi");
        return await edit(chat, messageId, "Kirish rad etildi.");
      }
      case "out":
        await answer();
        return await edit(chat, messageId, "Telegram hisobingizdan ajratiladi. Sayt va brauzerdagi kirish qoladi.", [
          [action("Ha, chiqish", "out!", "danger")],
          cancelRow,
        ]);
      case "out!":
        await unlinkMember(account.id);
        await clearState(user.id);
        await answer("Chiqdingiz");
        await edit(chat, messageId, "Hisobdan chiqdingiz.");
        await say(chat, "Qayta kirish uchun /start ni bosing.", { remove_keyboard: true });
        return;
      default:
        return await answer();
    }
  } catch (error) {
    if (error instanceof ApiError) return void (await answer(error.message, true));
    await answer("Xatolik yuz berdi. Qayta urinib ko‘ring.", true);
    throw error;
  }
}

export async function handleUpdate(update: Update) {
  if (update.callback_query) return onCallback(update.callback_query);
  if (update.message) return onMessage(update.message);
}
