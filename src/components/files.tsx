"use client";
import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileArchive,
  FileImage,
  FileText,
  Paperclip,
  Trash2,
  X,
} from "lucide-react";
import type { FileMeta, Task } from "@/lib/types";
import { api, fileSize, Spinner } from "./ui";

const MAX_FILE = 4 * 1024 * 1024;
const ACCEPT =
  ".png,.jpg,.jpeg,.webp,.gif,.svg,.pdf,.txt,.doc,.docx,.xlsx,.pptx,.zip,.psd,.ai,.eps,.fig,.sketch";
export const isImage = (file: FileMeta) => /^image\/(png|jpeg|webp|gif)$/.test(file.mime);
const opensInBrowser = (file: FileMeta) => file.mime === "application/pdf" || file.mime === "text/plain";

/* ---- Fonda oldindan yuklash ------------------------------------------------
   Ro‘yxat darhol ko‘rinadi; TZ fayllari va rasmlar esa brauzer bo‘sh paytida birma-bir
   yuklanib, HTTP keshga tushadi. Vazifa ochilganda ular kutmasdan ko‘rinadi. */
const warmed = new Set<string>();
const idle = (fn: () => void) =>
  "requestIdleCallback" in window ? window.requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 200);

function warm(file: FileMeta) {
  if (warmed.has(file.id)) return Promise.resolve();
  warmed.add(file.id);
  if (isImage(file))
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = img.onerror = () => resolve();
      img.src = file.url;
    });
  return fetch(file.url, { priority: "low", credentials: "same-origin" } as RequestInit)
    .then((r) => r.blob())
    .then(() => undefined, () => undefined);
}

/** Kursor qatorga kelganda shu vazifaning fayllarini darhol yuklay boshlaydi. */
export function warmTask(task: Task) {
  for (const file of [...task.briefFiles, ...task.resultFiles]) void warm(file);
}

/** Faol vazifalarning fayllarini fonda, birma-bir yuklaydi (eng ko‘pi 40 ta). */
export function useWarmFiles(tasks: Task[]) {
  const key = tasks
    .filter((t) => t.status !== "done" && t.status !== "cancelled")
    .flatMap((t) => [...t.briefFiles, ...t.resultFiles].map((f) => f.id))
    .join(",");
  useEffect(() => {
    if (!key) return;
    let stopped = false;
    const queue = key.split(",").filter((id) => !warmed.has(id)).slice(0, 40);
    const files = new Map(
      tasks.flatMap((t) => [...t.briefFiles, ...t.resultFiles]).map((f) => [f.id, f] as const),
    );
    const next = () => {
      const id = queue.shift();
      if (stopped || !id) return;
      const file = files.get(id);
      if (!file) return next();
      void warm(file).then(() => idle(next));
    };
    // Birinchi chizishdan keyin boshlaymiz — sahifa ochilishini sekinlashtirmasin.
    const start = setTimeout(() => idle(next), 600);
    return () => {
      stopped = true;
      clearTimeout(start);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/** Fayllarni ketma-ket yuklaydi; har biri tayyor bo‘lganda `onUploaded` chaqiriladi. */
export function useUploader(assignmentId?: string) {
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState("");
  async function upload(files: File[], onUploaded: (file: FileMeta) => void) {
    setError("");
    for (const file of files) {
      if (file.size > MAX_FILE) {
        setError(`«${file.name}» 4 MB dan katta. Hajmini kichraytirib qayta yuklang.`);
        continue;
      }
      setBusy((n) => n + 1);
      try {
        const data = new FormData();
        data.append("file", file);
        if (assignmentId) data.append("assignmentId", assignmentId);
        onUploaded((await api<{ file: FileMeta }>("/api/files", { method: "POST", body: data })).file);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy((n) => n - 1);
      }
    }
  }
  return { busy: busy > 0, error, upload, clearError: () => setError("") };
}

export function FileDrop({
  onFiles,
  busy,
  title,
  hint,
  imagesOnly = false,
}: {
  onFiles: (files: File[]) => void;
  busy: boolean;
  title: string;
  hint: string;
  imagesOnly?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      className={`drop ${over ? "is-over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!busy && e.dataTransfer.files.length) onFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept={imagesOnly ? ".png,.jpg,.jpeg,.webp,.gif,.svg,.psd,.ai,.pdf,.zip" : ACCEPT}
        onChange={(e) => {
          if (e.target.files?.length) onFiles(Array.from(e.target.files));
          e.target.value = "";
        }}
      />
      <button type="button" className="drop-button" disabled={busy} onClick={() => input.current?.click()}>
        <span className="drop-icon">{busy ? <Spinner label="Yuklanmoqda" /> : <Paperclip size={19} strokeWidth={1.8} />}</span>
        <span className="drop-text">
          <strong>{busy ? "Yuklanmoqda…" : title}</strong>
          <small>{hint}</small>
        </span>
      </button>
    </div>
  );
}

function FileIcon({ file }: { file: FileMeta }) {
  if (file.mime.startsWith("image/")) return <FileImage size={19} strokeWidth={1.7} />;
  if (file.mime === "application/zip") return <FileArchive size={19} strokeWidth={1.7} />;
  return <FileText size={19} strokeWidth={1.7} />;
}

/** Rasmlar — galereya, qolganlari — ro‘yxat. */
export function Attachments({
  files,
  canRemove,
  onRemove,
}: {
  files: FileMeta[];
  canRemove?: (file: FileMeta) => boolean;
  onRemove?: (file: FileMeta) => void;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const images = files.filter(isImage);
  const docs = files.filter((f) => !isImage(f));
  if (!files.length) return null;
  return (
    <div className="attachments">
      {images.length > 0 && (
        <ul className="image-grid">
          {images.map((file, index) => (
            <li key={file.id} className="image-tile">
              <button type="button" className="image-open" onClick={() => setOpen(index)} aria-label={`${file.name} — kattalashtirish`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={file.url} alt={file.name} loading="lazy" />
              </button>
              {onRemove && canRemove?.(file) && (
                <button type="button" className="tile-remove" aria-label={`${file.name} — olib tashlash`} onClick={() => onRemove(file)}>
                  <X size={14} strokeWidth={2.4} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {docs.length > 0 && (
        <ul className="doc-list">
          {docs.map((file) => (
            <li key={file.id} className="doc-row">
              <span className="doc-icon">
                <FileIcon file={file} />
              </span>
              <span className="doc-meta">
                <strong>{file.name}</strong>
                <small>{fileSize(file.size)}</small>
              </span>
              {opensInBrowser(file) && (
                <a className="icon-button" href={file.url} target="_blank" rel="noopener" aria-label={`${file.name} — ochish`} title="Ochish">
                  <ExternalLink size={16} strokeWidth={1.8} />
                </a>
              )}
              <a className="icon-button" href={`${file.url}?download`} aria-label={`${file.name} — yuklab olish`} title="Yuklab olish">
                <Download size={16} strokeWidth={1.8} />
              </a>
              {onRemove && canRemove?.(file) && (
                <button type="button" className="icon-button is-danger" aria-label={`${file.name} — olib tashlash`} onClick={() => onRemove(file)}>
                  <Trash2 size={16} strokeWidth={1.8} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {open !== null && images[open] && (
        <Lightbox images={images} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}

function Lightbox({
  images,
  index,
  onIndex,
  onClose,
}: {
  images: FileMeta[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const file = images[index];
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") onIndex((index + 1) % images.length);
      if (e.key === "ArrowLeft") onIndex((index - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, images.length, onIndex]);
  return (
    <dialog
      ref={ref}
      className="lightbox"
      aria-label={file.name}
      onCancel={(e) => {
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="lightbox-bar">
        <span>
          {images.length > 1 && `${index + 1} / ${images.length} · `}
          {file.name}
        </span>
        <a className="icon-button" href={`${file.url}?download`} aria-label="Yuklab olish">
          <Download size={18} strokeWidth={1.8} />
        </a>
        <button type="button" className="icon-button" aria-label="Yopish" onClick={onClose}>
          <X size={19} strokeWidth={2} />
        </button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={file.id} className="lightbox-image" src={file.url} alt={file.name} />
      {images.length > 1 && (
        <>
          <button type="button" className="lightbox-nav is-prev" aria-label="Oldingi rasm" onClick={() => onIndex((index - 1 + images.length) % images.length)}>
            <ChevronLeft size={22} strokeWidth={2} />
          </button>
          <button type="button" className="lightbox-nav is-next" aria-label="Keyingi rasm" onClick={() => onIndex((index + 1) % images.length)}>
            <ChevronRight size={22} strokeWidth={2} />
          </button>
        </>
      )}
    </dialog>
  );
}
