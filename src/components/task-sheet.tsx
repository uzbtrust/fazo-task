"use client";
import { useState } from "react";
import { ArrowRight, Ban, Check, CornerUpLeft, Hand, Pencil, RotateCcw, Trash2, Undo2 } from "lucide-react";
import type { Account, FileMeta, Task } from "@/lib/types";
import { REVIEW_STEP } from "@/lib/workflow";
import {
  api,
  Avatar,
  ConfirmDialog,
  dateTime,
  dueLabel,
  ErrorMessage,
  longDate,
  Modal,
  Spinner,
  STATUS_ORDER,
  statusLabels,
  Stars,
} from "./ui";
import { Attachments, FileDrop, isImage, LinkCards, useUploader } from "./files";
import { returnNote } from "./task-list";
import { useToast } from "./shell";

const eventLabels: Record<string, string> = {
  created: "vazifani qo‘ydi",
  edited: "vazifani tahrirladi",
  claim: "vazifani oldi",
  release: "ochiq vazifalarga qaytardi",
  complete: "ishni tugatdi",
  cancel: "vazifani bekor qildi",
  reopen: "vazifani qayta ochdi",
  submit: "tekshiruvga topshirdi",
  return: "qayta ishlashga qaytardi",
  accept: "ishni qabul qildi",
};

type Composer = "complete" | "submit" | "return" | "cancel";
const composerText: Record<Composer, { label: string; placeholder: string; button: string; done: string; required?: boolean }> = {
  complete: {
    label: "Izoh yoki havola",
    placeholder: "Ixtiyoriy: Figma havolasi yoki qisqa izoh",
    button: "Tugatildi deb belgilash",
    done: "Vazifa bajarildi",
  },
  submit: {
    label: "Izoh yoki havola",
    placeholder: "Ixtiyoriy: Figma havolasi yoki qisqa izoh",
    button: "Yuborish",
    done: "Ish tekshiruvga yuborildi",
  },
  return: {
    label: "Nimani tuzatish kerak?",
    placeholder: "Aniq yozing: qaysi rasm, nima o‘zgarsin",
    button: "Qaytarish",
    done: "Vazifa qayta ishlashga qaytarildi",
    required: true,
  },
  cancel: {
    label: "Bekor qilish sababi",
    placeholder: "Ixtiyoriy: nega bekor qilinyapti",
    button: "Vazifani bekor qilish",
    done: "Vazifa bekor qilindi",
  },
};

export function TaskSheet({
  task,
  account,
  onClose,
  onUpdated,
  onEdit,
  onDeleted,
}: {
  task: Task;
  account: Account;
  onClose: () => void;
  onUpdated: (task: Task) => void;
  onEdit?: () => void;
  onDeleted?: () => void;
}) {
  const notify = useToast();
  const [composer, setComposer] = useState<Composer | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<"delete" | "release" | null>(null);
  const uploader = useUploader(task.id);
  const isPm = account.role === "pm";
  const isDesigner = account.role === "designer" && task.assigneeId === account.id;
  const isOpen = task.status === "todo" && !task.assigneeId;
  const canClaim = account.role === "designer" && isOpen;
  const canRelease = task.status === "in_progress" && (isPm || isDesigner);
  const canCancel = isPm && ["todo", "in_progress", "in_review"].includes(task.status);
  const canUpload = isDesigner && task.status === "in_progress";
  const due = task.dueDate ? dueLabel(task.dueDate, task.status) : null;
  const returned = returnNote(task);
  const cancelled = task.status === "cancelled" ? [...task.events].reverse().find((e) => e.action === "cancel") : null;
  const images = task.resultFiles.filter(isImage).length;
  const step = STATUS_ORDER.indexOf(task.status);

  async function act(action: string, done: string) {
    setBusy(true);
    setError("");
    try {
      const data = await api<{ task: Task }>(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action, message }),
      });
      onUpdated(data.task);
      setComposer(null);
      setMessage("");
      notify(done);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function open(next: Composer) {
    setComposer(next);
    setMessage("");
    setError("");
  }
  async function removeResult(file: FileMeta) {
    try {
      await api(`/api/files/${file.id}`, { method: "DELETE" });
      onUpdated({ ...task, resultFiles: task.resultFiles.filter((f) => f.id !== file.id) });
    } catch (e) {
      notify({ message: (e as Error).message, tone: "error" });
    }
  }

  // O‘ng tomondagi asosiy amal(lar).
  const primary = (() => {
    if (composer) return null;
    if (canClaim)
      return (
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void act("claim", "Vazifa sizniki — omad!")}>
          {busy ? <Spinner /> : <><Hand size={16} strokeWidth={2} aria-hidden="true" />Men olaman</>}
        </button>
      );
    if (isDesigner && task.status === "in_progress")
      return REVIEW_STEP ? (
        <button type="button" className="btn btn-primary" onClick={() => open("submit")}>
          Tekshiruvga topshirish
          <ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" />
        </button>
      ) : (
        <button type="button" className="btn btn-primary" onClick={() => open("complete")}>
          <Check size={16} strokeWidth={2.4} aria-hidden="true" />
          Tugatdim
        </button>
      );
    if (isPm) {
      return (
        <>
          {onEdit && (
            <button type="button" className="btn btn-secondary" onClick={onEdit}>
              <Pencil size={15} strokeWidth={1.9} aria-hidden="true" />
              Tahrirlash
            </button>
          )}
          {task.status === "cancelled" && (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void act("reopen", "Vazifa yana ochiq vazifalarda")}>
              {busy ? <Spinner /> : <><RotateCcw size={15} strokeWidth={2} aria-hidden="true" />Qayta ochish</>}
            </button>
          )}
          {REVIEW_STEP && task.status === "in_review" && (
            <>
              <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => open("return")}>
                <CornerUpLeft size={15} strokeWidth={2} aria-hidden="true" />
                Qaytarish
              </button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void act("accept", "Ish qabul qilindi")}>
                {busy ? <Spinner /> : <><Check size={16} strokeWidth={2.4} aria-hidden="true" />Qabul qilish</>}
              </button>
            </>
          )}
        </>
      );
    }
    return null;
  })();

  const note =
    task.status === "done"
      ? `Bajarilgan · ${task.completedAt ? longDate(task.completedAt) : ""}`
      : task.status === "cancelled"
        ? "Bekor qilingan"
        : task.status === "in_review"
          ? "Tekshiruvda"
          : task.status === "todo"
            ? "Dizaynerlar uchun ochiq"
            : "Dizayner ishlamoqda";

  return (
    <>
      <Modal title={task.title} eyebrow={`Vazifa · #${String(task.number).padStart(3, "0")}`} onClose={onClose} size="lg">
        <div className="sheet-body">
          <ol className={`steps ${task.status === "cancelled" ? "is-cancelled" : ""}`} style={{ gridTemplateColumns: `repeat(${STATUS_ORDER.length}, 1fr)` }} aria-label="Vazifa bosqichi">
            {STATUS_ORDER.map((status, index) => (
              <li
                key={status}
                className={index < step ? "is-done" : index === step ? "is-current" : ""}
                aria-current={index === step ? "step" : undefined}
              >
                <span className="step-dot">{index < step || task.status === "done" ? <Check size={11} strokeWidth={3} /> : index + 1}</span>
                <span className="step-label">{statusLabels[status]}</span>
              </li>
            ))}
          </ol>

          {task.status === "cancelled" && (
            <div className="notice is-warn" role="note">
              <Ban size={17} strokeWidth={2} aria-hidden="true" />
              <p>
                <strong>{cancelled ? `${cancelled.memberName} bekor qildi` : "Vazifa bekor qilingan"}</strong>
                {cancelled?.message ? `: ${cancelled.message}` : "."}
              </p>
            </div>
          )}
          {returned && (
            <div className="notice is-warn" role="note">
              <CornerUpLeft size={17} strokeWidth={2} aria-hidden="true" />
              <p>
                <strong>{returned.memberName} qaytardi:</strong> {returned.message}
              </p>
            </div>
          )}
          {task.status === "in_review" && isDesigner && (
            <div className="notice" role="note">
              <p>Ish topshirildi. Project manager tekshirmoqda.</p>
            </div>
          )}

          <dl className="props">
            <div className="prop">
              <dt>Dizayner</dt>
              {task.assigneeName ? (
                <dd className="prop-person"><Avatar name={task.assigneeName} size="sm" />{task.assigneeName}</dd>
              ) : (
                <dd className="tone-muted">Hali hech kim olmagan</dd>
              )}
            </div>
            <div className="prop">
              <dt>Qo‘ygan</dt>
              <dd className="prop-person"><Avatar name={task.creatorName} size="sm" />{task.creatorName}</dd>
            </div>
            <div className="prop">
              <dt>Rasmlar</dt>
              <dd>{task.imageCount} ta</dd>
            </div>
            <div className="prop">
              <dt>Muddat</dt>
              <dd className={due?.tone ? `tone-${due.tone}` : ""}>
                {task.dueDate ? `${longDate(task.dueDate)}${due?.tone ? ` · ${due.text}` : ""}` : "Belgilanmagan"}
              </dd>
            </div>
            <div className="prop">
              <dt>Muhimlik</dt>
              <dd>{task.priority ? <Stars value={task.priority} /> : "Belgilanmagan"}</dd>
            </div>
          </dl>

          <section className="sheet-section">
            <h3 className="sheet-section-title">TZ</h3>
            {task.brief && <p className="sheet-text">{task.brief}</p>}
            <Attachments files={task.briefFiles} />
          </section>

          {(task.referenceFiles.length > 0 || task.links.length > 0) && (
            <section className="sheet-section">
              <h3 className="sheet-section-title">Referenslar</h3>
              <Attachments files={task.referenceFiles} layout="board" />
              <LinkCards links={task.links} />
            </section>
          )}

          {(canUpload || task.resultFiles.length > 0 || task.resultNote) && (
            <section className="sheet-section">
              <h3 className="sheet-section-title">
                Natija
                <span className={`count-chip ${images >= task.imageCount ? "is-full" : ""}`}>
                  {images} / {task.imageCount} rasm
                </span>
              </h3>
              {canUpload && (
                <>
                  {!REVIEW_STEP && (
                    <p className="field-hint">Ixtiyoriy. Hozircha ish PMga og‘zaki ko‘rsatiladi, xohlasangiz rasmlarni shu yerga ham yuklang.</p>
                  )}
                  <FileDrop
                    busy={uploader.busy}
                    imagesOnly
                    title="Tayyor rasmlarni yuklash"
                    hint="PNG, JPG, WEBP yoki manba fayl · har biri 4 MB gacha"
                    onFiles={(list) => {
                      let current = task.resultFiles;
                      void uploader.upload(list, (file) => {
                        current = [...current, file];
                        onUpdated({ ...task, resultFiles: current });
                      });
                    }}
                  />
                </>
              )}
              <ErrorMessage message={uploader.error} />
              <Attachments
                files={task.resultFiles}
                canRemove={(file) => canUpload && file.ownerId === account.id}
                onRemove={(file) => void removeResult(file)}
              />
              {task.resultNote && (
                <p className="sheet-quote">
                  <span>Dizayner izohi</span>
                  {task.resultNote}
                </p>
              )}
            </section>
          )}

          {composer && (
            <section className="composer">
              {composer === "complete" && (
                <p className="field-hint">Ishni PMga ko‘rsatib, kelishib olgan bo‘lsangiz — tugatildi deb belgilang.</p>
              )}
              <label className="field">
                <span className="field-label">
                  {composerText[composer].label}
                  {!composerText[composer].required && <span className="optional">ixtiyoriy</span>}
                </span>
                <textarea
                  className="input"
                  rows={3}
                  autoFocus
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={5000}
                  placeholder={composerText[composer].placeholder}
                />
              </label>
              {composer === "submit" && images < task.imageCount && (
                <p className="field-hint tone-warn">
                  {task.imageCount} ta rasm kerak, {images} tasi yuklangan.
                </p>
              )}
              <div className="composer-actions">
                <button type="button" className="btn btn-quiet" onClick={() => setComposer(null)} disabled={busy}>
                  Orqaga
                </button>
                <button
                  type="button"
                  className={`btn ${composer === "cancel" ? "btn-danger" : "btn-primary"}`}
                  disabled={
                    busy ||
                    uploader.busy ||
                    (composerText[composer].required && !message.trim()) ||
                    (composer === "submit" && !task.resultFiles.length && !message.trim())
                  }
                  onClick={() => void act(composer, composerText[composer].done)}
                >
                  {busy ? <Spinner /> : composerText[composer].button}
                </button>
              </div>
            </section>
          )}
          <ErrorMessage message={error} />

          {task.events.length > 0 && (
            <section className="sheet-section">
              <h3 className="sheet-section-title">Tarix</h3>
              <ol className="timeline">
                {[...task.events].reverse().map((event) => (
                  <li key={event.id}>
                    <span className="timeline-dot" aria-hidden="true" />
                    <p>
                      <strong>{event.memberName}</strong> {eventLabels[event.action] || event.action}
                      <time>{dateTime(event.createdAt)}</time>
                    </p>
                    {event.message && <p className="timeline-message">{event.message}</p>}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
        <div className="sheet-foot">
          {isPm && (
            <button type="button" className="btn-text is-danger" onClick={() => setConfirm("delete")}>
              <Trash2 size={15} strokeWidth={1.9} aria-hidden="true" />
              O‘chirish
            </button>
          )}
          {canCancel && !composer && (
            <button type="button" className="btn-text is-danger" onClick={() => open("cancel")}>
              <Ban size={15} strokeWidth={1.9} aria-hidden="true" />
              Bekor qilish
            </button>
          )}
          {canRelease && !composer && (
            <button type="button" className="btn-text" onClick={() => setConfirm("release")}>
              <Undo2 size={15} strokeWidth={1.9} aria-hidden="true" />
              {isPm ? "Ochiqqa qaytarish" : "Bo‘shatish"}
            </button>
          )}
          <span className="spacer" />
          {primary || (!composer && <span className="sheet-foot-note">{note}</span>)}
        </div>
      </Modal>
      {confirm === "delete" && (
        <ConfirmDialog
          title="Vazifani o‘chirasizmi?"
          message={
            <>
              <strong>{task.title}</strong>, uning TZ va natija fayllari butunlay o‘chiriladi va statistikaga
              kirmaydi. Faqat to‘xtatish kerak bo‘lsa, «Bekor qilish»ni tanlang.
            </>
          }
          confirmLabel="O‘chirish"
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await api(`/api/tasks/${task.id}`, { method: "DELETE" });
            setConfirm(null);
            onDeleted?.();
          }}
        />
      )}
      {confirm === "release" && (
        <ConfirmDialog
          title={isPm ? "Ochiq vazifalarga qaytarasizmi?" : "Vazifani bo‘shatasizmi?"}
          message={
            <>
              <strong>{task.title}</strong> yana ochiq vazifalarga chiqadi va boshqa dizayner olishi mumkin.
              {task.resultFiles.length > 0 && " Yuklangan rasmlar o‘chiriladi."}
            </>
          }
          confirmLabel={isPm ? "Qaytarish" : "Bo‘shatish"}
          danger={task.resultFiles.length > 0}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            const data = await api<{ task: Task }>(`/api/tasks/${task.id}`, {
              method: "PATCH",
              body: JSON.stringify({ action: "release" }),
            });
            setConfirm(null);
            onUpdated(data.task);
            notify("Vazifa ochiq vazifalarga qaytdi");
          }}
        />
      )}
    </>
  );
}
