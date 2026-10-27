"use client";
import { useCallback, useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import type { Stats, StatsRow } from "@/lib/types";
import { REVIEW_STEP } from "@/lib/workflow";
import { api, Avatar, Segmented, Spinner } from "./ui";
import { Empty, Facts, PageHead, rise } from "./page-parts";
import { usePolling, useToast } from "./shell";

type Period = Stats["period"];

const cache = new Map<Period, Promise<Stats>>();
/** Statistikani oldindan so‘rab qo‘yadi; StatsView shu natijadan boshlaydi. */
export function prefetchStats(period: Period) {
  if (!cache.has(period)) {
    const request = api<{ stats: Stats }>(`/api/stats?period=${period}`).then((r) => r.stats);
    request.catch(() => cache.delete(period));
    cache.set(period, request);
  }
  return cache.get(period)!;
}

function duration(hours: number | null) {
  if (hours === null) return "—";
  if (hours < 1) return "1 soatdan kam";
  if (hours < 24) return `${Math.round(hours)} soat`;
  return `${(hours / 24).toFixed(hours < 240 ? 1 : 0)} kun`;
}
const percent = (part: number, total: number) => (total ? Math.round((part / total) * 100) : null);

export function StatsView() {
  const notify = useToast();
  const [period, setPeriod] = useState<Period>("30");
  const [stats, setStats] = useState<Stats | null>(null);
  const refresh = useCallback(async () => {
    const fresh = (await api<{ stats: Stats }>(`/api/stats?period=${period}`)).stats;
    cache.set(period, Promise.resolve(fresh));
    setStats(fresh);
  }, [period]);
  useEffect(() => {
    // Avval keshdagi (oldindan yuklangan) natija, keyin yangilanadi.
    prefetchStats(period).then(setStats, (e) => notify({ message: (e as Error).message, tone: "error" }));
  }, [period, notify]);
  usePolling(refresh);

  const t = stats?.totals;
  const onTimeShare = t ? percent(t.onTime, t.onTime + t.late) : null;
  const periodLabel = period === "7" ? "So‘nggi 7 kun" : period === "30" ? "So‘nggi 30 kun" : "Butun davr";
  return (
    <>
      <PageHead
        eyebrow={<span className="eyebrow-accent">Statistika · {periodLabel}</span>}
        title="Natijalar."
        dim="Kim qancha va qanday ishladi."
        lead="Qabul qilingan ishlar, rasmlar soni va muddatga rioya. Yangi hodim qo‘shilsa, u ham shu yerda paydo bo‘ladi."
        action={
          <Segmented<Period>
            label="Davr"
            value={period}
            onChange={setPeriod}
            options={[
              { value: "7", label: "7 kun" },
              { value: "30", label: "30 kun" },
              { value: "all", label: "Hammasi" },
            ]}
          />
        }
      />
      {!stats || !t ? (
        <div className="page-loading">
          <Spinner />
        </div>
      ) : (
        <>
          <Facts
            items={[
              { key: "done", label: "Bajarilgan vazifa", value: t.done },
              { key: "images", label: "Tayyorlangan rasm", value: t.images },
              // Muddatli ish bo‘lmasa foiz ma’nosiz — ko‘rsatilmaydi.
              ...(onTimeShare === null
                ? []
                : [
                    { key: "ontime", label: "Vaqtida topshirilgan, %", value: onTimeShare, tone: "accent" as const },
                    { key: "late", label: "Kechikib topshirilgan", value: t.late, tone: "bad" as const },
                  ]),
              { key: "open", label: "Hozir ochiq", value: t.open },
            ]}
          />
          {stats.designers.length ? (
            <section className="stats-section rise" style={rise(4)} aria-label="Dizaynerlar natijasi">
              <div className="role-head">
                <h2 className="group-head">
                  Dizaynerlar
                  <span className="group-count">{stats.designers.length}</span>
                </h2>
                <p>Ko‘p rasm topshirganlar tepada.</p>
              </div>
              <DesignerTable rows={stats.designers} />
            </section>
          ) : (
            <Empty
              icon={<BarChart3 size={26} strokeWidth={1.6} />}
              title="Hali statistika yo‘q."
              text="Dizayner qo‘shilib, birinchi ish qabul qilinganda natijalar shu yerda ko‘rinadi."
            />
          )}
          {stats.managers.length > 0 && (
            <section className="stats-section rise" style={rise(5)} aria-label="Project managerlar natijasi">
              <div className="role-head">
                <h2 className="group-head">
                  Project managerlar
                  <span className="group-count">{stats.managers.length}</span>
                </h2>
                <p>Qo‘yilgan va bajarilgan vazifalar.</p>
              </div>
              <div className="stats-table" role="table" aria-label="Project managerlar">
                <div className="stats-head is-pm" role="row">
                  <span role="columnheader">Project manager</span>
                  <span role="columnheader">Qo‘ygan</span>
                  <span role="columnheader">Bajarilgan</span>
                </div>
                {stats.managers.map((row) => (
                  <div key={row.id} className="stats-row is-pm" role="row">
                    <span className="stats-person" role="cell">
                      <Avatar name={row.name} size="sm" />
                      <strong>{row.name}</strong>
                    </span>
                    <span className="stats-num" role="cell" data-label="Qo‘ygan">{row.created}</span>
                    <span className="stats-num" role="cell" data-label="Bajarilgan">{row.accepted}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
          <p className="stats-note">
            «Vaqtida» — dizayner ishni muddat kuni tugaguncha (Toshkent vaqti) tugatgan. Muddatsiz va bekor qilingan
            vazifalar bu foizga kirmaydi. Davr vazifa bajarilgan sana bo‘yicha hisoblanadi.
          </p>
        </>
      )}
    </>
  );
}

function DesignerTable({ rows }: { rows: StatsRow[] }) {
  const sorted = [...rows].sort((a, b) => b.images - a.images || b.done - a.done);
  const max = Math.max(1, ...sorted.map((r) => r.images));
  return (
    <div className={`stats-table ${REVIEW_STEP ? "" : "no-returns"}`} role="table" aria-label="Dizaynerlar">
      <div className="stats-head" role="row">
        <span role="columnheader">Dizayner</span>
        <span role="columnheader">Rasmlar</span>
        <span role="columnheader">Vazifa</span>
        <span role="columnheader">Vaqtida</span>
        {REVIEW_STEP && <span role="columnheader">Qaytarildi</span>}
        <span role="columnheader">O‘rtacha vaqt</span>
        <span role="columnheader">Hozir</span>
      </div>
      {sorted.map((row) => {
        const timed = row.onTime + row.late;
        const share = percent(row.onTime, timed);
        return (
          <div key={row.id} className="stats-row" role="row">
            <span className="stats-person" role="cell">
              <Avatar name={row.name} size="sm" />
              <strong>{row.name}</strong>
            </span>
            <span className="stats-bar-cell" role="cell" data-label="Rasmlar">
              <span className="stats-bar" title={`${row.name}: ${row.images} ta rasm, ${row.done} ta vazifa`}>
                <span style={{ width: `${(row.images / max) * 100}%` }} />
              </span>
              <span className="stats-num">{row.images}</span>
            </span>
            <span className="stats-num" role="cell" data-label="Vazifa">{row.done}</span>
            <span className="stats-ontime" role="cell" data-label="Vaqtida" title={`${row.onTime} ta vaqtida, ${row.late} ta kechikib, ${row.noDeadline} ta muddatsiz`}>
              {share === null ? (
                <span className="stats-muted">—</span>
              ) : (
                <>
                  <span className={`stats-num ${share < 70 ? "is-low" : ""}`}>{share}%</span>
                  <small>
                    {row.onTime}/{timed}
                  </small>
                </>
              )}
            </span>
            {REVIEW_STEP && <span className="stats-num" role="cell" data-label="Qaytarildi">{row.returns}</span>}
            <span className="stats-text" role="cell" data-label="O‘rtacha vaqt">{duration(row.avgHours)}</span>
            <span className="stats-text" role="cell" data-label="Hozir">
              {row.inProgress + row.inReview
                ? [row.inProgress && `${row.inProgress} jarayonda`, row.inReview && `${row.inReview} tekshiruvda`].filter(Boolean).join(", ")
                : "Bo‘sh"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
