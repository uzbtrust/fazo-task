"use client";
import { useCallback, useEffect, useState } from "react";
import { Inbox, Sparkles } from "lucide-react";
import type { Account, Task, TaskStatus } from "@/lib/types";
import type { Initial } from "@/lib/initial";
import { REVIEW_STEP } from "@/lib/workflow";
import { api, givenName, todayEyebrow } from "./ui";
import { Empty, Facts, PageHead, rise } from "./page-parts";
import { Shell, usePolling } from "./shell";
import { returnNote, sortTasks, TaskGroups } from "./task-list";
import { TaskSheet } from "./task-sheet";
import { useWarmFiles } from "./files";

type View = "mine" | "open";

export function DesignerPanel({ account, initial }: { account: Account; initial: Initial }) {
  const [view, setView] = useState<View>("mine");
  const [tasks, setTasks] = useState<Task[]>(initial.tasks);
  const [filter, setFilter] = useState<TaskStatus | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setTasks((await api<{ tasks: Task[] }>("/api/tasks")).tasks);
  }, []);
  useEffect(() => {
    if (window.location.hash === "#ochiq") setView("open");
  }, []);
  usePolling(refresh);
  useWarmFiles(tasks);

  function go(next: View) {
    setView(next);
    history.replaceState(null, "", next === "open" ? "#ochiq" : "#vazifalarim");
    window.scrollTo({ top: 0 });
  }
  const mine = tasks.filter((t) => t.assigneeId === account.id);
  const pool = tasks.filter((t) => !t.assigneeId && t.status === "todo").sort(sortTasks);
  const count = (status: TaskStatus) => mine.filter((t) => t.status === status).length;
  const visible = mine.filter((t) => filter === "all" || t.status === filter).sort(sortTasks);
  const open = tasks.find((t) => t.id === openId);
  const today = todayEyebrow();
  const eyebrow = (
    <>
      <span className="eyebrow-accent">{today.date}</span> · {today.weekday}
    </>
  );

  return (
    <Shell
      account={account}
      view={view}
      onView={go}
      nav={[
        { value: "mine", label: "Mening vazifalarim" },
        { value: "open", label: "Ochiq vazifalar", count: pool.length || undefined },
      ]}
    >
      {view === "mine" ? (
        <>
          <PageHead
            eyebrow={eyebrow}
            title={`Salom, ${givenName(account.name)}.`}
            dim={count("in_progress") ? `${count("in_progress")} ta ish qo‘lingizda.` : "Hozir qo‘lingiz bo‘sh."}
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
