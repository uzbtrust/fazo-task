"use client";
import { useCallback, useEffect, useState } from "react";
import { BarChart3, Inbox } from "lucide-react";
import type { Account, Task } from "@/lib/types";
import type { Initial } from "@/lib/initial";
import { REVIEW_STEP } from "@/lib/workflow";
import { api, givenName, isOverdue, todayEyebrow, todayISO } from "./ui";
import { Empty, PageHead } from "./page-parts";
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
  // Foydalanuvchi tanlagan bo‘lim; tanlamagan bo‘lsa, bo‘lim vazifalarga qarab belgilanadi.
  const [chosen, setChosen] = useState<View | null>(null);
  const [tasks, setTasks] = useState<Task[]>(initial.tasks);
  const [openId, setOpenId] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setTasks((await api<{ tasks: Task[] }>("/api/tasks")).tasks);
  }, []);
  useEffect(() => {
    const fromHash = (Object.keys(HASH) as View[]).find((v) => HASH[v] === window.location.hash);
    if (fromHash) setChosen(fromHash);
  }, []);
  usePolling(refresh);
  useWarmFiles(tasks);

  function go(next: View) {
    setChosen(next);
    history.replaceState(null, "", HASH[next]);
    window.scrollTo({ top: 0 });
  }
  const mine = tasks.filter((t) => t.assigneeId === account.id);
  // Ish stolida faqat amaldagi vazifalar; tugaganlari Statistikada.
  const active = mine.filter((t) => t.status === "in_progress" || t.status === "in_review").sort(sortTasks);
  const finished = mine.filter((t) => t.status === "done" || t.status === "cancelled");
  const pool = tasks.filter((t) => !t.assigneeId && t.status === "todo").sort(sortTasks);
  // Amaldagi vazifa bo‘lmasa, «Mening vazifalarim» bo‘limi yo‘q — ochiq vazifalar ochiladi.
  const view: View = chosen === "mine" && !active.length ? "open" : chosen || (active.length ? "mine" : "open");
  useEffect(() => {
    if (window.location.hash === HASH.mine && view !== "mine") history.replaceState(null, "", HASH[view]);
  }, [view]);
  const open = tasks.find((t) => t.id === openId);
  // Jumla holatga qarab: bo‘shmi, ish ko‘pmi, bugun samarali bo‘ldimi.
  const today = doneToday(mine, todayISO());
  const context = {
    inProgress: active.filter((t) => t.status === "in_progress").length,
    open: pool.length,
    doneToday: today.tasks,
    imagesToday: today.images,
    overdue: mine.filter((t) => isOverdue(t.dueDate, t.status, t.dueTime)).length,
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
        ...(active.length
          ? [{ value: "mine" as View, label: <NavLabel long="Mening vazifalarim" short="Vazifalarim" /> }]
          : []),
        { value: "open", label: <NavLabel long="Ochiq vazifalar" short="Ochiq" />, count: pool.length || undefined },
        {
          value: "stats",
          label: <NavLabel long="Statistika" short={<BarChart3 size={16} strokeWidth={1.9} aria-label="Statistika" />} />,
        },
      ]}
    >
      {view === "stats" ? (
        <StatsView role="designer" archive={{ tasks: finished, person: "creator", onOpen: (task) => setOpenId(task.id) }} />
      ) : view === "mine" ? (
        <>
          <PageHead
            eyebrow={eyebrow}
            title={`Salom, ${givenName(account.name)}.`}
            dim={<TypedLine next={quote} />}
            lead={
              REVIEW_STEP
                ? "Taskni o‘qing, tayyor rasmlarni yuklang va tekshiruvga topshiring."
                : "Taskni o‘qing, ishni PMga ko‘rsating va kelishgach «Tugatdim» deb belgilang."
            }
          />
          <section className="board" aria-label="Mening vazifalarim">
            <TaskGroups
              person="creator"
              onOpen={(task) => setOpenId(task.id)}
              groups={[
                { key: "returned", title: "Qaytarilgan", hint: "Tuzatib, qayta topshiring", items: active.filter((t) => returnNote(t)) },
                { key: "in_progress", title: "Jarayonda", items: active.filter((t) => t.status === "in_progress" && !returnNote(t)) },
                { key: "in_review", title: "Tekshiruvda", hint: "PM javobini kutmoqda", items: active.filter((t) => t.status === "in_review") },
              ]}
            />
          </section>
        </>
      ) : (
        <>
          <PageHead
            eyebrow={eyebrow}
            title="Ochiq vazifalar."
            dim="O‘zingizga mosini oling."
            lead="Bu vazifalarni hali hech kim olmagan. Taskni ochib ko‘ring va «Men olaman»ni bosing — vazifa sizga o‘tadi."
          />
          {pool.length ? (
            <section className="board" aria-label="Ochiq vazifalar">
              <TaskGroups
                person="creator"
                onOpen={(task) => setOpenId(task.id)}
                groups={[{ key: "open", title: "Olinmagan", items: pool }]}
              />
            </section>
          ) : (
            <Empty
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
            // Vazifa endi olindi: orqada «Mening vazifalarim» ochiladi.
            if (!open.assigneeId && task.assigneeId === account.id) go("mine");
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
