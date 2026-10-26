"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  CircleDashed,
  Clock3,
  Columns3,
  FileCheck2,
  LayoutDashboard,
  List,
  LogOut,
  Menu,
  Moon,
  Paperclip,
  PenTool,
  Plus,
  Search,
  Settings as SettingsIcon,
  SlidersHorizontal,
  Sun,
  Users,
  X,
  RefreshCw,
  CircleCheck,
  MessageSquare,
} from "lucide-react";
import type { Priority, Task, TaskStatus, User } from "@/lib/types";
import {
  actionLabels,
  api,
  Avatar,
  Badge,
  categories,
  ErrorMessage,
  Logo,
  Modal,
  PriorityBadge,
  roleLabels,
  shortDate,
  fullDate,
  todayISO,
  Spinner,
  statusLabels,
} from "./ui";
import { TaskDetail, TaskForm } from "./task-dialogs";
import { Settings, Team } from "./team-settings";
type View = "overview" | "open" | "mine" | "review" | "team" | "settings";
const navItems = [
  { id: "overview" as View, label: "Umumiy", icon: LayoutDashboard },
  { id: "open" as View, label: "Ochiq vazifalar", icon: CircleDashed },
  { id: "mine" as View, label: "Mening vazifalarim", icon: FileCheck2 },
  { id: "review" as View, label: "Tekshiruv", icon: CheckCheck },
];
export default function Workspace() {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [view, setView] = useState<View>("overview");
  const [mobile, setMobile] = useState(false);
  const [theme, setTheme] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TaskStatus | "all">("all");
  const [priority, setPriority] = useState<Priority | "all">("all");
  const [category, setCategory] = useState("all");
  const [filters, setFilters] = useState(false);
  const [layout, setLayout] = useState<"list" | "board">("list");
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState<Task | undefined>();
  const [selected, setSelected] = useState<string | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const [toast, setToast] = useState("");
  const notify = useCallback((message: string) => setToast(message), []);
  const refresh = useCallback(async () => {
    const [taskData, userData] = await Promise.all([
      api<{ tasks: Task[] }>("/api/tasks"),
      api<{ users: User[] }>("/api/users"),
    ]);
    setTasks(taskData.tasks);
    setUsers(userData.users);
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
      if (!response.ok)
        throw new Error(data.error || "Ish fazosini yuklab bo‘lmadi.");
      setUser(data.user);
      await refresh();
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [refresh]);
  useEffect(() => {
    void boot();
    setTheme(document.documentElement.classList.contains("dark"));
  }, [boot]);
  useEffect(() => {
    if (!user) return;
    const update = () => {
      if (document.visibilityState === "visible")
        void refresh().catch(() =>
          setLoadError(
            "Ma’lumotlarni yangilab bo‘lmadi. Aloqani tekshirib, qayta urinib ko‘ring.",
          ),
        );
    };
    const interval = setInterval(update, 15000);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
    };
  }, [user, refresh]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timeout);
  }, [toast]);
  function navigate(next: View) {
    setView(next);
    setMobile(false);
    setSearch("");
    setStatus("all");
    setPriority("all");
    setCategory("all");
  }
  function toggleTheme() {
    const next = !theme;
    setTheme(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("fazo-theme", next ? "dark" : "light");
  }
  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
      window.location.replace("/login");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  const selectedTask = tasks.find((t) => t.id === selected);
  const counts = useMemo(
    () => ({
      open: tasks.filter((t) => t.status === "open").length,
      progress: tasks.filter((t) => t.status === "in_progress").length,
      review: tasks.filter((t) => ["in_review", "approved"].includes(t.status))
        .length,
      done: tasks.filter((t) => t.status === "completed").length,
    }),
    [tasks],
  );
  const recent = useMemo(
    () =>
      tasks
        .flatMap((t) =>
          t.activity.map((a) => ({ ...a, taskTitle: t.title, taskId: t.id })),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 12),
    [tasks],
  );
  let baseTasks = tasks;
  if (view === "open") baseTasks = tasks.filter((t) => t.status === "open");
  if (view === "mine")
    baseTasks = tasks.filter((t) =>
      user?.role === "designer"
        ? t.assigneeId === user.id
        : t.creatorId === user?.id,
    );
  if (view === "review")
    baseTasks = tasks.filter(
      (t) =>
        ["in_review", "approved"].includes(t.status) &&
        (user?.role !== "creator" || t.creatorId === user.id),
    );
  const filtered = baseTasks
    .filter(
      (t) =>
        (status === "all" || t.status === status) &&
        (priority === "all" || t.priority === priority) &&
        (category === "all" || t.category === category) &&
        (!search ||
          `${t.title} ${t.description} ${t.number} ${t.category}`
            .toLowerCase()
            .includes(search.toLowerCase())),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const canCreate = user?.role === "admin" || user?.role === "creator";
  if (loading)
    return (
      <div className="app-loading">
        <Logo />
        <Spinner />
        <p>Ish fazongiz tayyorlanmoqda…</p>
      </div>
    );
  if (!user)
    return (
      <div className="app-loading">
        <Logo />
        <ErrorMessage message={loadError} />
        <button className="button button-primary" onClick={() => void boot()}>
          <RefreshCw size={16} />
          Qayta urinish
        </button>
      </div>
    );
  const currentTitle =
    navItems.find((n) => n.id === view)?.label ||
    (view === "team" ? "Jamoa" : "Sozlamalar");
  function newTask() {
    setEditTask(undefined);
    setShowForm(true);
  }
  return (
    <div className="workspace">
      <a href="#workspace-main" className="skip-link">
        Asosiy qismga o‘tish
      </a>
      {mobile && (
        <button
          className="mobile-scrim"
          aria-label="Menyuni yopish"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "is-open" : ""}`}>
        <div className="sidebar-brand">
          <Logo />
          <button
            className="icon-button mobile-close"
            aria-label="Menyuni yopish"
            onClick={() => setMobile(false)}
          >
            <X size={19} />
          </button>
        </div>
        <div className="workspace-switch">
          <span className="workspace-avatar">
            <PenTool size={19} strokeWidth={1.5} />
          </span>
          <div>
            <strong>Dizayn jamoasi</strong>
            <span>Fazo ish fazosi</span>
          </div>
          <span className="workspace-live" title="Faol ish fazosi" />
        </div>
        <p className="nav-label">ISH FAZOSI</p>
        <nav aria-label="Asosiy menyu">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${view === item.id ? "active" : ""}`}
              onClick={() => navigate(item.id)}
              aria-current={view === item.id ? "page" : undefined}
            >
              <item.icon size={19} strokeWidth={1.6} />
              <span>{item.label}</span>
              {item.id === "open" && counts.open > 0 && (
                <span className="nav-count">{counts.open}</span>
              )}
              {item.id === "review" && counts.review > 0 && (
                <span className="nav-count">{counts.review}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="nav-divider" />
        <p className="nav-label">BOSHQARUV</p>
        <nav aria-label="Boshqaruv">
          {user.role === "admin" && (
            <button
              className={`nav-item ${view === "team" ? "active" : ""}`}
              onClick={() => navigate("team")}
            >
              <Users size={19} strokeWidth={1.6} />
              <span>Jamoa</span>
              <span className="muted nav-small-count">{users.length}</span>
            </button>
          )}
          <button
            className={`nav-item ${view === "settings" ? "active" : ""}`}
            onClick={() => navigate("settings")}
          >
            <SettingsIcon size={19} strokeWidth={1.6} />
            <span>Sozlamalar</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="sidebar-note-mark">✳</span>
            <p>
              G‘oyalar uchun joy.
              <br />
              <strong>Natijalar uchun tartib.</strong>
            </p>
            <span>Birgalikda yaxshiroq.</span>
          </div>
          <button className="user-profile" onClick={() => navigate("settings")}>
            <Avatar name={user.name} />
            <span>
              <strong>{user.name}</strong>
              <small>{roleLabels[user.role]}</small>
            </span>
            <ChevronRight size={16} />
          </button>
          <button className="logout-button" onClick={() => void logout()}>
            <LogOut size={15} />
            Hisobdan chiqish
          </button>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Menyuni ochish"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb-root">Ish fazosi</span>
            <ChevronRight size={13} />
            <span>{currentTitle}</span>
          </div>
          <div className="topbar-actions">
            <span className="today-date">{fullDate()}</span>
            <span className="topbar-divider" />
            <button
              className="icon-button"
              aria-label={theme ? "Yorug‘ rejim" : "Qorong‘u rejim"}
              onClick={toggleTheme}
            >
              {theme ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              className="icon-button notification-button"
              aria-label="So‘nggi faollik"
              onClick={() => setActivityOpen(true)}
            >
              <Bell size={18} />
              {recent.length > 0 && <span />}
            </button>
            <button
              className="topbar-avatar"
              aria-label="Mening profilim"
              onClick={() => navigate("settings")}
            >
              <Avatar name={user.name} small />
            </button>
          </div>
        </header>
        <main id="workspace-main" className="main-content">
          {loadError && (
            <div className="refresh-error">
              <span>{loadError}</span>
              <button
                onClick={() =>
                  void refresh().catch((e) => notify((e as Error).message))
                }
              >
                Qayta urinish
              </button>
            </div>
          )}
          {view === "team" ? (
            <Team users={users} onRefresh={refresh} notify={notify} />
          ) : view === "settings" ? (
            <Settings user={user} onUserChanged={setUser} notify={notify} />
          ) : (
            <>
              {view === "overview" ? (
                <>
                  <section className="dashboard-hero">
                    <div>
                      <p className="hero-greeting">
                        <span className="live-dot" />
                        Xayrli kun, {user.name.split(" ")[0]}
                      </p>
                      <h1>
                        Ishlar bir joyda.
                        <br />
                        <span>Fikrlar erkin fazoda.</span>
                      </h1>
                      <p>
                        G‘oyadan tayyor dizayngacha — jamoangiz bilan bir
                        oqimda.
                      </p>
                      <div className="hero-actions">
                        {canCreate ? (
                          <button
                            className="button button-primary"
                            onClick={newTask}
                          >
                            <Plus size={17} />
                            Yangi vazifa
                          </button>
                        ) : (
                          <button
                            className="button button-primary"
                            onClick={() => navigate("open")}
                          >
                            Ishni tanlash
                            <ArrowUpRight size={16} />
                          </button>
                        )}
                        <button
                          className="text-button"
                          onClick={() =>
                            navigate(user.role === "admin" ? "team" : "mine")
                          }
                        >
                          {user.role === "admin"
                            ? "Jamoani boshqarish"
                            : "Mening vazifalarim"}
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="hero-art" aria-hidden="true">
                      <svg viewBox="0 0 290 216" fill="none">
                        <ellipse
                          cx="147"
                          cy="109"
                          rx="125"
                          ry="47"
                          transform="rotate(-25 147 109)"
                          stroke="currentColor"
                          strokeOpacity=".12"
                        />
                        <ellipse
                          cx="147"
                          cy="109"
                          rx="100"
                          ry="67"
                          transform="rotate(35 147 109)"
                          stroke="currentColor"
                          strokeOpacity=".07"
                        />
                        <circle cx="147" cy="109" r="58" fill="var(--bg)" />
                        <rect
                          x="113"
                          y="70"
                          width="70"
                          height="83"
                          rx="14"
                          fill="var(--bg)"
                          stroke="var(--line)"
                        />
                        <rect
                          x="125"
                          y="86"
                          width="30"
                          height="5"
                          rx="2.5"
                          fill="var(--fg)"
                          fillOpacity=".8"
                        />
                        <rect
                          x="125"
                          y="101"
                          width="43"
                          height="3"
                          rx="1.5"
                          fill="var(--fg)"
                          fillOpacity=".12"
                        />
                        <rect
                          x="125"
                          y="109"
                          width="35"
                          height="3"
                          rx="1.5"
                          fill="var(--fg)"
                          fillOpacity=".12"
                        />
                        <circle cx="158" cy="137" r="17" fill="var(--accent)" />
                        <path
                          d="m151 137 5 5 9-10"
                          stroke="white"
                          strokeWidth="2.3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle cx="40" cy="139" r="5" fill="var(--accent)" />
                        <circle
                          cx="242"
                          cy="67"
                          r="4"
                          fill="var(--fg)"
                          fillOpacity=".35"
                        />
                        <path
                          d="M211 165h10m-5-5v10M64 55h10m-5-5v10"
                          stroke="var(--fg)"
                          strokeOpacity=".25"
                          strokeWidth="1.5"
                        />
                        <path
                          d="M59 160c20-3 34-8 45-13m83-76c17-9 32-11 46-10"
                          stroke="var(--accent)"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span>Har bir g‘oya o‘z yo‘lini topadi.</span>
                    </div>
                  </section>
                  <section
                    className="stats-strip"
                    aria-label="Vazifalar holati"
                  >
                    {[
                      {
                        label: "Ochiq vazifalar",
                        value: counts.open,
                        icon: CircleDashed,
                        view: "open" as View,
                        tone: "open",
                      },
                      {
                        label: "Jarayonda",
                        value: counts.progress,
                        icon: Clock3,
                        view: "overview" as View,
                        tone: "progress",
                      },
                      {
                        label: "Tekshiruvda",
                        value: counts.review,
                        icon: FileCheck2,
                        view: "review" as View,
                        tone: "review",
                      },
                      {
                        label: "Yakunlangan",
                        value: counts.done,
                        icon: CircleCheck,
                        view: "overview" as View,
                        tone: "done",
                      },
                    ].map((s, i) => (
                      <button
                        className={`stat-item stat-${s.tone}`}
                        key={s.label}
                        onClick={() => {
                          navigate(s.view);
                          setStatus(
                            i === 3
                              ? "completed"
                              : i === 1
                                ? "in_progress"
                                : "all",
                          );
                        }}
                      >
                        <div>
                          <span className="stat-icon">
                            <s.icon size={17} strokeWidth={1.6} />
                          </span>
                          <span>{s.label}</span>
                          <ArrowUpRight className="stat-arrow" size={15} />
                        </div>
                        <strong>{String(s.value).padStart(2, "0")}</strong>
                        <span className="stat-caption">
                          {
                            [
                              "Ijodkoringizni kutmoqda",
                              "G‘oyalar shakl olmoqda",
                              "Yakuniy qadamga yaqin",
                              "Birgalikdagi natijalar",
                            ][i]
                          }
                        </span>
                      </button>
                    ))}
                  </section>
                </>
              ) : (
                <div className="page-heading task-page-heading">
                  <div>
                    <p className="eyebrow">
                      {view === "open"
                        ? "KEYINGI YAXSHI ISHINGIZ"
                        : view === "mine"
                          ? "SIZNING E’TIBORINGIZDA"
                          : "NATIJAGA BIR QADAM"}
                    </p>
                    <h1>
                      {view === "open"
                        ? "Ochiq vazifalar."
                        : view === "mine"
                          ? "Mening vazifalarim."
                          : "Tekshiruv va tasdiq."}
                    </h1>
                    <p className="page-description">
                      {view === "open"
                        ? "O‘zingizga mos ishni tanlang va ijodga kirishing."
                        : view === "mine"
                          ? "Siz bilan bog‘liq ishlar, ularning muddati va holati."
                          : "Tayyor ishni ko‘ring, fikr bildiring va tasdiqlang."}
                    </p>
                  </div>
                  {canCreate && (
                    <button className="button button-primary" onClick={newTask}>
                      <Plus size={17} />
                      Yangi vazifa
                    </button>
                  )}
                </div>
              )}
              <section className="tasks-section">
                <div className="section-heading">
                  <div>
                    <h2>
                      {view === "overview" ? "Vazifalar" : "Ishlar paneli"}
                      <span className="count-pill">{baseTasks.length}</span>
                    </h2>
                    {view === "overview" && (
                      <p>
                        Har bir ishning o‘z joyi, har bir g‘oyaning o‘z navbati.
                      </p>
                    )}
                  </div>
                  <div className="view-toggle" aria-label="Ko‘rinish">
                    <button
                      className={layout === "list" ? "active" : ""}
                      aria-label="Ro‘yxat ko‘rinishi"
                      aria-pressed={layout === "list"}
                      onClick={() => setLayout("list")}
                    >
                      <List size={18} />
                    </button>
                    <button
                      className={layout === "board" ? "active" : ""}
                      aria-label="Ustunlar ko‘rinishi"
                      aria-pressed={layout === "board"}
                      onClick={() => setLayout("board")}
                    >
                      <Columns3 size={17} />
                    </button>
                  </div>
                </div>
                <div className="task-toolbar">
                  <div
                    className="status-tabs"
                    role="tablist"
                    aria-label="Vazifa holati"
                  >
                    {(
                      [
                        "all",
                        "open",
                        "in_progress",
                        "in_review",
                        "completed",
                      ] as const
                    )
                      .filter((s) => view !== "open" || s === "all")
                      .map((s) => (
                        <button
                          key={s}
                          role="tab"
                          aria-selected={status === s}
                          className={status === s ? "active" : ""}
                          onClick={() => setStatus(s)}
                        >
                          {s === "all" ? "Barchasi" : statusLabels[s]}
                          {s === "all" && <span>{baseTasks.length}</span>}
                        </button>
                      ))}
                  </div>
                  <div className="task-search-tools">
                    <div className="search-field">
                      <Search size={16} />
                      <label className="sr-only" htmlFor="task-search">
                        Vazifalarni qidirish
                      </label>
                      <input
                        id="task-search"
                        placeholder="Vazifa qidirish…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                      {search && (
                        <button
                          aria-label="Qidiruvni tozalash"
                          onClick={() => setSearch("")}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <button
                      className={`filter-button ${filters || priority !== "all" || category !== "all" ? "is-active" : ""}`}
                      aria-expanded={filters}
                      onClick={() => setFilters(!filters)}
                    >
                      <SlidersHorizontal size={16} />
                      <span>Filtr</span>
                      {(priority !== "all" || category !== "all") && <i />}
                    </button>
                  </div>
                </div>
                {filters && (
                  <div className="filter-row">
                    <label>
                      Muhimlik
                      <select
                        value={priority}
                        onChange={(e) =>
                          setPriority(e.target.value as Priority | "all")
                        }
                      >
                        <option value="all">Barchasi</option>
                        <option value="high">Yuqori</option>
                        <option value="medium">O‘rta</option>
                        <option value="low">Past</option>
                      </select>
                    </label>
                    <label>
                      Yo‘nalish
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                      >
                        <option value="all">Barchasi</option>
                        {[
                          ...new Set([
                            ...categories,
                            ...tasks.map((t) => t.category),
                          ]),
                        ].map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Holat
                      <select
                        value={status}
                        onChange={(e) =>
                          setStatus(e.target.value as TaskStatus | "all")
                        }
                      >
                        <option value="all">Barchasi</option>
                        {Object.entries(statusLabels).map(([s, l]) => (
                          <option key={s} value={s}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="text-button"
                      onClick={() => {
                        setPriority("all");
                        setCategory("all");
                        setStatus("all");
                        setSearch("");
                      }}
                    >
                      Tozalash
                      <X size={14} />
                    </button>
                  </div>
                )}
                {filtered.length > 0 ? (
                  layout === "list" ? (
                    <div className="task-table">
                      <div className="task-table-head">
                        <span>Vazifa</span>
                        <span>Holat</span>
                        <span>Dizayner</span>
                        <span>Muddat</span>
                        <span />
                      </div>
                      {filtered.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          users={users}
                          onClick={() => setSelected(task.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="task-board">
                      {(
                        [
                          "open",
                          "in_progress",
                          "in_review",
                          "approved",
                          "completed",
                          "cancelled",
                        ] as TaskStatus[]
                      ).map((s) => (
                        <div className="board-column" key={s}>
                          <div className="board-column-heading">
                            <Badge status={s} />
                            <span>
                              {filtered.filter((t) => t.status === s).length}
                            </span>
                          </div>
                          {filtered
                            .filter((t) => t.status === s)
                            .map((task) => (
                              <TaskCard
                                key={task.id}
                                task={task}
                                users={users}
                                onClick={() => setSelected(task.id)}
                              />
                            ))}
                          {!filtered.some((t) => t.status === s) && (
                            <div className="board-empty">
                              Vazifalar hali yo‘q
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="empty-tasks">
                    <div className="empty-art" aria-hidden="true">
                      <div className="empty-paper">
                        <span />
                        <span />
                        <span />
                        <div>
                          <Check size={18} />
                        </div>
                      </div>
                      <span className="empty-orbit" />
                    </div>
                    <h3>
                      {baseTasks.length
                        ? "Mos vazifa topilmadi."
                        : view === "mine"
                          ? "Keyingi yaxshi ishingiz shu yerda."
                          : view === "review"
                            ? "Yaxshi ishlar o‘z navbatida."
                            : "Katta ishlar birinchi vazifadan boshlanadi."}
                    </h3>
                    <p>
                      {baseTasks.length
                        ? "Boshqa so‘z bilan qidiring yoki filtrlarni o‘zgartiring."
                        : view === "mine"
                          ? user.role === "designer"
                            ? "Ochiq vazifalardan birini tanlang. Olgan ishlaringiz shu yerda jamlanadi."
                            : "Yaratgan vazifalaringiz shu yerda jamlanadi."
                          : view === "review"
                            ? "Dizayner ishni topshirganda, uni shu yerdan tekshirish mumkin."
                            : "Aniq topshiriq bering, dizayneringiz tanlasin. Qolganini birga tartibga solamiz."}
                    </p>
                    {baseTasks.length ? (
                      <button
                        className="text-button"
                        onClick={() => {
                          setSearch("");
                          setPriority("all");
                          setCategory("all");
                          setStatus("all");
                        }}
                      >
                        Filtrlarni tozalash
                        <ArrowRight size={15} />
                      </button>
                    ) : canCreate && view !== "review" ? (
                      <button
                        className="button button-primary"
                        onClick={newTask}
                      >
                        <Plus size={16} />
                        Birinchi vazifani yaratish
                      </button>
                    ) : user.role === "designer" && view !== "open" ? (
                      <button
                        className="text-button"
                        onClick={() => navigate("open")}
                      >
                        Ochiq vazifalarga o‘tish
                        <ArrowRight size={16} />
                      </button>
                    ) : null}
                  </div>
                )}
              </section>
              {view === "overview" && (
                <div className="dashboard-bottom">
                  <section className="workflow-card">
                    <div className="section-heading">
                      <div>
                        <p className="eyebrow">SODDA OQIM. ANIQ NATIJA.</p>
                        <h2>Bir fikrdan tayyor ishgacha.</h2>
                      </div>
                      <span className="workflow-mark">
                        <PenTool size={21} strokeWidth={1.4} />
                      </span>
                    </div>
                    <div className="workflow-steps">
                      {[
                        {
                          n: "01",
                          title: "Vazifa yarating",
                          text: "Matn, fayl va aniq maqsad.",
                        },
                        {
                          n: "02",
                          title: "Dizayner ishni oladi",
                          text: "Har bir ishning bitta egasi.",
                        },
                        {
                          n: "03",
                          title: "Birga yakunlang",
                          text: "Tekshiruv, tasdiq va natija.",
                        },
                      ].map((s) => (
                        <div key={s.n}>
                          <span>{s.n}</span>
                          <strong>{s.title}</strong>
                          <p>{s.text}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className="recent-card">
                    <div className="section-heading">
                      <h2>So‘nggi faollik</h2>
                      <button
                        className="icon-button"
                        aria-label="Barcha faollikni ko‘rish"
                        onClick={() => setActivityOpen(true)}
                      >
                        <ArrowUpRight size={18} />
                      </button>
                    </div>
                    {recent.length ? (
                      <div className="recent-items">
                        {recent.slice(0, 3).map((a) => (
                          <button
                            className="recent-item"
                            key={a.id}
                            onClick={() => setSelected(a.taskId)}
                          >
                            <Avatar name={a.userName} small />
                            <span>
                              <strong>
                                {a.userName}{" "}
                                <span>
                                  {actionLabels[a.action] || a.action}
                                </span>
                              </strong>
                              <small>{a.taskTitle}</small>
                              <time>{shortDate(a.createdAt, true)}</time>
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="recent-empty">
                        <span className="large-icon">
                          <Clock3 size={23} strokeWidth={1.4} />
                        </span>
                        <p>
                          Jamoaning ilk qadamlari
                          <br />
                          shu yerda ko‘rinadi.
                        </p>
                      </div>
                    )}
                  </section>
                </div>
              )}
            </>
          )}
          <footer className="workspace-footer">
            <span>
              Fazo Task<span className="footer-dot">·</span>Ijod uchun fazo.
            </span>
            <span>
              <span className="live-dot" />
              Barchasi bir oqimda
            </span>
          </footer>
        </main>
      </div>
      {showForm && (
        <TaskForm
          initial={editTask}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            notify(editTask ? "Vazifa yangilandi" : "Yangi vazifa yaratildi");
            void refresh().catch((e) => notify((e as Error).message));
          }}
        />
      )}
      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          user={user}
          users={users}
          onClose={() => setSelected(null)}
          onChanged={refresh}
          onEdit={() => {
            setEditTask(selectedTask);
            setSelected(null);
            setShowForm(true);
          }}
        />
      )}
      {activityOpen && (
        <Modal
          title="Jamoa harakati"
          eyebrow="SO‘NGGI FAOLLIK"
          onClose={() => setActivityOpen(false)}
        >
          <div className="activity-modal-list">
            {recent.length ? (
              recent.map((a) => (
                <button
                  className="recent-item"
                  key={a.id}
                  onClick={() => {
                    setActivityOpen(false);
                    setSelected(a.taskId);
                  }}
                >
                  <Avatar name={a.userName} />
                  <span>
                    <strong>
                      {a.userName}{" "}
                      <span>{actionLabels[a.action] || a.action}</span>
                    </strong>
                    <small>{a.taskTitle}</small>
                    <time>{shortDate(a.createdAt, true)}</time>
                  </span>
                  <ChevronRight size={16} />
                </button>
              ))
            ) : (
              <div className="quiet-empty">
                Hozircha faollik yo‘q. Jamoangiz ish boshlaganda, yangiliklar
                shu yerda ko‘rinadi.
              </div>
            )}
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <CircleCheck size={18} />
          <span>{toast}</span>
          <button
            aria-label="Bildirishnomani yopish"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
function TaskRow({
  task,
  users,
  onClick,
}: {
  task: Task;
  users: User[];
  onClick: () => void;
}) {
  const assignee = users.find((u) => u.id === task.assigneeId);
  const overdue =
    task.dueDate &&
    task.dueDate < todayISO() &&
    !["completed", "cancelled"].includes(task.status);
  return (
    <button className="task-row" onClick={onClick}>
      <div className="task-name-cell">
        <span className="task-category-icon">
          <PenTool size={19} strokeWidth={1.4} />
        </span>
        <span>
          <span className="task-name-meta">
            FT–{String(task.number).padStart(3, "0")}
            <span>·</span>
            {task.category}
          </span>
          <strong>{task.title}</strong>
          <span className="task-row-extra">
            <PriorityBadge priority={task.priority} />
            {task.attachments.length > 0 && (
              <span>
                <Paperclip size={12} />
                {task.attachments.length}
              </span>
            )}
            {task.comments.length > 0 && (
              <span>
                <MessageSquare size={12} />
                {task.comments.length}
              </span>
            )}
          </span>
        </span>
      </div>
      <Badge status={task.status} />
      {assignee ? (
        <span className="assignee-cell">
          <Avatar name={assignee.name} small />
          <span>{assignee.name}</span>
        </span>
      ) : (
        <span className="muted unassigned-cell">Tanlanmagan</span>
      )}
      <span className={`deadline-cell ${overdue ? "overdue" : ""}`}>
        <CalendarDays size={14} />
        {task.dueDate ? shortDate(task.dueDate) : "Muddatsiz"}
      </span>
      <ArrowUpRight size={17} className="row-arrow" />
    </button>
  );
}
function TaskCard({
  task,
  users,
  onClick,
}: {
  task: Task;
  users: User[];
  onClick: () => void;
}) {
  const assignee = users.find((u) => u.id === task.assigneeId);
  return (
    <button className="task-card" onClick={onClick}>
      <div className="task-card-meta">
        <span>FT–{String(task.number).padStart(3, "0")}</span>
        <PriorityBadge priority={task.priority} />
      </div>
      <h3>{task.title}</h3>
      <p>{task.category}</p>
      <div className="task-card-footer">
        <span>
          {task.dueDate ? (
            <>
              <CalendarDays size={13} />
              {shortDate(task.dueDate)}
            </>
          ) : (
            "Muddatsiz"
          )}
        </span>
        {assignee ? (
          <Avatar name={assignee.name} small />
        ) : (
          <span className="card-unassigned">
            <CircleDashed size={17} />
          </span>
        )}
      </div>
    </button>
  );
}
