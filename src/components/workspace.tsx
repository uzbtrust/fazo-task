"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CircleAlert, CircleCheck, KeyRound, LogOut, Moon, RefreshCw, Sun } from "lucide-react";
import type { Account, Employee, Task, TaskStatus } from "@/lib/types";
import { api, Avatar, ErrorMessage, Segmented, Spinner, statusLabels, Wordmark } from "./ui";
import { TasksView } from "./tasks-view";
import { TeamView } from "./team-view";
import {
  AccountDialog,
  EmployeeForm,
  EmployeeSheet,
  TaskForm,
  TaskSheet,
} from "./dialogs";

type View = "tasks" | "team";
type Toast = {
  message: string;
  tone?: "error";
  action?: { label: string; run: () => void };
};

const viewFromHash = (): View =>
  typeof window !== "undefined" && window.location.hash === "#hodimlar" ? "team" : "tasks";

export default function Workspace() {
  const [account, setAccount] = useState<Account | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [view, setView] = useState<View>("tasks");
  const [dark, setDark] = useState(false);
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [taskForm, setTaskForm] = useState<{ task?: Task; assigneeId?: string } | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [employeeForm, setEmployeeForm] = useState<{ employee?: Employee } | null>(null);
  const [openEmployeeId, setOpenEmployeeId] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const notify = useCallback((next: Toast | string) => {
    setToast(typeof next === "string" ? { message: next } : next);
  }, []);

  const refresh = useCallback(async () => {
    const [taskData, employeeData] = await Promise.all([
      api<{ tasks: Task[] }>("/api/tasks"),
      api<{ employees: Employee[] }>("/api/employees"),
    ]);
    setTasks(taskData.tasks);
    setEmployees(employeeData.employees);
    setLoadError("");
  }, []);

  const boot = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/me");
      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Ma’lumotlarni yuklab bo‘lmadi.");
      setAccount(data.user);
      await refresh();
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  useEffect(() => {
    setView(viewFromHash());
    setDark(document.documentElement.classList.contains("dark"));
    void boot();
    const onHash = () => setView(viewFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [boot]);

  // Boshqa qurilmadagi o‘zgarishlar ham ko‘rinsin.
  useEffect(() => {
    if (!account) return;
    const update = () => {
      if (document.visibilityState === "visible")
        void refresh().catch(() =>
          setLoadError("Ma’lumotlarni yangilab bo‘lmadi. Aloqani tekshiring."),
        );
    };
    const interval = setInterval(update, 20000);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, [account, refresh]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), toast.action ? 6000 : 4000);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuRef.current?.contains(e.target as Node))
        setMenu(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menu]);

  function go(next: View) {
    setView(next);
    history.replaceState(null, "", next === "team" ? "#hodimlar" : "#vazifalar");
    window.scrollTo({ top: 0 });
  }

  function toggleTheme() {
    const next = !dark;
    const apply = () => {
      setDark(next);
      document.documentElement.classList.toggle("dark", next);
    };
    try {
      localStorage.setItem("fazo-theme", next ? "dark" : "light");
    } catch {}
    const doc = document as Document & { startViewTransition?: (cb: () => void) => void };
    if (doc.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches)
      doc.startViewTransition(apply);
    else apply();
  }

  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
      window.location.replace("/login");
    } catch (e) {
      notify({ message: (e as Error).message, tone: "error" });
    }
  }

  function upsertTask(task: Task) {
    setTasks((list) =>
      list.some((t) => t.id === task.id)
        ? list.map((t) => (t.id === task.id ? task : t))
        : [task, ...list],
    );
  }

  async function changeStatus(task: Task, status: TaskStatus, undo = true) {
    if (task.status === status) return;
    const previous = task.status;
    upsertTask({
      ...task,
      status,
      completedAt: status === "done" ? new Date().toISOString() : null,
    });
    try {
      const data = await api<{ task: Task }>(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      upsertTask(data.task);
      if (undo)
        notify({
          message: `«${task.title}» — ${statusLabels[status].toLowerCase()}`,
          action: {
            label: "Qaytarish",
            run: () => void changeStatus(data.task, previous, false),
          },
        });
    } catch (e) {
      upsertTask(task);
      notify({ message: (e as Error).message, tone: "error" });
    }
  }

  async function deleteTask(task: Task) {
    await api(`/api/tasks/${task.id}`, { method: "DELETE" });
    setTasks((list) => list.filter((t) => t.id !== task.id));
    setOpenTaskId(null);
    notify("Vazifa o‘chirildi");
  }

  async function deleteEmployee(employee: Employee) {
    await api(`/api/employees/${employee.id}`, { method: "DELETE" });
    setEmployees((list) => list.filter((e) => e.id !== employee.id));
    setOpenEmployeeId(null);
    notify(`${employee.name} jamoadan olindi`);
  }

  function newTask(assigneeId?: string) {
    if (!employees.length) {
      setEmployeeForm({});
      notify("Avval hodim qo‘shing — keyin unga vazifa belgilaysiz");
      return;
    }
    setTaskForm({ assigneeId });
  }

  if (loading)
    return (
      <div className="app-state">
        <Wordmark />
        <Spinner />
      </div>
    );
  if (!account)
    return (
      <div className="app-state">
        <Wordmark />
        <ErrorMessage message={loadError || "Ma’lumotlarni yuklab bo‘lmadi."} />
        <button className="btn btn-primary" onClick={() => void boot()}>
          <RefreshCw size={16} aria-hidden="true" />
          Qayta urinish
        </button>
      </div>
    );

  const openTask = tasks.find((t) => t.id === openTaskId);
  const openEmployee = employees.find((e) => e.id === openEmployeeId);

  return (
    <div className="app">
      <a href="#main" className="skip-link">
        Asosiy qismga o‘tish
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Wordmark />
          <nav className="topnav" aria-label="Bo‘limlar">
            <Segmented<View>
              label="Bo‘limlar"
              value={view}
              onChange={go}
              options={[
                { value: "tasks", label: "Vazifalar" },
                { value: "team", label: "Hodimlar" },
              ]}
            />
          </nav>
          <div className="top-actions">
            <button
              type="button"
              className="icon-button theme-toggle"
              aria-label={dark ? "Yorug‘ rejimga o‘tish" : "Qorong‘u rejimga o‘tish"}
              onClick={toggleTheme}
            >
              <Moon className="theme-icon icon-moon" size={17} strokeWidth={1.9} aria-hidden="true" />
              <Sun className="theme-icon icon-sun" size={18} strokeWidth={1.9} aria-hidden="true" />
            </button>
            <div className="menu-wrap" ref={menuRef}>
              <button
                type="button"
                className="account-button"
                aria-label="Hisob menyusi"
                aria-expanded={menu}
                aria-haspopup="menu"
                onClick={() => setMenu(!menu)}
              >
                <Avatar name={account.name} size="sm" />
              </button>
              {menu && (
                <div className="menu" role="menu">
                  <div className="menu-head">
                    <Avatar name={account.name} />
                    <span>
                      <strong>{account.name}</strong>
                      <small>@{account.username}</small>
                    </span>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    className="menu-item"
                    onClick={() => {
                      setMenu(false);
                      setAccountOpen(true);
                    }}
                  >
                    <KeyRound size={16} strokeWidth={1.8} aria-hidden="true" />
                    Parolni almashtirish
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="menu-item"
                    onClick={() => void logout()}
                  >
                    <LogOut size={16} strokeWidth={1.8} aria-hidden="true" />
                    Chiqish
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main id="main" className="page" key={view}>
        {loadError && (
          <div className="banner" role="alert">
            <CircleAlert size={17} strokeWidth={1.9} aria-hidden="true" />
            <span>{loadError}</span>
            <button
              type="button"
              className="link-more"
              onClick={() =>
                void refresh().catch((e) => notify({ message: (e as Error).message, tone: "error" }))
              }
            >
              Qayta urinish
            </button>
          </div>
        )}
        {view === "tasks" ? (
          <TasksView
            tasks={tasks}
            employees={employees}
            onNewTask={() => newTask()}
            onNewEmployee={() => setEmployeeForm({})}
            onOpenTask={(task) => setOpenTaskId(task.id)}
            onToggle={(task, status) => void changeStatus(task, status)}
          />
        ) : (
          <TeamView
            employees={employees}
            tasks={tasks}
            onNewEmployee={() => setEmployeeForm({})}
            onOpenEmployee={(employee) => setOpenEmployeeId(employee.id)}
          />
        )}
      </main>
      <footer className="foot">
        <span>Fazo Task</span>
        <span aria-hidden="true">·</span>
        <span>Jamoa ishlari bir joyda.</span>
      </footer>

      {openEmployee && (
        <EmployeeSheet
          employee={openEmployee}
          tasks={tasks}
          onClose={() => setOpenEmployeeId(null)}
          onAssign={() => {
            setOpenEmployeeId(null);
            setTaskForm({ assigneeId: openEmployee.id });
          }}
          onEdit={() => {
            setOpenEmployeeId(null);
            setEmployeeForm({ employee: openEmployee });
          }}
          onDelete={deleteEmployee}
          onOpenTask={(task) => {
            setOpenEmployeeId(null);
            setOpenTaskId(task.id);
          }}
          onToggle={(task, status) => void changeStatus(task, status)}
        />
      )}
      {openTask && (
        <TaskSheet
          task={openTask}
          onClose={() => setOpenTaskId(null)}
          onEdit={() => {
            setOpenTaskId(null);
            setTaskForm({ task: openTask });
          }}
          onStatus={(task, status) => void changeStatus(task, status, false)}
          onDelete={deleteTask}
        />
      )}
      {taskForm && (
        <TaskForm
          task={taskForm.task}
          employees={employees}
          defaultAssignee={taskForm.assigneeId}
          onClose={() => setTaskForm(null)}
          onSaved={(task) => {
            upsertTask(task);
            setTaskForm(null);
            notify(taskForm.task ? "Vazifa saqlandi" : `Vazifa ${task.assigneeName}ga belgilandi`);
          }}
        />
      )}
      {employeeForm && (
        <EmployeeForm
          employee={employeeForm.employee}
          onClose={() => setEmployeeForm(null)}
          onSaved={(employee) => {
            setEmployees((list) =>
              list.some((e) => e.id === employee.id)
                ? list.map((e) => (e.id === employee.id ? employee : e))
                : [...list, employee],
            );
            setEmployeeForm(null);
            // Hodim nomi vazifalarda ham yangilansin.
            void refresh().catch(() => {});
            notify(employeeForm.employee ? "Hodim ma’lumoti saqlandi" : `${employee.name} jamoaga qo‘shildi`);
          }}
        />
      )}
      {accountOpen && (
        <AccountDialog
          account={account}
          onClose={() => setAccountOpen(false)}
          onSaved={() => {
            setAccountOpen(false);
            notify("Parol yangilandi");
          }}
        />
      )}

      <div className="toast-region" aria-live="polite">
        {toast && (
          <div className={`toast ${toast.tone === "error" ? "is-error" : ""}`} role="status">
            {toast.tone === "error" ? (
              <CircleAlert size={17} strokeWidth={2} aria-hidden="true" />
            ) : (
              <CircleCheck size={17} strokeWidth={2} aria-hidden="true" />
            )}
            <span className="toast-text">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  toast.action?.run();
                  setToast(null);
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
