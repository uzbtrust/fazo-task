"use client";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { BarChart3, ChevronDown } from "lucide-react";
import type { DailyPoint, Role, Stats, StatsRow } from "@/lib/types";
import { REVIEW_STEP } from "@/lib/workflow";
import { api, Avatar, longDate, Segmented, shortDate, Spinner } from "./ui";
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

const heads: Record<Role, { title: string; dim: string; lead: string }> = {
  admin: {
    title: "Natijalar.",
    dim: "Kim qancha va qanday ishladi.",
    lead: "Bajarilgan ishlar, dizaynlar soni va muddatga rioya. Dizaynerni bosing — uning kunlik grafigi ochiladi.",
  },
  pm: {
    title: "Natijalar.",
    dim: "Bergan TZ va tayyor dizaynlar.",
    lead: "Siz qo‘ygan vazifalar bo‘yicha: nechtasi bajarildi, nechta dizayn tayyor bo‘ldi va kim qancha qildi.",
  },
  designer: {
    title: "Natijalarim.",
    dim: "Kunma-kun nima qildingiz.",
    lead: "Bajarilgan ishlaringiz, tayyorlagan dizaynlaringiz va muddatga rioya.",
  },
};

export function StatsView({ role }: { role: Role }) {
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
  const head = heads[role];
  const onTimeFacts =
    onTimeShare === null || !t
      ? []
      : [
          { key: "ontime", label: "Vaqtida, %", value: onTimeShare, tone: "accent" as const },
          { key: "late", label: "Kechikkan", value: t.late, tone: "bad" as const },
        ];
  return (
    <>
      <PageHead
        eyebrow={<span className="eyebrow-accent">Statistika · {periodLabel}</span>}
        title={head.title}
        dim={head.dim}
        lead={head.lead}
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
            items={
              role === "pm"
                ? [
                    { key: "created", label: "Bergan TZ", value: t.created, tone: "accent" as const },
                    { key: "done", label: "Bajarilgan vazifa", value: t.done },
                    { key: "images", label: "Tayyor dizayn", value: t.images },
                    { key: "progress", label: "Jarayonda", value: t.inProgress },
                    { key: "open", label: "Hozir ochiq", value: t.open },
                  ]
                : role === "designer"
                  ? [
                      { key: "images", label: "Tayyorlagan dizayn", value: t.images, tone: "accent" as const },
                      { key: "done", label: "Bajarilgan vazifa", value: t.done },
                      ...onTimeFacts,
                      { key: "progress", label: "Hozir qo‘lda", value: t.inProgress },
                    ]
                  : [
                      { key: "done", label: "Bajarilgan vazifa", value: t.done },
                      { key: "images", label: "Tayyor dizayn", value: t.images },
                      ...onTimeFacts,
                      { key: "open", label: "Hozir ochiq", value: t.open },
                    ]
            }
          />
          <section className="stats-section rise" style={rise(4)} aria-label="Kunlik dizaynlar">
            <DailyChart
              points={stats.daily}
              title={role === "designer" ? "Kunlik dizaynlaringiz" : role === "pm" ? "Vazifalaringiz bo‘yicha kunlik dizaynlar" : "Jamoaning kunlik dizaynlari"}
            />
            {role === "designer" && t.avgHours !== null && (
              <p className="stats-note">O‘rtacha bajarish vaqti (olishdan tugatishgacha): {duration(t.avgHours)}.</p>
            )}
          </section>
          {role !== "designer" &&
            (stats.designers.length ? (
              <section className="stats-section rise" style={rise(5)} aria-label="Dizaynerlar natijasi">
                <div className="role-head">
                  <h2 className="group-head">
                    Dizaynerlar
                    <span className="group-count">{stats.designers.length}</span>
                  </h2>
                  <p>{role === "admin" ? "Ko‘p dizayn qilganlar tepada. Qatorni bosing — kunlik grafik." : "Sizning vazifalaringizda kim qancha qildi."}</p>
                </div>
                <DesignerTable rows={stats.designers} dailyBy={role === "admin" ? stats.dailyBy : undefined} />
              </section>
            ) : (
              <Empty
                index={5}
                icon={<BarChart3 size={26} strokeWidth={1.6} />}
                title="Hali natija yo‘q."
                text="Birinchi vazifa bajarilganda kim qancha qilgani shu yerda ko‘rinadi."
              />
            ))}
          {role === "admin" && stats.managers.length > 0 && (
            <section className="stats-section rise" style={rise(6)} aria-label="Project managerlar natijasi">
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
                  <span role="columnheader">Bergan TZ</span>
                  <span role="columnheader">Bajarilgan</span>
                </div>
                {stats.managers.map((row) => (
                  <div key={row.id} className="stats-row is-pm" role="row">
                    <span className="stats-person" role="cell">
                      <Avatar name={row.name} size="sm" />
                      <strong>{row.name}</strong>
                    </span>
                    <span className="stats-num" role="cell" data-label="Bergan TZ">{row.created}</span>
                    <span className="stats-num" role="cell" data-label="Bajarilgan">{row.accepted}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
          <p className="stats-note">
            «Vaqtida» — ish muddat kuni tugaguncha (Toshkent vaqti) tugatilgan. Muddatsiz va bekor qilingan
            vazifalar bu foizga kirmaydi. Grafikda «Hammasi» so‘nggi 90 kunni ko‘rsatadi.
          </p>
        </>
      )}
    </>
  );
}

/** Grafik shkalasi uchun «yumaloq» yuqori chegara. */
function niceMax(value: number) {
  if (value <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 4, 6, 8, 10]) if (value <= step * pow) return step * pow;
  return value;
}

/** Kunlik bar chart: bitta qator — bitta rang; har ustunda kun va son ko‘rinadi. */
export function DailyChart({ points, title }: { points: DailyPoint[]; title: string }) {
  const [active, setActive] = useState<number | null>(null);
  const n = points.length;
  const max = Math.max(0, ...points.map((p) => p.images));
  const scale = niceMax(max);
  const total = points.reduce((sum, p) => sum + p.images, 0);
  const best = points.findIndex((p) => p.images === max);
  const every = n > 14 ? Math.ceil(n / 6) : n > 7 ? 2 : 1;
  const columns = { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` } as CSSProperties;
  return (
    <figure className="chart">
      <figcaption className="chart-head">
        <span>
          <strong>{title}</strong>
          <small>
            {total} ta dizayn · {n} kun
          </small>
        </span>
        {max > 0 && (
          <span className="chart-best">
            Eng samarali kun: {shortDate(points[best].date)} — {max} ta
          </span>
        )}
      </figcaption>
      <div className="chart-body">
        <div className="chart-y" aria-hidden="true">
          <span>{scale}</span>
          <span>{scale / 2}</span>
          <span>0</span>
        </div>
        <div className="chart-plot" onMouseLeave={() => setActive(null)}>
          <span className="chart-gridline" style={{ bottom: "100%" }} />
          <span className="chart-gridline" style={{ bottom: "50%" }} />
          <div className={`chart-bars ${n > 45 ? "is-dense" : ""}`} style={columns}>
            {points.map((p, i) => (
              <button
                key={p.date}
                type="button"
                className={`chart-bar ${p.images ? "" : "is-zero"} ${active === i ? "is-active" : ""}`}
                style={{ "--h": `${(p.images / scale) * 100}%` } as CSSProperties}
                aria-label={`${longDate(p.date)}: ${p.images} ta dizayn, ${p.tasks} ta vazifa`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              >
                <span className="bar-fill" />
              </button>
            ))}
          </div>
          {active !== null && (
            <div
              className={`chart-tip ${active > n * 0.7 ? "is-left" : active < n * 0.3 ? "is-right" : ""}`}
              style={{
                left: `${((active + 0.5) / n) * 100}%`,
                // Izoh ustun tepasida turadi — grafik sarlavhasini yopmaydi.
                bottom: `calc(${Math.min(78, (points[active].images / scale) * 100)}% + 10px)`,
              }}
              aria-hidden="true"
            >
              <strong>{points[active].images} ta dizayn</strong>
              <span>
                {active === n - 1 ? "Bugun" : shortDate(points[active].date)} · {points[active].tasks} ta vazifa
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="chart-x" style={columns} aria-hidden="true">
        {points.map((p, i) => (
          <span key={p.date}>{i === n - 1 ? "Bugun" : (n - 1 - i) % every === 0 && n - 1 - i > every / 2 ? shortDate(p.date) : ""}</span>
        ))}
      </div>
    </figure>
  );
}

function DesignerTable({ rows, dailyBy }: { rows: StatsRow[]; dailyBy?: Record<string, DailyPoint[]> }) {
  const sorted = [...rows].sort((a, b) => b.images - a.images || b.done - a.done);
  const max = Math.max(1, ...sorted.map((r) => r.images));
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className={`stats-table ${REVIEW_STEP ? "" : "no-returns"}`} role="table" aria-label="Dizaynerlar">
      <div className="stats-head" role="row">
        <span role="columnheader">Dizayner</span>
        <span role="columnheader">Dizaynlar</span>
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
          <div key={row.id} className={`stats-row ${open === row.id ? "is-open" : ""}`} role="row">
            {dailyBy ? (
              <button
                type="button"
                className="stats-person is-button"
                role="cell"
                aria-expanded={open === row.id}
                onClick={() => setOpen(open === row.id ? null : row.id)}
              >
                <Avatar name={row.name} size="sm" />
                <strong>{row.name}</strong>
                <ChevronDown className="stats-chevron" size={15} strokeWidth={2} aria-hidden="true" />
              </button>
            ) : (
              <span className="stats-person" role="cell">
                <Avatar name={row.name} size="sm" />
                <strong>{row.name}</strong>
              </span>
            )}
            <span className="stats-bar-cell" role="cell" data-label="Dizaynlar">
              <span className="stats-bar" title={`${row.name}: ${row.images} ta dizayn, ${row.done} ta vazifa`}>
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
            {dailyBy && open === row.id && dailyBy[row.id] && (
              <div className="stats-expand" role="cell">
                <DailyChart points={dailyBy[row.id]} title={`${row.name} — kunlik dizaynlar`} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
