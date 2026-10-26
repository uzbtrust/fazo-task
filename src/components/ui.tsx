"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  X,
  LoaderCircle,
  Paperclip,
  FileText,
  ArrowUpRight,
} from "lucide-react";
import type { Attachment, Priority, TaskStatus, Role } from "@/lib/types";

export const roleLabels: Record<Role, string> = {
  admin: "Administrator",
  creator: "Kontent kreator",
  designer: "Dizayner",
};
export const statusLabels: Record<TaskStatus, string> = {
  open: "Ochiq",
  in_progress: "Jarayonda",
  in_review: "Tekshiruvda",
  approved: "Tasdiqlangan",
  completed: "Yakunlangan",
  cancelled: "Bekor qilingan",
};
export const priorityLabels: Record<Priority, string> = {
  low: "Past",
  medium: "O‘rta",
  high: "Yuqori",
};
export const categories = [
  "Ijtimoiy tarmoq",
  "Brending",
  "Taqdimot",
  "Veb dizayn",
  "Bosma dizayn",
  "Boshqa",
];
export const actionLabels: Record<string, string> = {
  created: "vazifa yaratdi",
  create: "vazifa yaratdi",
  claimed: "vazifani oldi",
  claim: "vazifani oldi",
  released: "vazifani qaytardi",
  release: "vazifani qaytardi",
  submitted: "ishni topshirdi",
  submit: "ishni topshirdi",
  approved: "ishni tasdiqladi",
  approve: "ishni tasdiqladi",
  request_changes: "tuzatish so‘radi",
  changes_requested: "tuzatish so‘radi",
  complete: "ishni yakunladi",
  completed: "ishni yakunladi",
  cancel: "vazifani bekor qildi",
  cancelled: "vazifani bekor qildi",
  edit: "vazifani tahrirladi",
  edited: "vazifani tahrirladi",
  comment: "izoh qoldirdi",
  commented: "izoh qoldirdi",
};

export async function api<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers:
      options.body instanceof FormData
        ? options.headers
        : { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response
    .json()
    .catch(() => ({ error: "Server bilan bog‘lanib bo‘lmadi." }));
  if (
    response.status === 401 &&
    url !== "/api/auth/login" &&
    typeof window !== "undefined"
  )
    window.location.replace("/login");
  if (!response.ok)
    throw new Error(data.error || "Amal bajarilmadi. Qayta urinib ko‘ring.");
  return data as T;
}
const months = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr",
];
const monthShort = [
  "yan",
  "fev",
  "mar",
  "apr",
  "may",
  "iyn",
  "iyl",
  "avg",
  "sen",
  "okt",
  "noy",
  "dek",
];
function dateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Tashkent",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return {
    day: get("day"),
    month: get("month"),
    year: get("year"),
    hour: get("hour"),
    minute: get("minute"),
  };
}
export function shortDate(value: string | null, time = false) {
  if (!value) return "Belgilanmagan";
  const date = new Date(
    value.length === 10 ? value + "T12:00:00+05:00" : value,
  );
  if (!Number.isFinite(date.getTime())) return "Belgilanmagan";
  const p = dateParts(date);
  return `${Number(p.day)}-${monthShort[Number(p.month) - 1]}${time ? `, ${p.hour}:${p.minute}` : ""}`;
}
export function fullDate(date = new Date()) {
  const p = dateParts(date);
  return `${Number(p.day)}-${months[Number(p.month) - 1]}, ${p.year}`;
}
export function todayISO() {
  const p = dateParts(new Date());
  return `${p.year}-${p.month}-${p.day}`;
}
export function initials(name: string) {
  return name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
export function Logo({ small = false }: { small?: boolean }) {
  return (
    <a
      href="/"
      className={`brand ${small ? "brand-small" : ""}`}
      aria-label="Fazo Task bosh sahifa"
    >
      <svg
        className="brand-mark"
        viewBox="0 0 36 36"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M8 26 19 6l9 20H8Z"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <ellipse
          cx="18"
          cy="21"
          rx="16"
          ry="5"
          transform="rotate(-29 18 21)"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="m13 17 6-11 5 12"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
      </svg>
      <span>
        fazo<span className="brand-task">task</span>
      </span>
    </a>
  );
}
export function Spinner() {
  return <LoaderCircle size={18} className="spin" aria-label="Yuklanmoqda" />;
}
export function Badge({ status }: { status: TaskStatus }) {
  return (
    <span className={`badge status-${status}`}>
      <span className="status-dot" />
      {statusLabels[status]}
    </span>
  );
}
export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`priority priority-${priority}`}>
      <span>{priority === "high" ? "↑" : priority === "low" ? "↓" : "−"}</span>
      {priorityLabels[priority]}
    </span>
  );
}
export function Avatar({
  name,
  small = false,
}: {
  name: string;
  small?: boolean;
}) {
  return (
    <span
      className={`avatar ${small ? "avatar-small" : ""}`}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
export function Modal({
  title,
  eyebrow,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement;
    dialog?.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal-wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = ref.current.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
      aria-labelledby="modal-title"
    >
      <div className="modal-heading">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2 id="modal-title">{title}</h2>
        </div>
        <button className="icon-button" aria-label="Yopish" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function FileLinks({ files }: { files: Attachment[] }) {
  return files.length ? (
    <div className="file-links">
      {files.map((file) => (
        <a
          key={file.id}
          className="file-link"
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="file-icon">
            <FileText size={19} />
          </span>
          <span>
            <strong>{file.name}</strong>
            <small>
              {file.size < 1024 * 1024
                ? Math.ceil(file.size / 1024) + " KB"
                : (file.size / 1024 / 1024).toFixed(1) + " MB"}
            </small>
          </span>
          <ArrowUpRight size={16} />
        </a>
      ))}
    </div>
  ) : null;
}
export function FilePicker({
  files,
  onChange,
  busy,
  onBusy,
}: {
  files: Attachment[];
  onChange: (files: Attachment[]) => void;
  busy: boolean;
  onBusy: (busy: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  async function upload(items: FileList | null) {
    if (!items?.length) return;
    onBusy(true);
    if (errorRef.current) errorRef.current.textContent = "";
    let added = [...files];
    try {
      for (const file of Array.from(items)) {
        if (file.size > 3 * 1024 * 1024)
          throw new Error("Har bir fayl hajmi 3 MB dan oshmasin.");
        const data = new FormData();
        data.append("file", file);
        const result = await api<{ file: Attachment }>("/api/files", {
          method: "POST",
          body: data,
        });
        added = [...added, result.file];
        onChange(added);
      }
    } catch (error) {
      if (errorRef.current)
        errorRef.current.textContent = (error as Error).message;
    } finally {
      onBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }
  return (
    <div>
      <input
        ref={ref}
        type="file"
        multiple
        className="sr-only"
        id="file-upload"
        onChange={(e) => upload(e.target.files)}
        accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.zip,.psd,.ai,.svg,.fig,.sketch,.eps,.docx,.pptx,.xlsx"
      />
      <button
        type="button"
        className="upload-zone"
        disabled={busy}
        onClick={() => ref.current?.click()}
      >
        <span className="upload-icon">
          {busy ? <Spinner /> : <Paperclip size={20} />}
        </span>
        <span>
          <strong>{busy ? "Fayl yuklanmoqda…" : "Fayl biriktirish"}</strong>
          <small>Rasm, hujjat yoki dizayn fayli · 3 MB gacha</small>
        </span>
        <span className="upload-plus">+</span>
      </button>
      <p ref={errorRef} className="field-error" role="alert" />
      {files.length > 0 && (
        <div className="uploaded-files">
          {files.map((file) => (
            <span key={file.id}>
              <Paperclip size={13} />
              <span>{file.name}</span>
              <button
                type="button"
                aria-label={`${file.name} faylini olib tashlash`}
                onClick={() => onChange(files.filter((f) => f.id !== file.id))}
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
export function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <p role="alert" className="error-message">
      {message}
    </p>
  ) : null;
}
