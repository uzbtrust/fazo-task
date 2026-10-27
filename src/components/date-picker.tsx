"use client";
import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { addDaysISO, longDate, months, todayISO } from "./ui";

const WEEKDAYS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

/** Muddat tanlash: tugma bosilganda ostida kichik kalendar ochiladi — sana qo‘lda yozilmaydi. */
export function DatePicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const id = useId();
  const today = todayISO();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState((value || today).slice(0, 7));
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Dialogning o‘zi yopilmasin — faqat kalendar.
        e.stopPropagation();
        e.preventDefault();
        setOpen(false);
        root.current?.querySelector<HTMLElement>(".date-trigger")?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const element = root.current;
    element?.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      element?.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const [y, m] = month.split("-").map(Number);
  const firstWeekday = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];
  const pick = (date: string) => {
    onChange(date);
    setMonth(date.slice(0, 7));
    setOpen(false);
  };
  const quick = [
    { label: "Bugun", value: today },
    { label: "Ertaga", value: addDaysISO(1) },
    { label: "3 kun", value: addDaysISO(3) },
    { label: "1 hafta", value: addDaysISO(7) },
  ];

  return (
    <div className="datepicker" ref={root}>
      <div className="date-row">
        <button
          type="button"
          className={`date-trigger ${value ? "has-value" : ""}`}
          aria-expanded={open}
          aria-controls={id}
          aria-label={`${label}: ${value ? longDate(value) : "tanlanmagan"}`}
          onClick={() => {
            if (!open) setMonth((value || today).slice(0, 7));
            setOpen(!open);
          }}
        >
          <CalendarDays size={17} strokeWidth={1.8} aria-hidden="true" />
          <span>{value ? longDate(value) : "Sanani tanlang"}</span>
        </button>
        {value && (
          <button type="button" className="icon-button date-clear" aria-label="Muddatni olib tashlash" onClick={() => onChange("")}>
            <X size={15} strokeWidth={2.2} />
          </button>
        )}
        <div className="quick-dates" role="group" aria-label="Tezkor muddat">
          {quick.map((q) => (
            <button
              key={q.label}
              type="button"
              className={`chip-button ${value === q.value ? "is-on" : ""}`}
              aria-pressed={value === q.value}
              onClick={() => onChange(value === q.value ? "" : q.value)}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>
      {open && (
        <div className="calendar" id={id} role="dialog" aria-label="Kalendar">
          <div className="cal-head">
            <button
              type="button"
              className="icon-button"
              aria-label="Oldingi oy"
              disabled={month <= today.slice(0, 7)}
              onClick={() => setMonth(shiftMonth(month, -1))}
            >
              <ChevronLeft size={18} strokeWidth={2} />
            </button>
            <strong>
              {months[m - 1][0].toUpperCase() + months[m - 1].slice(1)} {y}
            </strong>
            <button type="button" className="icon-button" aria-label="Keyingi oy" onClick={() => setMonth(shiftMonth(month, 1))}>
              <ChevronRight size={18} strokeWidth={2} />
            </button>
          </div>
          <div className="cal-grid">
            {WEEKDAYS.map((d, i) => (
              <span key={d} className={`cal-weekday ${i > 4 ? "is-weekend" : ""}`} aria-hidden="true">
                {d}
              </span>
            ))}
            {cells.map((date, i) =>
              date ? (
                <button
                  key={date}
                  type="button"
                  className={`cal-day ${date === today ? "is-today" : ""} ${date === value ? "is-selected" : ""}`}
                  disabled={date < today}
                  aria-pressed={date === value}
                  aria-label={longDate(date)}
                  onClick={() => pick(date)}
                >
                  {Number(date.slice(8))}
                </button>
              ) : (
                <span key={`blank-${i}`} />
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
