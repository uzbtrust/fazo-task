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
import { CircleAlert, CircleCheck, KeyRound, LogOut, Moon, Send, Sun } from "lucide-react";
import type { Account } from "@/lib/types";
import { roleInfo } from "@/lib/roles";
import { api, Avatar, ErrorMessage, Modal, Segmented, Signature, Spinner, Wordmark } from "./ui";
import { storedInitData } from "./telegram-webapp";

/** Hisobga yozilgan mavzu: Workspace beradi, Shell qo‘llaydi va boshqa qurilmadagi o‘zgarishni kuzatadi. */
type Theme = "light" | "dark";
const ThemeContext = createContext<Theme | null>(null);
export function ThemeSync({ theme, children }: { theme: Theme | null; children: ReactNode }) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

function applyTheme(theme: Theme | null) {
  const dark = theme ? theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", dark);
  try {
    if (theme) localStorage.setItem("fazo-theme", theme);
    else localStorage.removeItem("fazo-theme");
  } catch {}
  return dark;
}

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
  const [accountOpen, setAccountOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notify = useToast();
  const saved = useContext(ThemeContext);
  // Hisobdagi mavzu ustun: boshqa qurilmada tanlangani shu yerda ham bo‘ladi.
  useEffect(() => {
    setDark(saved ? applyTheme(saved) : document.documentElement.classList.contains("dark"));
    if (window.location.hash === "#hisob") {
      setAccountOpen(true);
      history.replaceState(null, "", window.location.pathname);
    }
  }, [saved]);
  const syncTheme = useCallback(async () => {
    const data = await api<{ theme: Theme | null }>("/api/me");
    const dark = document.documentElement.classList.contains("dark");
    if (data.theme && (data.theme === "dark") !== dark) setDark(applyTheme(data.theme));
  }, []);
  usePolling(syncTheme);
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
    const apply = () => setDark(applyTheme(next ? "dark" : "light"));
    // Hisobga yoziladi: web-app, boshqa brauzer va bot rasmlari ham almashadi.
    void api("/api/me/settings", { method: "PUT", body: JSON.stringify({ theme: next ? "dark" : "light" }) }).catch(() => {});
    const doc = document as Document & { startViewTransition?: (cb: () => void) => void };
    if (doc.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches)
      doc.startViewTransition(apply);
    else apply();
  }

  async function logout() {
    try {
      // Web-app ichidan chiqilsa, Telegram ham ajratiladi.
      const initData = storedInitData();
      await api("/api/auth/logout", { method: "POST", body: JSON.stringify(initData ? { initData } : {}) });
      window.location.replace(initData ? "/tg" : "/login");
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
                        setAccountOpen(true);
                      }}
                    >
                      <KeyRound size={16} strokeWidth={1.8} aria-hidden="true" />
                      Login va parol
                    </button>
                    <TelegramItem onDone={() => setMenu(false)} />
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
          <Signature />
        </footer>
        {accountOpen && (
          <AccountDialog
            account={account}
            onClose={() => setAccountOpen(false)}
            onSaved={(what) => {
              setAccountOpen(false);
              notify(what === "password" ? "Parol yangilandi" : "Login yangilandi");
              if (what === "login") setTimeout(() => window.location.reload(), 900);
            }}
          />
        )}
    </div>
  );
}

/** Hisob menyusida: Telegram'ni ulash yoki ajratish. Web-app ichida kerak emas. */
function TelegramItem({ onDone }: { onDone: () => void }) {
  const notify = useToast();
  const [state, setState] = useState<{ enabled: boolean; telegram: { name: string } | null } | null>(null);
  useEffect(() => {
    if (storedInitData()) return;
    let alive = true;
    api<{ enabled: boolean; telegram: { name: string } | null }>("/api/me/telegram").then(
      (data) => alive && setState(data),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, []);
  if (!state?.enabled) return null;
  async function connect() {
    // Yangi oyna bosish paytida ochiladi: keyinroq ochilsa, brauzer to‘sadi.
    const tab = window.open("", "_blank");
    try {
      const { url } = await api<{ url: string }>("/api/me/telegram", { method: "POST" });
      if (tab) tab.location.href = url;
      onDone();
    } catch (e) {
      tab?.close();
      notify({ message: (e as Error).message, tone: "error" });
    }
  }
  async function disconnect() {
    try {
      await api("/api/me/telegram", { method: "DELETE" });
      notify("Telegram ajratildi");
      onDone();
    } catch (e) {
      notify({ message: (e as Error).message, tone: "error" });
    }
  }
  return (
    <button type="button" role="menuitem" className="menu-item" onClick={() => void (state.telegram ? disconnect() : connect())}>
      <Send size={16} strokeWidth={1.8} aria-hidden="true" />
      {state.telegram ? `Telegram'ni ajratish (${state.telegram.name})` : "Telegram'ni ulash"}
    </button>
  );
}

type AccountTab = "password" | "login";

/** Login va parol: ikkalasi ham joriy parol bilan almashtiriladi. */
function AccountDialog({ account, onClose, onSaved }: { account: Account; onClose: () => void; onSaved: (what: AccountTab) => void }) {
  const formId = useId();
  const [tab, setTab] = useState<AccountTab>("password");
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [login, setLogin] = useState(account.username);
  const [unlink, setUnlink] = useState(false);
  const [telegram, setTelegram] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    api<{ telegram: { name: string } | null }>("/api/me/telegram").then(
      (data) => setTelegram(data.telegram?.name || null),
      () => {},
    );
  }, []);
  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (tab === "password" && password !== repeat) {
      setError("Yangi parollar mos kelmadi.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/me", {
        method: "PATCH",
        body: JSON.stringify(
          tab === "password"
            ? { currentPassword: current, newPassword: password, unlinkTelegram: unlink }
            : { currentPassword: current, newUsername: login },
        ),
      });
      onSaved(tab);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <Modal title="Login va parol" eyebrow={`Hisob · @${account.username}`} onClose={onClose} size="sm">
      <form id={formId} className="sheet-body form" onSubmit={save}>
        <Segmented<AccountTab>
          label="Nimani almashtirish"
          className="segmented-block"
          value={tab}
          onChange={(next) => {
            setTab(next);
            setError("");
          }}
          options={[
            { value: "password", label: "Parol" },
            { value: "login", label: "Login" },
          ]}
        />
        {tab === "login" && (
          <label className="field">
            <span className="field-label">Yangi login</span>
            <input className="input" autoComplete="username" autoCapitalize="none" spellCheck={false} value={login} onChange={(e) => setLogin(e.target.value)} minLength={3} maxLength={32} required />
            <span className="field-hint">Lotin harflari, raqam, nuqta, chiziqcha. Keyingi safar shu login bilan kirasiz.</span>
          </label>
        )}
        <label className="field">
          <span className="field-label">Joriy parol</span>
          <input className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </label>
        {tab === "password" && (
          <>
            <label className="field">
              <span className="field-label">Yangi parol</span>
              <input className="input" type="password" autoComplete="new-password" placeholder="Kamida 8 ta belgi" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} maxLength={128} required />
            </label>
            <label className="field">
              <span className="field-label">Yangi parolni takrorlang</span>
              <input className="input" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} minLength={8} maxLength={128} required />
            </label>
            {telegram && (
              <label className="check-row">
                <input type="checkbox" checked={unlink} onChange={(e) => setUnlink(e.target.checked)} />
                <span>
                  Telegram'ni ham ajratish
                  <small>{`Hozir ulangan: ${telegram}. Siz ulamagan bo‘lsangiz, belgilang.`}</small>
                </span>
              </label>
            )}
            <p className="field-hint">Boshqa qurilmalardagi kirishlar yopiladi.</p>
          </>
        )}
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
