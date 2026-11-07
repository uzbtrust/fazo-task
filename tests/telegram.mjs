import assert from "node:assert/strict";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";

/*
 * Bot va Telegram orqali kirish oqimlari. Haqiqiy Telegram ishlatilmaydi: test o‘zining soxta serverini ochadi.
 * Ilovani shunday ishga tushiring (bir martalik baza bilan):
 *   BOT_TOKEN=test-token TELEGRAM_API_URL=http://127.0.0.1:4055 TURSO_DATABASE_URL=file:/tmp/test.db npm run dev
 * Eslatmalar bo‘limi vaqtni bazada suradi: TEST_DB=/tmp/test.db bilan ishga tushiring.
 */
const base = new URL(process.env.BASE_URL || "http://127.0.0.1:3000");
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) throw new Error("Faqat lokal server bilan ishlaydi.");
const TOKEN = process.env.TEST_BOT_TOKEN || "test-token";
const PORT = Number(process.env.TELEGRAM_MOCK_PORT || 4055);
const secret = createHash("sha256").update(`fazo-webhook:${TOKEN}`).digest("hex");
const runId = `tg${Date.now().toString(36)}`;
const password = randomBytes(12).toString("base64url");
let checks = 0;
const ok = (value, label) => {
  assert.ok(value, label);
  checks++;
};

/* ---- Soxta Telegram ---- */
let calls = [];
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
    calls.push({ method, params });
    const photo = method === "sendPhoto" ? { photo: [{ file_id: "small" }, { file_id: "uploaded-image" }] } : {};
    const result = method === "getMe" ? { id: 1, username: "fazo_test_bot" } : { message_id: ++messageId, ...photo };
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ ok: true, result }));
  });
});

const VISIBLE = ["sendMessage", "editMessageText", "sendPhoto", "editMessageMedia", "editMessageCaption"];
const texts = (chat) =>
  calls
    .filter((c) => VISIBLE.includes(c.method) && c.params.chat_id == chat)
    .map((c) => ({ ...c.params, method: c.method, text: c.params.text || c.params.caption || "" }));
const last = (chat) => texts(chat).at(-1);
const buttons = (params) => (params?.reply_markup?.inline_keyboard || []).flat();
async function until(check, label) {
  for (let i = 0; i < 40; i++) {
    const value = check();
    if (value) {
      checks++;
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Kutilgan xabar kelmadi: ${label}`);
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
const press = (user, data, photo = false) =>
  webhook({
    callback_query: {
      id: String(++messageId),
      data,
      from: user,
      message: { message_id: ++messageId, chat: { id: user.id, type: "private" }, ...(photo ? { photo: [{}] } : {}) },
    },
  });
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

  // Hodimlar
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
  const stranger = person(n + 9, "Begona");

  // Webhook himoyasi
  ok((await webhook({}, "noto‘g‘ri".replace(/[^a-z]/g, "x"))) === 401, "Noto‘g‘ri sir rad etiladi");
  await say(stranger, "/start", "group");
  ok(!texts(stranger.id).length, "Guruh xabarlari e’tiborsiz qoladi");

  // 1. Bot ichida login va parol
  await say(tgPm, "/start");
  const signIn = last(tgPm.id);
  const kinds = buttons(signIn);
  ok(kinds.some((x) => x.web_app?.url.endsWith("/tg")), "Ilovada kirish tugmasi bor");
  ok(kinds.some((x) => x.url?.includes("/telegram?t=")), "Brauzer orqali kirish tugmasi bor");
  ok(kinds.some((x) => x.callback_data === "login"), "Login va parol tugmasi bor");
  ok(kinds.some((x) => x.web_app?.url.endsWith("/tg?mode=register")), "Ro‘yxatdan o‘tish web-app orqali ochiladi");
  await press(tgPm, "login");
  await say(tgPm, pm.username);
  await say(tgPm, "noto‘g‘ri-parol");
  ok(calls.some((x) => x.method === "deleteMessage"), "Parol xabari o‘chiriladi");
  ok(/noto‘g‘ri/.test(last(tgPm.id).text), "Xato parol aytiladi");
  await say(tgPm, pm.username);
  calls = [];
  await say(tgPm, password);
  ok(calls.some((x) => x.method === "deleteMessage"), "To‘g‘ri parol ham o‘chiriladi");
  ok(/Kirdingiz/.test(last(tgPm.id).text), "Bot ichida kirildi");
  ok(last(tgPm.id).reply_markup.keyboard.flat().some((x) => x.text === "Yangi vazifa"), "PM menyusi chiqdi");

  // 2. Bot → web-app: o‘zi kiradi
  const app = client();
  ok((await app("/api/auth/telegram", { method: "POST", body: { initData: initData(tgPm, { tamper: true }) } })).status === 401, "Soxta initData rad etiladi");
  ok((await app("/api/auth/telegram", { method: "POST", body: { initData: initData(tgPm, { age: 90000 }) } })).status === 401, "Eski initData rad etiladi");
  ok((await app("/api/auth/telegram", { method: "POST", body: { initData: initData(tgPm) } })).data.status === "signed-in", "Botda kirgan web-app'da o‘zi kiradi");
  ok((await app("/api/me")).data.user.username === pm.username, "Web-app to‘g‘ri hisobda");
  ok((await client()("/api/auth/telegram", { method: "POST", body: { initData: initData(tgPm, { signature: true }) } })).data.status === "signed-in", "signature maydoni bor initData o‘tadi");

  // 3. Web-app → bot
  const appA = client();
  ok((await appA("/api/auth/telegram", { method: "POST", body: { initData: initData(tgA) } })).data.status === "unlinked", "Bog‘lanmagan web-app kirish so‘raydi");
  ok((await appA("/api/auth/login", { method: "POST", body: { username: a.username, password, initData: initData(tgA) } })).status === 200, "Web-app ichida kirish");
  await until(() => /Kirdingiz/.test(last(tgA.id)?.text || ""), "web-appdan kirgach bot xabari");
  await say(tgA, "/start");
  ok(last(tgA.id).reply_markup?.keyboard, "Web-appda kirgan botga o‘zi kiradi");

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
  await until(() => /Kirdingiz/.test(last(tgB.id)?.text || ""), "brauzerdan keyin bot xabari");
  ok((await client()("/api/auth/telegram", { method: "POST", body: { initData: initData(tgB) } })).data.status === "signed-in", "Brauzerdan keyin web-app o‘zi kiradi");

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
  ok(/Kirdingiz/.test(last(tgD.id).text), "Saytdan ulash ishladi");
  ok((await d.web("/api/me/telegram")).data.telegram?.name === "To‘rtinchi", "Sayt ulanganini ko‘radi");

  // 7. Sayt: Telegram orqali kirish
  const browser = client();
  const start = await browser("/api/auth/telegram/start", { method: "POST" });
  const param = new URL(start.data.url).searchParams.get("start");
  ok((await browser("/api/auth/telegram/status")).data.status === "pending", "So‘rov kutmoqda");
  ok((await client()("/api/auth/telegram/status")).data.status === "expired", "Boshqa brauzer so‘rovni ko‘rmaydi");
  await say(tgA, `/start ${param}`);
  const ask = last(tgA.id);
  ok(/Bu sizmisiz/.test(ask.text), "Bot tasdiq so‘raydi");
  await press(tgA, buttons(ask)[0].callback_data);
  ok((await browser("/api/auth/telegram/status")).data.status === "signed-in", "Tasdiqlangach brauzer kiradi");
  ok((await browser("/api/me")).data.user.username === a.username, "Brauzer to‘g‘ri hisobda");
  ok((await browser("/api/auth/telegram/status")).data.status === "expired", "So‘rov bir marta ishlaydi");
  const denied = client();
  const second = await denied("/api/auth/telegram/start", { method: "POST" });
  await say(tgA, `/start ${new URL(second.data.url).searchParams.get("start")}`);
  await press(tgA, buttons(last(tgA.id))[1].callback_data);
  ok((await denied("/api/auth/telegram/status")).data.status === "denied", "Rad etilsa kirilmaydi");

  // Bog‘lanmagan Telegram: avval kiradi, keyin so‘rov davom etadi
  const later = client();
  const third = await later("/api/auth/telegram/start", { method: "POST" });
  const tgE = person(n + 6, "Beshinchi");
  await say(tgE, `/start ${new URL(third.data.url).searchParams.get("start")}`);
  ok(/Avval/.test(last(tgE.id).text), "Avval kirish so‘raladi");
  await press(tgE, "login");
  await say(tgE, c.username);
  await say(tgE, password);
  ok(/Bu sizmisiz/.test(last(tgE.id).text), "Kirgach so‘rov davom etadi");
  ok(!/Bu sizmisiz/.test(last(tgC.id)?.text || ""), "Oldingi Telegram'ga tasdiq bormaydi");
  ok(/boshqa Telegram/.test(last(tgC.id).text), "Oldingi Telegram'ga ogohlantirish boradi");
  ok((await client()("/api/auth/telegram", { method: "POST", body: { initData: initData(tgC) } })).data.status === "unlinked", "Hisob yangi Telegram'ga o‘tgach eskisi chiqadi");

  // 8. Yangi vazifa va tugmalar
  calls = [];
  const posted = await pm.web("/api/tasks", {
    method: "POST",
    body: { title: `${runId} <karusel>`, brief: "Matn & rang", imageCount: 3, dueDate: "2099-12-31", dueTime: "18:00", priority: 4 },
  });
  assert.equal(posted.status, 201);
  const task = posted.data.task;
  const card = await until(() => texts(tgB.id).find((x) => /Yangi vazifa/.test(x.text)), "yangi vazifa xabari");
  ok(card.text.includes("&lt;karusel&gt;"), "Matn HTML'dan himoyalangan");
  ok(card.method === "sendPhoto", "Yangi vazifa rasm bilan keladi");
  const uploads = calls.filter((x) => x.method === "sendPhoto");
  ok(uploads.filter((x) => x.params.photo?.head === "PNG").length === 1, "Rasm bir marta yuklanadi");
  ok(uploads.slice(1).every((x) => x.params.photo === "uploaded-image"), "Qolganlarga Telegram'dagi nusxa ketadi");
  ok(card.text.includes("18:00"), "Muddat soati ko‘rinadi");
  ok(texts(tgD.id).length || (await until(() => texts(tgD.id).length, "D ham xabar oladi")), "Hamma dizaynerga boradi");
  ok(!texts(tgPm.id).some((x) => /Yangi vazifa/.test(x.text)), "Qo‘ygan PMga yuborilmaydi");
  const claim = buttons(card).find((x) => x.text === "Men olaman").callback_data;
  await press(tgB, claim);
  await until(() => texts(tgPm.id).find((x) => /vazifani oldi/.test(x.text)), "PM vazifa olinganini biladi");
  calls = [];
  await press(tgA, claim);
  ok(calls.find((x) => x.method === "answerCallbackQuery")?.params.show_alert, "Ikkinchi dizaynerga rad javobi");
  ok(/boshqa dizayner/.test(calls.find((x) => x.method === "answerCallbackQuery").params.text), "Sababi aytiladi");
  await say(tgB, "Mening vazifalarim");
  ok(last(tgB.id).method === "sendPhoto", "Ro‘yxat rasm bilan keladi");
  ok(buttons(last(tgB.id)).length === 1, "Ro‘yxatda vazifa bor");
  await press(tgB, buttons(last(tgB.id))[0].callback_data);
  ok(last(tgB.id).method === "editMessageMedia", "Tugma bosilganda vazifa oynasi joyida ochiladi");
  ok(buttons(last(tgB.id)).some((x) => x.callback_data === "l:mine:0"), "Oynada orqaga tugmasi bor");
  await press(tgB, "l:mine:0");
  ok(last(tgB.id).method === "editMessageMedia", "Orqaga bosilganda ro‘yxat joyida qaytadi");
  await press(tgB, `done:${task.id}`, true);
  ok(last(tgB.id).method === "editMessageCaption", "Rasmli xabarda savol rasm ostida chiqadi");
  await say(tgB, "https://figma.example/ish");
  ok(/Ish tugatildi/.test(last(tgB.id).text), "Izoh bilan tugatildi");
  await until(() => texts(tgPm.id).find((x) => /ishni tugatdi/.test(x.text)), "PM tugaganini biladi");
  ok((await pm.web("/api/tasks")).data.tasks.find((t) => t.id === task.id).status === "done", "Saytda ham tugagan");
  ok((await pm.web("/api/tasks")).data.tasks.find((t) => t.id === task.id).resultNote.includes("figma"), "Izoh saqlandi");

  // 9. PM bot orqali vazifa qo‘yadi
  calls = [];
  await say(tgPm, "Yangi vazifa");
  await say(tgPm, `${runId} botdan`);
  await say(tgPm, "Task matni");
  await press(tgPm, "n:count:2");
  await press(tgPm, "n:date:1");
  await say(tgPm, "17:30");
  await press(tgPm, "n:pri:3");
  ok(/qo‘yilsinmi/.test(last(tgPm.id).text), "Tasdiq so‘raladi");
  await press(tgPm, "n:post");
  ok(/qo‘yildi/.test(last(tgPm.id).text), "Vazifa qo‘yildi");
  const fromBot = (await pm.web("/api/tasks")).data.tasks.find((t) => t.title === `${runId} botdan`);
  ok(fromBot.imageCount === 2 && fromBot.dueTime === "17:30" && fromBot.priority === 3, "Maydonlar to‘g‘ri saqlandi");
  await until(() => texts(tgB.id).find((x) => x.text.includes(`${runId} botdan`)), "Botdan qo‘yilgan vazifa xabari");
  await press(tgPm, `can:${fromBot.id}`);
  await press(tgPm, `can!:${fromBot.id}`);
  ok((await pm.web("/api/tasks")).data.tasks.find((t) => t.id === fromBot.id).status === "cancelled", "PM botda bekor qildi");
  await press(tgB, `can!:${fromBot.id}`);

  await press(tgD, "out!");

  // Fayllar botga yuboriladi; boshqa dizaynerning vazifasi ko‘rinmaydi
  const form = new FormData();
  form.set("file", new Blob(["task fayli"]), "task.txt");
  const uploaded = await pm.web("/api/files", { method: "POST", body: form });
  assert.equal(uploaded.status, 201);
  const withFile = await pm.web("/api/tasks", {
    method: "POST",
    body: { title: `${runId} fayl`, brief: "", imageCount: 1, fileIds: [uploaded.data.file.id] },
  });
  calls = [];
  await press(tgB, `f:${withFile.data.task.id}`);
  await until(() => calls.some((x) => x.method === "sendDocument"), "fayl botga yuboriladi");
  await press(tgB, `claim:${withFile.data.task.id}`);
  calls = [];
  await press(tgD, `f:${withFile.data.task.id}`);
  ok(!calls.some((x) => x.method === "sendDocument"), "Tizimdan chiqqan Telegram fayl ololmaydi");
  await press(tgE, `f:${withFile.data.task.id}`);
  ok(!calls.some((x) => x.method === "sendDocument"), "Boshqa dizayner olgan vazifa fayli yuborilmaydi");
  await press(tgE, "n:post");
  ok(calls.filter((x) => x.method === "answerCallbackQuery").at(-1).params.show_alert, "Dizayner vazifa qo‘ya olmaydi");

  // 10. Brauzerda ochish: bog‘langan Telegram parolsiz kiradi
  await say(tgB, "Hisob");
  const openUrl = buttons(last(tgB.id)).find((x) => x.url).url;
  const fresh = client();
  const openToken = new URL(openUrl).searchParams.get("t");
  ok((await fresh("/api/auth/telegram/link", { method: "POST", body: { token: openToken } })).data.status === "signed-in", "Bir martalik kirish");
  ok((await fresh("/api/me")).data.user.username === b.username, "To‘g‘ri hisob");
  ok((await client()("/api/auth/telegram/link", { method: "POST", body: { token: openToken } })).status === 410, "Kirish havolasi bir marta ishlaydi");

  // 11. Eslatmalar: vaqtni bazada surib tekshiriladi
  if (process.env.TEST_DB) {
    const database = new DatabaseSync(process.env.TEST_DB);
    const tashkent = (ms) => new Date(ms + 5 * 36e5).toISOString();
    const hour = Number(tashkent(Date.now()).slice(11, 13));
    const sweep = async () => {
      database.exec("DELETE FROM telegram_reminders WHERE key='sweep'");
      return (await client()("/api/telegram/cron")).data;
    };
    const skip = (await client()("/api/telegram/cron")).data;
    ok(typeof skip.sent === "number", "Tekshiruv manzili ishlaydi");
    if (hour >= 9 && hour < 21) {
      const soon = tashkent(Date.now() + 2 * 36e5);
      const made = await pm.web("/api/tasks", {
        method: "POST",
        body: { title: `${runId} tez`, brief: "Eslatma sinovi", imageCount: 1, dueDate: soon.slice(0, 10), dueTime: soon.slice(11, 16) },
      });
      const id = made.data.task.id;
      await press(tgB, `claim:${id}`);
      await sweep();
      calls = [];
      await sweep();
      ok(!calls.some((x) => /soat qoldi/.test(x.params.caption || "")), "Yangi olingan vazifa darhol eslatilmaydi");
      database.prepare("UPDATE assignments SET claimed_at=? WHERE id=?").run(new Date(Date.now() - 2 * 36e5).toISOString(), id);
      calls = [];
      await sweep();
      await until(() => texts(tgB.id).find((x) => /soat qoldi/.test(x.text) && x.text.includes("tez")), "muddat yaqin eslatmasi");
      ok(buttons(texts(tgB.id).find((x) => /soat qoldi/.test(x.text))).some((x) => x.text === "Tugatdim"), "Eslatmada amal tugmasi bor");
      calls = [];
      await sweep();
      ok(!texts(tgB.id).some((x) => /soat qoldi/.test(x.text)), "Eslatma ikki marta kelmaydi");
      const yesterday = tashkent(Date.now() - 864e5).slice(0, 10);
      database.prepare("UPDATE assignments SET due_date=?,due_time=NULL WHERE id=?").run(yesterday, id);
      calls = [];
      await sweep();
      await until(() => texts(tgB.id).find((x) => /Muddat o‘tdi/.test(x.text)), "muddat o‘tdi: dizaynerga");
      await until(() => texts(tgPm.id).find((x) => /Muddat o‘tdi/.test(x.text)), "muddat o‘tdi: PMga");
      await say(tgB, "Hisob");
      await press(tgB, "mute");
      ok(/o‘chiq/.test(last(tgB.id).text), "Eslatmalarni o‘chirish");
      database.prepare("UPDATE assignments SET due_date=?,due_time=NULL WHERE id=?").run(tashkent(Date.now() - 2 * 864e5).slice(0, 10), id);
      calls = [];
      await sweep();
      ok(!texts(tgB.id).length, "O‘chirgan odamga eslatma bormaydi");
      await press(tgB, "mute");
      const digest = texts(tgPm.id).find((x) => /Xayrli tong/.test(x.text));
      console.log(digest ? "  ertalabki xulosa shu tekshiruvda yuborildi" : "  ertalabki xulosa avvalroq yuborilgan");
    } else console.log("  eslatmalar: tun vaqti, sinov o‘tkazib yuborildi");
    database.close();
  }

  // 12. Parol o‘zgarsa va chiqilsa
  const newPassword = `${password}x`;
  ok((await a.web("/api/me", { method: "PATCH", body: { currentPassword: password, newPassword } })).status === 200, "Parol almashdi");
  ok(/Parolingiz o‘zgardi/.test(last(tgA.id).text), "Botga aytildi");
  ok((await client()("/api/auth/telegram", { method: "POST", body: { initData: initData(tgA) } })).data.status === "unlinked", "Parol o‘zgargach web-app qayta so‘raydi");
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
  .finally(() => mock.close());
