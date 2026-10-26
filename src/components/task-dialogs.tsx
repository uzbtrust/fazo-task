"use client";
import { FormEvent, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCheck,
  CircleDashed,
  Clock3,
  MessageSquare,
  Send,
  UserRound,
  X,
  RotateCcw,
  Pencil,
  Paperclip,
} from "lucide-react";
import type { Attachment, Task, User, Priority } from "@/lib/types";
import {
  api,
  Avatar,
  Badge,
  categories,
  ErrorMessage,
  FileLinks,
  FilePicker,
  Modal,
  PriorityBadge,
  shortDate,
  Spinner,
  actionLabels,
} from "./ui";

export function TaskForm({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Task;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [priority, setPriority] = useState<Priority>(
    initial?.priority || "medium",
  );
  const [category, setCategory] = useState(initial?.category || categories[0]);
  const [dueDate, setDueDate] = useState(initial?.dueDate || "");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(initial ? `/api/tasks/${initial.id}` : "/api/tasks", {
        method: initial ? "PATCH" : "POST",
        body: JSON.stringify({
          ...(initial ? { action: "edit" } : {}),
          title,
          description,
          priority,
          category,
          dueDate: dueDate || null,
          fileIds: files.map((f) => f.id),
        }),
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={initial ? "Vazifani tahrirlash" : "Yangi vazifa"}
      eyebrow="YAXSHI ISH ANIQ VAZIFADAN BOSHLANADI"
      onClose={onClose}
    >
      <form onSubmit={save} className="form-stack task-form">
        <label>
          Vazifa nomi<span className="required">*</span>
          <input
            placeholder="Masalan, yangi kolleksiya uchun karusel"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={160}
            autoFocus
          />
        </label>
        <label>
          Vazifa
          <textarea
            placeholder="Nima qilish kerak? Maqsad, o‘lcham, uslub va kerakli tafsilotlarni yozing…"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={15000}
          />
        </label>
        {initial && <FileLinks files={initial.attachments} />}
        <FilePicker
          files={files}
          onChange={setFiles}
          busy={uploading}
          onBusy={setUploading}
        />
        <p className="field-note">
          Vazifani matn bilan tushuntiring yoki fayl biriktiring. Ikkalasini ham
          qo‘shish mumkin.
        </p>
        <div className="form-row">
          <label>
            Yo‘nalish
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Muhimlik
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
            >
              <option value="low">Past</option>
              <option value="medium">O‘rta</option>
              <option value="high">Yuqori</option>
            </select>
          </label>
        </div>
        <label>
          Topshirish muddati<span className="optional">ixtiyoriy</span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </label>
        <ErrorMessage message={error} />
        <div className="modal-footer">
          <span className="footer-note">
            <CircleDashed size={15} />
            Ochiq vazifalarda ko‘rinadi
          </span>
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
          >
            Bekor qilish
          </button>
          <button
            className="button button-primary"
            disabled={
              busy ||
              uploading ||
              (!description.trim() &&
                !files.length &&
                !initial?.attachments.length)
            }
          >
            {busy ? (
              <Spinner />
            ) : (
              <>
                {initial ? "Saqlash" : "Vazifani yaratish"}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function TaskDetail({
  task,
  user,
  users,
  onClose,
  onChanged,
  onEdit,
}: {
  task: Task;
  user: User;
  users: User[];
  onClose: () => void;
  onChanged: () => Promise<void>;
  onEdit: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<
    "submit" | "request_changes" | "cancel" | null
  >(null);
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [comment, setComment] = useState("");
  const [tab, setTab] = useState<"comments" | "activity">("comments");
  const creator = users.find((u) => u.id === task.creatorId);
  const assignee = users.find((u) => u.id === task.assigneeId);
  const isOwner =
    user.role === "admin" ||
    (user.role === "creator" && task.creatorId === user.id);
  const isAssignee = user.id === task.assigneeId;
  async function act(action: string) {
    setBusy(true);
    setError("");
    try {
      await api(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          action,
          message,
          fileIds: files.map((f) => f.id),
        }),
      });
      await onChanged();
      setMode(null);
      setMessage("");
      setFiles([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function addComment(e: FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/tasks/${task.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ message: comment }),
      });
      setComment("");
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function start(next: "submit" | "request_changes" | "cancel") {
    setMode(next);
    setError("");
    setMessage("");
    setFiles([]);
  }
  return (
    <Modal
      title={task.title}
      eyebrow={`FT–${String(task.number).padStart(3, "0")} · ${task.category}`}
      onClose={onClose}
      wide
    >
      <div className="detail-layout">
        <div className="detail-main">
          <div className="detail-badges">
            <Badge status={task.status} />
            <PriorityBadge priority={task.priority} />
          </div>
          <section className="detail-section">
            <h3>Vazifa</h3>
            {task.description ? (
              <p className="brief-text">{task.description}</p>
            ) : (
              <p className="muted">Topshiriq biriktirilgan faylda berilgan.</p>
            )}
            <FileLinks files={task.attachments} />
          </section>
          {(task.submissionText || task.deliveryAttachments.length > 0) && (
            <section className="detail-section submission-section">
              <div className="section-mini-title">
                <CheckCheck size={17} />
                <h3>Topshirilgan ish</h3>
              </div>
              {task.submissionText && (
                <p className="brief-text">{task.submissionText}</p>
              )}
              <FileLinks files={task.deliveryAttachments} />
            </section>
          )}
          {task.status === "approved" && (
            <div className="info-banner success-banner">
              <CheckCheck size={19} />
              <p>
                <strong>Kontent kreator ishni tasdiqladi.</strong>
                <span>
                  {isAssignee
                    ? "Endi yakunlash belgisini qo‘yishingiz mumkin."
                    : "Dizayner vazifani yakunlashi kutilmoqda."}
                </span>
              </p>
            </div>
          )}
          {mode && (
            <section className="action-composer">
              <div className="composer-heading">
                <h3>
                  {mode === "submit"
                    ? "Tayyor ishni topshirish"
                    : mode === "request_changes"
                      ? "Qanday tuzatish kerak?"
                      : "Vazifani bekor qilish"}
                </h3>
                <button
                  className="icon-button"
                  aria-label="Amalni bekor qilish"
                  onClick={() => setMode(null)}
                >
                  <X size={17} />
                </button>
              </div>
              {mode === "cancel" ? (
                <p>
                  Bu vazifa ochiq paneldan olinadi. Vazifa tarixi saqlanadi.
                </p>
              ) : (
                <>
                  <label className="sr-only" htmlFor="action-message">
                    {mode === "submit" ? "Ish haqida izoh" : "Tuzatish sababi"}
                  </label>
                  <textarea
                    id="action-message"
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={
                      mode === "submit"
                        ? "Tayyor ishga havola yoki qisqa izoh…"
                        : "Kerakli o‘zgarishlarni aniq yozing…"
                    }
                    maxLength={15000}
                  />
                  {mode === "submit" && (
                    <FilePicker
                      files={files}
                      onChange={setFiles}
                      busy={uploading}
                      onBusy={setUploading}
                    />
                  )}
                </>
              )}
              <button
                className={`button ${mode === "cancel" ? "button-danger" : "button-primary"}`}
                disabled={
                  busy ||
                  uploading ||
                  (mode === "request_changes" && !message.trim()) ||
                  (mode === "submit" && !message.trim() && !files.length)
                }
                onClick={() => act(mode)}
              >
                {busy ? (
                  <Spinner />
                ) : (
                  <>
                    {mode === "submit"
                      ? "Tekshiruvga yuborish"
                      : mode === "request_changes"
                        ? "Tuzatishga qaytarish"
                        : "Ha, bekor qilish"}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </section>
          )}
          <ErrorMessage message={error} />
          <div className="detail-actions">
            {user.role === "designer" && task.status === "open" && (
              <button
                className="button button-primary"
                onClick={() => act("claim")}
                disabled={busy}
              >
                {busy ? (
                  <Spinner />
                ) : (
                  <>
                    <PlusIcon />
                    Men qilaman
                  </>
                )}
              </button>
            )}
            {isAssignee && task.status === "in_progress" && (
              <>
                <button
                  className="button button-primary"
                  onClick={() => start("submit")}
                  disabled={busy}
                >
                  <ArrowUpRight size={17} />
                  Ishni topshirish
                </button>
                <button
                  className="button button-secondary"
                  onClick={() => act("release")}
                  disabled={busy}
                >
                  <RotateCcw size={15} />
                  Ochiq panelga qaytarish
                </button>
              </>
            )}
            {isOwner && task.status === "in_review" && (
              <>
                <button
                  className="button button-primary"
                  onClick={() => act("approve")}
                  disabled={busy}
                >
                  {busy ? (
                    <Spinner />
                  ) : (
                    <>
                      <Check size={18} />
                      Ishni tasdiqlash
                    </>
                  )}
                </button>
                <button
                  className="button button-secondary"
                  onClick={() => start("request_changes")}
                  disabled={busy}
                >
                  Tuzatishga qaytarish
                </button>
              </>
            )}
            {isAssignee && task.status === "approved" && (
              <button
                className="button button-primary"
                onClick={() => act("complete")}
                disabled={busy}
              >
                {busy ? (
                  <Spinner />
                ) : (
                  <>
                    <CheckCheck size={18} />
                    Vazifani yakunlash
                  </>
                )}
              </button>
            )}
            {isOwner && task.status === "open" && (
              <button className="button button-secondary" onClick={onEdit}>
                <Pencil size={15} />
                Tahrirlash
              </button>
            )}
            {isOwner && ["open", "in_progress"].includes(task.status) && (
              <button
                className="text-button muted"
                onClick={() => start("cancel")}
                disabled={busy}
              >
                Bekor qilish
              </button>
            )}
          </div>
          <section className="discussion">
            <div className="detail-tabs">
              <button
                className={tab === "comments" ? "active" : ""}
                onClick={() => setTab("comments")}
              >
                <MessageSquare size={15} />
                Izohlar<span>{task.comments.length}</span>
              </button>
              <button
                className={tab === "activity" ? "active" : ""}
                onClick={() => setTab("activity")}
              >
                <Clock3 size={15} />
                Faollik tarixi
              </button>
            </div>
            {tab === "comments" ? (
              <>
                <div className="comments-list">
                  {task.comments.length ? (
                    task.comments.map((c) => (
                      <article className="comment" key={c.id}>
                        <Avatar name={c.userName} small />
                        <div>
                          <header>
                            <strong>{c.userName}</strong>
                            <time>{shortDate(c.createdAt, true)}</time>
                          </header>
                          <p>{c.message}</p>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="quiet-empty">
                      Hozircha izoh yo‘q. Muhokamani boshlang.
                    </p>
                  )}
                </div>
                <form className="comment-form" onSubmit={addComment}>
                  <Avatar name={user.name} small />
                  <label className="sr-only" htmlFor="comment-input">
                    Izoh yozish
                  </label>
                  <input
                    id="comment-input"
                    placeholder="Izoh yozing…"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    maxLength={3000}
                    required
                  />
                  <button
                    className="icon-button"
                    aria-label="Izohni yuborish"
                    disabled={busy || !comment.trim()}
                  >
                    {busy ? <Spinner /> : <Send size={18} />}
                  </button>
                </form>
              </>
            ) : (
              <div className="activity-list">
                {task.activity.length ? (
                  task.activity.map((a) => (
                    <div className="activity-item" key={a.id}>
                      <span className="activity-point" />
                      <div>
                        <p>
                          <strong>{a.userName}</strong>{" "}
                          {actionLabels[a.action] || a.action}
                        </p>
                        {a.message && (
                          <p className="activity-message">{a.message}</p>
                        )}
                        <time>{shortDate(a.createdAt, true)}</time>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="quiet-empty">
                    Vazifa faolligi shu yerda ko‘rinadi.
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
        <aside className="detail-aside">
          <h3>Tafsilotlar</h3>
          <div className="detail-property">
            <span>
              <UserRound size={15} />
              Dizayner
            </span>
            {assignee ? (
              <span className="person-line">
                <Avatar name={assignee.name} small />
                {assignee.name}
              </span>
            ) : (
              <span className="unassigned">Hali biriktirilmagan</span>
            )}
          </div>
          <div className="detail-property">
            <span>
              <CalendarDays size={15} />
              Topshirish muddati
            </span>
            <strong>{shortDate(task.dueDate)}</strong>
          </div>
          <div className="detail-property">
            <span>
              <UserRound size={15} />
              Vazifa muallifi
            </span>
            <span className="person-line">
              <Avatar name={creator?.name || "Jamoa"} small />
              {creator?.name || "Jamoa a’zosi"}
            </span>
          </div>
          <div className="detail-property">
            <span>
              <Clock3 size={15} />
              Yaratilgan sana
            </span>
            <strong>{shortDate(task.createdAt)}</strong>
          </div>
          <div className="detail-flow">
            <span className="eyebrow">ISH OQIMI</span>
            {(
              [
                "open",
                "in_progress",
                "in_review",
                "approved",
                "completed",
              ] as const
            ).map((s, i) => {
              const index = [
                "open",
                "in_progress",
                "in_review",
                "approved",
                "completed",
              ].indexOf(task.status);
              return (
                <div key={s} className={index >= i ? "done" : ""}>
                  <span>{index > i ? <Check size={11} /> : i + 1}</span>
                  {
                    [
                      "Ochiq vazifa",
                      "Dizayner ishlaydi",
                      "Kreator tekshiradi",
                      "Ish tasdiqlanadi",
                      "Dizayner yakunlaydi",
                    ][i]
                  }
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </Modal>
  );
}
function PlusIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
