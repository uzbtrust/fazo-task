import assert from "node:assert/strict";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";

/*
 * Bot va Telegram orqali kirish oqimlari. Haqiqiy Telegram ishlatilmaydi: test o‘zining soxta serverini ochadi.
 * Ilovani bir martalik baza bilan ishga tushiring:
 *   BOT_TOKEN=test-token TELEGRAM_API_URL=http://127.0.0.1:4055 TURSO_DATABASE_URL=file:/tmp/test.db npm run dev
 *   TEST_DB=/tmp/test.db npm run test:telegram
 * TEST_DB — vaqtni bazada surish uchun (eslatma, o‘chirish, tiklash kodi). Bo‘lmasa, o‘sha qismlar o‘tkazib yuboriladi.
 */
const base = new URL(process.env.BASE_URL || "http://127.0.0.1:3000");
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) throw new Error("Faqat lokal server bilan ishlaydi.");
const TOKEN = process.env.TEST_BOT_TOKEN || "test-token";
const PORT = Number(process.env.TELEGRAM_MOCK_PORT || 4055);
const secret = createHash("sha256").update(`fazo-webhook:${TOKEN}`).digest("hex");
const runId = `tg${Date.now().toString(36)}`;
const password = randomBytes(12).toString("base64url");
// Ilova ham shu bazaga yozadi: qulf bo‘shashini kutamiz.
const database = process.env.TEST_DB ? new DatabaseSync(process.env.TEST_DB, { timeout: 5000 }) : null;
let checks = 0;
const ok = (value, label) => {
  assert.ok(value, label);
  checks++;
};

/* ---- Soxta Telegram ---- */
let calls = [];
const all = [];
let messageId = 1000;
const mock = createServer((request, response) => {
  const chunks = [];
  request.on("data", (chunk) => chunks.push(chunk));
  request.on("end", async () => {
    const [, bot, method] = /^\/bot([^/]+)\/(\w+)/.exec(request.url) || [];
    assert.equal(bot, TOKEN, "Ilova test tokeni bilan ishlashi kerak");
    const raw = Buffer.concat(chunks);
    const type = request.headers["content-type"] || "";
    let params = {};
    if (type.includes("json")) params = JSON.parse(raw.toString());
    else {
      for (const [key, value] of await new Response(raw, { headers: { "Content-Type": type } }).formData())
        params[key] = typeof value === "string" ? value : { file: value.name, size: value.size, head: Buffer.from(await value.arrayBuffer()).subarray(1, 4).toString() };
      if (typeof params.reply_markup === "string") params.reply_markup = JSON.parse(params.reply_markup);
      if (params.media) params.caption = JSON.parse(params.media).caption;
    }
    const photo = method === "sendPhoto" ? { photo: [{ file_id: "small" }, { file_id: "uploaded-image" }] } : {};
    const result = method === "getMe" ? { id: 1, username: "fazo_test_bot" } : { message_id: ++messageId, ...photo };
    calls.push({ method, params, result });
    all.push({ method, params, result });
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ ok: true, result }));
  });
});

const VISIBLE = ["sendMessage", "editMessageText", "sendPhoto", "editMessageMedia", "editMessageCaption"];
const texts = (chat) =>
  calls
    .filter((c) => VISIBLE.includes(c.method) && c.params.chat_id == chat)
    .map((c) => ({ ...c.params, method: c.method, id: c.params.message_id ? Number(c.params.message_id) : c.result.message_id, text: c.params.text || c.params.caption || "" }));
const last = (chat) => texts(chat).at(-1);
const buttons = (params) => (params?.reply_markup?.inline_keyboard || []).flat();
const isHome = (params) => buttons(params).some((b) => b.callback_data?.startsWith("m:"));
/** Chatdagi bosh menyu raqami: u yuborilgandan keyin joyida yangilanadi, raqami o‘zgarmaydi. */
const homeOf = (chat) => all.filter((c) => c.method === "sendPhoto" && c.params.chat_id == chat && isHome(c.params)).at(-1)?.result.message_id;
const deleted = (chat) =>
  calls
    .filter((c) => c.params.chat_id == chat && (c.method === "deleteMessage" || c.method === "deleteMessages"))
    .flatMap((c) => (c.method === "deleteMessage" ? [Number(c.params.message_id)] : c.params.message_ids.map(Number)));
async function until(check, label) {
  for (let i = 0; i < 150; i++) {
    const value = check();
    if (value) {
      checks++;
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Kutilgan natija kelmadi: ${label}`);
}

/* ---- Ilova bilan aloqa ---- */
function client() {
  let cookie = "";
  return async (path, { method = "GET", body } = {}) => {
    const headers = { Accept: "application/json", ...(cookie ? { Cookie: cookie } : {}) };
    if (method !== "GET") headers.Origin = base.origin;
    if (body !== undefined && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
    const response = await fetch(new URL(path, base), {
      method,
      headers,
      body: body === undefined || body instanceof FormData ? body : JSON.stringify(body),
      redirect: "manual",
    });
    for (const value of response.headers.getSetCookie()) {
      const [pair] = value.split(";");
      const [name] = pair.split("=");
      const rest = cookie.split("; ").filter((c) => c && !c.startsWith(`${name}=`));
      cookie = [...rest, ...(pair.endsWith("=") ? [] : [pair])].join("; ");
    }
    const text = await response.text();
    let data = text;
    try {
      data = JSON.parse(text);
    } catch {}
    return { status: response.status, data, text };
  };
}
async function webhook(update, headerSecret = secret) {
  const response = await fetch(new URL("/api/telegram/webhook", base), {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": headerSecret },
    body: JSON.stringify(update),
  });
  return response.status;
}
const person = (id, first_name) => ({ id, first_name, username: `u${id}` });
const say = (user, text, type = "private") =>
  webhook({ message: { message_id: ++messageId, text, from: user, chat: { id: user.id, type } } });
/** Tugma bosish. on — qaysi xabardagi tugma (bosh menyu, ish xabari, xabarnoma); bo‘lmasa yangi raqam. */
const press = (user, data, on = null) =>
  webhook({
    callback_query: {
      id: String(++messageId),
      data,
      from: user,
      message: { message_id: on?.id ?? ++messageId, chat: { id: user.id, type: "private" }, ...(on?.photo !== false ? { photo: [{}] } : {}) },
    },
  });
const sweep = async () => {
  database?.exec("DELETE FROM telegram_reminders WHERE key='sweep'");
  return (await client()("/api/telegram/cron")).data;
};
function initData(user, { age = 0, tamper = false, signature = false } = {}) {
  const fields = {
    auth_date: String(Math.floor(Date.now() / 1000) - age),
    query_id: "AAE",
    user: JSON.stringify(user),
    ...(signature ? { signature: "abc" } : {}),
  };
  const check = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  const key = createHmac("sha256", "WebAppData").update(TOKEN).digest();
  const hash = createHmac("sha256", key).update(check).digest("hex");
  return new URLSearchParams({ ...fields, hash: tamper ? hash.replace(/.$/, "0") : hash }).toString();
}

async function main() {
  await new Promise((resolve) => mock.listen(PORT, "127.0.0.1", resolve));

  const admin = client();
  assert.equal((await admin("/api/auth/login", { method: "POST", body: { username: "admin", password: process.env.ADMIN_PASSWORD || "admin" } })).status, 200);
  async function member(suffix, role) {
    const username = `${runId}.${suffix}`;
    const made = await admin("/api/members", { method: "POST", body: { name: `Sinov ${suffix}`, role, username } });
    assert.equal(made.status, 201);
    const web = client();
    assert.equal((await web("/api/auth/register", { method: "POST", body: { username, password } })).status, 200);
    return { username, web, id: made.data.member.id };
  }
  const pm = await member("pm", "pm");
  const a = await member("a", "designer");
  const b = await member("b", "designer");
  const c = await member("c", "designer");
  const d = await member("d", "designer");
  const n = Date.now() % 1e6;
  const tgPm = person(n + 1, "PM");
  const tgA = person(n + 2, "Birinchi");
  const tgB = person(n + 3, "Ikkinchi");
  const tgC = person(n + 4, "Uchinchi");
  const tgD = person(n + 5, "To‘rtinchi");
  const tgE = person(n + 6, "Beshinchi");
  const stranger = person(n + 9, "Begona");

  // Webhook himoyasi
  ok((await webhook({}, "xxxxxxxx")) === 401, "Noto‘g‘ri sir rad etiladi");
  await say(stranger, "/start", "group");
  ok(!texts(stranger.id).length, "Guruh xabarlari e’tiborsiz qoladi");

  // 1. Kirish ekrani va bot ichida login
  await say(tgPm, "/start");
  const signIn = last(tgPm.id);
  ok(signIn.method === "sendPhoto", "Kirish ekrani rasm bilan keladi");
  const kinds = buttons(signIn);
  ok(!signIn.reply_markup.keyboard, "Pastki menyu yo‘q, faqat inline tugmalar");
  ok(kinds.some((x) => x.web_app?.url.endsWith("/tg")), "Ilovada kirish tugmasi bor");
  ok(kinds.some((x) => x.url?.includes("/telegram?t=")), "Brauzer orqali kirish tugmasi bor");
  ok(kinds.some((x) => x.callback_data === "login"), "Login va parol tugmasi bor");
  ok(kinds.some((x) => x.web_app?.url.endsWith("/tg?mode=register")), "Ro‘yxatdan o‘tish web-app orqali ochiladi");
  await press(tgPm, "login", { id: signIn.id });
  const own = messageId + 1;
  await say(tgPm, pm.username);
  ok(deleted(tgPm.id).includes(own), "Foydalanuvchi yozgan xabar o‘chiriladi");
  await say(tgPm, "noto‘g‘ri-parol");
  ok(/noto‘g‘ri/.test(last(tgPm.id).text), "Xato parol aytiladi");
  await say(tgPm, pm.username);
  await say(tgPm, password);
  const home = await until(() => (isHome(last(tgPm.id)) ? last(tgPm.id) : null), "PM bosh menyusi");
  ok(home.method === "sendPhoto", "Kirgach bosh menyu rasm bilan keladi");
  ok(buttons(home).some((x) => x.callback_data === "m:new"), "PM menyusida yangi vazifa bor");
  ok(deleted(tgPm.id).includes(signIn.id), "Kirish ekrani o‘rniga bosh menyu turadi");

  // 2. Bot → web-app: o‘zi kiradi
  const app = client();
  ok((await app("/api/auth/telegram", { method: "POST", body: { initData: initData(tgPm, { tamper: true }) } })).status === 401, "Soxta initData rad etiladi");
  ok((await app("/api/auth/telegram", { method: "POST", body: { initData: initData(tgPm, { age: 90000 }) } })).status === 401, "Eski initData rad etiladi");
  const loaded = await app("/api/auth/telegram", { method: "POST", body: { initData: initData(tgPm), load: true } });
  ok(loaded.data.status === "signed-in" && loaded.data.initial?.tasks, "Web-app ish stoli bilan birga kiradi");
  ok((await app("/api/me")).data.user.username === pm.username, "Web-app to‘g‘ri hisobda");
  ok((await client()("/api/auth/telegram", { method: "POST", body: { initData: initData(tgPm, { signature: true }) } })).data.status === "signed-in", "signature maydoni bor initData o‘tadi");

  // 3. Web-app → bot
  const appA = client();
  ok((await appA("/api/auth/telegram", { method: "POST", body: { initData: initData(tgA) } })).data.status === "unlinked", "Bog‘lanmagan web-app kirish so‘raydi");
  const viaApp = await appA("/api/auth/login", { method: "POST", body: { username: a.username, password, initData: initData(tgA) } });
  ok(viaApp.status === 200 && viaApp.data.initial, "Kirish javobida ish stoli ma’lumoti bor");
  await until(() => isHome(last(tgA.id)), "web-appdan kirgach bosh menyu");

  // 4. Bot → brauzer: bir martalik havola
  await say(tgB, "/start");
  const browserUrl = buttons(last(tgB.id)).find((x) => x.url).url;
  const path = new URL(browserUrl).pathname + new URL(browserUrl).search;
  const token = new URL(browserUrl).searchParams.get("t");
  const anon = client();
  ok((await anon(path)).status === 200, "Kirmagan brauzerda sahifa ochiladi");
  ok((await anon("/api/auth/telegram/link", { method: "POST", body: { token } })).status === 401, "Kirmasdan ulab bo‘lmaydi");
  ok((await b.web(path)).status === 200, "Havola GET bilan ishlatilmaydi");
  ok((await b.web("/api/auth/telegram/link", { method: "POST", body: { token } })).status === 200, "Brauzerdagi hisob ulanadi");
  ok((await b.web("/api/auth/telegram/link", { method: "POST", body: { token } })).status === 410, "Havola ikkinchi marta ishlamaydi");
  await until(() => isHome(last(tgB.id)), "brauzerdan keyin bosh menyu");

  // 5. Web-app → brauzer
  const appC = client();
  const made = await appC("/api/auth/telegram/browser", { method: "POST", body: { initData: initData(tgC) } });
  const tokenC = new URL(made.data.url).searchParams.get("t");
  ok((await c.web("/api/auth/telegram/link", { method: "POST", body: { token: tokenC } })).status === 200, "Web-appdan ochilgan brauzer havolasi");
  ok((await appC("/api/auth/telegram", { method: "POST", body: { initData: initData(tgC) } })).data.status === "signed-in", "Web-app brauzerdan keyin o‘zi kiradi");

  // 6. Sayt → bot: Telegram'ni ulash
  ok((await d.web("/api/me/telegram")).data.telegram === null, "Hali ulanmagan");
  const connect = await d.web("/api/me/telegram", { method: "POST" });
  await say(tgD, `/start ${new URL(connect.data.url).searchParams.get("start")}`);
  await until(() => isHome(last(tgD.id)), "saytdan ulagach bosh menyu");
  ok((await d.web("/api/me/telegram")).data.telegram?.name === "To‘rtinchi", "Sayt ulanganini ko‘radi");

  // 7. Sayt: Telegram orqali kirish
  const browser = client();
  const start = await browser("/api/auth/telegram/start", { method: "POST" });
  const param = new URL(start.data.url).searchParams.get("start");
  ok((await browser("/api/auth/telegram/status")).data.status === "pending", "So‘rov kutmoqda");
  ok((await client()("/api/auth/telegram/status")).data.status === "expired", "Boshqa brauzer so‘rovni ko‘rmaydi");
  await say(tgA, `/start ${param}`);
  const ask = await until(() => texts(tgA.id).find((x) => /Brauzerga kirish so‘raldi/.test(x.text)), "tasdiq so‘rovi");
  await press(tgA, buttons(ask).find((x) => x.callback_data?.startsWith("wl:y")).callback_data, { id: ask.id });
  const approved = await browser("/api/auth/telegram/status");
  ok(approved.data.status === "signed-in" && approved.data.initial, "Tasdiqlangach brauzer ish stoli bilan kiradi");
  ok((await browser("/api/me")).data.user.username === a.username, "Brauzer to‘g‘ri hisobda");
  ok((await browser("/api/auth/telegram/status")).data.status === "expired", "So‘rov bir marta ishlaydi");
  const denied = client();
  const second = await denied("/api/auth/telegram/start", { method: "POST" });
  await say(tgA, `/start ${new URL(second.data.url).searchParams.get("start")}`);
  const ask2 = last(tgA.id);
  await press(tgA, buttons(ask2).find((x) => x.callback_data?.startsWith("wl:n")).callback_data, { id: ask2.id });
  ok((await denied("/api/auth/telegram/status")).data.status === "denied", "Rad etilsa kirilmaydi");

  // Bog‘lanmagan Telegram: avval kiradi, keyin so‘rov davom etadi
  const later = client();
  const third = await later("/api/auth/telegram/start", { method: "POST" });
  await say(tgE, `/start ${new URL(third.data.url).searchParams.get("start")}`);
  ok(buttons(last(tgE.id)).some((x) => x.callback_data === "login"), "Avval kirish so‘raladi");
  await press(tgE, "login");
  await say(tgE, c.username);
  await say(tgE, password);
  await until(() => texts(tgE.id).find((x) => /Brauzerga kirish so‘raldi/.test(x.text)), "kirgach so‘rov davom etadi");
  ok(/boshqa Telegram/.test(texts(tgC.id).at(-1).text), "Oldingi Telegram'ga ogohlantirish boradi");
  ok((await client()("/api/auth/telegram", { method: "POST", body: { initData: initData(tgC) } })).data.status === "unlinked", "Hisob yangi Telegram'ga o‘tgach eskisi chiqadi");

  // 8. Yangi vazifa: rasm, bir marta yuklash, olinganda boshqalardan o‘chish
  calls = [];
  const posted = await pm.web("/api/tasks", {
    method: "POST",
    body: { title: `${runId} <karusel>`, brief: "Matn & rang", imageCount: 3, dueDate: "2099-12-31", dueTime: "18:00", priority: 4 },
  });
  assert.equal(posted.status, 201);
  const task = posted.data.task;
  const card = await until(() => texts(tgB.id).find((x) => /Yangi vazifa/.test(x.text)), "yangi vazifa xabari");
  const cardD = await until(() => texts(tgD.id).find((x) => /Yangi vazifa/.test(x.text)), "D ham xabar oladi");
  ok(card.text.includes("&lt;karusel&gt;"), "Matn HTML'dan himoyalangan");
  ok(card.method === "sendPhoto", "Yangi vazifa rasm bilan keladi");
  const uploads = calls.filter((x) => x.method === "sendPhoto" && /Yangi vazifa/.test(x.params.caption || ""));
  // Rasm har mavzu (tungi, kunduzgi) uchun bir marta chiziladi va yuklanadi, qolganlarga nusxasi ketadi.
  const pngs = uploads.filter((x) => x.params.photo?.head === "PNG").length;
  ok(pngs >= 1 && pngs <= 2, "Rasm har mavzu uchun bir marta yuklanadi");
  ok(uploads.length - pngs === uploads.filter((x) => x.params.photo === "uploaded-image").length && uploads.length > pngs, "Qolganlarga Telegram'dagi nusxa ketadi");
  ok(!texts(tgPm.id).some((x) => /Yangi vazifa/.test(x.text)), "Qo‘ygan PMga yuborilmaydi");
  await until(() => calls.some((x) => x.method === "editMessageMedia" && x.params.chat_id == tgB.id && isHome(x.params)), "bosh menyu jimgina yangilandi");
  const claim = buttons(card).find((x) => x.text === "Men olaman").callback_data;
  calls = [];
  await press(tgB, claim, { id: card.id });
  ok(calls.some((x) => x.method === "editMessageMedia" && x.params.message_id == card.id), "Bosilgan xabarning o‘zi «Vazifa sizda»ga almashadi");
  await until(() => deleted(tgD.id).includes(cardD.id), "sherik olgach xabar boshqalardan o‘chadi");
  ok(!deleted(tgB.id).includes(card.id), "Olgan odamdagi xabar qoladi");
  await until(() => texts(tgPm.id).find((x) => /vazifani oldi/.test(x.text)), "PM vazifa olinganini biladi");
  calls = [];
  await press(tgA, claim);
  ok(calls.find((x) => x.method === "answerCallbackQuery")?.params.show_alert, "Ikkinchi dizaynerga rad javobi");

  // Ish xabari: bosh menyudan ochiladi, ichida aylanib yuriladi
  const homeB = { id: homeOf(tgB.id) };
  calls = [];
  await press(tgB, "m:mine", homeB);
  const work = last(tgB.id);
  ok(work.method === "sendPhoto" && work.id !== homeB.id && homeB.id, "Bosh menyu tugmasi ish xabarini ochadi");
  ok(buttons(work).filter((x) => x.callback_data?.startsWith("t:")).length === 1, "Ro‘yxatda vazifa bor");
  await press(tgB, buttons(work).find((x) => x.callback_data?.startsWith("t:")).callback_data, { id: work.id });
  ok(last(tgB.id).method === "editMessageMedia" && last(tgB.id).message_id == work.id, "Vazifa shu xabarning o‘zida ochiladi");
  await press(tgB, "m:stats", homeB);
  ok(last(tgB.id).method === "editMessageMedia" && last(tgB.id).message_id == work.id, "Bosh menyudan keyingi bosish ham shu ish xabarida");
  await press(tgB, `done:${task.id}`, { id: work.id });
  ok(last(tgB.id).method === "editMessageCaption", "Rasmli xabarda savol rasm ostida chiqadi");
  await say(tgB, "https://figma.example/ish");
  ok(/Ish tugatildi/.test(last(tgB.id).text), "Izoh bilan tugatildi");
  await until(() => texts(tgPm.id).find((x) => /ishni tugatdi/.test(x.text)), "PM tugaganini biladi");
  ok((await pm.web("/api/tasks")).data.tasks.find((t) => t.id === task.id).resultNote.includes("figma"), "Izoh saqlandi");

  // 9. PM bot orqali vazifa qo‘yadi
  await press(tgPm, "m:new", { id: homeOf(tgPm.id) });
  await say(tgPm, `${runId} botdan`);
  await say(tgPm, "Task matni");
  await press(tgPm, "n:count:2", { id: last(tgPm.id).id, photo: false });
  await press(tgPm, "n:date:1", { id: last(tgPm.id).id, photo: false });
  await say(tgPm, "17:30");
  await press(tgPm, "n:pri:3", { id: last(tgPm.id).id, photo: false });
  ok(/qo‘yilsinmi/.test(last(tgPm.id).text), "Qo‘yishdan oldin oyna ko‘rsatiladi");
  await press(tgPm, "n:post", { id: last(tgPm.id).id });
  ok(/qo‘yildi/.test(last(tgPm.id).text), "Vazifa qo‘yildi");
  const fromBot = (await pm.web("/api/tasks")).data.tasks.find((t) => t.title === `${runId} botdan`);
  ok(fromBot.imageCount === 2 && fromBot.dueTime === "17:30" && fromBot.priority === 3, "Maydonlar to‘g‘ri saqlandi");
  const notice = await until(() => texts(tgB.id).find((x) => x.text.includes(`${runId} botdan`)), "botdan qo‘yilgan vazifa xabari");
  await press(tgPm, `can:${fromBot.id}`);
  await press(tgPm, `can!:${fromBot.id}`);
  ok((await pm.web("/api/tasks")).data.tasks.find((t) => t.id === fromBot.id).status === "cancelled", "PM botda bekor qildi");
  await until(() => deleted(tgB.id).includes(notice.id), "bekor qilingan vazifa xabari o‘chadi");

  // 10. PM qo‘lda eslatadi: sayt va bot
  const nudged = await pm.web("/api/tasks", { method: "POST", body: { title: `${runId} eslat`, brief: "x", imageCount: 1 } });
  const nudgeId = nudged.data.task.id;
  await press(tgA, `claim:${nudgeId}`);
  calls = [];
  const reminded = await pm.web(`/api/tasks/${nudgeId}/remind`, { method: "POST" });
  ok(reminded.status === 200 && reminded.data.sent === 1, "Saytdan dizaynerga eslatma");
  ok(texts(tgA.id).some((x) => /eslatmoqda/.test(x.text)), "Dizayner eslatmani oladi");
  ok(buttons(texts(tgA.id).find((x) => /eslatmoqda/.test(x.text))).some((x) => x.text === "Tugatdim"), "Eslatmada amal tugmasi bor");
  ok((await pm.web(`/api/tasks/${nudgeId}/remind`, { method: "POST" })).status === 429, "Bir vazifa tez-tez eslatilmaydi");
  ok((await a.web(`/api/tasks/${nudgeId}/remind`, { method: "POST" })).status === 403, "Dizayner eslata olmaydi");
  calls = [];
  await press(tgPm, `nudge:${nudgeId}`);
  ok(calls.find((x) => x.method === "answerCallbackQuery")?.params.show_alert, "Botda ham 10 daqiqa cheklovi");

  // 11. Fayllar
  const form = new FormData();
  form.set("file", new Blob(["task fayli"]), "task.txt");
  const uploaded = await pm.web("/api/files", { method: "POST", body: form });
  const withFile = await pm.web("/api/tasks", { method: "POST", body: { title: `${runId} fayl`, brief: "", imageCount: 1, fileIds: [uploaded.data.file.id] } });
  calls = [];
  await press(tgB, `f:${withFile.data.task.id}`);
  await until(() => calls.some((x) => x.method === "sendDocument"), "fayl botga yuboriladi");
  await press(tgB, `claim:${withFile.data.task.id}`);
  calls = [];
  await press(tgE, `f:${withFile.data.task.id}`);
  ok(!calls.some((x) => x.method === "sendDocument"), "Boshqa dizayner olgan vazifa fayli yuborilmaydi");
  await press(tgE, "n:post");
  ok(calls.filter((x) => x.method === "answerCallbackQuery").at(-1).params.show_alert, "Dizayner vazifa qo‘ya olmaydi");

  // 12. Hisob: brauzerda ochish, mavzu
  await press(tgB, "m:acct", { id: homeOf(tgB.id) });
  const account = last(tgB.id);
  const openToken = new URL(buttons(account).find((x) => x.url).url).searchParams.get("t");
  const fresh = client();
  ok((await fresh("/api/auth/telegram/link", { method: "POST", body: { token: openToken } })).data.status === "signed-in", "Bir martalik kirish");
  ok((await client()("/api/auth/telegram/link", { method: "POST", body: { token: openToken } })).status === 410, "Kirish havolasi bir marta ishlaydi");
  calls = [];
  ok((await b.web("/api/me/settings", { method: "PUT", body: { theme: "light" } })).status === 200, "Saytda mavzu tanlandi");
  ok((await b.web("/api/me")).data.theme === "light", "Mavzu hisobga yozildi");
  await until(() => calls.some((x) => x.method === "editMessageMedia" && x.params.chat_id == tgB.id), "bot rasmlari ham kunduzgi mavzuga o‘tdi");
  ok((await client()("/api/auth/telegram", { method: "POST", body: { initData: initData(tgB), load: true } })).data.initial?.theme === "light", "Web-app ham shu mavzuda ochiladi");

  // 13. Parolni tiklash kodi
  calls = [];
  const asked = await client()("/api/auth/recover", { method: "POST", body: { username: b.username } });
  ok(asked.status === 200 && asked.data.telegram, "Kod Telegram'ga yuborildi");
  const code = texts(tgB.id).find((x) => /tiklash kodi/.test(x.text));
  ok(code?.method === "sendPhoto", "Kod rasm bilan keladi");
  ok((await client()("/api/auth/recover", { method: "POST", body: { username: d.username } })).status === 200, "Ulangan hisobga kod boradi");
  ok((await client()("/api/auth/recover", { method: "POST", body: { username: `${runId}.yoq` } })).status === 404, "Noma’lum login");
  ok((await client()("/api/auth/recover", { method: "POST", body: { username: b.username, code: "000000", password: "yangi-parol-123" } })).status === 400, "Noto‘g‘ri kod");
  if (database) {
    database.prepare("UPDATE password_resets SET code_hash=? WHERE member_id=?").run(createHash("sha256").update(`${b.id}:424242`).digest("hex"), b.id);
    const recovered = client();
    const reset = await recovered("/api/auth/recover", { method: "POST", body: { username: b.username, code: "424242", password: "yangi-parol-123" } });
    ok(reset.status === 200 && reset.data.initial, "Kod bilan parol tiklandi va kirildi");
    ok((await b.web("/api/me")).status === 401, "Boshqa kirishlar yopildi");
    ok((await client()("/api/auth/login", { method: "POST", body: { username: b.username, password: "yangi-parol-123" } })).status === 200, "Yangi parol ishlaydi");
    await until(() => deleted(tgB.id).includes(code.id), "kod xabari o‘chdi");
    ok((await client()("/api/auth/telegram", { method: "POST", body: { initData: initData(tgB) } })).data.status === "signed-in", "Tiklashdan keyin Telegram ulangan qoladi");
    ok((await recovered("/api/auth/recover", { method: "POST", body: { username: b.username, code: "424242", password: "boshqa-parol-1" } })).status === 410, "Kod bir marta ishlaydi");
  }

  // 14. Login va parolni almashtirish
  const newLogin = `${runId}.yangi`;
  ok((await a.web("/api/me", { method: "PATCH", body: { currentPassword: "xato", newUsername: newLogin } })).status === 400, "Login joriy parolsiz almashmaydi");
  ok((await a.web("/api/me", { method: "PATCH", body: { currentPassword: password, newUsername: d.username } })).status === 409, "Band login");
  ok((await a.web("/api/me", { method: "PATCH", body: { currentPassword: password, newUsername: newLogin } })).status === 200, "Login almashdi");
  ok((await client()("/api/auth/login", { method: "POST", body: { username: newLogin, password } })).status === 200, "Yangi login bilan kirish");
  ok((await a.web("/api/me", { method: "PATCH", body: { currentPassword: password, newPassword: `${password}x` } })).status === 200, "Parol almashdi");
  await until(() => texts(tgA.id).find((x) => /Parolingiz o‘zgartirildi/.test(x.text)), "botga xabar");
  ok((await client()("/api/auth/telegram", { method: "POST", body: { initData: initData(tgA) } })).data.status === "signed-in", "Oddiy almashtirishda Telegram qoladi");
  ok((await a.web("/api/me", { method: "PATCH", body: { currentPassword: `${password}x`, newPassword: `${password}y`, unlinkTelegram: true } })).status === 200, "Telegram'ni ham ajratib almashtirish");
  ok((await client()("/api/auth/telegram", { method: "POST", body: { initData: initData(tgA) } })).data.status === "unlinked", "Telegram ajratildi");

  // 15. Eslatmalar, o‘chirish va eski chatni tozalash (vaqt bazada suriladi)
  if (database) {
    const tashkent = (ms) => new Date(ms + 5 * 36e5).toISOString();
    calls = [];
    const first = await sweep();
    ok(typeof first.sent === "number", "Tekshiruv manzili ishlaydi");
    ok(deleted(tgB.id).length >= 100, "Eski chat bir marta tozalandi");
    ok(calls.some((x) => x.method === "sendPhoto" && x.params.chat_id == String(tgB.id) && x.params.disable_notification === "true"), "Tozalangach bosh menyu ovozsiz keladi");
    calls = [];
    await sweep();
    ok(deleted(tgB.id).length < 100, "Tozalash ikkinchi marta qilinmaydi");
    // Ish xabari va ko‘rilgan xabarnomalar 10 daqiqadan keyin o‘chadi
    const screen = database.prepare("SELECT work_id FROM telegram_screens WHERE telegram_id=?").get(String(tgD.id));
    database.prepare("UPDATE telegram_screens SET work_id=?,work_at=? WHERE telegram_id=?").run(777777, new Date(Date.now() - 11 * 60_000).toISOString(), String(tgD.id));
    database.prepare("INSERT OR REPLACE INTO telegram_messages(chat,message_id,kind,task_id,sent_at,delete_at) VALUES (?,?,?,?,?,?)").run(String(tgD.id), 888888, "note", null, new Date().toISOString(), new Date(Date.now() - 1000).toISOString());
    database.prepare("INSERT OR REPLACE INTO telegram_messages(chat,message_id,kind,task_id,sent_at,delete_at) VALUES (?,?,?,?,?,?)").run(String(tgD.id), 999999, "note", null, new Date().toISOString(), null);
    calls = [];
    await sweep();
    ok(deleted(tgD.id).includes(777777), "Ish xabari 10 daqiqadan keyin o‘chdi");
    ok(deleted(tgD.id).includes(888888), "Ko‘rilgan xabarnoma o‘chdi");
    ok(!deleted(tgD.id).includes(999999), "Ko‘rilmagan xabarnoma turibdi");
    await say(tgD, "salom");
    ok(database.prepare("SELECT delete_at FROM telegram_messages WHERE chat=? AND message_id=999999").get(String(tgD.id)).delete_at, "Botga qaytgach xabarnoma ko‘rilgan hisoblanadi");
    void screen;
    const hour = Number(tashkent(Date.now()).slice(11, 13));
    if (hour >= 9 && hour < 21) {
      const soon = tashkent(Date.now() + 2 * 36e5);
      const made = await pm.web("/api/tasks", {
        method: "POST",
        body: { title: `${runId} tez`, brief: "Eslatma sinovi", imageCount: 1, dueDate: soon.slice(0, 10), dueTime: soon.slice(11, 16) },
      });
      const id = made.data.task.id;
      await press(tgD, `claim:${id}`);
      await sweep();
      calls = [];
      await sweep();
      ok(!calls.some((x) => /soat qoldi/.test(x.params.caption || "")), "Yangi olingan vazifa darhol eslatilmaydi");
      database.prepare("UPDATE assignments SET claimed_at=? WHERE id=?").run(new Date(Date.now() - 2 * 36e5).toISOString(), id);
      calls = [];
      await sweep();
      await until(() => texts(tgD.id).find((x) => /soat qoldi/.test(x.text)), "muddat yaqin eslatmasi");
      calls = [];
      await sweep();
      ok(!texts(tgD.id).some((x) => /soat qoldi/.test(x.text)), "Eslatma ikki marta kelmaydi");
      database.prepare("UPDATE assignments SET due_date=?,due_time=NULL WHERE id=?").run(tashkent(Date.now() - 864e5).slice(0, 10), id);
      calls = [];
      await sweep();
      await until(() => texts(tgD.id).find((x) => /Muddat o‘tdi/.test(x.text)), "muddat o‘tdi: dizaynerga");
      await until(() => texts(tgPm.id).find((x) => /Muddat o‘tdi/.test(x.text)), "muddat o‘tdi: PMga");
      await press(tgD, "mute");
      database.prepare("UPDATE assignments SET due_date=?,due_time=NULL WHERE id=?").run(tashkent(Date.now() - 2 * 864e5).slice(0, 10), id);
      calls = [];
      await sweep();
      ok(!texts(tgD.id).some((x) => /Muddat/.test(x.text)), "O‘chirgan odamga eslatma bormaydi");
      await press(tgD, "mute");
    } else console.log("  eslatmalar: tun vaqti, sinov o‘tkazib yuborildi");
  }

  // 16. Chiqish
  await press(tgD, "out!");
  await say(tgD, "Statistika");
  ok(buttons(last(tgD.id)).some((x) => x.callback_data === "login"), "Chiqqandan keyin bot kirish so‘raydi");
  const appB = client();
  await appB("/api/auth/telegram", { method: "POST", body: { initData: initData(tgB) } });
  ok((await appB("/api/auth/logout", { method: "POST", body: { initData: initData(tgB) } })).status === 200, "Web-appdan chiqish");
  ok((await client()("/api/auth/telegram", { method: "POST", body: { initData: initData(tgB) } })).data.status === "unlinked", "Web-appdan chiqilsa Telegram ham ajraladi");

  console.log(`PASS: ${checks} ta tekshiruv`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    mock.close();
    database?.close();
  });
