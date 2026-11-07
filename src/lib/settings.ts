import { db } from "./db";

/** Mavzu hisobga yoziladi: sayt, web-app va bot rasmlari bir xil ko‘rinadi. null — tizimga ergashadi. */
export type Theme = "light" | "dark";
export const isTheme = (value: unknown): value is Theme => value === "light" || value === "dark";

export async function getTheme(memberId: string): Promise<Theme | null> {
  const row = (
    await (await db()).execute({ sql: "SELECT theme FROM member_settings WHERE member_id=?", args: [memberId] })
  ).rows[0];
  return isTheme(row?.theme) ? row.theme : null;
}

export async function setTheme(memberId: string, theme: Theme | null) {
  await (await db()).execute({
    sql: `INSERT INTO member_settings(member_id,theme) VALUES (?,?)
      ON CONFLICT(member_id) DO UPDATE SET theme=excluded.theme`,
    args: [memberId, theme],
  });
}

/** Bir nechta odamning mavzusi bitta so‘rovda. Tanlamaganlar uchun bot rasmi qorong‘u. */
export async function themesOf(ids: string[]): Promise<Map<string, Theme>> {
  if (!ids.length) return new Map();
  const rows = (
    await (await db()).execute({
      sql: `SELECT member_id,theme FROM member_settings WHERE member_id IN (${ids.map(() => "?").join(",")})`,
      args: ids,
    })
  ).rows;
  return new Map(rows.filter((r) => isTheme(r.theme)).map((r) => [String(r.member_id), r.theme as Theme]));
}
