import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { api, checkOrigin, readBody } from "@/lib/server";
import { postTask } from "@/lib/task-actions";
import { getTasks } from "@/lib/tasks";
export const runtime = "nodejs";

export async function GET() {
  return api(async () => {
    const user = await requireUser("pm", "designer");
    // Dizayner faqat o‘zi olgan va hali hech kim olmagan vazifalarni ko‘radi.
    const filter = user.role === "designer" ? { visibleTo: user.id } : {};
    return { tasks: await getTasks(await db(), filter) };
  });
}

export async function POST(request: Request) {
  return api(async () => {
    checkOrigin(request);
    const user = await requireUser("pm");
    return { task: await postTask(user, await readBody(request)) };
  }, 201);
}
