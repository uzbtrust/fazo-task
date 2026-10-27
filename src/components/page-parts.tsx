"use client";
import type { CSSProperties, ReactNode } from "react";
import { CountUp } from "./ui";

const rise = (i: number) => ({ "--i": i }) as CSSProperties;

export function PageHead({
  eyebrow,
  title,
  dim,
  lead,
  action,
}: {
  eyebrow: ReactNode;
  title: string;
  dim: string;
  lead: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="page-head-text">
        <p className="eyebrow rise">{eyebrow}</p>
        <h1 className="page-title rise" style={rise(1)}>
          {title}
          <span className="dim">{dim}</span>
        </h1>
        <p className="page-lead rise" style={rise(2)}>
          {lead}
        </p>
      </div>
      {action && (
        <div className="page-actions rise" style={rise(2)}>
          {action}
        </div>
      )}
    </header>
  );
}

export function Facts<K extends string>({
  items,
  active,
  onSelect,
}: {
  items: { key: K; label: string; value: number; tone?: "bad" | "accent" }[];
  active?: K | "all";
  onSelect?: (key: K | "all") => void;
}) {
  return (
    <div className="facts rise" style={rise(3)}>
      {items.map((item) =>
        onSelect ? (
          <button
            key={item.key}
            type="button"
            className={`fact ${active === item.key ? "is-active" : ""} ${item.value && item.tone ? `is-${item.tone}` : ""}`}
            aria-pressed={active === item.key}
            disabled={!item.value && active !== item.key}
            onClick={() => onSelect(active === item.key ? "all" : item.key)}
          >
            <span className="fact-num">
              <CountUp value={item.value} />
            </span>
            <span className="fact-label">{item.label}</span>
          </button>
        ) : (
          <div key={item.key} className={`fact is-static ${item.value && item.tone ? `is-${item.tone}` : ""}`}>
            <span className="fact-num">
              <CountUp value={item.value} />
            </span>
            <span className="fact-label">{item.label}</span>
          </div>
        ),
      )}
    </div>
  );
}

export function Empty({
  icon,
  title,
  text,
  action,
  index = 4,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
  index?: number;
}) {
  return (
    <div className="empty rise" style={rise(index)}>
      <span className="empty-icon">{icon}</span>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  );
}

export { rise };
