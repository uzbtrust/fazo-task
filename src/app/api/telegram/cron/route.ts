import { api } from "@/lib/server";
import { sweep } from "@/lib/telegram/reminders";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Eslatmalar tekshiruvi: GitHub Actions har 15 daqiqada chaqiradi (.github/workflows/reminders.yml). */
export async function GET() {
  return api(() => sweep());
}
