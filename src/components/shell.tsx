"use client";
import {
  createContext,
  FormEvent,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CircleAlert, CircleCheck, KeyRound, LogOut, Moon, Sun } from "lucide-react";
import type { Account } from "@/lib/types";
import { roleInfo } from "@/lib/roles";
import { api, Avatar, ErrorMessage, Modal, Segmented, Spinner, Wordmark } from "./ui";

type Toast = { message: string; tone?: "error" };
const ToastContext = createContext<(toast: Toast | string) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const notify = useCallback(
    (next: Toast | string) => setToast(typeof next === "string" ? { message: next } : next),
    [],
  );
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timeout);
  }, [toast]);
  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toast-region" aria-live="polite">
        {toast && (
          <div className={`toast ${toast.tone === "error" ? "is-error" : ""}`} role="status">
            {toast.tone === "error" ? (
              <CircleAlert size={17} strokeWidth={2} aria-hidden="true" />
            ) : (
              <CircleCheck size={17} strokeWidth={2} aria-hidden="true" />
            )}
            <span className="toast-text">{toast.message}</span>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

/** Har 20 soniyada va oynaga qaytilganda ma’lumotni yangilaydi. */
export function usePolling(refresh: () => Promise<void>) {
  const notify = useToast();
  useEffect(() => {
    let failed = false;
    const update = () => {
      if (document.visibilityState !== "visible") return;
      refresh().then(
        () => (failed = false),
        () => {
          if (!failed) notify({ message: "Ma’lumotni yangilab bo‘lmadi. Aloqani tekshiring.", tone: "error" });
          failed = true;
        },
      );
    };
    const interval = setInterval(update, 20000);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, [refresh, notify]);
}

/** Navigatsiya yorlig‘i: keng ekranda to‘liq, telefonda qisqa. */
export function NavLabel({ long, short }: { long: string; short: ReactNode }) {
  return (
    <>
      <span className="nav-long">{long}</span>
      <span className="nav-short" aria-hidden="true">
        {short}
      </span>
    </>
  );
}

export function Shell<V extends string>({
  account,
  nav,
  view,
  onView,
  children,
}: {
  account: Account;
  nav?: { value: V; label: ReactNode; count?: number }[];
  view?: V;
  onView?: (view: V) => void;
  children: ReactNode;
}) {
  const [dark, setDark] = useState(false);
  const [menu, setMenu] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notify = useToast();
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuRef.current?.contains(e.target as Node))
        setMenu(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menu]);

  function toggleTheme() {
    const next = !dark;
    const apply = () => {
      setDark(next);
      document.documentElement.classList.toggle("dark", next);
    };
    try {
      localStorage.setItem("fazo-theme", next ? "dark" : "light");
    } catch {}
    const doc = document as Document & { startViewTransition?: (cb: () => void) => void };
    if (doc.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches)
      doc.startViewTransition(apply);
    else apply();
  }

  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
      window.location.replace("/login");
    } catch (e) {
      notify({ message: (e as Error).message, tone: "error" });
    }
  }

  return (
    <div className="app">
        <a href="#main" className="skip-link">
          Asosiy qismga o‘tish
        </a>
        <header className="topbar">
          <div className="topbar-inner">
            <Wordmark />
            {nav && view && onView && (
              <nav className="topnav" aria-label="Bo‘limlar">
                <Segmented<V> label="Bo‘limlar" value={view} onChange={onView} options={nav} />
              </nav>
            )}
            <div className="top-actions">
              <span className="role-pill">{roleInfo[account.role].label}</span>
              <button
                type="button"
                className="icon-button theme-toggle"
                aria-label={dark ? "Yorug‘ rejimga o‘tish" : "Qorong‘u rejimga o‘tish"}
                onClick={toggleTheme}
              >
                <Moon className="theme-icon icon-moon" size={17} strokeWidth={1.9} aria-hidden="true" />
                <Sun className="theme-icon icon-sun" size={18} strokeWidth={1.9} aria-hidden="true" />
              </button>
              <div className="menu-wrap" ref={menuRef}>
                <button
                  type="button"
                  className="account-button"
                  aria-label="Hisob menyusi"
                  aria-expanded={menu}
                  aria-haspopup="menu"
                  onClick={() => setMenu(!menu)}
                >
                  <Avatar name={account.name} size="sm" />
                </button>
                {menu && (
                  <div className="menu" role="menu">
                    <div className="menu-head">
                      <Avatar name={account.name} />
                      <span>
                        <strong>{account.name}</strong>
                        <small>
                          @{account.username} · {roleInfo[account.role].label}
                        </small>
                      </span>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      className="menu-item"
                      onClick={() => {
                        setMenu(false);
                        setPasswordOpen(true);
                      }}
                    >
                      <KeyRound size={16} strokeWidth={1.8} aria-hidden="true" />
                      Parolni almashtirish
                    </button>
                    <button type="button" role="menuitem" className="menu-item" onClick={() => void logout()}>
                      <LogOut size={16} strokeWidth={1.8} aria-hidden="true" />
                      Chiqish
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
        <main id="main" className="page" key={view}>
          {children}
        </main>
        <footer className="foot">
          <span>Fazo Task</span>
          <span aria-hidden="true">·</span>
          <span>Jamoa ishlari bir joyda.</span>
        </footer>
        {passwordOpen && (
          <PasswordDialog
            account={account}
            onClose={() => setPasswordOpen(false)}
            onSaved={() => {
              setPasswordOpen(false);
              notify("Parol yangilandi");
            }}
          />
        )}
    </div>
  );
}

function PasswordDialog({
  account,
  onClose,
  onSaved,
}: {
  account: Account;
  onClose: () => void;
  onSaved: () => void;
}) {
  const formId = useId();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== repeat) {
      setError("Yangi parollar mos kelmadi.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/me", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword: current, newPassword: password }),
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <Modal title="Parolni almashtirish" eyebrow={`Hisob · @${account.username}`} onClose={onClose} size="sm">
      <form id={formId} className="sheet-body form" onSubmit={save}>
        <label className="field">
          <span className="field-label">Joriy parol</span>
          <input className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </label>
        <label className="field">
          <span className="field-label">Yangi parol</span>
          <input className="input" type="password" autoComplete="new-password" placeholder="Kamida 8 ta belgi" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} maxLength={128} required />
        </label>
        <label className="field">
          <span className="field-label">Yangi parolni takrorlang</span>
          <input className="input" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} minLength={8} maxLength={128} required />
        </label>
        <p className="field-hint">Boshqa qurilmalardagi kirishlar bekor qilinadi.</p>
        <ErrorMessage message={error} />
      </form>
      <div className="sheet-foot">
        <button type="button" className="btn btn-quiet" onClick={onClose}>
          Bekor qilish
        </button>
        <button type="submit" form={formId} className="btn btn-primary" disabled={busy}>
          {busy ? <Spinner label="Saqlanmoqda" /> : "Saqlash"}
        </button>
      </div>
    </Modal>
  );
}
