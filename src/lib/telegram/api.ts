import { createHash } from "node:crypto";

/** Bot tokeni faqat shu faylda ishlatiladi; xato xabarlarida ham chiqmaydi. */
export const botToken = () => process.env.BOT_TOKEN || "";
export const telegramEnabled = () => !!botToken();
const apiBase = () => process.env.TELEGRAM_API_URL || "https://api.telegram.org";

/** Sayt manzili: webhook ichida so‘rov yo‘q, shuning uchun muhitdan olinadi. */
export function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://127.0.0.1:3000";
}

/** Webhook siri tokendan olinadi: alohida sozlash shart emas. */
export const webhookSecret = () => createHash("sha256").update(`fazo-webhook:${botToken()}`).digest("hex");

export class TelegramError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function request<T>(method: string, init: RequestInit, retry = true): Promise<T> {
  const response = await fetch(`${apiBase()}/bot${botToken()}/${method}`, {
    ...init,
    method: "POST",
    signal: AbortSignal.timeout(15000),
  });
  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    result?: T;
    error_code?: number;
    description?: string;
    parameters?: { retry_after?: number };
  };
  if (data.ok) return data.result as T;
  const after = data.parameters?.retry_after;
  if (data.error_code === 429 && retry && after && after <= 5) {
    await wait(after * 1000);
    return request(method, init, false);
  }
  throw new TelegramError(data.error_code || response.status, data.description || "Telegram javob bermadi");
}

export function tg<T = unknown>(method: string, params: Record<string, unknown> = {}) {
  return request<T>(method, {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

export function sendFile(chatId: string | number, name: string, mime: string, bytes: Buffer, caption?: string) {
  const form = new FormData();
  form.set("chat_id", String(chatId));
  form.set("document", new Blob([new Uint8Array(bytes)], { type: mime }), name);
  if (caption) form.set("caption", caption);
  return request("sendDocument", { body: form });
}

let username: Promise<string> | undefined;
/** Bot manzili (t.me/…) uchun; bir marta so‘raladi. */
export function botUsername() {
  if (process.env.BOT_USERNAME) return Promise.resolve(process.env.BOT_USERNAME);
  username ??= tg<{ username: string }>("getMe").then(
    (me) => me.username,
    (error) => {
      username = undefined;
      throw error;
    },
  );
  return username;
}

export const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type Button = Record<string, unknown>;
export type Keyboard = Button[][];

export interface Sent {
  message_id: number;
}

/** Xabar yuboradi. Foydalanuvchi botni bloklagan bo‘lsa, ish to‘xtamaydi. */
export async function say(chatId: string | number, text: string, markup?: unknown, extra: Record<string, unknown> = {}) {
  try {
    return await tg<Sent>("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      ...(markup ? { reply_markup: markup } : {}),
      ...extra,
    });
  } catch (error) {
    console.error("Telegram sendMessage:", error instanceof Error ? error.message : "xato");
    return null;
  }
}

/** Xabarni joyida yangilaydi; matn o‘zgarmagan bo‘lsa, Telegram xatosi e’tiborsiz qoladi. */
export async function edit(chatId: string | number, messageId: number, text: string, keyboard?: Keyboard) {
  try {
    await tg("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: { inline_keyboard: keyboard || [] },
    });
  } catch (error) {
    if (!(error instanceof TelegramError) || !/not modified/i.test(error.message)) throw error;
  }
}

export interface SentPhoto extends Sent {
  photo?: { file_id: string }[];
}

/**
 * Rasm yuboradi: fayl yoki avval yuklangan file_id. Bir xil rasm har odamga qayta yuklanmaydi.
 * silent — ovozsiz (bosh menyu va tozalash), xabarnoma emas.
 */
export async function sendPhoto(chatId: string | number, photo: Buffer | string, caption: string, markup?: unknown, silent = false) {
  const fields = { chat_id: String(chatId), caption, parse_mode: "HTML", ...(silent ? { disable_notification: "true" } : {}) };
  if (typeof photo === "string")
    return tg<SentPhoto>("sendPhoto", { ...fields, disable_notification: silent, photo, ...(markup ? { reply_markup: markup } : {}) });
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  if (markup) form.set("reply_markup", JSON.stringify(markup));
  form.set("photo", new Blob([new Uint8Array(photo)], { type: "image/png" }), "fazo-task.png");
  return request<SentPhoto>("sendPhoto", { body: form });
}

/** Xabardagi rasmni almashtiradi: ro‘yxatdan vazifa oynasiga o‘tish va orqaga qaytish shu. */
export function editPhoto(chatId: number, messageId: number, image: Buffer, caption: string, keyboard: Keyboard) {
  const form = new FormData();
  form.set("chat_id", String(chatId));
  form.set("message_id", String(messageId));
  form.set("media", JSON.stringify({ type: "photo", media: "attach://image", caption, parse_mode: "HTML" }));
  form.set("reply_markup", JSON.stringify({ inline_keyboard: keyboard }));
  form.set("image", new Blob([new Uint8Array(image)], { type: "image/png" }), "fazo-task.png");
  return request("editMessageMedia", { body: form });
}

export async function editCaption(chatId: number, messageId: number, caption: string, keyboard?: Keyboard) {
  try {
    await tg("editMessageCaption", {
      chat_id: chatId,
      message_id: messageId,
      caption,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: keyboard || [] },
    });
  } catch (error) {
    if (!(error instanceof TelegramError) || !/not modified/i.test(error.message)) throw error;
  }
}

/** Xabarni o‘chiradi; allaqachon yo‘q bo‘lsa, jim o‘tadi. */
export async function remove(chatId: string | number, messageId: number | null | undefined) {
  if (!messageId) return;
  await tg("deleteMessage", { chat_id: chatId, message_id: messageId }).catch(() => {});
}

/** Ko‘p xabarni 100 tadan o‘chiradi. Topilmagan raqamlarni Telegram o‘zi o‘tkazib yuboradi. */
export async function removeMany(chatId: string | number, ids: number[]) {
  for (let i = 0; i < ids.length; i += 100)
    await tg("deleteMessages", { chat_id: chatId, message_ids: ids.slice(i, i + 100) }).catch(() => {});
}

export const inline = (keyboard: Keyboard) => ({ inline_keyboard: keyboard });
export const webApp = (text: string, path: string) => ({ text, web_app: { url: `${appUrl()}${path}` } });
export const link = (text: string, url: string) => ({ text, url });
export const action = (text: string, data: string, style?: "primary" | "success" | "danger") => ({
  text,
  callback_data: data,
  ...(style ? { style } : {}),
});
