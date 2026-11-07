"use client";
import type { ReactNode } from "react";

export function PageHead({
  eyebrow,
  title,
  dim,
  lead,
  action,
}: {
  eyebrow: ReactNode;
  title: string;
  dim: ReactNode;
  lead?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="page-head-text">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="page-title">
          {title}
          <span className="dim">{dim}</span>
        </h1>
        {lead && <p className="page-lead">{lead}</p>}
      </div>
      {action && (
        <div className="page-actions">
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
    <div className="facts">
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
            <span className="fact-num">{item.value}</span>
            <span className="fact-label">{item.label}</span>
          </button>
        ) : (
          <div key={item.key} className={`fact is-static ${item.value && item.tone ? `is-${item.tone}` : ""}`}>
            <span className="fact-num">{item.value}</span>
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
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">{icon}</span>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  );
}

