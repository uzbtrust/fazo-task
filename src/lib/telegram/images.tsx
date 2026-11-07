import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { CSSProperties, ReactNode } from "react";
import { ImageResponse } from "next/og";
import { dueLabel, longDate, shortDate } from "../dates";
import type { Theme } from "../settings";
import type { DailyPoint, Task, TaskStatus } from "../types";
import { STATUS_ORDER, statusLabels } from "../workflow";
import { STAR } from "./star";

/*
 * Telegram xabarlari uchun rasmlar: macOS oynasi ichida ilovaning o‘z ko‘rinishi.
 * Ranglar uzbtrust tokenlaridan (tokens.json → light / dark): rasmda CSS o‘zgaruvchisi ishlamaydi.
 */
const palettes = {
  dark: {
    page: "#f5f5f7",
    ink: "#1d1d1f",
    muted: "#6e6e73",
    win: "#000000",
    sheet: "#1c1c1e",
    card: "#2c2c2e",
    bar: "#28282a",
    fg: "#f5f5f7",
    fg2: "#d2d2d7",
    fg3: "#a1a1a6",
    line: "rgba(255,255,255,0.09)",
    chip: "rgba(245,245,247,0.09)",
    accent: "#0a84ff",
    link: "#2997ff",
    soft: "rgba(10,132,255,0.18)",
    bad: "#ff453a",
    badSoft: "rgba(255,69,58,0.18)",
    warn: "#ffb340",
    warnSoft: "rgba(255,159,10,0.2)",
    good: "#30d158",
    goodSoft: "rgba(48,209,88,0.18)",
    avatar: "linear-gradient(180deg, #737378 0%, #4f4f54 100%)",
    shadow: "0 18px 50px rgba(0,0,0,0.32), 0 0 0 1px rgba(0,0,0,0.14)",
  },
  light: {
    page: "#e8e8ed",
    ink: "#1d1d1f",
    muted: "#6e6e73",
    win: "#ffffff",
    sheet: "#ffffff",
    card: "#f5f5f7",
    bar: "#f5f5f7",
    fg: "#1d1d1f",
    fg2: "#424245",
    fg3: "#6e6e73",
    line: "rgba(0,0,0,0.08)",
    chip: "rgba(29,29,31,0.07)",
    accent: "#0071e3",
    link: "#0066cc",
    soft: "rgba(0,113,227,0.1)",
    bad: "#d70015",
    badSoft: "rgba(215,0,21,0.08)",
    warn: "#a35200",
    warnSoft: "rgba(255,149,0,0.16)",
    good: "#1f7f37",
    goodSoft: "rgba(31,127,55,0.12)",
    avatar: "linear-gradient(180deg, #6e737f 0%, #4f545e 100%)",
    shadow: "0 18px 50px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.08)",
  },
};
type Palette = (typeof palettes)["dark"];

const W = 1080;
const OUTER = 40;
const PAD = 48;
const BAR = 76;
const INNER = W - (OUTER + PAD) * 2;

export type Tone = "accent" | "warn" | "bad" | "good";
export interface Lead {
  text: string;
  tone: Tone;
}
export interface Fact {
  label: string;
  value: string;
  tone?: "accent" | "bad";
}

let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 500 | 600; style: "normal" }[]> | undefined;
function loadFonts() {
  const load = (file: string) => readFile(join(process.cwd(), "src/lib/telegram/fonts", file));
  fonts ??= Promise.all([
    load("Inter-Regular.ttf"),
    load("Inter-Medium.ttf"),
    load("Inter-SemiBold.ttf"),
    load("Inter-Display.ttf"),
  ]).then(([regular, medium, semibold, display]) => [
    { name: "Inter", data: regular, weight: 400, style: "normal" },
    { name: "Inter", data: medium, weight: 500, style: "normal" },
    { name: "Inter", data: semibold, weight: 600, style: "normal" },
    { name: "Inter Display", data: display, weight: 600, style: "normal" },
  ]);
  return fonts;
}

async function png(element: ReactNode, height: number) {
  const response = new ImageResponse(element as React.ReactElement, {
    width: W,
    height: Math.ceil(height),
    fonts: await loadFonts(),
  });
  return Buffer.from(await response.arrayBuffer());
}

/** Satrlar sonini taxminan hisoblaydi: rasm balandligi oldindan berilishi kerak. */
function lines(text: string, size: number, width: number, factor = 0.54) {
  const perLine = Math.max(1, Math.floor(width / (size * factor)));
  return text.split("\n").reduce((sum, part) => {
    let count = 1;
    let used = 0;
    for (const word of part.split(/\s+/)) {
      if (used && used + word.length + 1 > perLine) {
        count += 1;
        used = 0;
      }
      used += word.length + (used ? 1 : 0);
    }
    return sum + count;
  }, 0);
}

const row: CSSProperties = { display: "flex", alignItems: "center" };
const col: CSSProperties = { display: "flex", flexDirection: "column" };
const clip: CSSProperties = { overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" };
const display = (size: number): CSSProperties => ({
  fontFamily: "Inter Display",
  fontWeight: 600,
  fontSize: size,
  letterSpacing: -size * 0.009,
});

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const HEAD_H = 44 + 88;
const DIM_H = 66;
const PILL_H = 86;
const ROW_H = 176;
const GROUP_H = 102;
const FACT_H = 150;
const PROP_H = 78;
const STEPS_H = 36 + 5 + 16 + 42 + 12 + 36;
const factsHeight = (count: number) => 34 + 30 + Math.ceil(count / 3) * FACT_H;
/*
 * Muallif belgisi (uzbtrust → docs/brand.md «Standart belgi», rasm uchun): pastki burchakda yulduz va «Abdurakhmonov».
 * Yulduz rasm kichik tomonining ~6%i, chetdan ~4%, yozuv yulduzdan ~1.3 baravar kichik.
 */
const markBand = (height: number) => Math.round(Math.min(W, height) * 0.1) + 20;
function frameHeight(body: number) {
  const window = OUTER + BAR + PAD * 2 + body;
  const tall = window + Math.round(W * 0.1) + 20;
  return tall >= W ? tall : Math.ceil((window + 20) / 0.9);
}

/** Bitta mavzu uchun komponentlar: ranglar yopilishda (closure) turadi, rasmlar bir vaqtda chizilsa ham aralashmaydi. */
function kit(t: Palette) {
  function Avatar({ name, size = 44 }: { name: string; size?: number }) {
    return (
      <div
        style={{
          ...row,
          justifyContent: "center",
          flexShrink: 0,
          width: size,
          height: size,
          borderRadius: size,
          backgroundImage: t.avatar,
          color: "#fff",
          fontSize: size * 0.38,
          fontWeight: 600,
        }}
      >
        {initials(name)}
      </div>
    );
  }

  function Stars({ value, size = 28 }: { value: number | null; size?: number }) {
    const path = "M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z";
    return (
      <div style={{ ...row, flexShrink: 0 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <svg key={n} width={size} height={size} viewBox="0 0 24 24">
            <path d={path} fill={n <= (value || 0) ? t.fg2 : "none"} stroke={t.fg2} strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        ))}
      </div>
    );
  }

  function Glyph({ status, size = 44 }: { status: TaskStatus; size?: number }) {
    const ring = status === "cancelled" ? t.fg3 : t.accent;
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
        {status === "done" ? (
          <>
            <circle cx="12" cy="12" r="11" fill={t.accent} />
            <path d="m7.4 12.4 3.1 3.1 6.1-6.6" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : (
          <>
            <circle cx="12" cy="12" r="10.2" fill="none" stroke={ring} strokeWidth="1.8" strokeDasharray={status === "in_review" ? "2.6 2.6" : undefined} />
            {status === "in_progress" && <path d="M12 5.4a6.6 6.6 0 0 0 0 13.2z" fill={t.accent} />}
            {status === "cancelled" && (
              <path d="m8.4 8.4 7.2 7.2m0-7.2-7.2 7.2" fill="none" stroke={t.fg3} strokeWidth="1.9" strokeLinecap="round" />
            )}
          </>
        )}
      </svg>
    );
  }

  const icon = { width: 30, height: 30, viewBox: "0 0 24 24", fill: "none", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  const ImagesIcon = ({ color }: { color: string }) => (
    <svg {...icon} stroke={color}>
      <path d="m22 11-1.296-1.296a2.4 2.4 0 0 0-3.408 0L11 16" />
      <path d="M4 8a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2" />
      <rect x="8" y="2" width="14" height="14" rx="2" />
    </svg>
  );
  const CalendarIcon = ({ color }: { color: string }) => (
    <svg {...icon} stroke={color}>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );

  /** macOS oynasi: svetofor tugmalari, o‘rtada Fazo Task, pastki burchakda muallif belgisi. */
  function Frame({ height, background, children }: { height: number; background: string; children: ReactNode }) {
    const short = Math.min(W, height);
    const star = Math.round(short * 0.06);
    const edge = Math.round(short * 0.04);
    return (
      <div style={{ ...col, width: W, height, padding: `${OUTER}px ${OUTER}px 0`, background: t.page, fontFamily: "Inter", color: t.fg }}>
        <div style={{ ...col, flexGrow: 1, borderRadius: 28, overflow: "hidden", background, boxShadow: t.shadow }}>
          <div style={{ ...row, position: "relative", justifyContent: "center", height: BAR, flexShrink: 0, background: t.bar, borderBottom: `1px solid ${t.line}` }}>
            <div style={{ ...row, position: "absolute", left: 28, top: 26 }}>
              {["#ff5f57", "#febc2e", "#28c840"].map((color) => (
                <div key={color} style={{ width: 24, height: 24, borderRadius: 24, background: color, marginRight: 16 }} />
              ))}
            </div>
            <div style={{ ...row }}>
              <svg width="34" height="34" viewBox="0 0 24 24" style={{ marginRight: 14 }}>
                <rect width="24" height="24" rx="6.5" fill={t.accent} />
                <path d="m7.2 12.4 3.1 3.1 6.5-7" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontSize: 30, fontWeight: 600, letterSpacing: -0.3 }}>Fazo Task</span>
            </div>
          </div>
          <div style={{ ...col, flexGrow: 1, padding: PAD }}>{children}</div>
        </div>
        <div style={{ ...row, justifyContent: "flex-end", alignItems: "flex-end", height: markBand(height), flexShrink: 0, padding: `0 ${edge - OUTER}px ${edge}px 0` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={STAR} width={star} height={Math.round((star * 1346) / 1400)} alt="" style={{ marginRight: Math.round(star * 0.3) }} />
          <span style={{ color: t.ink, fontSize: Math.round(star / 1.3), fontWeight: 600, letterSpacing: -0.3, lineHeight: 1 }}>Abdurakhmonov</span>
        </div>
      </div>
    );
  }

  function Pill({ lead }: { lead: Lead }) {
    const tone = {
      accent: { bg: t.soft, fg: t.link },
      warn: { bg: t.warnSoft, fg: t.warn },
      bad: { bg: t.badSoft, fg: t.bad },
      good: { bg: t.goodSoft, fg: t.good },
    }[lead.tone];
    return (
      <div style={{ ...row, alignSelf: "flex-start", height: 56, padding: "0 24px", marginBottom: 30, borderRadius: 56, background: tone.bg, color: tone.fg, fontSize: 29, fontWeight: 600 }}>
        {lead.text}
      </div>
    );
  }

  function Head({ eyebrow, accent, title, dim }: { eyebrow: string; accent?: string; title: string; dim?: string }) {
    return (
      <div style={{ ...col }}>
        <div style={{ ...row, height: 44, fontSize: 29, fontWeight: 600, color: t.fg3 }}>
          {accent && <span style={{ color: t.link, marginRight: 10 }}>{accent}</span>}
          {accent && <span style={{ marginRight: 10 }}>·</span>}
          <span>{eyebrow}</span>
        </div>
        <span style={{ ...clip, ...display(74), height: 88 }}>{title}</span>
        {dim ? <span style={{ ...clip, ...display(50), height: DIM_H, color: t.fg3 }}>{dim}</span> : null}
      </div>
    );
  }

  function Facts({ items }: { items: Fact[] }) {
    return (
      <div style={{ ...row, flexWrap: "wrap", marginTop: 34, paddingTop: 30, borderTop: `1px solid ${t.line}` }}>
        {items.map((item) => (
          <div key={item.label} style={{ ...col, width: "33.3%", height: FACT_H }}>
            <span style={{ ...display(76), height: 92, color: item.tone === "accent" ? t.link : item.tone === "bad" ? t.bad : t.fg }}>
              {item.value}
            </span>
            <span style={{ fontSize: 27, color: t.fg3 }}>{item.label}</span>
          </div>
        ))}
      </div>
    );
  }

  function TaskRow({ task, person, first }: { task: Task; person: "assignee" | "creator"; first: boolean }) {
    const due = task.dueDate ? dueLabel(task.dueDate, task.status, task.dueTime) : null;
    const dueColor = due?.tone === "bad" ? t.bad : due?.tone === "warn" ? t.warn : t.fg3;
    const snippet = task.brief.split("\n").find((line) => line.trim()) || "";
    const name = person === "creator" ? task.creatorName : task.assigneeName;
    const finished = task.status === "done" || task.status === "cancelled";
    return (
      <div style={{ ...row, height: ROW_H, padding: "0 28px", borderTop: first ? "none" : `1px solid ${t.line}` }}>
        <Glyph status={task.status} />
        <div style={{ ...col, flexGrow: 1, flexBasis: 0, minWidth: 0, marginLeft: 24 }}>
          <span style={{ ...clip, height: 46, fontSize: 35, fontWeight: 500, color: finished ? t.fg3 : t.fg, textDecoration: task.status === "cancelled" ? "line-through" : "none" }}>
            {task.title}
          </span>
          {snippet ? <span style={{ ...clip, height: 40, fontSize: 28, color: t.fg3 }}>{snippet}</span> : null}
          <div style={{ ...row, height: 48, marginTop: 4, fontSize: 27 }}>
            {task.priority ? (
              <div style={{ ...row, marginRight: 18 }}>
                <Stars value={task.priority} size={25} />
              </div>
            ) : null}
            <div style={{ ...row, height: 42, padding: "0 14px", marginRight: 18, borderRadius: 42, background: t.chip, color: t.fg2, flexShrink: 0 }}>
              <ImagesIcon color={t.fg2} />
              <span style={{ marginLeft: 8 }}>{`${task.imageCount} ta`}</span>
            </div>
            {due ? (
              <div style={{ ...row, marginRight: 18, color: dueColor, flexShrink: 0 }}>
                <CalendarIcon color={dueColor} />
                <span style={{ marginLeft: 8 }}>{due.text}</span>
              </div>
            ) : null}
            {name ? (
              <div style={{ ...row, minWidth: 0, flexShrink: 1, color: t.fg2 }}>
                <Avatar name={name} size={38} />
                <span style={{ ...clip, marginLeft: 10 }}>{name}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  function Groups({ groups, person, more }: { groups: ListGroup[]; person: "assignee" | "creator"; more?: number }) {
    return (
      <div style={{ ...col }}>
        {groups.map((group) => (
          <div key={group.title} style={{ ...col }}>
            <div style={{ ...row, height: GROUP_H, paddingTop: 42, paddingLeft: 6 }}>
              <span style={{ fontSize: 36, fontWeight: 600 }}>{group.title}</span>
              <span style={{ marginLeft: 14, fontSize: 36, color: t.fg3 }}>{String(group.count ?? group.items.length)}</span>
              {group.hint ? <span style={{ marginLeft: 18, fontSize: 26, color: t.fg3 }}>{group.hint}</span> : null}
            </div>
            <div style={{ ...col, borderRadius: 26, background: t.sheet === t.win ? t.card : t.sheet, overflow: "hidden" }}>
              {group.items.map((task, index) => (
                <TaskRow key={task.id} task={task} person={person} first={index === 0} />
              ))}
            </div>
          </div>
        ))}
        {more ? <span style={{ height: 56, paddingTop: 18, paddingLeft: 6, fontSize: 27, color: t.fg3 }}>{`Yana ${more} ta`}</span> : null}
      </div>
    );
  }

  function Empty({ text }: { text: string }) {
    return (
      <div style={{ ...row, justifyContent: "center", height: 190, marginTop: 40, padding: "0 40px", borderRadius: 26, background: t.sheet === t.win ? t.card : t.sheet, color: t.fg3, fontSize: 32, textAlign: "center" }}>
        {text}
      </div>
    );
  }

  return { Avatar, Stars, Glyph, Frame, Pill, Head, Facts, Groups, Empty };
}

const kits = { dark: kit(palettes.dark), light: kit(palettes.light) };
const pick = (theme: Theme = "dark") => ({ t: palettes[theme], ui: kits[theme] });

export interface ListGroup {
  title: string;
  hint?: string;
  items: Task[];
  /** Ko‘rsatilganidan ko‘p bo‘lsa, haqiqiy soni. */
  count?: number;
}
const groupsHeight = (groups: ListGroup[], more = 0) =>
  groups.reduce((sum, g) => sum + GROUP_H + g.items.length * ROW_H, 0) + (more ? 56 : 0);

/** Vazifa oynasi: ilovadagi varaqning o‘zi. briefLines — xabarnomada matn qisqaroq. */
export function taskSheetImage(task: Task, lead?: Lead, theme?: Theme, briefLines = 6) {
  const { t, ui } = pick(theme);
  const due = task.dueDate ? dueLabel(task.dueDate, task.status, task.dueTime) : null;
  const dueText = task.dueDate
    ? `${longDate(task.dueDate)}${task.dueTime ? `, ${task.dueTime}` : ""}${due?.note ? ` · ${due.note}` : ""}`
    : "Belgilanmagan";
  const dueColor = due?.tone === "bad" ? t.bad : due?.tone === "warn" ? t.warn : t.fg;
  const brief = task.brief.trim();
  const titleLines = Math.min(3, lines(task.title, 58, INNER, 0.57));
  const shown = brief ? Math.min(briefLines, lines(brief, 33, INNER)) : 0;
  const props = 4 + (task.priority ? 1 : 0);
  const stepped = task.status !== "cancelled";
  const files = task.briefFiles.length + task.referenceFiles.length;
  const height = frameHeight(
    (lead ? PILL_H : 0) + 44 + titleLines * 68 + (stepped ? STEPS_H : 0) + 36 + props * PROP_H +
      (brief ? 36 + 46 + shown * 47 : 0) + (files ? 56 : 0),
  );
  const Prop = ({ label, last, children }: { label: string; last?: boolean; children: ReactNode }) => (
    <div style={{ ...row, justifyContent: "space-between", height: PROP_H, padding: "0 30px", borderBottom: last ? "none" : `1px solid ${t.line}`, fontSize: 31 }}>
      <span style={{ color: t.fg3, flexShrink: 0 }}>{label}</span>
      <div style={{ ...row, justifyContent: "flex-end", marginLeft: 24 }}>{children}</div>
    </div>
  );
  const Person = ({ name }: { name: string }) => (
    <div style={{ ...row }}>
      <ui.Avatar name={name} />
      <span style={{ ...clip, marginLeft: 14, maxWidth: 520 }}>{name}</span>
    </div>
  );
  const current = STATUS_ORDER.indexOf(task.status);
  return png(
    <ui.Frame height={height} background={t.sheet}>
      {lead && <ui.Pill lead={lead} />}
      <span style={{ color: t.fg3, fontSize: 29, fontWeight: 600, height: 44 }}>{`Vazifa · #${String(task.number).padStart(3, "0")}`}</span>
      <div style={{ display: "block", ...display(58), lineHeight: "68px", lineClamp: 3 }}>{task.title}</div>
      {stepped && (
        <div style={{ ...row, alignItems: "flex-start", marginTop: 36 }}>
          {STATUS_ORDER.map((step, index) => {
            const passed = index < current || task.status === "done";
            const active = index <= current;
            return (
              <div key={step} style={{ ...col, flexGrow: 1, flexBasis: 0, marginRight: index === STATUS_ORDER.length - 1 ? 0 : 12 }}>
                <div style={{ height: 5, borderRadius: 5, background: active ? t.accent : t.card }} />
                <div style={{ ...row, justifyContent: "center", width: 42, height: 42, marginTop: 16, borderRadius: 42, background: active ? t.accent : t.card, color: active ? "#fff" : t.fg3, fontSize: 24, fontWeight: 600 }}>
                  {passed ? (
                    <svg width="24" height="24" viewBox="0 0 24 24">
                      <path d="m5.5 12.5 4.3 4.3 8.7-9.3" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    String(index + 1)
                  )}
                </div>
                <span style={{ marginTop: 12, fontSize: 28, fontWeight: index === current ? 600 : 400, color: index === current ? t.fg : t.fg3 }}>
                  {statusLabels[step]}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ ...col, marginTop: 36, borderRadius: 26, background: t.card }}>
        <Prop label="Dizayner">
          {task.assigneeName ? <Person name={task.assigneeName} /> : <span style={{ color: t.fg3 }}>Hali hech kim olmagan</span>}
        </Prop>
        <Prop label="Qo‘ygan">
          <Person name={task.creatorName} />
        </Prop>
        <Prop label="Rasmlar">
          <span>{`${task.imageCount} ta`}</span>
        </Prop>
        <Prop label="Muddat" last={!task.priority}>
          <span style={{ color: dueColor }}>{dueText}</span>
        </Prop>
        {task.priority ? (
          <Prop label="Muhimlik" last>
            <ui.Stars value={task.priority} size={32} />
          </Prop>
        ) : null}
      </div>
      {brief ? (
        <div style={{ ...col, marginTop: 36 }}>
          <span style={{ height: 46, color: t.fg2, fontSize: 29, fontWeight: 600 }}>Task</span>
          <div style={{ display: "block", fontSize: 33, lineHeight: "47px", lineClamp: briefLines }}>{brief}</div>
        </div>
      ) : null}
      {files ? <span style={{ marginTop: 20, height: 36, color: t.fg3, fontSize: 27 }}>{`${files} ta fayl biriktirilgan`}</span> : null}
    </ui.Frame>,
    height,
  );
}

/** Vazifalar ro‘yxati: ilovadagi ish stoli ko‘rinishi. */
export function taskListImage(options: {
  eyebrow: string;
  accent?: string;
  title: string;
  dim?: string;
  lead?: Lead;
  person: "assignee" | "creator";
  groups: ListGroup[];
  empty?: string;
  theme?: Theme;
}) {
  const { t, ui } = pick(options.theme);
  const groups = options.groups.filter((g) => g.items.length);
  const height = frameHeight(HEAD_H + (options.dim ? DIM_H : 0) + (options.lead ? PILL_H : 0) + (groups.length ? groupsHeight(groups) : 230));
  return png(
    <ui.Frame height={height} background={t.win}>
      {options.lead && <ui.Pill lead={options.lead} />}
      <ui.Head eyebrow={options.eyebrow} accent={options.accent} title={options.title} dim={options.dim} />
      {groups.length ? <ui.Groups groups={groups} person={options.person} /> : <ui.Empty text={options.empty || "Hozircha vazifa yo‘q."} />}
    </ui.Frame>,
    height,
  );
}

/** Bosh menyu: salomlashuv, raqamlar va hozirgi ishlar — saytdagi ish stoli. */
export function homeImage(options: {
  eyebrow: string;
  accent?: string;
  title: string;
  dim?: string;
  facts: Fact[];
  groups?: ListGroup[];
  person?: "assignee" | "creator";
  more?: number;
  theme?: Theme;
}) {
  const { t, ui } = pick(options.theme);
  const groups = (options.groups || []).filter((g) => g.items.length);
  const height = frameHeight(
    HEAD_H + (options.dim ? DIM_H : 0) + (options.facts.length ? factsHeight(options.facts.length) : 0) + groupsHeight(groups, options.more),
  );
  return png(
    <ui.Frame height={height} background={t.win}>
      <ui.Head eyebrow={options.eyebrow} accent={options.accent} title={options.title} dim={options.dim} />
      {options.facts.length ? <ui.Facts items={options.facts} /> : null}
      {groups.length ? <ui.Groups groups={groups} person={options.person || "creator"} more={options.more} /> : null}
    </ui.Frame>,
    height,
  );
}

const CHART_H = 300;

/** Statistika: katta raqamlar va kunlik ustunlar. */
export function statsImage(options: { eyebrow: string; title: string; dim: string; facts: Fact[]; daily: DailyPoint[]; theme?: Theme }) {
  const { t, ui } = pick(options.theme);
  const points = options.daily.slice(-14);
  const max = Math.max(1, ...points.map((p) => p.images));
  const total = points.reduce((sum, p) => sum + p.images, 0);
  const height = frameHeight(HEAD_H + DIM_H + factsHeight(options.facts.length) + 30 + CHART_H + 70);
  return png(
    <ui.Frame height={height} background={t.win}>
      <ui.Head eyebrow={options.eyebrow} accent="Statistika" title={options.title} dim={options.dim} />
      <ui.Facts items={options.facts} />
      <div style={{ ...col, marginTop: 30, padding: "28px 30px", height: CHART_H + 70, borderRadius: 26, background: t.sheet === t.win ? t.card : t.sheet }}>
        <div style={{ ...row, justifyContent: "space-between", height: 44, fontSize: 28 }}>
          <span style={{ fontWeight: 600 }}>Kunlik dizaynlar</span>
          <span style={{ color: t.fg3 }}>{`${total} ta · 14 kun`}</span>
        </div>
        <div style={{ ...row, alignItems: "flex-end", flexGrow: 1, marginTop: 14 }}>
          {points.map((p) => (
            <div key={p.date} style={{ ...col, justifyContent: "flex-end", flexGrow: 1, flexBasis: 0, height: "100%", marginRight: 8 }}>
              <div style={{ height: p.images ? Math.max(10, (p.images / max) * (CHART_H - 110)) : 6, borderRadius: 8, background: p.images ? t.accent : t.chip }} />
            </div>
          ))}
        </div>
        <div style={{ ...row, justifyContent: "space-between", height: 40, marginTop: 8, color: t.fg3, fontSize: 24 }}>
          <span>{points[0] ? shortDate(points[0].date) : ""}</span>
          <span>Bugun</span>
        </div>
      </div>
    </ui.Frame>,
    height,
  );
}

/** Jamoa: odamlar ro‘yxati. */
export function teamImage(options: { title: string; dim: string; people: { name: string; line: string; value: string; label: string }[]; theme?: Theme }) {
  const { t, ui } = pick(options.theme);
  const rowH = 124;
  const height = frameHeight(HEAD_H + DIM_H + 40 + Math.max(1, options.people.length) * rowH);
  return png(
    <ui.Frame height={height} background={t.win}>
      <ui.Head eyebrow="Jamoa" title={options.title} dim={options.dim} />
      <div style={{ ...col, marginTop: 40, borderRadius: 26, background: t.sheet === t.win ? t.card : t.sheet, overflow: "hidden" }}>
        {options.people.map((person, index) => (
          <div key={person.name + index} style={{ ...row, height: rowH, padding: "0 28px", borderTop: index ? `1px solid ${t.line}` : "none" }}>
            <ui.Avatar name={person.name} size={64} />
            <div style={{ ...col, flexGrow: 1, flexBasis: 0, minWidth: 0, marginLeft: 22 }}>
              <span style={{ ...clip, fontSize: 34, fontWeight: 500 }}>{person.name}</span>
              <span style={{ ...clip, fontSize: 27, color: t.fg3 }}>{person.line}</span>
            </div>
            <div style={{ ...col, alignItems: "flex-end", marginLeft: 20 }}>
              <span style={{ ...display(48) }}>{person.value}</span>
              <span style={{ fontSize: 24, color: t.fg3 }}>{person.label}</span>
            </div>
          </div>
        ))}
      </div>
    </ui.Frame>,
    height,
  );
}

/** Oddiy ekran: sarlavha, kulrang davomi va bir-ikki qator — kirish, tasdiq, natija. */
export function noticeImage(options: { title: string; dim?: string; text?: string; lead?: Lead; theme?: Theme }) {
  const { t, ui } = pick(options.theme);
  const text = options.text || "";
  const textLines = text ? Math.min(5, lines(text, 33, INNER)) : 0;
  const height = frameHeight(44 + 88 + (options.dim ? DIM_H : 0) + (options.lead ? PILL_H : 0) + (text ? 30 + textLines * 47 : 0));
  return png(
    <ui.Frame height={height} background={t.win}>
      {options.lead && <ui.Pill lead={options.lead} />}
      <ui.Head eyebrow="Fazo Task" title={options.title} dim={options.dim} />
      {text ? <div style={{ display: "block", marginTop: 30, fontSize: 33, lineHeight: "47px", color: t.fg2, lineClamp: 5 }}>{text}</div> : null}
    </ui.Frame>,
    height,
  );
}

/** Hisob: profil kartasi. */
export function accountImage(options: { name: string; username: string; role: string; telegram: string; reminders: boolean; theme?: Theme }) {
  const { t, ui } = pick(options.theme);
  const rows: [string, string][] = [
    ["Login", `@${options.username}`],
    ["Rol", options.role],
    ["Telegram", options.telegram],
    ["Eslatmalar", options.reminders ? "Yoniq" : "O‘chiq"],
  ];
  const height = frameHeight(44 + 150 + 36 + rows.length * PROP_H);
  return png(
    <ui.Frame height={height} background={t.win}>
      <span style={{ color: t.fg3, fontSize: 29, fontWeight: 600, height: 44 }}>Hisob</span>
      <div style={{ ...row, height: 150 }}>
        <ui.Avatar name={options.name} size={112} />
        <div style={{ ...col, flexGrow: 1, flexBasis: 0, minWidth: 0, marginLeft: 30 }}>
          <span style={{ ...clip, ...display(58), height: 70 }}>{options.name}</span>
          <span style={{ fontSize: 30, color: t.fg3 }}>{options.role}</span>
        </div>
      </div>
      <div style={{ ...col, marginTop: 36, borderRadius: 26, background: t.card }}>
        {rows.map(([label, value], index) => (
          <div key={label} style={{ ...row, justifyContent: "space-between", height: PROP_H, padding: "0 30px", borderBottom: index === rows.length - 1 ? "none" : `1px solid ${t.line}`, fontSize: 31 }}>
            <span style={{ color: t.fg3 }}>{label}</span>
            <span style={{ ...clip, maxWidth: 560 }}>{value}</span>
          </div>
        ))}
      </div>
    </ui.Frame>,
    height,
  );
}

/** Parolni tiklash kodi: katta raqamlar, qorong‘u oyna. */
export function codeImage(options: { code: string; name: string; theme?: Theme }) {
  const { t, ui } = pick(options.theme);
  const height = frameHeight(44 + 88 + DIM_H + 40 + 200 + 30 + 47 * 2);
  return png(
    <ui.Frame height={height} background={t.win}>
      <ui.Head eyebrow="Parolni tiklash" title="Tasdiqlash kodi." dim={`${options.name} uchun`} />
      <div style={{ ...row, justifyContent: "center", height: 200, marginTop: 40, borderRadius: 26, background: t.sheet === t.win ? t.card : t.sheet }}>
        {options.code.split("").map((digit, index) => (
          <span key={index} style={{ ...display(110), color: t.fg, marginLeft: index === 3 ? 48 : 14, marginRight: 14 }}>
            {digit}
          </span>
        ))}
      </div>
      <div style={{ display: "block", marginTop: 30, fontSize: 31, lineHeight: "47px", color: t.fg3 }}>
        Kod 10 daqiqa amal qiladi va shu xabar o‘zi o‘chadi. Parolni siz so‘ramagan bo‘lsangiz, kodni hech kimga bermang.
      </div>
    </ui.Frame>,
    height,
  );
}
