"use client";
import { useCallback, useEffect, useState } from "react";
import { BarChart3, Inbox, Sparkles } from "lucide-react";
import type { Account, Task, TaskStatus } from "@/lib/types";
import type { Initial } from "@/lib/initial";
import { REVIEW_STEP } from "@/lib/workflow";
import { api, givenName, isOverdue, todayEyebrow, todayISO } from "./ui";
import { Empty, Facts, PageHead, rise } from "./page-parts";
import { NavLabel, Shell, usePolling } from "./shell";
import { doneToday, returnNote, sortTasks, TaskGroups } from "./task-list";
import { TaskSheet } from "./task-sheet";
import { useWarmFiles } from "./files";
import { StatsView } from "./stats-view";
import { TypedLine } from "./typed-line";
import { firstQuote, pickQuote } from "./quotes";

type View = "mine" | "open" | "stats";
const HASH: Record<View, string> = { mine: "#vazifalarim", open: "#ochiq", stats: "#statistika" };

export function DesignerPanel({ account, initial }: { account: Account; initial: Initial }) {
  const [view, setView] = useState<View>("mine");
  const [tasks, setTasks] = useState<Task[]>(initial.tasks);
  const [filter, setFilter] = useState<TaskStatus | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setTasks((await api<{ tasks: Task[] }>("/api/tasks")).tasks);
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
  const mine = tasks.filter((t) => t.assigneeId === account.id);
  const pool = tasks.filter((t) => !t.assigneeId && t.status === "todo").sort(sortTasks);
  const count = (status: TaskStatus) => mine.filter((t) => t.status === status).length;
  const visible = mine.filter((t) => filter === "all" || t.status === filter).sort(sortTasks);
  const open = tasks.find((t) => t.id === openId);
  // Jumla holatga qarab: bo‘shmi, ish ko‘pmi, bugun samarali bo‘ldimi.
  const today = doneToday(mine, todayISO());
  const context = {
    inProgress: count("in_progress"),
    open: pool.length,
    doneToday: today.tasks,
    imagesToday: today.images,
    overdue: mine.filter((t) => isOverdue(t.dueDate, t.status)).length,
  };
  const quote = (recent: string[]) =>
    recent.length ? pickQuote("designer", context, recent) : firstQuote("designer", context);
  const date = todayEyebrow();
  const eyebrow = (
    <>
      <span className="eyebrow-accent">{date.date}</span> · {date.weekday}
    </>
  );

  return (
    <Shell
      account={account}
      view={view}
      onView={go}
      nav={[
        { value: "mine", label: <NavLabel long="Mening vazifalarim" short="Vazifalarim" /> },
        { value: "open", label: <NavLabel long="Ochiq vazifalar" short="Ochiq" />, count: pool.length || undefined },
        {
          value: "stats",
          label: <NavLabel long="Statistika" short={<BarChart3 size={16} strokeWidth={1.9} aria-label="Statistika" />} />,
        },
      ]}
    >
      {view === "stats" ? (
        <StatsView role="designer" />
      ) : view === "mine" ? (
        <>
          <PageHead
            eyebrow={eyebrow}
            title={`Salom, ${givenName(account.name)}.`}
            dim={<TypedLine next={quote} />}
            lead={
              REVIEW_STEP
                ? "TZ ni o‘qing, tayyor rasmlarni yuklang va tekshiruvga topshiring."
                : "TZ ni o‘qing, ishni PMga ko‘rsating va kelishgach «Tugatdim» deb belgilang."
            }
            action={
              pool.length > 0 && (
                <button className="btn btn-secondary btn-lg" onClick={() => go("open")}>
                  <Sparkles size={17} strokeWidth={2} aria-hidden="true" />
                  {pool.length} ta ochiq vazifa
                </button>
              )
            }
          />
          <Facts<TaskStatus>
            active={filter}
            onSelect={setFilter}
            items={[
              { key: "in_progress", label: "Jarayonda", value: count("in_progress"), tone: "accent" },
              ...(REVIEW_STEP ? [{ key: "in_review" as TaskStatus, label: "Tekshiruvda", value: count("in_review") }] : []),
              { key: "done", label: "Bajarildi", value: count("done") },
              ...(count("cancelled") ? [{ key: "cancelled" as TaskStatus, label: "Bekor qilingan", value: count("cancelled") }] : []),
            ]}
          />
          {mine.length ? (
            <section className="board rise" style={rise(4)} aria-label="Mening vazifalarim">
              <TaskGroups
                person="creator"
                onOpen={(task) => setOpenId(task.id)}
                groups={[
                  { key: "returned", title: "Qaytarilgan", hint: "Tuzatib, qayta topshiring", items: visible.filter((t) => returnNote(t)) },
                  { key: "in_progress", title: "Jarayonda", items: visible.filter((t) => t.status === "in_progress" && !returnNote(t)) },
                  { key: "in_review", title: "Tekshiruvda", hint: "PM javobini kutmoqda", items: visible.filter((t) => t.status === "in_review") },
                  { key: "done", title: "Bajarildi", items: visible.filter((t) => t.status === "done") },
                  { key: "cancelled", title: "Bekor qilingan", hint: "PM bekor qilgan", items: visible.filter((t) => t.status === "cancelled") },
                ]}
              />
            </section>
          ) : (
            <Empty
              icon={<Inbox size={26} strokeWidth={1.6} />}
              title="Hali vazifa olmadingiz."
              text="Ochiq vazifalardan o‘zingizga mosini tanlang — «Men olaman» tugmasi bilan."
              action={
                <button className="btn btn-primary" onClick={() => go("open")}>
                  Ochiq vazifalarga o‘tish
                </button>
              }
            />
          )}
        </>
      ) : (
        <>
          <PageHead
            eyebrow={eyebrow}
            title="Ochiq vazifalar."
            dim="O‘zingizga mosini oling."
            lead="Bu vazifalarni hali hech kim olmagan. TZ ni ochib ko‘ring va «Men olaman»ni bosing — vazifa sizga o‘tadi."
          />
          {pool.length ? (
            <section className="board rise" style={rise(3)} aria-label="Ochiq vazifalar">
              <TaskGroups
                person="creator"
                onOpen={(task) => setOpenId(task.id)}
                groups={[{ key: "open", title: "Olinmagan", items: pool }]}
              />
            </section>
          ) : (
            <Empty
              index={3}
              icon={<Inbox size={26} strokeWidth={1.6} />}
              title="Ochiq vazifa yo‘q."
              text="Hamma vazifalar olingan. Project manager yangisini qo‘yganda shu yerda paydo bo‘ladi."
            />
          )}
        </>
      )}
      {open && (
        <TaskSheet
          task={open}
          account={account}
          onClose={() => setOpenId(null)}
          onUpdated={(task) => {
            setTasks((list) =>
              task.assigneeId && task.assigneeId !== account.id
                ? list.filter((t) => t.id !== task.id)
                : list.map((t) => (t.id === task.id ? task : t)),
            );
            void refresh().catch(() => {});
          }}
        />
      )}
    </Shell>
  );
}
