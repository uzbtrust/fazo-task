import type { Role } from "./types";

export const roleInfo: Record<Role, { label: string; plural: string; description: string }> = {
  admin: {
    label: "Administrator",
    plural: "Administratorlar",
    description: "Jamoani boshqaradi: hodim qo‘shadi va o‘chiradi.",
  },
  pm: {
    label: "Project manager",
    plural: "Project managerlar",
    description: "Dizaynerga vazifa beradi va natijani qabul qiladi.",
  },
  designer: {
    label: "Dizayner",
    plural: "Dizaynerlar",
    description: "Vazifani bajaradi va tayyor rasmlarni topshiradi.",
  },
};

/** Administrator yarata oladigan rollar. Yangi kasb shu ro‘yxatga qo‘shiladi. */
export const memberRoles = ["pm", "designer"] as const satisfies readonly Role[];
export type MemberRole = (typeof memberRoles)[number];
export const isMemberRole = (value: unknown): value is MemberRole =>
  memberRoles.includes(value as MemberRole);
