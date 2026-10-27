"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, ChevronDown, ChevronRight, CircleCheck, Plus, Search, UserRound, Users, X } from "lucide-react";
import type { Account, Member, Task, TaskStatus } from "@/lib/types";
import type { Initial } from "@/lib/initial";
import { REVIEW_STEP } from "@/lib/workflow";
import { api, Avatar, givenName, isOverdue, Modal, Segmented, todayEyebrow, todayISO } from "./ui";
import { Empty, Facts, PageHead, rise } from "./page-parts";
import { NavLabel, Shell, usePolling, useToast } from "./shell";
import { doneToday, sortTasks, TaskGroups } from "./task-list";
import { TaskForm } from "./task-form";
import { TaskSheet } from "./task-sheet";
import { useWarmFiles } from "./files";
import { StatsView } from "./stats-view";
import { TypedLine } from "./typed-line";
import { firstQuote, pickQuote } from "./quotes";

type View = "tasks" | "designers" | "stats";
const HASH: Record<View, string> = { tasks: "#vazifalar", designers: "#dizaynerlar", stats: "#statistika" };
type Filter = "all" | TaskStatus | "overdue";

export function PmPanel({ account, initial }: { account: Account; initial: Initial }) {
  const notify = useToast();
  const [view, setView] = useState<View>("tasks");
  const [tasks, setTasks] = useState<Task[]>(initial.tasks);
  const [designers, setDesigners] = useState<Member[]>(initial.members);
  const [form, setForm] = useState<{ task?: Task } | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [openDesignerId, setOpenDesignerId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [taskData, memberData] = await Promise.all([
      api<{ tasks: Task[] }>("/api/tasks"),
      api<{ members: Member[] }>("/api/members"),
    ]);
    setTasks(taskData.tasks);
    setDesigners(memberData.members);
  }, []);
  useEffect(() => {
    const fromHash = (Object.keys(HASH) as View[]).find((v) => HASH[v] === window.location.hash);
    if (fromHash) setView(fromHash);
  }, []);
  usePolling(refresh);
  useWarmFiles(tasks);

  function go(next: View) {
    setView(next);
    history.replaceState(null, "", HASH[next]);
    window.scrollTo({ top: 0 });
  }
  const upsert = (task: Task) =>
    setTasks((list) => (list.some((t) => t.id === task.id) ? list.map((t) => (t.id === task.id ? task : t)) : [task, ...list]));
  const openTask = tasks.find((t) => t.id === openTaskId);
  const openDesigner = designers.find((d) => d.id === openDesignerId);
  const review = tasks.filter((t) => t.status === "in_review").length;

  return (
    <Shell
      account={account}
      view={view}
      onView={go}
      nav={[
        { value: "tasks", label: "Vazifalar", count: review || undefined },
        { value: "designers", label: <NavLabel long="Dizaynerlar" short={<Users size={16} strokeWidth={1.9} aria-label="Dizaynerlar" />} /> },
        {
          value: "stats",
          label: <NavLabel long="Statistika" short={<BarChart3 size={16} strokeWidth={1.9} aria-label="Statistika" />} />,
        },
      ]}
    >
      {view === "stats" ? (
        <StatsView role="pm" />
      ) : view === "tasks" ? (
        <PmTasks account={account} tasks={tasks} designers={designers} onNew={() => setForm({})} onOpen={(task) => setOpenTaskId(task.id)} />
      ) : (
        <PmDesigners designers={designers} onOpen={(d) => setOpenDesignerId(d.id)} />
      )}

      {openDesigner && (
        <Modal title={openDesigner.name} onClose={() => setOpenDesignerId(null)} hideTitle size="lg">
          <div className="sheet-body">
            <div className="profile">
              <Avatar name={openDesigner.name} size="lg" />
              <div>
                <p className="profile-name" aria-hidden="true">{openDesigner.name}</p>
                <p className="profile-role">Dizayner · @{openDesigner.username}</p>
              </div>
            </div>
            <DesignerFacts member={openDesigner} />
            {tasks.some((t) => t.assigneeId === openDesigner.id) ? (
              <TaskGroups
                groups={[{ key: "all", title: "Olgan vazifalari", items: tasks.filter((t) => t.assigneeId === openDesigner.id).sort(byStage) }]}
                onOpen={(task) => {
                  setOpenDesignerId(null);
                  setOpenTaskId(task.id);
                }}
              />
            ) : (
              <p className="inset-empty">Hali vazifa olmagan.</p>
            )}
          </div>
        </Modal>
      )}
      {openTask && (
        <TaskSheet
          task={openTask}
          account={account}
          onClose={() => setOpenTaskId(null)}
          onUpdated={(task) => {
            upsert(task);
            void refresh().catch(() => {});
          }}
          onEdit={() => {
            setOpenTaskId(null);
            setForm({ task: openTask });
          }}
          onDeleted={() => {
            setTasks((list) => list.filter((t) => t.id !== openTask.id));
            setOpenTaskId(null);
            notify("Vazifa o‘chirildi");
          }}
        />
      )}
      {form && (
        <TaskForm
          task={form.task}
          onClose={() => setForm(null)}
          onSaved={(task) => {
            upsert(task);
            setForm(null);
            notify(form.task ? "Vazifa saqlandi" : "Vazifa ochiq vazifalarga qo‘yildi");
          }}
        />
      )}
    </Shell>
  );
}

/** Ish bosqichi bo‘yicha: tekshiruv → jarayon → ochiq → bajarilgan → bekor qilingan. */
function byStage(a: Task, b: Task) {
  const order: Record<TaskStatus, number> = { in_review: 0, in_progress: 1, todo: 2, done: 3, cancelled: 4 };
  return order[a.status] - order[b.status] || sortTasks(a, b);
}

function PmTasks({
  account,
  tasks,
  designers,
  onNew,
  onOpen,
}: {
  account: Account;
  tasks: Task[];
  designers: Member[];
  onNew: () => void;
  onOpen: (task: Task) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [whoChoice, setWho] = useState("all");
  const [query, setQuery] = useState("");
  const who = designers.some((d) => d.id === whoChoice) ? whoChoice : "all";
  const today = todayEyebrow();
  const counts = useMemo(
    () => ({
      todo: tasks.filter((t) => t.status === "todo").length,
      in_progress: tasks.filter((t) => t.status === "in_progress").length,
      in_review: tasks.filter((t) => t.status === "in_review").length,
      done: tasks.filter((t) => t.status === "done").length,
      cancelled: tasks.filter((t) => t.status === "cancelled").length,
      overdue: tasks.filter((t) => isOverdue(t.dueDate, t.status)).length,
    }),
    [tasks],
  );
  const finished = doneToday(tasks, todayISO());
  const context = {
    total: tasks.length,
    open: counts.todo,
    inProgress: counts.in_progress,
    doneToday: finished.tasks,
    imagesToday: finished.images,
    overdue: counts.overdue,
  };
  const quote = (recent: string[]) => (recent.length ? pickQuote("pm", context, recent) : firstQuote("pm", context));
  const needle = query.trim().toLowerCase();
  const visible = tasks
    .filter(
      (t) =>
        (who === "all" || t.assigneeId === who) &&
        (filter === "all" || (filter === "overdue" ? isOverdue(t.dueDate, t.status) : t.status === filter)) &&
        (!needle || `${t.title} ${t.brief} ${t.assigneeName || ""}`.toLowerCase().includes(needle)),
    )
    .sort(sortTasks);
  const groups =
    filter === "overdue"
      ? [{ key: "overdue", title: "Muddati o‘tgan", items: visible }]
      : [
          { key: "in_review", title: "Tekshiruvda", hint: "Sizning javobingizni kutmoqda", items: visible.filter((t) => t.status === "in_review") },
          { key: "in_progress", title: "Jarayonda", items: visible.filter((t) => t.status === "in_progress") },
          { key: "todo", title: "Ochiq", hint: "Hali hech bir dizayner olmagan", items: visible.filter((t) => t.status === "todo") },
          { key: "done", title: "Bajarildi", items: visible.filter((t) => t.status === "done") },
          { key: "cancelled", title: "Bekor qilingan", items: visible.filter((t) => t.status === "cancelled") },
        ];
  const newButton = (
    <button className="btn btn-primary btn-lg" onClick={onNew}>
      <Plus size={19} strokeWidth={2.2} aria-hidden="true" />
      Vazifa qo‘yish
    </button>
  );
  return (
    <>
      <PageHead
        eyebrow={
          <>
            <span className="eyebrow-accent">{today.date}</span> · {today.weekday}
          </>
        }
        title={`Salom, ${givenName(account.name)}.`}
        dim={<TypedLine next={quote} />}
        lead="Vazifani qo‘ying — dizaynerlar o‘zlari olishadi. Kerak bo‘lsa, vazifani tahrirlang yoki bekor qiling."
        action={newButton}
      />
      <Facts<Filter>
        active={filter}
        onSelect={setFilter}
        items={[
          ...(REVIEW_STEP
            ? [{ key: "in_review" as Filter, label: "Tekshiruvda", value: counts.in_review, tone: "accent" as const }]
            : []),
          { key: "in_progress", label: "Jarayonda", value: counts.in_progress, tone: REVIEW_STEP ? undefined : "accent" },
          { key: "todo", label: "Ochiq", value: counts.todo },
          { key: "done", label: "Bajarildi", value: counts.done },
          { key: "overdue", label: "Muddati o‘tgan", value: counts.overdue, tone: "bad" },
        ]}
      />
      {!tasks.length ? (
        <Empty
          icon={<CircleCheck size={26} strokeWidth={1.6} />}
          title="Hali vazifa yo‘q."
          text="Birinchi vazifani qo‘ying: nomi, TZ va nechta rasm kerakligi kifoya. Dizaynerlar uni ochiq vazifalarda ko‘radi."
          action={
            <button className="btn btn-primary" onClick={onNew}>
              <Plus size={17} strokeWidth={2.2} aria-hidden="true" />
              Vazifa qo‘yish
            </button>
          }
        />
      ) : (
        <section className="board rise" style={rise(4)} aria-label="Vazifalar ro‘yxati">
          <div className="toolbar">
            <Segmented<Filter>
              label="Holat bo‘yicha saralash"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "Barchasi", count: tasks.length },
                ...(REVIEW_STEP ? [{ value: "in_review" as Filter, label: "Tekshiruvda" }] : []),
                { value: "in_progress", label: "Jarayonda" },
                { value: "todo", label: "Ochiq" },
                { value: "done", label: "Bajarildi" },
                ...(counts.cancelled ? [{ value: "cancelled" as Filter, label: "Bekor qilingan" }] : []),
              ]}
            />
            <div className="toolbar-filters">
              <label className="pill-field select-pill">
                <UserRound size={15} strokeWidth={1.8} aria-hidden="true" />
                <span className="sr-only">Dizayner bo‘yicha saralash</span>
                <select value={who} onChange={(e) => setWho(e.target.value)}>
                  <option value="all">Barcha dizaynerlar</option>
                  {designers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} strokeWidth={2} aria-hidden="true" />
              </label>
              <label className="pill-field search-pill">
                <Search size={15} strokeWidth={1.8} aria-hidden="true" />
                <span className="sr-only">Vazifalarni qidirish</span>
                <input type="search" placeholder="Qidirish" value={query} onChange={(e) => setQuery(e.target.value)} />
                {query && (
                  <button type="button" className="pill-clear" aria-label="Qidiruvni tozalash" onClick={() => setQuery("")}>
                    <X size={13} strokeWidth={2.4} />
                  </button>
                )}
              </label>
            </div>
          </div>
          {visible.length ? (
            <TaskGroups groups={groups} onOpen={onOpen} person={who === "all" ? "assignee" : undefined} />
          ) : (
            <div className="empty empty-quiet">
              <h2>Mos vazifa topilmadi.</h2>
              <p>Boshqa so‘z bilan qidiring yoki saralashni bekor qiling.</p>
              <button
                type="button"
                className="link-more"
                onClick={() => {
                  setFilter("all");
                  setWho("all");
                  setQuery("");
                }}
              >
                Saralashni tozalash
              </button>
            </div>
          )}
        </section>
      )}
    </>
  );
}

export function DesignerFacts({ member }: { member: Member }) {
  const s = member.stats;
  return (
    <div className="mini-facts">
      <span><strong>{s.inProgress}</strong>jarayonda</span>
      {REVIEW_STEP && <span><strong>{s.inReview}</strong>tekshiruvda</span>}
      <span><strong>{s.done}</strong>bajarildi</span>
      {s.overdue > 0 && (
        <span className="is-bad"><strong>{s.overdue}</strong>kechikkan</span>
      )}
    </div>
  );
}

function PmDesigners({ designers, onOpen }: { designers: Member[]; onOpen: (member: Member) => void }) {
  const busy = designers.filter((d) => d.stats.inProgress + d.stats.inReview > 0).length;
  return (
    <>
      <PageHead
        eyebrow={<span className="eyebrow-accent">Jamoa · {designers.length} dizayner</span>}
        title="Dizaynerlar."
        dim="Kim qancha ish bilan band."
        lead="Dizaynerlar vazifani o‘zlari olishadi. Bu yerda kim nima ustida ishlayotganini ko‘rasiz."
      />
      {designers.length > 0 && (
        <Facts
          items={[
            { key: "all", label: "Dizayner", value: designers.length },
            { key: "busy", label: "Ishda", value: busy },
            { key: "free", label: "Bo‘sh", value: designers.length - busy },
          ]}
        />
      )}
      {designers.length ? (
        <ul className="people-grid" aria-label="Dizaynerlar">
          {designers.map((member, index) => (
            <li key={member.id} className="rise" style={rise(4 + Math.min(index, 8))}>
              <MemberCard member={member} onOpen={() => onOpen(member)} />
            </li>
          ))}
        </ul>
      ) : (
        <Empty
          icon={<Users size={26} strokeWidth={1.6} />}
          title="Dizaynerlar hali yo‘q."
          text="Dizaynerlarni administrator qo‘shadi. Qo‘shilgach, ular shu yerda ko‘rinadi."
        />
      )}
    </>
  );
}

/** Hodim kartasi: katta raqam — dizaynerda hozirgi ishlari, PMda qo‘ygan vazifalari. */
export function MemberCard({ member, onOpen, showStatus = false }: { member: Member; onOpen: () => void; showStatus?: boolean }) {
  const s = member.stats;
  const active = s.inProgress + s.inReview;
  const total = active + s.done;
  const isDesigner = member.role === "designer";
  return (
    <button type="button" className="person-card" onClick={onOpen}>
      <span className="pc-top">
        <span className="pc-count">
          <span className="pc-num">{String(isDesigner ? active : s.created).padStart(2, "0")}</span>
          <span className="pc-num-label">
            {isDesigner ? <>hozirgi<br />ishi</> : <>qo‘ygan<br />vazifasi</>}
          </span>
        </span>
        <span className="pc-arrow" aria-hidden="true">
          <ChevronRight size={16} strokeWidth={2.2} />
        </span>
      </span>
      <span className="pc-body">
        <Avatar name={member.name} />
        <span>
          <span className="pc-name">{member.name}</span>
          <span className="pc-role">@{member.username}</span>
        </span>
      </span>
      <span className="pc-foot">
        {isDesigner && (
          <>
            <span className="pc-bar" role="img" aria-label={`${total} tadan ${s.done} tasi bajarilgan`}>
              <span style={{ width: total ? `${(s.done / total) * 100}%` : 0 }} />
            </span>
            <span className="pc-meta">
              <span>{s.inProgress} jarayonda</span>
              {REVIEW_STEP && <span>{s.inReview} tekshiruvda</span>}
              <span>{s.done} bajarildi</span>
            </span>
          </>
        )}
        <span className="pc-tags">
          {showStatus &&
            (member.activated ? (
              <span className="tag tag-accent">Faol</span>
            ) : (
              <span className="tag tag-warn">Ro‘yxatdan o‘tmagan</span>
            ))}
          {isDesigner && !active && <span className="tag">Bo‘sh</span>}
          {s.overdue > 0 && <span className="tag tag-bad">{s.overdue} ta kechikkan</span>}
        </span>
      </span>
    </button>
  );
}
