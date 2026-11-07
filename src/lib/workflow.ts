import type { TaskStatus } from "./types";

/**
 * Ish oqimi sozlamasi — server ham, interfeys ham shu qiymatga qaraydi.
 *
 * false (hozirgi tartib): dizayner ishni PMga og‘zaki ko‘rsatadi va o‘zi «Tugatdim» deb
 *   belgilaydi: Ochiq → Jarayonda → Bajarildi. Natija yuklash ixtiyoriy.
 * true: dizayner natijani yuklab topshiradi, PM qabul qiladi yoki qaytaradi:
 *   Ochiq → Jarayonda → Tekshiruvda → Bajarildi.
 */
export const REVIEW_STEP = false;

/** Vazifa bosqichlari (bekor qilish bosqich emas). Tekshiruv faqat yoqilganda. */
export const STATUS_ORDER: TaskStatus[] = REVIEW_STEP
  ? ["todo", "in_progress", "in_review", "done"]
  : ["todo", "in_progress", "done"];

export const statusLabels: Record<TaskStatus, string> = {
  todo: "Ochiq",
  in_progress: "Jarayonda",
  in_review: "Tekshiruvda",
  done: "Bajarildi",
  cancelled: "Bekor qilingan",
};
