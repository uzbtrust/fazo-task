import type { Row } from "./db";

/** Vercel funksiyasiga so‘rov 4.5 MB dan oshmasligi kerak. */
export const MAX_FILE = 4 * 1024 * 1024;

export const FILE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  txt: "text/plain",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
  psd: "image/vnd.adobe.photoshop",
  ai: "application/postscript",
  eps: "application/postscript",
  fig: "application/octet-stream",
  sketch: "application/octet-stream",
};

/** Brauzerda xavfsiz ochiladigan turlar. SVG skript tashishi mumkin — u faqat yuklab olinadi. */
const INLINE = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf", "text/plain"]);

function disposition(name: string, mode: "inline" | "attachment") {
  const ascii = name.replace(/[^\x20-\x7e]|["\\]/g, "_");
  return `${mode}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export function serveFile(row: Row, download: boolean): Response {
  const name = String(row.name);
  const mime = String(row.mime);
  const buffer = Buffer.from(String(row.data), "base64");
  const inline = !download && INLINE.has(mime);
  return new Response(buffer, {
    headers: {
      "Content-Type": mime === "text/plain" ? "text/plain; charset=utf-8" : mime,
      "Content-Length": String(buffer.length),
      "Content-Disposition": disposition(name, inline ? "inline" : "attachment"),
      "X-Content-Type-Options": "nosniff",
      // Fayl id bo‘yicha o‘zgarmaydi; faqat shu foydalanuvchining brauzerida keshlanadi.
      "Cache-Control": "private, max-age=86400, immutable",
      "Content-Security-Policy":
        mime === "application/pdf"
          ? "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
          : "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; frame-ancestors 'none'; sandbox",
    },
  });
}
