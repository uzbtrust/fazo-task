"use client";
import { CalendarDays, ChevronRight } from "lucide-react";
import type { Task, TaskStatus } from "@/lib/types";
import {
  Avatar,
  dueLabel,
  nextStatus,
  nextStatusAction,
  PriorityTag,
  statusLabels,
} from "./ui";

export function sortTasks(a: Task, b: Task) {
  if (a.status === "done" && b.status === "done")
    return (b.completedAt || "").localeCompare(a.completedAt || "");
  if (a.priority !== b.priority) return b.priority - a.priority;
  const ad = a.dueDate || "9999-12-31";
  const bd = b.dueDate || "9999-12-31";
  if (ad !== bd) return ad.localeCompare(bd);
  return b.number - a.number;
}

export function StatusCheck({
  task,
  onToggle,
}: {
  task: Task;
  onToggle: (task: Task, status: TaskStatus) => void;
}) {
  return (
    <button
      type="button"
      className={`check check-${task.status}`}
      aria-label={`«${task.title}» — ${nextStatusAction[task.status]}`}
      title={nextStatusAction[task.status]}
      onClick={() => onToggle(task, nextStatus[task.status])}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle className="check-ring" cx="12" cy="12" r="10" />
        <path className="check-half" d="M12 5.5a6.5 6.5 0 0 0 0 13Z" />
        <circle className="check-fill" cx="12" cy="12" r="10" />
        <path className="check-mark" d="m7.6 12.3 3 3 5.8-6.3" />
      </svg>
    </button>
  );
}

export function TaskRow({
  task,
  onOpen,
  onToggle,
  showAssignee = true,
}: {
  task: Task;
  onOpen: (task: Task) => void;
  onToggle: (task: Task, status: TaskStatus) => void;
  showAssignee?: boolean;
}) {
  const due = task.dueDate ? dueLabel(task.dueDate, task.status) : null;
  const snippet = task.description.split("\n").find((line) => line.trim());
  return (
    <li className={`task-row is-${task.status}`}>
      <StatusCheck task={task} onToggle={onToggle} />
      <button type="button" className="row-open" onClick={() => onOpen(task)}>
        <span className="row-main">
          <span className="row-title">{task.title}</span>
          {snippet && <span className="row-desc">{snippet}</span>}
          <span className="sr-only">Holat: {statusLabels[task.status]}.</span>
        </span>
        <span className="row-meta">
          <PriorityTag priority={task.priority} quiet />
          {due && (
            <span className={`due due-${due.tone || "plain"}`}>
              <CalendarDays size={13} strokeWidth={1.8} aria-hidden="true" />
              {due.text}
            </span>
          )}
          {showAssignee && (
            <span className="person-chip">
              <Avatar name={task.assigneeName} size="sm" />
              <span>{task.assigneeName}</span>
            </span>
          )}
        </span>
        <ChevronRight className="row-chevron" size={16} strokeWidth={2} aria-hidden="true" />
      </button>
    </li>
  );
}
