import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

/*
 * Botni sayt bilan bog‘laydi: webhook, buyruqlar, menyu tugmasi va tavsif.
 * Sayt deploy bo‘lgandan keyin bir marta ishga tushiriladi:
 *   node scripts/telegram-setup.mjs https://fazo-task.vercel.app
 * Token BOT_TOKEN muhit o‘zgaruvchisidan yoki .env faylidan olinadi va chiqarilmaydi.
 */
const app = (process.argv[2] || "").replace(/\/$/, "");
if (!/^https:\/\//.test(app)) throw new Error("Sayt manzilini https:// bilan bering.");

function token() {
  if (process.env.BOT_TOKEN) return process.env.BOT_TOKEN;
  if (!existsSync(".env")) return "";
  const line = readFileSync(".env", "utf8").split("\n").find((l) => /^\s*BOT_TOKEN\s*=/.test(l));
  return line ? line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "") : "";
}
const bot = token();
if (!bot) throw new Error("BOT_TOKEN topilmadi.");

async function call(method, params) {
  const response = await fetch(`https://api.telegram.org/bot${bot}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await response.json();
  if (!data.ok) throw new Error(`${method}: ${data.description}`);
  console.log(`✓ ${method}`);
}

await call("setWebhook", {
  url: `${app}/api/telegram/webhook`,
  secret_token: createHash("sha256").update(`fazo-webhook:${bot}`).digest("hex"),
  allowed_updates: ["message", "callback_query"],
  drop_pending_updates: true,
});
await call("setMyCommands", {
  commands: [
    { command: "start", description: "Bosh menyu" },
    { command: "vazifalar", description: "Vazifalarim" },
    { command: "statistika", description: "Statistika" },
    { command: "hisob", description: "Hisob" },
    { command: "bekor", description: "Boshlangan amalni bekor qilish" },
  ],
});
await call("setChatMenuButton", {
  menu_button: { type: "web_app", text: "Ilova", web_app: { url: `${app}/tg` } },
});
await call("setMyDescription", {
  description: "Fazo Task: vazifalarni shu yerda oling, boshqaring va yangi vazifa haqida xabar oling.",
});
await call("setMyShortDescription", { short_description: "Dizayn jamoasi vazifalari" });
