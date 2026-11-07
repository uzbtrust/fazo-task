"use client";
import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, X } from "lucide-react";
import { addDaysISO, longDate, months, nowTime, todayISO } from "./ui";

const WEEKDAYS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

/**
 * Muddat tanlash: sana kalendardan, soat shu uslubdagi paneldan — qo‘lda yozilmaydi.
 * Soat ixtiyoriy: tanlanmasa, muddat kun oxirigacha.
 */
export function DatePicker({
  value,
  time,
  onChange,
  label,
}: {
  value: string;
  time: string;
  onChange: (value: string, time: string) => void;
  label: string;
}) {
  const id = useId();
  const today = todayISO();
  const [open, setOpen] = useState<"date" | "time" | null>(null);
  const [month, setMonth] = useState((value || today).slice(0, 7));
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Dialogning o‘zi yopilmasin — faqat kalendar.
        e.stopPropagation();
        e.preventDefault();
        setOpen(null);
        root.current?.querySelector<HTMLElement>(`[data-panel="${open}"]`)?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(null);
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
  /** Bugungi kunda o‘tib ketgan soat tanlanmaydi. */
  const isPast = (date: string, clock: string) => date === today && clock <= nowTime();
  const setDate = (date: string) => onChange(date, date && !isPast(date, time) ? time : "");
  const pick = (date: string) => {
    setDate(date);
    setMonth(date.slice(0, 7));
    // Sanadan keyin soat so‘raladi; soat allaqachon bo‘lsa, panel yopiladi.
    setOpen(time && !isPast(date, time) ? null : "time");
  };
  const pickHour = (hour: string) => {
    const wanted = `${hour}:${time.slice(3) || "00"}`;
    const next = isPast(value, wanted) ? MINUTES.map((m) => `${hour}:${m}`).find((t) => !isPast(value, t)) : wanted;
    if (next) onChange(value, next);
  };
  const pickMinute = (minute: string) => {
    onChange(value, `${time.slice(0, 2)}:${minute}`);
    setOpen(null);
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
          data-panel="date"
          className={`date-trigger ${value ? "has-value" : ""}`}
          aria-expanded={open === "date"}
          aria-controls={id}
          aria-label={`${label}: ${value ? longDate(value) : "tanlanmagan"}`}
          onClick={() => {
            if (open !== "date") setMonth((value || today).slice(0, 7));
            setOpen(open === "date" ? null : "date");
          }}
        >
          <CalendarDays size={17} strokeWidth={1.8} aria-hidden="true" />
          <span>{value ? longDate(value) : "Sanani tanlang"}</span>
        </button>
        {value && (
          <button
            type="button"
            data-panel="time"
            className={`date-trigger ${time ? "has-value" : ""}`}
            aria-expanded={open === "time"}
            aria-controls={id}
            aria-label={`Soat: ${time || "tanlanmagan"}`}
            onClick={() => setOpen(open === "time" ? null : "time")}
          >
            <Clock size={17} strokeWidth={1.8} aria-hidden="true" />
            <span className="date-time">{time || "Soat"}</span>
          </button>
        )}
        {value && (
          <button type="button" className="icon-button date-clear" aria-label="Muddatni olib tashlash" onClick={() => onChange("", "")}>
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
              onClick={() => setDate(value === q.value ? "" : q.value)}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>
      {open === "date" && (
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
      {open === "time" && value && (
        <div className="calendar" id={id} role="dialog" aria-label="Soat">
          <div className="time-head">
            <strong className={time ? "" : "is-empty"}>{time || "––:––"}</strong>
            <small>{longDate(value)}</small>
          </div>
          <p className="time-label">Soat</p>
          <div className="time-grid">
            {HOURS.map((hour) => (
              <button
                key={hour}
                type="button"
                className={`cal-day ${time.slice(0, 2) === hour ? "is-selected" : ""}`}
                disabled={isPast(value, `${hour}:45`)}
                aria-pressed={time.slice(0, 2) === hour}
                aria-label={`Soat ${hour}`}
                onClick={() => pickHour(hour)}
              >
                {hour}
              </button>
            ))}
          </div>
          <p className="time-label">Daqiqa</p>
          <div className="time-grid is-minutes">
            {MINUTES.map((minute) => (
              <button
                key={minute}
                type="button"
                className={`cal-day ${time.slice(3) === minute ? "is-selected" : ""}`}
                disabled={!time || isPast(value, `${time.slice(0, 2)}:${minute}`)}
                aria-pressed={time.slice(3) === minute}
                aria-label={`${minute} daqiqa`}
                onClick={() => pickMinute(minute)}
              >
                {minute}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="time-end"
            onClick={() => {
              onChange(value, "");
              setOpen(null);
            }}
          >
            Soatsiz — kun oxirigacha
          </button>
        </div>
      )}
    </div>
  );
}
