import { NextResponse } from "next/server";
import type { Account, Role } from "./types";
import type { Row } from "./db";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api(
  run: () => Promise<Response | unknown>,
  status = 200,
) {
  try {
    const result = await run();
    if (result instanceof Response) return result;
    return NextResponse.json(result, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ApiError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    if (error instanceof SyntaxError)
      return NextResponse.json(
        { error: "So‘rov ma’lumoti noto‘g‘ri." },
        { status: 400 },
      );
    console.error(
      "Fazo API error:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json(
      { error: "Serverda xatolik yuz berdi. Qayta urinib ko‘ring." },
      { status: 500 },
    );
  }
}

export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    new URL(request.url).host;
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new ApiError(403, "Bu manbadan so‘rovga ruxsat yo‘q.");
  if (origin) {
    try {
      if (new URL(origin).host !== host)
        throw new ApiError(403, "Bu manbadan so‘rovga ruxsat yo‘q.");
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(403, "So‘rov manbasi noto‘g‘ri.");
    }
  }
}

export function text(
  value: unknown,
  label: string,
  max: number,
  required = true,
): string {
  if (value === undefined || value === null) {
    if (!required) return "";
    throw new ApiError(400, `${label} kiriting.`);
  }
  if (typeof value !== "string")
    throw new ApiError(400, `${label} matn bo‘lishi kerak.`);
  const clean = value.trim();
  if (required && !clean) throw new ApiError(400, `${label} kiriting.`);
  if (clean.length > max)
    throw new ApiError(400, `${label} ${max} belgidan oshmasligi kerak.`);
  return clean;
}

export function publicAccount(row: Row): Account {
  return {
    id: String(row.id),
    name: String(row.name),
    username: String(row.username),
    role: row.role as Role,
    createdAt: String(row.created_at),
  };
}

export function newPassword(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.trim().length < 8 ||
    value.length > 128
  )
    throw new ApiError(400, "Parol kamida 8 ta belgidan iborat bo‘lsin.");
  return value;
}

export function username(value: unknown): string {
  const clean = text(value, "Loginni", 32).toLowerCase();
  if (!/^[a-z0-9_.-]{3,32}$/.test(clean))
    throw new ApiError(
      400,
      "Login 3–32 ta lotin harfi, raqam, nuqta, chiziqcha yoki pastki chiziqdan iborat bo‘lsin.",
    );
  return clean;
}

/** Toshkent vaqti bo‘yicha bugungi sana (YYYY-MM-DD). */
export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());
}

export async function readBody(
  request: Request,
): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length") || 0) > 256 * 1024)
    throw new ApiError(413, "So‘rov hajmi juda katta.");
  const body = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new ApiError(400, "So‘rov ma’lumoti noto‘g‘ri.");
  return body as Record<string, unknown>;
}
