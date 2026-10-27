"use client";
import type { CSSProperties } from "react";
import { ChevronRight, Plus, Users } from "lucide-react";
import type { Employee, Task } from "@/lib/types";
import { Avatar, CountUp, isOverdue } from "./ui";

export function employeeStats(employee: Employee, tasks: Task[]) {
  const own = tasks.filter((t) => t.assigneeId === employee.id);
  return {
    total: own.length,
    todo: own.filter((t) => t.status === "todo").length,
    progress: own.filter((t) => t.status === "in_progress").length,
    done: own.filter((t) => t.status === "done").length,
    overdue: own.filter((t) => isOverdue(t.dueDate, t.status)).length,
  };
}

export function TeamView({
  employees,
  tasks,
  onNewEmployee,
  onOpenEmployee,
}: {
  employees: Employee[];
  tasks: Task[];
  onNewEmployee: () => void;
  onOpenEmployee: (employee: Employee) => void;
}) {
  const busy = employees.filter((e) =>
    tasks.some((t) => t.assigneeId === e.id && t.status !== "done"),
  ).length;
  return (
    <>
      <header className="page-head">
        <div className="page-head-text">
          <p className="eyebrow rise">
            <span className="eyebrow-accent">Jamoa</span>
            <span aria-hidden="true"> · </span>
            {employees.length} hodim
          </p>
          <h1 className="page-title rise" style={{ "--i": 1 } as CSSProperties}>
            Hodimlar.
            <span className="dim">Har biriga aniq vazifa.</span>
          </h1>
          <p className="page-lead rise" style={{ "--i": 2 } as CSSProperties}>
            Hodimni qo‘shing, keyin kartasini ochib unga vazifa belgilang.
          </p>
        </div>
        <div className="page-actions rise" style={{ "--i": 2 } as CSSProperties}>
          <button className="btn btn-primary btn-lg" onClick={onNewEmployee}>
            <Plus size={19} strokeWidth={2.2} aria-hidden="true" />
            Hodim qo‘shish
          </button>
        </div>
      </header>

      {employees.length > 0 && (
        <div className="facts rise" style={{ "--i": 3 } as CSSProperties}>
          <div className="fact is-static">
            <span className="fact-num">
              <CountUp value={employees.length} />
            </span>
            <span className="fact-label">Hodim</span>
          </div>
          <div className="fact is-static">
            <span className="fact-num">
              <CountUp value={busy} />
            </span>
            <span className="fact-label">Ishda</span>
          </div>
          <div className="fact is-static">
            <span className="fact-num">
              <CountUp value={employees.length - busy} />
            </span>
            <span className="fact-label">Bo‘sh</span>
          </div>
        </div>
      )}

      {employees.length ? (
        <ul className="people-grid" aria-label="Hodimlar">
          {employees.map((employee, index) => {
            const s = employeeStats(employee, tasks);
            const active = s.todo + s.progress;
            return (
              <li
                key={employee.id}
                className="rise"
                style={{ "--i": 4 + Math.min(index, 8) } as CSSProperties}
              >
                <button
                  type="button"
                  className="person-card"
                  onClick={() => onOpenEmployee(employee)}
                >
                  <span className="pc-top">
                    <span className="pc-count">
                      <span className="pc-num">{String(active).padStart(2, "0")}</span>
                      <span className="pc-num-label">
                        faol
                        <br />
                        vazifa
                      </span>
                    </span>
                    <span className="pc-arrow" aria-hidden="true">
                      <ChevronRight size={16} strokeWidth={2.2} />
                    </span>
                  </span>
                  <span className="pc-body">
                    <Avatar name={employee.name} />
                    <span>
                      <span className="pc-name">{employee.name}</span>
                      <span className="pc-role">
                        {employee.position || "Lavozim ko‘rsatilmagan"}
                      </span>
                    </span>
                  </span>
                  <span className="pc-foot">
                    <span
                      className="pc-bar"
                      role="img"
                      aria-label={`${s.total} tadan ${s.done} tasi bajarilgan`}
                    >
                      <span style={{ width: s.total ? `${(s.done / s.total) * 100}%` : 0 }} />
                    </span>
                    <span className="pc-meta">
                      <span>{s.progress} jarayonda</span>
                      <span>{s.todo} yangi</span>
                      <span>{s.done} bajarildi</span>
                    </span>
                    <span className="pc-tags">
                      {!active && <span className="tag">Bo‘sh</span>}
                      {s.overdue > 0 && (
                        <span className="tag tag-bad">{s.overdue} ta kechikkan</span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          <li className="rise" style={{ "--i": 4 + Math.min(employees.length, 8) } as CSSProperties}>
            <button type="button" className="person-card add-card" onClick={onNewEmployee}>
              <span className="add-icon" aria-hidden="true">
                <Plus size={26} strokeWidth={1.8} />
              </span>
              <span className="pc-name">Hodim qo‘shish</span>
              <span className="pc-role">Ism va lavozim — bas.</span>
            </button>
          </li>
        </ul>
      ) : (
        <div className="empty rise" style={{ "--i": 3 } as CSSProperties}>
          <span className="empty-icon">
            <Users size={26} strokeWidth={1.6} />
          </span>
          <h2>Jamoangizga joy bor.</h2>
          <p>Birinchi hodimni qo‘shing — keyin unga vazifa belgilashingiz mumkin.</p>
          <button className="btn btn-primary" onClick={onNewEmployee}>
            <Plus size={17} strokeWidth={2.2} aria-hidden="true" />
            Birinchi hodimni qo‘shish
          </button>
        </div>
      )}
    </>
  );
}
