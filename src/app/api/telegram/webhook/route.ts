import { timingSafeEqual } from "node:crypto";
import { telegramEnabled, webhookSecret } from "@/lib/telegram/api";
import { handleUpdate, type Update } from "@/lib/telegram/bot";
export const runtime = "nodejs";

/** Telegram'dan keladi. Javob doim 200: xato bo‘lsa, Telegram bir xil xabarni qayta yubormasin. */
export async function POST(request: Request) {
  if (!telegramEnabled()) return new Response(null, { status: 404 });
  const given = Buffer.from(request.headers.get("x-telegram-bot-api-secret-token") || "");
  const expected = Buffer.from(webhookSecret());
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    return new Response(null, { status: 401 });
  try {
    await handleUpdate((await request.json()) as Update);
  } catch (error) {
    console.error("Telegram bot:", error instanceof Error ? error.message : "xato");
  }
  return new Response(null, { status: 200 });
}
