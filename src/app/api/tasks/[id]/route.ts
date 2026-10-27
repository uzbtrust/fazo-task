import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { api, ApiError, checkOrigin, readBody, text } from "@/lib/server";
import { addEvent, fileIds, getTasks, linkFiles, linkUrls, saveLinks, taskFields } from "@/lib/tasks";
import type { TaskStatus } from "@/lib/types";
import { REVIEW_STEP } from "@/lib/workflow";
export const runtime = "nodejs";

/**
 * Vazifa oqimi: todo (ochiq) → in_progress → done; REVIEW_STEP yoqilsa orada in_review.
 * Dizayner: claim, complete (yoki submit), release.
 * PM: edit, cancel, reopen, release (va tekshiruv yoqilsa accept, return).
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    checkOrigin(request);
    const user = await requireUser("pm", "designer");
    const { id } = await context.params;
    const body = await readBody(request);
    const action = text(body.action, "Amalni", 40);
    const message = text(body.message, "Izohni", 5000, false);
    const database = await db();
    const tx = await database.transaction("write");
    try {
      const task = (await getTasks(tx, { id }))[0];
      if (!task) throw new ApiError(404, "Vazifa topilmadi.");
      const open = task.status === "todo" && task.assigneeId === null;
      if (user.role === "designer" && task.assigneeId !== user.id && !open)
        throw action === "claim"
          ? new ApiError(409, "Bu vazifani boshqa dizayner oldi.")
          : new ApiError(404, "Vazifa topilmadi.");
      const expect = (...statuses: TaskStatus[]) => {
        if (!statuses.includes(task.status))
          throw new ApiError(409, "Vazifa holati o‘zgargan. Sahifani yangilang.");
      };
      const role = (needed: "pm" | "designer") => {
        if (user.role !== needed) throw new ApiError(403, "Bu amal sizning rolingiz uchun emas.");
      };
      const now = new Date().toISOString();
      let next: TaskStatus = task.status;
      let assignee = task.assigneeId;
      switch (action) {
        case "claim":
          role("designer");
          if (!open) throw new ApiError(409, "Bu vazifani boshqa dizayner oldi.");
          assignee = user.id;
          await tx.execute({ sql: "UPDATE assignments SET claimed_at=? WHERE id=?", args: [now, id] });
          next = "in_progress";
          break;
        case "release":
          // Dizayner o‘zi yoki PM vazifani ochiq ro‘yxatga qaytaradi; yuklangan natija o‘chadi.
          if (user.role === "designer" && task.assigneeId !== user.id)
            throw new ApiError(403, "Bu vazifa sizda emas.");
          expect("in_progress");
          assignee = null;
          await tx.execute({ sql: "DELETE FROM attachments WHERE assignment_id=? AND kind='result'", args: [id] });
          await tx.execute({
            sql: "UPDATE assignments SET claimed_at=NULL,submitted_at=NULL,result_note='' WHERE id=?",
            args: [id],
          });
          next = "todo";
          break;
        case "complete":
          // Hozirgi tartib: ish PMga og‘zaki ko‘rsatiladi, dizayner o‘zi tugatadi.
          if (REVIEW_STEP) throw new ApiError(400, "Ishni tekshiruvga topshiring.");
          role("designer");
          if (task.assigneeId !== user.id) throw new ApiError(403, "Bu vazifa sizda emas.");
          expect("in_progress");
          await tx.execute({
            sql: "UPDATE assignments SET result_note=?,submitted_at=?,completed_at=? WHERE id=?",
            args: [message, now, now, id],
          });
          next = "done";
          break;
        case "cancel":
          role("pm");
          expect("todo", "in_progress", "in_review");
          next = "cancelled";
          break;
        case "reopen":
          // Bekor qilingan vazifa yana ochiq ro‘yxatga chiqadi — istalgan dizayner olishi mumkin.
          role("pm");
          expect("cancelled");
          assignee = null;
          await tx.execute({ sql: "DELETE FROM attachments WHERE assignment_id=? AND kind='result'", args: [id] });
          await tx.execute({
            sql: "UPDATE assignments SET claimed_at=NULL,submitted_at=NULL,completed_at=NULL,result_note='' WHERE id=?",
            args: [id],
          });
          next = "todo";
          break;
        case "submit":
          if (!REVIEW_STEP) throw new ApiError(400, "Tekshiruv bosqichi hozircha o‘chirilgan.");
          role("designer");
          if (task.assigneeId !== user.id) throw new ApiError(403, "Bu vazifa sizda emas.");
          expect("in_progress");
          if (!task.resultFiles.length && !message)
            throw new ApiError(400, "Tayyor rasmlarni yuklang yoki havola/izoh yozing.");
          await tx.execute({
            sql: "UPDATE assignments SET result_note=?,submitted_at=? WHERE id=?",
            args: [message, now, id],
          });
          next = "in_review";
          break;
        case "accept":
          if (!REVIEW_STEP) throw new ApiError(400, "Tekshiruv bosqichi hozircha o‘chirilgan.");
          role("pm");
          expect("in_review");
          await tx.execute({ sql: "UPDATE assignments SET completed_at=? WHERE id=?", args: [now, id] });
          next = "done";
          break;
        case "return":
          if (!REVIEW_STEP) throw new ApiError(400, "Tekshiruv bosqichi hozircha o‘chirilgan.");
          role("pm");
          expect("in_review");
          if (!message) throw new ApiError(400, "Nimani tuzatish kerakligini yozing.");
          next = "in_progress";
          break;
        case "edit": {
          role("pm");
          const fields = taskFields({ ...task, ...body });
          const added = fileIds(body.fileIds);
          const addedReferences = fileIds(body.referenceIds);
          const removed = fileIds(body.removeFileIds);
          const kept = task.briefFiles.filter((f) => !removed.includes(f.id));
          if (!fields.brief && !kept.length && !added.length)
            throw new ApiError(400, "TZ ni matn bilan yozing yoki fayl yuklang.");
          for (const fileId of removed)
            await tx.execute({
              sql: "DELETE FROM attachments WHERE id=? AND assignment_id=? AND kind IN ('brief','reference')",
              args: [fileId, id],
            });
          await linkFiles(tx, id, added, user.id, "brief");
          await linkFiles(tx, id, addedReferences, user.id, "reference");
          // Havolalar yuborilgan bo‘lsa, ro‘yxat to‘liq almashtiriladi.
          if (body.links !== undefined) await saveLinks(tx, id, linkUrls(body.links));
          await tx.execute({
            sql: "UPDATE assignments SET title=?,brief=?,image_count=?,priority=?,due_date=? WHERE id=?",
            args: [fields.title, fields.brief, fields.imageCount, fields.priority, fields.dueDate, id],
          });
          break;
        }
        default:
          throw new ApiError(400, "Bunday amal mavjud emas.");
      }
      // Holat va ijrochi faqat o‘qilgan holatdan o‘zgaradi: ikki dizayner bir vaqtda
      // «Men olaman» desa, faqat birinchisi oladi.
      const updated = await tx.execute({
        sql: "UPDATE assignments SET status=?,assignee_id=?,updated_at=? WHERE id=? AND status=? AND assignee_id IS ?",
        args: [next, assignee, now, id, task.status, task.assigneeId],
      });
      if (updated.rowsAffected !== 1)
        throw new ApiError(409, action === "claim" ? "Bu vazifani boshqa dizayner oldi." : "Vazifa holati o‘zgargan. Sahifani yangilang.");
      await addEvent(tx, id, user.id, action === "edit" ? "edited" : action, message);
      await tx.commit();
      return { task: (await getTasks(database, { id }))[0] };
    } catch (error) {
      if (!tx.closed) await tx.rollback();
      throw error;
    }
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    checkOrigin(request);
    await requireUser("pm");
    const { id } = await context.params;
    const result = await (await db()).batch(
      [
        { sql: "DELETE FROM assignments WHERE id=?", args: [id] },
        { sql: "DELETE FROM attachments WHERE assignment_id=?", args: [id] },
        { sql: "DELETE FROM assignment_events WHERE assignment_id=?", args: [id] },
        { sql: "DELETE FROM assignment_links WHERE assignment_id=?", args: [id] },
      ],
      "write",
    );
    if (result[0].rowsAffected !== 1) throw new ApiError(404, "Vazifa topilmadi.");
    return { ok: true };
  });
}
