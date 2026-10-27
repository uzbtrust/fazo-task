"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { LoaderCircle, Star, X } from "lucide-react";
import type { Priority, TaskStatus } from "@/lib/types";
import { REVIEW_STEP } from "@/lib/workflow";

export const statusLabels: Record<TaskStatus, string> = {
  todo: "Ochiq",
  in_progress: "Jarayonda",
  in_review: "Tekshiruvda",
  done: "Bajarildi",
  cancelled: "Bekor qilingan",
};
/** Vazifa bosqichlari (bekor qilish bosqich emas). Tekshiruv faqat yoqilganda. */
export const STATUS_ORDER: TaskStatus[] = REVIEW_STEP
  ? ["todo", "in_progress", "in_review", "done"]
  : ["todo", "in_progress", "done"];

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
    !url.startsWith("/api/auth/") &&
    typeof window !== "undefined"
  )
    window.location.replace("/login");
  if (!response.ok)
    throw new Error(data.error || "Amal bajarilmadi. Qayta urinib ko‘ring.");
  return data as T;
}

/* ---- Sana: hammasi Toshkent vaqtida ---------------------------------- */
export const months = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];
const monthShort = [
  "yan", "fev", "mar", "apr", "may", "iyn",
  "iyl", "avg", "sen", "okt", "noy", "dek",
];
const weekdays: Record<string, string> = {
  Monday: "Dushanba",
  Tuesday: "Seshanba",
  Wednesday: "Chorshanba",
  Thursday: "Payshanba",
  Friday: "Juma",
  Saturday: "Shanba",
  Sunday: "Yakshanba",
};
function dateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    weekday: "long",
    timeZone: "Asia/Tashkent",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return {
    day: get("day"),
    month: get("month"),
    year: get("year"),
    weekday: weekdays[get("weekday")] || "",
  };
}
function parseDay(value: string) {
  return new Date(value.length === 10 ? `${value}T12:00:00+05:00` : value);
}
export function todayISO() {
  const p = dateParts(new Date());
  return `${p.year}-${p.month}-${p.day}`;
}
export function addDaysISO(days: number) {
  const [y, m, d] = todayISO().split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
function dayDiff(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const [ty, tm, td] = todayISO().split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 864e5);
}
export function shortDate(value: string | null) {
  if (!value) return "Belgilanmagan";
  const date = parseDay(value);
  if (!Number.isFinite(date.getTime())) return "Belgilanmagan";
  const p = dateParts(date);
  return `${Number(p.day)}-${monthShort[Number(p.month) - 1]}`;
}
export function longDate(value: string) {
  const p = dateParts(parseDay(value));
  return `${Number(p.day)}-${months[Number(p.month) - 1]}, ${p.year}`;
}
export function dateTime(value: string) {
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Tashkent",
  }).format(new Date(value));
  return `${shortDate(value)}, ${time}`;
}
export function fileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
export function todayEyebrow() {
  const p = dateParts(new Date());
  return { date: `${Number(p.day)}-${months[Number(p.month) - 1]}`, weekday: p.weekday };
}
export function isOverdue(dueDate: string | null, status: TaskStatus) {
  return !!dueDate && status !== "done" && status !== "cancelled" && dueDate < todayISO();
}
export function dueLabel(dueDate: string, status: TaskStatus) {
  const diff = dayDiff(dueDate);
  if (status === "done" || status === "cancelled") return { text: shortDate(dueDate), tone: "" };
  if (diff < 0)
    return { text: `${-diff} kun kechikdi`, tone: "bad" };
  if (diff === 0) return { text: "Bugun", tone: "warn" };
  if (diff === 1) return { text: "Ertaga", tone: "" };
  return { text: shortDate(dueDate), tone: "" };
}

/* ---- Kichik komponentlar --------------------------------------------- */
export function Wordmark() {
  return (
    <a href="/" className="wordmark" aria-label="Fazo Task — bosh sahifa">
      <svg className="wordmark-mark" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <rect width="24" height="24" rx="6.5" />
        <path d="m7.2 12.4 3.1 3.1 6.5-7" />
      </svg>
      <span className="wordmark-text">Fazo Task</span>
    </a>
  );
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Ism tartibi har xil bo‘lishi mumkin (avval familiya yoki avval ism) — familiyani chetlab o‘tamiz. */
export function givenName(name: string) {
  const words = name.split(/\s+/).filter(Boolean);
  return words.find((w) => !/(ov|ova|ev|eva|yev|yeva)$/i.test(w)) || words[0] || name;
}

export function Avatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span className={`avatar avatar-${size}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function Spinner({ label = "Yuklanmoqda" }: { label?: string }) {
  return <LoaderCircle size={18} className="spin" aria-label={label} />;
}

export function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <p role="alert" className="error-message">
      {message}
    </p>
  ) : null;
}

export function StatusGlyph({ status }: { status: TaskStatus }) {
  return (
    <svg className={`glyph glyph-${status}`} viewBox="0 0 24 24" aria-hidden="true">
      <circle className="glyph-ring" cx="12" cy="12" r="10" />
      <path className="glyph-half" d="M12 5.5a6.5 6.5 0 0 0 0 13Z" />
      <circle className="glyph-dot" cx="12" cy="12" r="4" />
      <circle className="glyph-fill" cx="12" cy="12" r="10" />
      <path className="glyph-mark" d="m7.6 12.3 3 3 5.8-6.3" />
      <path className="glyph-cross" d="m8.5 8.5 7 7m0-7-7 7" />
    </svg>
  );
}

export function StatusTag({ status }: { status: TaskStatus }) {
  return <span className={`tag tag-status-${status}`}>{statusLabels[status]}</span>;
}

export function Stars({ value }: { value: Priority | null }) {
  if (!value) return null;
  return (
    <span className="stars" role="img" aria-label={`Muhimlik: ${value} yulduz`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={12} strokeWidth={1.8} fill={n <= value ? "currentColor" : "none"} className={n <= value ? "on" : ""} />
      ))}
    </span>
  );
}

/** 1–5 yulduz; tanlangan yulduzni qayta bosish muhimlikni olib tashlaydi. */
export function StarPicker({
  value,
  onChange,
}: {
  value: Priority | null;
  onChange: (value: Priority | null) => void;
}) {
  const [hover, setHover] = useState<number>(0);
  const shown = hover || value || 0;
  return (
    <div className="star-picker" role="group" aria-label="Muhimlik" onMouseLeave={() => setHover(0)}>
      {([1, 2, 3, 4, 5] as Priority[]).map((n) => (
        <button
          key={n}
          type="button"
          aria-pressed={value === n}
          aria-label={`${n} yulduz`}
          className={n <= shown ? "on" : ""}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(value === n ? null : n)}
        >
          <Star size={24} strokeWidth={1.6} fill={n <= shown ? "currentColor" : "none"} />
        </button>
      ))}
      <span className="star-picker-value">{value ? `${value} / 5` : "Belgilanmagan"}</span>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger = true,
  onConfirm,
  onClose,
}: {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run() {
    setBusy(true);
    setError("");
    try {
      await onConfirm();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <Modal title={title} onClose={onClose} size="sm">
      <div className="sheet-body">
        <p className="sheet-text">{message}</p>
        <ErrorMessage message={error} />
      </div>
      <div className="sheet-foot">
        <button type="button" className="btn btn-quiet" onClick={onClose} disabled={busy}>
          Bekor qilish
        </button>
        <button
          type="button"
          className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
          onClick={() => void run()}
          disabled={busy}
        >
          {busy ? <Spinner /> : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

/** Raqam o‘zgarganda silliq sanab chiqadi (kamaytirilgan harakatda darhol). */
export function CountUp({ value, pad = 2 }: { value: number; pad?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);
  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (
      start === value ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setShown(value);
      return;
    }
    let frame = 0;
    const began = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / 700);
      const eased = 1 - Math.pow(1 - t, 4);
      setShown(Math.round(start + (value - start) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{String(shown).padStart(pad, "0")}</>;
}

/** Sirpanuvchi indikatorli segmentli tanlov (Apple uslubida). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className = "",
}: {
  value: T;
  options: { value: T; label: ReactNode; count?: number }[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ x: number; w: number } | null>(null);
  const [animate, setAnimate] = useState(false);
  // Hisoblar o‘zgarsa tugma kengligi ham o‘zgaradi — indikatorni qayta o‘lchaymiz.
  const layoutKey = options.map((o) => `${o.value}:${o.count ?? ""}`).join("|");
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const measure = () => {
      const active = root.querySelector<HTMLElement>("[aria-pressed='true']");
      // Yopiq dialog ichida kenglik 0 bo‘ladi — u holda CSS zaxira ko‘rinishi ishlaydi.
      const next =
        active && active.offsetWidth ? { x: active.offsetLeft, w: active.offsetWidth } : null;
      setIndicator((prev) =>
        prev && next && prev.x === next.x && prev.w === next.w ? prev : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [value, layoutKey]);
  useEffect(() => {
    if (!indicator || animate) return;
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, [indicator, animate]);
  return (
    <div
      ref={ref}
      className={`segmented ${indicator ? "is-measured" : ""} ${animate ? "is-animated" : ""} ${className}`}
      role="group"
      aria-label={label}
    >
      {indicator && (
        <span
          className="segmented-ind"
          style={{ transform: `translateX(${indicator.x}px)`, width: indicator.w }}
          aria-hidden="true"
        />
      )}
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count !== undefined && (
            <span className="seg-count">{option.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Modal({
  title,
  eyebrow,
  children,
  onClose,
  size = "md",
  hideTitle = false,
}: {
  title: string;
  eyebrow?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  size?: "sm" | "md" | "lg";
  hideTitle?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const closing = useRef(false);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    // showModal() fokusni birinchi tugmaga (Yopish) beradi; formada birinchi maydonga o‘tkazamiz.
    dialog?.querySelector<HTMLElement>(".sheet-body input, .sheet-body textarea")?.focus();
    return () => {
      dialog?.close();
      previous?.focus?.();
    };
  }, []);
  // Yopilishda qisqa animatsiya, keyin ota komponent dialogni olib tashlaydi.
  function requestClose() {
    const dialog = ref.current;
    if (!dialog || closing.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onClose();
      return;
    }
    closing.current = true;
    dialog.classList.add("is-closing");
    setTimeout(onClose, 180);
  }
  return (
    <dialog
      ref={ref}
      className={`sheet sheet-${size}`}
      onCancel={(e) => {
        // React bu hodisani ichki dialogdan (masalan, lightbox) ota dialogga ham uzatadi.
        if (e.target !== ref.current) return;
        e.preventDefault();
        requestClose();
      }}
      onClick={(e) => {
        if (e.target !== ref.current) return;
        const r = ref.current.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          requestClose();
      }}
      aria-labelledby={titleId}
    >
      <div className={`sheet-head ${hideTitle ? "is-bare" : ""}`}>
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2 id={titleId} className={hideTitle ? "sr-only" : ""}>
            {title}
          </h2>
        </div>
        <button
          type="button"
          className="icon-button sheet-close"
          aria-label="Yopish"
          onClick={requestClose}
        >
          <X size={18} strokeWidth={2} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
