"use client";
import { useMemo, useState, type CSSProperties } from "react";
import {
  ChevronDown,
  CircleCheck,
  Plus,
  Search,
  UserRound,
  Users,
  X,
} from "lucide-react";
import type { Employee, Task, TaskStatus } from "@/lib/types";
import { CountUp, isOverdue, Segmented, statusLabels, todayEyebrow } from "./ui";
import { sortTasks, TaskRow } from "./task-list";

type Filter = "all" | TaskStatus | "overdue";
const GROUP_ORDER: TaskStatus[] = ["in_progress", "todo", "done"];
const DONE_PREVIEW = 5;

export function TasksView({
  tasks,
  employees,
  onNewTask,
  onNewEmployee,
  onOpenTask,
  onToggle,
}: {
  tasks: Task[];
  employees: Employee[];
  onNewTask: () => void;
  onNewEmployee: () => void;
  onOpenTask: (task: Task) => void;
  onToggle: (task: Task, status: TaskStatus) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [whoChoice, setWho] = useState("all");
  // Tanlangan hodim o‘chirilsa, saralash "Barcha hodimlar"ga qaytadi.
  const who = employees.some((e) => e.id === whoChoice) ? whoChoice : "all";
  const [query, setQuery] = useState("");
  const [showAllDone, setShowAllDone] = useState(false);
  const today = todayEyebrow();
  const counts = useMemo(
    () => ({
      todo: tasks.filter((t) => t.status === "todo").length,
      in_progress: tasks.filter((t) => t.status === "in_progress").length,
      done: tasks.filter((t) => t.status === "done").length,
      overdue: tasks.filter((t) => isOverdue(t.dueDate, t.status)).length,
    }),
    [tasks],
  );
  const activeFilter: Filter =
    filter === "overdue" && !counts.overdue ? "all" : filter;
  const needle = query.trim().toLowerCase();
  const visible = tasks
    .filter(
      (t) =>
        (who === "all" || t.assigneeId === who) &&
        (activeFilter === "all" ||
          (activeFilter === "overdue"
            ? isOverdue(t.dueDate, t.status)
            : t.status === activeFilter)) &&
        (!needle ||
          `${t.title} ${t.description} ${t.assigneeName}`
            .toLowerCase()
            .includes(needle)),
    )
    .sort(sortTasks);
  const groups =
    activeFilter === "overdue"
      ? [{ key: "overdue", title: "Muddati o‘tgan", items: visible }]
      : GROUP_ORDER.filter((s) => activeFilter === "all" || s === activeFilter).map(
          (s) => ({
            key: s,
            title: statusLabels[s],
            items: visible.filter((t) => t.status === s),
          }),
        );
  const narrowed = who !== "all" || !!needle || activeFilter !== "all";
  function reset() {
    setFilter("all");
    setWho("all");
    setQuery("");
  }
  const facts: { key: Filter; label: string; value: number }[] = [
    { key: "todo", label: "Yangi", value: counts.todo },
    { key: "in_progress", label: "Jarayonda", value: counts.in_progress },
    { key: "done", label: "Bajarildi", value: counts.done },
    { key: "overdue", label: "Muddati o‘tgan", value: counts.overdue },
  ];
  return (
    <>
      <header className="page-head">
        <div className="page-head-text">
          <p className="eyebrow rise">
            <span className="eyebrow-accent">{today.date}</span>
            <span aria-hidden="true"> · </span>
            {today.weekday}
          </p>
          <h1 className="page-title rise" style={{ "--i": 1 } as CSSProperties}>
            Vazifalar.
            <span className="dim">Kim nima qilyapti.</span>
          </h1>
          <p className="page-lead rise" style={{ "--i": 2 } as CSSProperties}>
            Hodimga vazifa belgilang. Holatini doirachani bosib yangilang.
          </p>
        </div>
        <div className="page-actions rise" style={{ "--i": 2 } as CSSProperties}>
          <button className="btn btn-primary btn-lg" onClick={onNewTask}>
            <Plus size={19} strokeWidth={2.2} aria-hidden="true" />
            Vazifa belgilash
          </button>
        </div>
      </header>

      <div className="facts rise" style={{ "--i": 3 } as CSSProperties}>
        {facts.map((fact) => (
          <button
            key={fact.key}
            type="button"
            className={`fact ${activeFilter === fact.key ? "is-active" : ""} ${
              fact.key === "overdue" && fact.value ? "is-bad" : ""
            }`}
            aria-pressed={activeFilter === fact.key}
            disabled={fact.key === "overdue" && !fact.value}
            onClick={() => setFilter(activeFilter === fact.key ? "all" : fact.key)}
          >
            <span className="fact-num">
              <CountUp value={fact.value} />
            </span>
            <span className="fact-label">{fact.label}</span>
          </button>
        ))}
      </div>

      {!employees.length && !tasks.length ? (
        <div className="empty rise" style={{ "--i": 4 } as CSSProperties}>
          <span className="empty-icon">
            <Users size={26} strokeWidth={1.6} />
          </span>
          <h2>Avval jamoani qo‘shing.</h2>
          <p>Vazifa belgilash uchun kamida bitta hodim kerak. Ism va lavozim — bas.</p>
          <button className="btn btn-primary" onClick={onNewEmployee}>
            <Plus size={17} strokeWidth={2.2} aria-hidden="true" />
            Hodim qo‘shish
          </button>
        </div>
      ) : !tasks.length ? (
        <div className="empty rise" style={{ "--i": 4 } as CSSProperties}>
          <span className="empty-icon">
            <CircleCheck size={26} strokeWidth={1.6} />
          </span>
          <h2>Hali vazifa yo‘q.</h2>
          <p>Birinchi vazifani belgilang: nima qilinadi, kim qiladi va qachongacha.</p>
          <button className="btn btn-primary" onClick={onNewTask}>
            <Plus size={17} strokeWidth={2.2} aria-hidden="true" />
            Vazifa belgilash
          </button>
        </div>
      ) : (
        <section className="board rise" style={{ "--i": 4 } as CSSProperties} aria-label="Vazifalar ro‘yxati">
          <div className="toolbar">
            <Segmented<Filter>
              label="Holat bo‘yicha saralash"
              value={activeFilter}
              onChange={setFilter}
              className="toolbar-segmented"
              options={[
                { value: "all", label: "Barchasi", count: tasks.length },
                { value: "todo", label: "Yangi" },
                { value: "in_progress", label: "Jarayonda" },
                { value: "done", label: "Bajarildi" },
                ...(counts.overdue
                  ? [{ value: "overdue" as Filter, label: "Kechikkan" }]
                  : []),
              ]}
            />
            <div className="toolbar-filters">
              <label className="pill-field select-pill">
                <UserRound size={15} strokeWidth={1.8} aria-hidden="true" />
                <span className="sr-only">Hodim bo‘yicha saralash</span>
                <select value={who} onChange={(e) => setWho(e.target.value)}>
                  <option value="all">Barcha hodimlar</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} strokeWidth={2} aria-hidden="true" />
              </label>
              <label className="pill-field search-pill">
                <Search size={15} strokeWidth={1.8} aria-hidden="true" />
                <span className="sr-only">Vazifalarni qidirish</span>
                <input
                  type="search"
                  placeholder="Qidirish"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button
                    type="button"
                    className="pill-clear"
                    aria-label="Qidiruvni tozalash"
                    onClick={() => setQuery("")}
                  >
                    <X size={13} strokeWidth={2.4} />
                  </button>
                )}
              </label>
            </div>
          </div>

          {visible.length ? (
            <div className="groups">
              {groups
                .filter((g) => g.items.length)
                .map((group) => {
                  const limited =
                    group.key === "done" && activeFilter === "all" && !showAllDone
                      ? group.items.slice(0, DONE_PREVIEW)
                      : group.items;
                  return (
                    <section key={group.key} className="group" aria-label={group.title}>
                      <h2 className="group-head">
                        {group.title}
                        <span className="group-count">{group.items.length}</span>
                      </h2>
                      <ul className="inset-list">
                        {limited.map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            onOpen={onOpenTask}
                            onToggle={onToggle}
                            showAssignee={who === "all"}
                          />
                        ))}
                      </ul>
                      {limited.length < group.items.length && (
                        <button
                          type="button"
                          className="link-more group-more"
                          onClick={() => setShowAllDone(true)}
                        >
                          Yana {group.items.length - limited.length} tasini ko‘rsatish
                        </button>
                      )}
                    </section>
                  );
                })}
            </div>
          ) : (
            <div className="empty empty-quiet">
              <h2>Mos vazifa topilmadi.</h2>
              <p>Boshqa so‘z bilan qidiring yoki saralashni bekor qiling.</p>
              {narrowed && (
                <button type="button" className="link-more" onClick={reset}>
                  Saralashni tozalash
                </button>
              )}
            </div>
          )}
        </section>
      )}
    </>
  );
}
