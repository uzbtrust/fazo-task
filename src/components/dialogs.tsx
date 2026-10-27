"use client";
import { FormEvent, useId, useState, type ReactNode } from "react";
import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import type { Account, Employee, Priority, Task, TaskStatus } from "@/lib/types";
import {
  addDaysISO,
  api,
  Avatar,
  dueLabel,
  ErrorMessage,
  longDate,
  Modal,
  priorityLabels,
  PriorityTag,
  Segmented,
  Spinner,
  statusLabels,
  todayISO,
} from "./ui";
import { sortTasks, TaskRow } from "./task-list";
import { employeeStats } from "./team-view";

const taskNumber = (task: Task) => `#${String(task.number).padStart(3, "0")}`;

export function TaskForm({
  task,
  employees,
  defaultAssignee,
  onClose,
  onSaved,
}: {
  task?: Task;
  employees: Employee[];
  defaultAssignee?: string;
  onClose: () => void;
  onSaved: (task: Task) => void;
}) {
  const formId = useId();
  const dateId = useId();
  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [assigneeId, setAssigneeId] = useState(
    task?.assigneeId || defaultAssignee || employees[0]?.id || "",
  );
  const [dueDate, setDueDate] = useState(task?.dueDate || "");
  const [priority, setPriority] = useState<Priority>(task?.priority || 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // O‘chirilgan hodimning bajarilgan vazifasi tahrirlanganda ismi yo‘qolmasin.
  const options =
    task && !employees.some((e) => e.id === task.assigneeId)
      ? [{ id: task.assigneeId, name: `${task.assigneeName} (o‘chirilgan)` }, ...employees]
      : employees;
  const quick = [
    { label: "Bugun", value: todayISO() },
    { label: "Ertaga", value: addDaysISO(1) },
    { label: "1 hafta", value: addDaysISO(7) },
    { label: "Muddatsiz", value: "" },
  ];
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api<{ task: Task }>(
        task ? `/api/tasks/${task.id}` : "/api/tasks",
        {
          method: task ? "PATCH" : "POST",
          body: JSON.stringify({
            title,
            description,
            assigneeId,
            priority,
            dueDate: dueDate || null,
          }),
        },
      );
      onSaved(data.task);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <Modal
      title={task ? "Vazifani tahrirlash" : "Vazifa belgilash"}
      eyebrow={task ? `Vazifa · ${taskNumber(task)}` : "Yangi vazifa"}
      onClose={onClose}
    >
      <form id={formId} className="sheet-body form" onSubmit={save}>
        <label className="field">
          <span className="field-label">Vazifa</span>
          <input
            className="input input-lg"
            placeholder="Masalan, yangi kolleksiya uchun 5 ta post"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={160}
            autoFocus
          />
        </label>
        <label className="field">
          <span className="field-label">
            Tavsif <span className="optional">ixtiyoriy</span>
          </span>
          <textarea
            className="input"
            rows={4}
            placeholder="Nima qilish kerak? Maqsad, o‘lcham, havolalar…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={20000}
          />
        </label>
        <label className="field">
          <span className="field-label">Hodim</span>
          <span className="select-wrap">
            <select
              className="input"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              required
            >
              {options.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
          </span>
        </label>
        <div className="field">
          <label className="field-label" htmlFor={dateId}>
            Muddat <span className="optional">ixtiyoriy</span>
          </label>
          <div className="date-row">
            <input
              id={dateId}
              className="input date-input"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <div className="quick-dates" role="group" aria-label="Tezkor muddat">
              {quick.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  className={`chip-button ${dueDate === q.value ? "is-on" : ""}`}
                  aria-pressed={dueDate === q.value}
                  onClick={() => setDueDate(q.value)}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="field">
          <span className="field-label">Muhimlik</span>
          <Segmented
            label="Muhimlik"
            className="segmented-block"
            value={String(priority)}
            onChange={(v) => setPriority(Number(v) as Priority)}
            options={([1, 2, 3] as Priority[]).map((p) => ({
              value: String(p),
              label: priorityLabels[p],
            }))}
          />
        </div>
        <ErrorMessage message={error} />
      </form>
      <div className="sheet-foot">
        <button type="button" className="btn btn-quiet" onClick={onClose}>
          Bekor qilish
        </button>
        <button
          type="submit"
          form={formId}
          className="btn btn-primary"
          disabled={busy || !title.trim() || !assigneeId}
        >
          {busy ? <Spinner label="Saqlanmoqda" /> : task ? "Saqlash" : "Belgilash"}
        </button>
      </div>
    </Modal>
  );
}

export function TaskSheet({
  task,
  onClose,
  onEdit,
  onStatus,
  onDelete,
}: {
  task: Task;
  onClose: () => void;
  onEdit: () => void;
  onStatus: (task: Task, status: TaskStatus) => void;
  onDelete: (task: Task) => Promise<void>;
}) {
  const [confirm, setConfirm] = useState(false);
  const due = task.dueDate ? dueLabel(task.dueDate, task.status) : null;
  return (
    <>
      <Modal title={task.title} eyebrow={`Vazifa · ${taskNumber(task)}`} onClose={onClose}>
        <div className="sheet-body">
          <Segmented<TaskStatus>
            label="Vazifa holati"
            className="segmented-block"
            value={task.status}
            onChange={(status) => onStatus(task, status)}
            options={(["todo", "in_progress", "done"] as TaskStatus[]).map((s) => ({
              value: s,
              label: statusLabels[s],
            }))}
          />
          {task.description ? (
            <p className="sheet-text">{task.description}</p>
          ) : (
            <p className="sheet-text is-muted">Tavsif qo‘shilmagan.</p>
          )}
          <dl className="props">
            <div className="prop">
              <dt>Hodim</dt>
              <dd className="prop-person">
                <Avatar name={task.assigneeName} size="sm" />
                {task.assigneeName}
              </dd>
            </div>
            <div className="prop">
              <dt>Muddat</dt>
              <dd className={due?.tone ? `tone-${due.tone}` : ""}>
                {task.dueDate
                  ? `${longDate(task.dueDate)}${due && due.tone ? ` · ${due.text}` : ""}`
                  : "Belgilanmagan"}
              </dd>
            </div>
            <div className="prop">
              <dt>Muhimlik</dt>
              <dd>
                <PriorityTag priority={task.priority} />
              </dd>
            </div>
            <div className="prop">
              <dt>Belgilangan</dt>
              <dd>{longDate(task.createdAt)}</dd>
            </div>
            {task.completedAt && (
              <div className="prop">
                <dt>Bajarilgan</dt>
                <dd>{longDate(task.completedAt)}</dd>
              </div>
            )}
          </dl>
        </div>
        <div className="sheet-foot">
          <button type="button" className="btn-text is-danger" onClick={() => setConfirm(true)}>
            <Trash2 size={15} strokeWidth={1.9} aria-hidden="true" />
            O‘chirish
          </button>
          <span className="spacer" />
          <button type="button" className="btn btn-secondary" onClick={onEdit}>
            <Pencil size={15} strokeWidth={1.9} aria-hidden="true" />
            Tahrirlash
          </button>
        </div>
      </Modal>
      {confirm && (
        <ConfirmDialog
          title="Vazifani o‘chirasizmi?"
          message={
            <>
              <strong>{task.title}</strong> butunlay o‘chiriladi. Bu amalni qaytarib bo‘lmaydi.
            </>
          }
          confirmLabel="O‘chirish"
          onClose={() => setConfirm(false)}
          onConfirm={() => onDelete(task)}
        />
      )}
    </>
  );
}

export function EmployeeForm({
  employee,
  onClose,
  onSaved,
}: {
  employee?: Employee;
  onClose: () => void;
  onSaved: (employee: Employee) => void;
}) {
  const formId = useId();
  const listId = useId();
  const [name, setName] = useState(employee?.name || "");
  const [position, setPosition] = useState(employee?.position || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api<{ employee: Employee }>(
        employee ? `/api/employees/${employee.id}` : "/api/employees",
        {
          method: employee ? "PATCH" : "POST",
          body: JSON.stringify({ name, position }),
        },
      );
      onSaved(data.employee);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <Modal
      title={employee ? "Hodimni tahrirlash" : "Hodim qo‘shish"}
      eyebrow="Jamoa"
      onClose={onClose}
      size="sm"
    >
      <form id={formId} className="sheet-body form" onSubmit={save}>
        <label className="field">
          <span className="field-label">Ism va familiya</span>
          <input
            className="input input-lg"
            placeholder="Masalan, Dilnoza Karimova"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
            autoFocus
            autoComplete="off"
          />
        </label>
        <label className="field">
          <span className="field-label">
            Lavozim <span className="optional">ixtiyoriy</span>
          </span>
          <input
            className="input"
            placeholder="Masalan, dizayner"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            maxLength={80}
            list={listId}
            autoComplete="off"
          />
          <datalist id={listId}>
            {["Dizayner", "Kontent kreator", "SMM mutaxassisi", "Videograf", "Kopirayter", "Menejer"].map(
              (p) => (
                <option key={p} value={p} />
              ),
            )}
          </datalist>
        </label>
        <ErrorMessage message={error} />
      </form>
      <div className="sheet-foot">
        <button type="button" className="btn btn-quiet" onClick={onClose}>
          Bekor qilish
        </button>
        <button
          type="submit"
          form={formId}
          className="btn btn-primary"
          disabled={busy || !name.trim()}
        >
          {busy ? <Spinner label="Saqlanmoqda" /> : employee ? "Saqlash" : "Qo‘shish"}
        </button>
      </div>
    </Modal>
  );
}

export function EmployeeSheet({
  employee,
  tasks,
  onClose,
  onAssign,
  onEdit,
  onDelete,
  onOpenTask,
  onToggle,
}: {
  employee: Employee;
  tasks: Task[];
  onClose: () => void;
  onAssign: () => void;
  onEdit: () => void;
  onDelete: (employee: Employee) => Promise<void>;
  onOpenTask: (task: Task) => void;
  onToggle: (task: Task, status: TaskStatus) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const own = tasks
    .filter((t) => t.assigneeId === employee.id)
    .sort((a, b) =>
      a.status === "done" && b.status !== "done"
        ? 1
        : b.status === "done" && a.status !== "done"
          ? -1
          : sortTasks(a, b),
    );
  const s = employeeStats(employee, tasks);
  return (
    <>
      <Modal title={employee.name} onClose={onClose} hideTitle size="lg">
        <div className="sheet-body">
          <div className="profile">
            <Avatar name={employee.name} size="lg" />
            <div>
              <p className="profile-name" aria-hidden="true">
                {employee.name}
              </p>
              <p className="profile-role">{employee.position || "Lavozim ko‘rsatilmagan"}</p>
            </div>
          </div>
          <div className="mini-facts">
            <span>
              <strong>{s.todo}</strong>yangi
            </span>
            <span>
              <strong>{s.progress}</strong>jarayonda
            </span>
            <span>
              <strong>{s.done}</strong>bajarildi
            </span>
            {s.overdue > 0 && (
              <span className="is-bad">
                <strong>{s.overdue}</strong>kechikkan
              </span>
            )}
          </div>
          {own.length ? (
            <ul className="inset-list">
              {own.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onOpen={onOpenTask}
                  onToggle={onToggle}
                  showAssignee={false}
                />
              ))}
            </ul>
          ) : (
            <p className="inset-empty">Hali vazifa belgilanmagan.</p>
          )}
        </div>
        <div className="sheet-foot">
          <button type="button" className="btn-text is-danger" onClick={() => setConfirm(true)}>
            <Trash2 size={15} strokeWidth={1.9} aria-hidden="true" />
            O‘chirish
          </button>
          <span className="spacer" />
          <button type="button" className="btn btn-secondary" onClick={onEdit}>
            <Pencil size={15} strokeWidth={1.9} aria-hidden="true" />
            Tahrirlash
          </button>
          <button type="button" className="btn btn-primary" onClick={onAssign}>
            <Plus size={17} strokeWidth={2.2} aria-hidden="true" />
            Vazifa belgilash
          </button>
        </div>
      </Modal>
      {confirm && (
        <ConfirmDialog
          title="Hodimni o‘chirasizmi?"
          message={
            <>
              <strong>{employee.name}</strong> jamoa ro‘yxatidan olinadi. Bajarilgan vazifalari
              tarixda qoladi.
            </>
          }
          confirmLabel="O‘chirish"
          onClose={() => setConfirm(false)}
          onConfirm={() => onDelete(employee)}
        />
      )}
    </>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  message: ReactNode;
  confirmLabel: string;
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
        <button type="button" className="btn btn-danger" onClick={() => void run()} disabled={busy}>
          {busy ? <Spinner /> : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function AccountDialog({
  account,
  onClose,
  onSaved,
}: {
  account: Account;
  onClose: () => void;
  onSaved: () => void;
}) {
  const formId = useId();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== repeat) {
      setError("Yangi parollar mos kelmadi.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/me", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword: current, newPassword: password }),
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <Modal title="Parolni almashtirish" eyebrow={`Hisob · @${account.username}`} onClose={onClose} size="sm">
      <form id={formId} className="sheet-body form" onSubmit={save}>
        <label className="field">
          <span className="field-label">Joriy parol</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
            autoFocus
          />
        </label>
        <label className="field">
          <span className="field-label">Yangi parol</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            placeholder="Kamida 6 ta belgi"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            maxLength={128}
            required
          />
        </label>
        <label className="field">
          <span className="field-label">Yangi parolni takrorlang</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
            minLength={6}
            maxLength={128}
            required
          />
        </label>
        <p className="field-hint">Boshqa qurilmalardagi kirishlar bekor qilinadi.</p>
        <ErrorMessage message={error} />
      </form>
      <div className="sheet-foot">
        <button type="button" className="btn btn-quiet" onClick={onClose}>
          Bekor qilish
        </button>
        <button type="submit" form={formId} className="btn btn-primary" disabled={busy}>
          {busy ? <Spinner label="Saqlanmoqda" /> : "Saqlash"}
        </button>
      </div>
    </Modal>
  );
}
