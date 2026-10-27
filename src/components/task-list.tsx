"use client";
import { CalendarDays, ChevronRight, Images } from "lucide-react";
import type { Task } from "@/lib/types";
import { Avatar, dueLabel, StatusGlyph, statusLabels, Stars } from "./ui";
import { warmTask } from "./files";
import { REVIEW_STEP } from "@/lib/workflow";

/** Qaytarilgan vazifa: ish jarayonida, oxirgi PM javobi — «qaytarish». */
export function returnNote(task: Task) {
  if (task.status !== "in_progress") return null;
  const last = [...task.events].reverse().find((e) => ["return", "submit", "start"].includes(e.action));
  return last?.action === "return" ? last : null;
}

export function sortTasks(a: Task, b: Task) {
  if (a.status === "done" && b.status === "done")
    return (b.completedAt || "").localeCompare(a.completedAt || "");
  const ad = a.dueDate || "9999-12-31";
  const bd = b.dueDate || "9999-12-31";
  if (ad !== bd) return ad.localeCompare(bd);
  if ((a.priority || 0) !== (b.priority || 0)) return (b.priority || 0) - (a.priority || 0);
  return b.number - a.number;
}

export function TaskRow({
  task,
  onOpen,
  person,
}: {
  task: Task;
  onOpen: (task: Task) => void;
  /** Qatorda kim ko‘rsatiladi: PMga — dizayner, dizaynerga — PM. */
  person?: "assignee" | "creator";
}) {
  const due = task.dueDate ? dueLabel(task.dueDate, task.status) : null;
  const snippet = task.brief.split("\n").find((line) => line.trim());
  const returned = returnNote(task);
  const name = person === "creator" ? task.creatorName : task.assigneeName;
  const showPerson = person && name;
  const uploaded = task.resultFiles.length;
  const showProgress = task.status !== "todo" && (REVIEW_STEP || uploaded > 0);
  return (
    <li className={`task-row is-${task.status}`}>
      <span className="row-glyph">
        <StatusGlyph status={task.status} />
      </span>
      <button
        type="button"
        className="row-open"
        onClick={() => onOpen(task)}
        onPointerEnter={() => warmTask(task)}
        onFocus={() => warmTask(task)}
      >
        <span className="row-main">
          <span className="row-title">{task.title}</span>
          {returned ? (
            <span className="row-desc is-returned">Qaytarildi: {returned.message}</span>
          ) : (
            snippet && <span className="row-desc">{snippet}</span>
          )}
          <span className="sr-only">Holat: {statusLabels[task.status]}.</span>
        </span>
        <span className="row-meta">
          <Stars value={task.priority} />
          {/* Yuklash ixtiyoriy bo‘lganda «0/1» chalg‘itadi — faqat kerakli rasm soni ko‘rsatiladi. */}
          {showProgress ? (
            <span className={`count-chip ${uploaded >= task.imageCount ? "is-full" : ""}`} title="Yuklangan / kerakli rasmlar">
              <Images size={13} strokeWidth={1.8} aria-hidden="true" />
              {uploaded}/{task.imageCount}
            </span>
          ) : (
            <span className="count-chip" title="Kerakli rasmlar soni">
              <Images size={13} strokeWidth={1.8} aria-hidden="true" />
              {task.imageCount} ta
            </span>
          )}
          {due && (
            <span className={`due due-${due.tone || "plain"}`}>
              <CalendarDays size={13} strokeWidth={1.8} aria-hidden="true" />
              {due.text}
            </span>
          )}
          {person === "assignee" && !name && <span className="tag">Hech kim olmagan</span>}
          {showPerson && (
            <span className="person-chip">
              <Avatar name={name} size="sm" />
              <span>{name}</span>
            </span>
          )}
        </span>
        <ChevronRight className="row-chevron" size={16} strokeWidth={2} aria-hidden="true" />
      </button>
    </li>
  );
}

export function TaskGroups({
  groups,
  onOpen,
  person,
}: {
  groups: { key: string; title: string; hint?: string; items: Task[] }[];
  onOpen: (task: Task) => void;
  person?: "assignee" | "creator";
}) {
  return (
    <div className="groups">
      {groups
        .filter((g) => g.items.length)
        .map((group) => (
          <section key={group.key} className="group" aria-label={group.title}>
            <h2 className="group-head">
              {group.title}
              <span className="group-count">{group.items.length}</span>
              {group.hint && <span className="group-hint">{group.hint}</span>}
            </h2>
            <ul className="inset-list">
              {group.items.map((task) => (
                <TaskRow key={task.id} task={task} onOpen={onOpen} person={person} />
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}

/** Bugun (Toshkent vaqti) tugatilgan vazifalar va ulardagi dizaynlar. */
export function doneToday(tasks: Task[], today: string) {
  const done = tasks.filter(
    (t) =>
      t.status === "done" &&
      t.completedAt &&
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date(t.completedAt)) === today,
  );
  return { tasks: done.length, images: done.reduce((sum, t) => sum + t.imageCount, 0) };
}
