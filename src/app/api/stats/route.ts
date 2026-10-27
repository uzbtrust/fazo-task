import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { api } from "@/lib/server";
import { getStats } from "@/lib/tasks";
import type { Stats } from "@/lib/types";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return api(async () => {
    await requireUser("admin");
    const value = new URL(request.url).searchParams.get("period");
    const period: Stats["period"] = value === "7" || value === "30" ? value : "all";
    return { stats: await getStats(await db(), period) };
  });
}
