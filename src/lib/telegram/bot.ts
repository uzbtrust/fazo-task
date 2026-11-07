import { attemptLimit, checkPassword, DUMMY_HASH } from "../auth";
import { addDaysISO, nowTime, todayEyebrow, todayISO } from "../dates";
import { db } from "../db";
import { memberRoles, roleInfo } from "../roles";
import { ApiError, publicAccount } from "../server";
import { getTheme, setTheme, type Theme } from "../settings";
import { postTask, runTaskAction } from "../task-actions";
import { getMembers, getStats, getTasks } from "../tasks";
import type { Account, Stats, Task } from "../types";
import {
  action,
  edit,
  editCaption,
  editPhoto,
  escapeHtml,
  inline,
  link,
  remove,
  say,
  sendFile,
  sendPhoto,
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
  telegramOf,
  unlinkMember,
  type TelegramUser,
} from "./accounts";
import { refreshHomes, showHome, showSignInHome } from "./home";
import { accountImage, noticeImage, statsImage, taskListImage, taskSheetImage, teamImage, type Lead, type ListGroup } from "./images";
import { isMuted, setMuted } from "./reminders";
import { remindTask } from "./remind";
import { expire, getScreen, saveScreen, seen, track } from "./screens";
import { LISTS, taskKeyboard, taskText, type ListKind } from "./views";

interface Message {
  message_id: number;
  text?: string;
  from?: TelegramUser;
  chat: { id: number; type: string };
  photo?: unknown[];
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
const closeRow = [action("Yopish", "x")];

/* ---- Ekran: bosh menyu va ish xabari -------------------------------------- */
interface Ctx {
  chat: number;
  user: TelegramUser;
  account: Account | null;
  /** Tugma bosilgan xabar. Bo‘lmasa — ish xabari. */
  origin?: { id: number; photo: boolean };
}
interface View {
  render?: (theme: Theme) => Promise<Buffer>;
  caption?: string;
  /** Rasm chizilmasa yoki faqat matn kerak bo‘lsa. */
  text: string;
  keyboard: Keyboard;
  /** Rasm o‘rniga toza matnli xabar (yozish kutilayotgan qadamlar). */
  plain?: boolean;
}

const themeOf = async (account: Account | null): Promise<Theme> => (account ? ((await getTheme(account.id)) ?? "dark") : "dark");

/**
 * Ko‘rinishni chiqaradi. Bosh menyudagi tugma — ish xabarini ochadi yoki yangilaydi;
 * ish xabari va xabarnomadagi tugma — o‘sha xabarning o‘zini almashtiradi.
 */
async function show(ctx: Ctx, view: View) {
  const screen = await getScreen(ctx.chat);
  const fromHome = ctx.origin?.id === screen.homeId;
  const target = ctx.origin && !fromHome ? ctx.origin : screen.workId ? { id: screen.workId, photo: screen.workPhoto } : null;
  const work = !ctx.origin || fromHome || ctx.origin.id === screen.workId;
  const image =
    view.render && !view.plain
      ? await view.render(await themeOf(ctx.account)).catch((error) => {
          console.error("Telegram rasm:", error instanceof Error ? error.message : "xato");
          return null;
        })
      : null;
  let id: number | null = null;
  let photo = false;
  if (target) {
    try {
      if (image) {
        await editPhoto(ctx.chat, target.id, image, view.caption ?? "", view.keyboard);
        photo = true;
      } else if (target.photo && !view.plain) {
        await editCaption(ctx.chat, target.id, view.text, view.keyboard);
        photo = true;
      } else if (!target.photo) await edit(ctx.chat, target.id, view.text, view.keyboard);
      else throw new Error("matnga almashtiriladi");
      id = target.id;
    } catch {
      await remove(ctx.chat, target.id);
    }
  }
  if (!id) {
    const sent = image ? await sendPhoto(ctx.chat, image, view.caption ?? "", inline(view.keyboard)).catch(() => null) : null;
    const message = sent ?? (await say(ctx.chat, view.text, inline(view.keyboard)));
    if (!message) return;
    id = message.message_id;
    photo = !!sent;
  }
  if (work) {
    if (screen.workId && screen.workId !== id && screen.workId !== target?.id) await remove(ctx.chat, screen.workId);
    await saveScreen(ctx.chat, { workId: id, workPhoto: photo, workAt: new Date().toISOString() });
  } else await expire(ctx.chat, id);
}

/* ---- Kirish -------------------------------------------------------------- */
async function signInKeyboard(user: TelegramUser): Promise<Keyboard> {
  const token = await createToken("browser", { telegram: profile(user) });
  return [
    [webApp("Ilovada kirish", "/tg"), link("Brauzer orqali", browserLink(token))],
    [action("Login va parol", "login"), webApp("Ro‘yxatdan o‘tish", "/tg?mode=register")],
  ];
}

async function signInHome(chat: number, user: TelegramUser, notice?: string) {
  await showSignInHome(chat, await signInKeyboard(user), notice);
}

/** Istalgan yo‘l bilan kirilgandan keyin: yangi bosh menyu va kutib turgan so‘rov. */
export async function afterLinked(telegramId: number | string, account: Account) {
  const id = Number(telegramId);
  const state = await getState(id);
  await clearState(id);
  await showHome(id, account, true);
  if (typeof state?.data.pending === "string")
    await askWebLogin({ chat: id, user: { id }, account }, state.data.pending.slice(2));
}

async function passwordStep(ctx: Ctx, password: string, data: Draft) {
  const username = String(data.username);
  await attemptLimit([
    [`user:${username}`, 10],
    [`tg:${ctx.user.id}`, 10],
  ]);
  const row = (
    await (await db()).execute({
      sql: "SELECT * FROM members WHERE username=? COLLATE NOCASE AND deleted_at IS NULL",
      args: [username],
    })
  ).rows[0];
  const valid = checkPassword(password, row?.password_hash ? String(row.password_hash) : DUMMY_HASH);
  if (row && row.password_hash === null) {
    await clearState(ctx.user.id);
    return show(ctx, {
      text: "Bu hisob uchun hali parol yaratilmagan. Ro‘yxatdan o‘ting, keyin bot o‘zi kiradi.",
      keyboard: [[webApp("Ro‘yxatdan o‘tish", "/tg?mode=register")], cancelRow],
      plain: true,
    });
  }
  if (!row || !valid) {
    await setState(ctx.user.id, "login:username", { pending: data.pending });
    return show(ctx, { text: "Login yoki parol noto‘g‘ri. Loginni qayta yozing.", keyboard: [cancelRow], plain: true });
  }
  const account = publicAccount(row);
  await linkTelegram(profile(ctx.user), account.id);
  await setState(ctx.user.id, "linked", { pending: data.pending });
  await afterLinked(ctx.user.id, account);
}

/* ---- /start havolalari --------------------------------------------------- */
async function askWebLogin(ctx: Ctx, token: string) {
  const row = await readToken(token);
  if (!row || row.kind !== "web-login" || !ctx.account)
    return show(ctx, { text: "Bu so‘rov eskirgan. Saytda «Telegram orqali kirish»ni qayta bosing.", keyboard: [closeRow], plain: true });
  const account = ctx.account;
  await show(ctx, {
    render: (theme) =>
      noticeImage({
        lead: { text: "Brauzerga kirish so‘raldi", tone: "warn" },
        title: "Bu sizmisiz?",
        dim: row.device,
        text: `${account.name} hisobiga kirish so‘raldi. Bilmasangiz, «Yo‘q»ni bosing.`,
        theme,
      }),
    caption: "<b>Brauzerga kirish so‘raldi</b>",
    text: `<b>Brauzerga kirish so‘raldi</b>\n${escapeHtml(row.device)}\n\nBu sizmisiz? Bilmasangiz, «Yo‘q»ni bosing.`,
    keyboard: [[action("Ha, kirish", `wl:y:${token}`, "success"), action("Yo‘q", `wl:n:${token}`, "danger")]],
  });
}

async function startParam(ctx: Ctx, param: string) {
  const token = param.slice(2);
  if (param.startsWith("c_")) {
    const row = await readToken(token);
    if (!row || row.kind !== "connect" || !row.memberId || !(await spendToken(token))) {
      if (!ctx.account) return signInHome(ctx.chat, ctx.user, "Havola eskirgan. Saytda «Telegram'ni ulash»ni qayta bosing.");
      return showHome(ctx.chat, ctx.account, true);
    }
    await linkTelegram(profile(ctx.user), row.memberId);
    const linked = await memberByTelegram(ctx.user.id);
    if (linked) await afterLinked(ctx.user.id, linked);
    return;
  }
  if (param.startsWith("w_")) {
    if (ctx.account) {
      await showHome(ctx.chat, ctx.account, true);
      return askWebLogin(ctx, token);
    }
    await setState(ctx.user.id, "pending", { pending: param });
    return signInHome(ctx.chat, ctx.user, "Brauzerga kirish uchun avval shu yerda hisobingizga kiring.");
  }
  return ctx.account ? showHome(ctx.chat, ctx.account, true) : signInHome(ctx.chat, ctx.user);
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

const PAGE = 5;

function listView(account: Account, kind: ListKind, items: Task[], total: number) {
  const byStatus = (status: Task["status"]) => items.filter((t) => t.status === status);
  const groups: Record<ListKind, ListGroup[]> = {
    mine: [
      { title: "Tekshiruvda", hint: "PM javobini kutmoqda", items: byStatus("in_review") },
      { title: "Jarayonda", items: byStatus("in_progress") },
    ],
    open: [{ title: "Olinmagan", items }],
    live: [
      { title: "Tekshiruvda", items: byStatus("in_review") },
      { title: "Jarayonda", items: byStatus("in_progress") },
      { title: "Ochiq", hint: "Hali hech kim olmagan", items: byStatus("todo") },
    ],
    done: [
      { title: "Bajarildi", items: byStatus("done") },
      { title: "Bekor qilingan", items: byStatus("cancelled") },
    ],
  };
  const heads: Record<ListKind, { title: string; dim: string }> = {
    mine: { title: "Vazifalarim.", dim: `${total} ta vazifa jarayonda.` },
    open: { title: "Ochiq vazifalar.", dim: "O‘zingizga mosini oling." },
    live: { title: "Hozirgi vazifalar.", dim: `${total} ta ish ochiq.` },
    done: { title: "Tugagan vazifalar.", dim: `Jami ${total} ta.` },
  };
  const today = todayEyebrow();
  return {
    accent: today.date,
    eyebrow: today.weekday,
    ...heads[kind],
    person: account.role === "designer" ? ("creator" as const) : ("assignee" as const),
    groups: groups[kind],
    empty: LISTS[kind].empty,
  };
}

async function showList(ctx: Ctx, kind: ListKind, page: number) {
  const account = ctx.account!;
  const tasks = await visibleTasks(account);
  const filters: Record<ListKind, (t: Task) => boolean> = {
    mine: isMine(account),
    open: isOpen,
    live: (t) => !isFinished(t),
    done: (t) => isFinished(t) && (account.role !== "designer" || t.assigneeId === account.id),
  };
  const list = tasks.filter(filters[kind] || (() => false));
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const current = Math.min(Math.max(page, 0), pages - 1);
  const items = list.slice(current * PAGE, (current + 1) * PAGE);
  const rows: Keyboard = items.map((t) => [action(t.title.length > 40 ? `${t.title.slice(0, 39)}…` : t.title, `t:${t.id}:${kind}`)]);
  if (pages > 1)
    rows.push([
      ...(current > 0 ? [action("Oldingi", `l:${kind}:${current - 1}`)] : []),
      ...(current < pages - 1 ? [action("Keyingi", `l:${kind}:${current + 1}`)] : []),
    ]);
  rows.push(closeRow);
  const text = list.length ? `<b>${LISTS[kind].title}</b> · ${list.length} ta` : LISTS[kind].empty;
  await show(ctx, {
    render: (theme) => taskListImage({ ...listView(account, kind, items, list.length), theme }),
    text,
    keyboard: rows,
  });
}

async function loadTask(account: Account, id: string) {
  const task = (await visibleTasks(account, id))[0];
  if (!task) throw new ApiError(404, "Vazifa topilmadi yoki boshqa dizayner oldi.");
  return task;
}

async function showTask(ctx: Ctx, task: Task, back?: ListKind, lead?: Lead) {
  await show(ctx, {
    render: (theme) => taskSheetImage(task, lead, theme),
    caption: lead ? `<b>${escapeHtml(lead.text)}</b>` : "",
    text: taskText(task, lead?.text),
    keyboard: taskKeyboard(task, ctx.account!, back),
  });
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
  for (const row of rows) {
    const sent = (await sendFile(chat, String(row.name), String(row.mime), Buffer.from(String(row.data), "base64"))) as { message_id?: number };
    // Fayllar ham chatda abadiy qolmaydi: ko‘rilgandan keyin o‘chadi, kerak bo‘lsa qayta so‘raladi.
    if (sent?.message_id) await track(chat, sent.message_id, "note");
  }
}

/* ---- Statistika, jamoa, hisob ------------------------------------------------ */
const percent = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)}%` : "—");

async function showStats(ctx: Ctx, period: Stats["period"]) {
  const account = ctx.account!;
  const stats = await getStats(await db(), period, account);
  const t = stats.totals;
  const label = period === "all" ? "Butun davr" : `So‘nggi ${period} kun`;
  const facts =
    account.role === "designer"
      ? [
          { label: "Tayyor dizayn", value: String(t.images), tone: "accent" as const },
          { label: "Bajarilgan vazifa", value: String(t.done) },
          { label: "Vaqtida", value: percent(t.onTime, t.onTime + t.late) },
        ]
      : [
          ...(account.role === "pm" ? [{ label: "Bergan task", value: String(t.created), tone: "accent" as const }] : []),
          { label: "Bajarilgan vazifa", value: String(t.done) },
          { label: "Tayyor dizayn", value: String(t.images) },
          ...(account.role === "pm" ? [] : [{ label: "Hozir ochiq", value: String(t.open) }]),
        ];
  await show(ctx, {
    render: (theme) =>
      statsImage({
        eyebrow: label,
        title: account.role === "designer" ? "Natijalarim." : "Natijalar.",
        dim: account.role === "designer" ? "Kunma-kun nima qildingiz." : "Kim qancha va qanday ishladi.",
        facts,
        daily: stats.daily,
        theme,
      }),
    text: `<b>Statistika</b> · ${label}\n\n${facts.map((f) => `${f.label}: ${f.value}`).join("\n")}`,
    keyboard: [
      (["7", "30", "all"] as const).map((p) => action(p === period ? `• ${p === "all" ? "Hammasi" : `${p} kun`}` : p === "all" ? "Hammasi" : `${p} kun`, `s:${p}`)),
      ...(account.role === "admin" ? [] : [[action("Tugagan vazifalar", "l:done:0")]]),
      closeRow,
    ],
  });
}

async function showTeam(ctx: Ctx) {
  const account = ctx.account!;
  const members = await getMembers(await db(), account.role === "admin" ? [...memberRoles] : ["designer"]);
  const people = members.map((m) => {
    const s = m.stats;
    const state = m.role === "designer" ? `${s.done} ta bajarildi` : `${s.created} ta vazifa qo‘ydi`;
    return {
      name: m.name,
      line: `${account.role === "admin" ? `${roleInfo[m.role].label} · ` : ""}${state}${m.activated ? "" : " · Ro‘yxatdan o‘tmagan"}`,
      value: String(m.role === "designer" ? s.inProgress + s.inReview : s.created),
      label: m.role === "designer" ? "hozirgi ishi" : "vazifa",
    };
  });
  const title = account.role === "admin" ? "Jamoa." : "Dizaynerlar.";
  await show(ctx, {
    render: (theme) => teamImage({ title, dim: "Kim qancha ish bilan band.", people, theme }),
    text: people.map((p) => `<b>${escapeHtml(p.name)}</b>\n${escapeHtml(p.line)}`).join("\n\n") || "Hali hech kim yo‘q.",
    keyboard: [[webApp(account.role === "admin" ? "Jamoani boshqarish" : "Ilovada ko‘rish", account.role === "admin" ? "/tg" : "/tg?view=dizaynerlar")], closeRow],
  });
}

async function showAccount(ctx: Ctx) {
  const account = ctx.account!;
  const token = await createToken("open", { telegram: profile(ctx.user), memberId: account.id });
  const muted = await isMuted(ctx.user.id);
  const theme = await themeOf(account);
  const telegram = await telegramOf(account.id);
  await show(ctx, {
    render: (current) =>
      accountImage({
        name: account.name,
        username: account.username,
        role: roleInfo[account.role].label,
        telegram: telegram ? `${telegram.name} · ulangan` : "Ulanmagan",
        reminders: !muted,
        theme: current,
      }),
    text: `<b>${escapeHtml(account.name)}</b>\n@${escapeHtml(account.username)} · ${roleInfo[account.role].label}`,
    keyboard: [
      [webApp("Ilovani ochish", "/tg"), link("Brauzerda ochish", browserLink(token))],
      [webApp("Login va parol", "/tg?view=hisob")],
      [action(muted ? "Eslatmalarni yoqish" : "Eslatmalarni o‘chirish", "mute"), action(theme === "dark" ? "Kunduzgi mavzu" : "Tungi mavzu", "theme")],
      [action("Chiqish", "out", "danger"), action("Yopish", "x")],
    ],
  });
}

/* ---- PM: yangi vazifa ------------------------------------------------------ */
function askDate(ctx: Ctx) {
  return show(ctx, {
    text: "<b>Yangi vazifa</b>\n\nMuddat qachon?",
    keyboard: [
      [action("Bugun", "n:date:0"), action("Ertaga", "n:date:1")],
      [action("3 kun", "n:date:3"), action("1 hafta", "n:date:7")],
      [action("Muddatsiz", "n:date:none")],
      cancelRow,
    ],
    plain: true,
  });
}
function askHour(ctx: Ctx, date: string) {
  const now = nowTime();
  const hours = ["10:00", "12:00", "15:00", "18:00", "20:00", "22:00"].filter((h) => date !== todayISO() || h > now);
  return show(ctx, {
    text: "<b>Yangi vazifa</b>\n\nSoat nechigacha? Tugmani bosing yoki yozing, masalan 17:30.",
    keyboard: [
      ...[hours.slice(0, 3), hours.slice(3)].filter((r) => r.length).map((r) => r.map((h) => action(h, `n:hour:${h.replace(":", "-")}`))),
      [action("Kun oxirigacha", "n:hour:none")],
      cancelRow,
    ],
    plain: true,
  });
}
function askPriority(ctx: Ctx) {
  return show(ctx, {
    text: "<b>Yangi vazifa</b>\n\nMuhimligi qanday?",
    keyboard: [
      [1, 2, 3, 4, 5].map((n) => action("★".repeat(n), `n:pri:${n}`)),
      [action("O‘tkazib yuborish", "n:pri:none")],
      cancelRow,
    ],
    plain: true,
  });
}

/** Qo‘yishdan oldin vazifa qanday ko‘rinishini ko‘rsatadi — xuddi dizaynerga boradigan oyna. */
async function askConfirm(ctx: Ctx, data: Draft) {
  await setState(ctx.user.id, "new:confirm", data);
  const now = new Date().toISOString();
  const preview: Task = {
    id: "preview",
    number: 0,
    title: String(data.title),
    brief: String(data.brief),
    imageCount: Number(data.imageCount),
    priority: (data.priority as Task["priority"]) ?? null,
    dueDate: (data.dueDate as string) ?? null,
    dueTime: (data.dueTime as string) ?? null,
    status: "todo",
    assigneeId: null,
    assigneeName: null,
    createdBy: ctx.account!.id,
    creatorName: ctx.account!.name,
    resultNote: "",
    createdAt: now,
    updatedAt: now,
    claimedAt: null,
    submittedAt: null,
    completedAt: null,
    briefFiles: [],
    referenceFiles: [],
    links: [],
    resultFiles: [],
    events: [],
  };
  await show(ctx, {
    render: (theme) => taskSheetImage(preview, { text: "Tekshiring", tone: "accent" }, theme, 4),
    caption: "Ochiq vazifalarga qo‘yilsinmi?",
    text: `${taskText(preview)}\n\nOchiq vazifalarga qo‘yilsinmi?`,
    keyboard: [[action("Vazifani qo‘yish", "n:post", "success")], cancelRow],
  });
}

async function wizardText(ctx: Ctx, step: string, data: Draft, text: string) {
  if (step === "new:title") {
    if (text.length > 160) return show(ctx, { text: "Nom 160 belgidan oshmasin. Qisqaroq yozing.", keyboard: [cancelRow], plain: true });
    await setState(ctx.user.id, "new:brief", { ...data, title: text });
    return show(ctx, { text: "<b>Yangi vazifa</b>\n\nTaskni yozing: nima kerak, o‘lcham, uslub, matnlar.", keyboard: [cancelRow], plain: true });
  }
  if (step === "new:brief") {
    await setState(ctx.user.id, "new:count", { ...data, brief: text });
    return show(ctx, {
      text: "<b>Yangi vazifa</b>\n\nNechta rasm kerak? Tugmani bosing yoki sonini yozing.",
      keyboard: [[1, 2, 3, 5, 10].map((n) => action(String(n), `n:count:${n}`)), cancelRow],
      plain: true,
    });
  }
  if (step === "new:count") {
    const count = Number(text);
    if (!Number.isInteger(count) || count < 1 || count > 100) return show(ctx, { text: "1 dan 100 gacha son yozing.", keyboard: [cancelRow], plain: true });
    await setState(ctx.user.id, "new:date", { ...data, imageCount: count });
    return askDate(ctx);
  }
  if (step === "new:hour") {
    const match = /^([01]?\d|2[0-3])[:.]([0-5]\d)$/.exec(text);
    if (!match) return show(ctx, { text: "Soatni shunday yozing: 17:30.", keyboard: [cancelRow], plain: true });
    await setState(ctx.user.id, "new:priority", { ...data, dueTime: `${match[1].padStart(2, "0")}:${match[2]}` });
    return askPriority(ctx);
  }
}

async function wizardCallback(ctx: Ctx, kind: string, value: string) {
  const account = ctx.account!;
  if (account.role !== "pm") throw new ApiError(403, "Bu amal sizning rolingiz uchun emas.");
  const state = await getState(ctx.user.id);
  if (!state?.step.startsWith("new:")) throw new ApiError(409, "Bu qadam eskirgan. «Yangi vazifa»ni qayta bosing.");
  const data = state.data;
  if (kind === "count") {
    await setState(ctx.user.id, "new:date", { ...data, imageCount: Number(value) });
    return askDate(ctx);
  }
  if (kind === "date") {
    if (value === "none") {
      await setState(ctx.user.id, "new:priority", { ...data, dueDate: null, dueTime: null });
      return askPriority(ctx);
    }
    const dueDate = addDaysISO(Number(value));
    await setState(ctx.user.id, "new:hour", { ...data, dueDate });
    return askHour(ctx, dueDate);
  }
  if (kind === "hour") {
    await setState(ctx.user.id, "new:priority", { ...data, dueTime: value === "none" ? null : value.replace("-", ":") });
    return askPriority(ctx);
  }
  if (kind === "pri") return askConfirm(ctx, { ...data, priority: value === "none" ? null : Number(value) });
  if (kind === "post") {
    if (state.step !== "new:confirm") throw new ApiError(409, "Bu qadam eskirgan.");
    const task = await postTask(account, data);
    await clearState(ctx.user.id);
    await showTask(ctx, task, undefined, { text: "Ochiq vazifalarga qo‘yildi", tone: "good" });
  }
}

async function startWizard(ctx: Ctx) {
  if (ctx.account?.role !== "pm") throw new ApiError(403, "Bu amal sizning rolingiz uchun emas.");
  await setState(ctx.user.id, "new:title");
  await show(ctx, {
    text: "<b>Yangi vazifa</b>\n\nVazifa nomini yozing. Fayl qo‘shish uchun ilovada to‘ldiring.",
    keyboard: [[webApp("Ilovada to‘ldirish", "/tg?view=yangi-vazifa")], cancelRow],
    plain: true,
  });
}

/* ---- Menyu ------------------------------------------------------------------- */
async function menu(ctx: Ctx, what: string) {
  const role = ctx.account!.role;
  switch (what) {
    case "mine":
    case "open":
    case "live":
    case "done":
      return showList(ctx, what, 0);
    case "stats":
      return showStats(ctx, "30");
    case "team":
      return role === "designer" ? undefined : showTeam(ctx);
    case "acct":
      return showAccount(ctx);
    case "new":
      return startWizard(ctx);
  }
}

/** Eski pastki menyu matnlari: chat tozalanguncha ishlab turadi. */
const LEGACY: Record<string, string> = {
  "Mening vazifalarim": "mine",
  "/vazifalar": "mine",
  "Ochiq vazifalar": "open",
  "/ochiq": "open",
  "Hozirgi vazifalar": "live",
  "Yangi vazifa": "new",
  "/yangi": "new",
  "Dizaynerlar": "team",
  "Jamoa": "team",
  "Statistika": "stats",
  "/statistika": "stats",
  "Hisob": "acct",
  "/hisob": "acct",
};

/* ---- Xabarlar ------------------------------------------------------------------ */
async function onMessage(message: Message) {
  const user = message.from;
  if (!user || message.chat.type !== "private") return;
  const chat = message.chat.id;
  const text = message.text?.trim() || "";
  const account = await memberByTelegram(user.id);
  const ctx: Ctx = { chat, user, account };
  await seen(chat);
  try {
    if (text === "/start" || text.startsWith("/start ")) {
      await clearState(user.id);
      return await startParam(ctx, text.slice(7).trim());
    }
    if (text === "/bekor") {
      await clearState(user.id);
      return account ? await showHome(chat, account) : await signInHome(chat, user);
    }
    const state = await getState(user.id);
    if (!account) {
      if (state?.step === "login:username" && text) {
        await setState(user.id, "login:password", { ...state.data, username: text.toLowerCase().slice(0, 32) });
        return await show(ctx, { text: "Parolingizni yozing. Xabar darhol o‘chiriladi.", keyboard: [cancelRow], plain: true });
      }
      if (state?.step === "login:password" && text) return await passwordStep(ctx, text, state.data);
      return await signInHome(chat, user);
    }
    const legacy = LEGACY[text];
    if (legacy) {
      await clearState(user.id);
      return await menu(ctx, legacy);
    }
    if (state?.step === "comment" && text) {
      const id = String(state.data.id);
      const task = await runTaskAction(account, id, { action: "complete", message: text });
      await clearState(user.id);
      const origin = state.data.message ? { id: Number(state.data.message), photo: !!state.data.photo } : undefined;
      return await showTask({ ...ctx, origin }, task, undefined, { text: "Ish tugatildi", tone: "good" });
    }
    if (state?.step.startsWith("new:") && text) return await wizardText(ctx, state.step, state.data, text);
    return await showHome(chat, account);
  } catch (error) {
    if (error instanceof ApiError) return void (await show(ctx, { text: escapeHtml(error.message), keyboard: [closeRow], plain: true }));
    throw error;
  } finally {
    // Foydalanuvchi yozgan xabar ham chatda qolmaydi: javob ekranning o‘zida.
    await remove(chat, message.message_id);
  }
}

/* ---- Tugmalar ------------------------------------------------------------------- */
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
  const ctx: Ctx = { chat, user, account, origin: { id: messageId, photo: !!query.message?.photo } };
  await seen(chat);
  const ask = (task: Task, text: string, yes: string, back: string) =>
    show(ctx, {
      text: `<b>${escapeHtml(task.title)}</b>\n\n${text}`,
      keyboard: [[action("Ha", yes, "danger"), action("Yo‘q", back)]],
    });
  try {
    if (head === "x") {
      await answer();
      const screen = await getScreen(chat);
      await remove(chat, messageId);
      if (screen.workId === messageId) await saveScreen(chat, { workId: null, workAt: null });
      if (screen.homeId === messageId) await saveScreen(chat, { homeId: null, homeSig: null });
      return;
    }
    if (head === "cancel") {
      await clearState(user.id);
      await answer("Bekor qilindi");
      if (account) return await show(ctx, { text: "Bekor qilindi.", keyboard: [closeRow], plain: true });
      return await signInHome(chat, user);
    }
    if (head === "login") {
      await answer();
      if (account) return await showHome(chat, account, true);
      const state = await getState(user.id);
      await setState(user.id, "login:username", { pending: state?.data.pending });
      return await show(ctx, { text: "Loginingizni yozing.", keyboard: [cancelRow], plain: true });
    }
    if (!account) {
      await answer("Avval hisobingizga kiring", true);
      return await signInHome(chat, user);
    }
    switch (head) {
      case "m":
        await answer();
        return await menu(ctx, first);
      case "l":
        await answer();
        return await showList(ctx, first as ListKind, Number(second) || 0);
      case "t":
        await answer();
        return await showTask(ctx, await loadTask(account, first), (second as ListKind) || undefined);
      case "s":
        await answer();
        return await showStats(ctx, first as Stats["period"]);
      case "f":
        await answer("Fayllar yuborilmoqda");
        return await sendTaskFiles(chat, await loadTask(account, first));
      case "claim": {
        const task = await runTaskAction(account, first, { action: "claim" });
        await answer("Vazifa sizniki. Omad!");
        return await showTask(ctx, task, undefined, { text: "Vazifa sizda", tone: "good" });
      }
      case "done": {
        const task = await loadTask(account, first);
        await setState(user.id, "comment", { id: first, message: messageId, photo: !!query.message?.photo });
        await answer();
        return await show(ctx, {
          text: `<b>${escapeHtml(task.title)}</b>\n\nIzoh yoki havola bo‘lsa, yozing. Bo‘lmasa, shu tugmani bosing.`,
          keyboard: [[action("Izohsiz tugatish", `fin:${first}`, "success")], [action("Orqaga", `t:${first}`)]],
        });
      }
      case "fin": {
        const task = await runTaskAction(account, first, { action: "complete" });
        await clearState(user.id);
        await answer("Ish tugatildi");
        return await showTask(ctx, task, undefined, { text: "Ish tugatildi", tone: "good" });
      }
      case "rel":
        await answer();
        return await ask(await loadTask(account, first), "Vazifa ochiq ro‘yxatga qaytadi, yuklangan natija o‘chadi.", `rel!:${first}`, `t:${first}`);
      case "rel!": {
        const task = await runTaskAction(account, first, { action: "release" });
        await answer("Vazifa bo‘shatildi");
        return await showTask(ctx, task, undefined, { text: "Ochiq ro‘yxatga qaytdi", tone: "warn" });
      }
      case "can":
        await answer();
        return await ask(await loadTask(account, first), "Vazifa bekor qilinsinmi?", `can!:${first}`, `t:${first}`);
      case "can!": {
        const task = await runTaskAction(account, first, { action: "cancel" });
        await answer("Vazifa bekor qilindi");
        return await showTask(ctx, task, undefined, { text: "Bekor qilindi", tone: "bad" });
      }
      case "re": {
        const task = await runTaskAction(account, first, { action: "reopen" });
        await answer("Vazifa qayta ochildi");
        return await showTask(ctx, task, undefined, { text: "Qayta ochildi", tone: "accent" });
      }
      case "nudge": {
        const sent = await remindTask(account, first);
        return await answer(`Eslatma yuborildi: ${sent} kishiga`);
      }
      case "n":
        await answer();
        return await wizardCallback(ctx, first, second);
      case "wl": {
        if (first === "y") {
          const ok = await approveWebLogin(second, account.id);
          await answer(ok ? "Brauzerga kirildi" : "So‘rov eskirgan", !ok);
          return await show(ctx, { text: ok ? "Brauzerga kirish tasdiqlandi." : "Bu so‘rov eskirgan.", keyboard: [closeRow], plain: true });
        }
        await spendToken(second, "denied");
        await answer("Rad etildi");
        return await show(ctx, { text: "Kirish rad etildi.", keyboard: [closeRow], plain: true });
      }
      case "mute": {
        const muted = !(await isMuted(user.id));
        await setMuted(user.id, muted);
        await answer(muted ? "Eslatmalar o‘chirildi" : "Eslatmalar yoqildi");
        return await showAccount(ctx);
      }
      case "theme": {
        const next: Theme = (await themeOf(account)) === "dark" ? "light" : "dark";
        await setTheme(account.id, next);
        await answer(next === "light" ? "Kunduzgi mavzu" : "Tungi mavzu");
        await showAccount(ctx);
        return await refreshHomes([account.id], true);
      }
      case "out":
        await answer();
        return await show(ctx, {
          text: "Telegram hisobingizdan ajratiladi. Sayt va brauzerdagi kirish qoladi.",
          keyboard: [[action("Ha, chiqish", "out!", "danger")], cancelRow],
        });
      case "out!":
        await unlinkMember(account.id);
        await clearState(user.id);
        await answer("Chiqdingiz");
        return await signInHome(chat, user, "Hisobdan chiqdingiz. Qayta kirish uchun usulni tanlang.");
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

