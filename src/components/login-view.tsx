"use client";
import { FormEvent, useEffect, useState, type CSSProperties } from "react";
import { ArrowLeft, Eye, EyeOff, Globe, Send } from "lucide-react";
import { api, ErrorMessage, Segmented, Signature, Spinner, Wordmark } from "./ui";
import type { MiniApp } from "./telegram-webapp";

type Mode = "login" | "register";

/** Kirgandan keyin qayerga o‘tiladi va so‘rovga nima qo‘shiladi. */
interface Context {
  next: string;
  extra: { initData?: string; embedded?: boolean };
}

export default function LoginView({
  bot = false,
  telegram,
  next = "/",
  note,
}: {
  /** Saytda «Telegram orqali kirish» ko‘rinadi. */
  bot?: boolean;
  /** Telegram web-app ichida ochilgan. */
  telegram?: MiniApp;
  next?: string;
  note?: string;
}) {
  const [mode, setMode] = useState<Mode>(telegram?.register ? "register" : "login");
  const context: Context = {
    next: telegram?.next || next,
    extra: telegram ? { initData: telegram.initData, embedded: telegram.embedded } : {},
  };
  useEffect(() => {
    if (window.location.hash === "#royxatdan-otish") setMode("register");
  }, []);
  function switchTo(next: Mode) {
    setMode(next);
    if (!telegram) history.replaceState(null, "", window.location.search + (next === "register" ? "#royxatdan-otish" : "#"));
  }
  return (
    <div className="login">
      <header className="login-top">
        <Wordmark />
      </header>
      <main className="login-main">
        <p className="eyebrow rise">PM va dizaynerlar uchun</p>
        <h1 className="login-title rise" style={{ "--i": 1 } as CSSProperties}>
          Fazo Task.
          <span className="dim">Har kimga o‘z paneli.</span>
        </h1>
        <p className="login-lead rise" style={{ "--i": 2 } as CSSProperties}>
          {telegram
            ? `Salom, ${telegram.name}. Bir marta kirsangiz, bot va ilova sizni o‘zi taniydi.`
            : note || "Project manager vazifa beradi, dizayner bajaradi — hammasi bir joyda."}
        </p>
        <div className="login-card rise" style={{ "--i": 3 } as CSSProperties}>
          <Segmented<Mode>
            label="Kirish turi"
            className="segmented-block"
            value={mode}
            onChange={switchTo}
            options={[
              { value: "login", label: "Kirish" },
              { value: "register", label: "Ro‘yxatdan o‘tish" },
            ]}
          />
          {mode === "login" ? (
            <LoginForm context={context} onRegister={() => switchTo("register")} />
          ) : (
            <RegisterForm context={context} />
          )}
          {telegram && <BrowserSignIn telegram={telegram} />}
          {bot && !telegram && <TelegramSignIn next={next} />}
        </div>
      </main>
      <footer className="foot">
        <span>Fazo Task</span>
        <span aria-hidden="true">·</span>
        <span>Jamoa ishlari bir joyda.</span>
        <Signature />
      </footer>
    </div>
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
  autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <label className="password-row">
      <span className="sr-only">{placeholder}</span>
      <input
        autoComplete={autoComplete}
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        autoFocus={autoFocus}
      />
      <button
        type="button"
        className="icon-button"
        aria-label={show ? "Parolni yashirish" : "Parolni ko‘rsatish"}
        onClick={() => setShow(!show)}
      >
        {show ? <EyeOff size={17} strokeWidth={1.8} /> : <Eye size={17} strokeWidth={1.8} />}
      </button>
    </label>
  );
}

/** Web-app ichidan: tashqi brauzerda bir martalik havola ochiladi, tasdiqlangach shu yer o‘zi kiradi. */
function BrowserSignIn({ telegram }: { telegram: MiniApp }) {
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!waiting) return;
    const check = async () => {
      const data = await api<{ status: string }>("/api/auth/telegram", {
        method: "POST",
        body: JSON.stringify({ initData: telegram.initData, embedded: telegram.embedded }),
      }).catch(() => null);
      if (data?.status === "signed-in") window.location.replace(telegram.next);
    };
    const timer = setInterval(() => void check(), 2500);
    return () => clearInterval(timer);
  }, [waiting, telegram]);
  async function open() {
    setError("");
    try {
      const { url } = await api<{ url: string }>("/api/auth/telegram/browser", {
        method: "POST",
        body: JSON.stringify({ initData: telegram.initData }),
      });
      if (window.Telegram?.WebApp) window.Telegram.WebApp.openLink(url);
      else window.open(url, "_blank");
      setWaiting(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="login-alt">
      <span className="login-or">yoki</span>
      <ErrorMessage message={error} />
      {waiting ? (
        <p className="login-wait">
          <Spinner label="Kutilmoqda" />
          Brauzerda tasdiqlang, keyin bu yer o‘zi ochiladi.
        </p>
      ) : (
        <button type="button" className="btn btn-secondary btn-lg btn-block" onClick={() => void open()}>
          <Globe size={17} strokeWidth={1.9} aria-hidden="true" />
          Brauzer orqali kirish
        </button>
      )}
    </div>
  );
}

/** Saytdan: bot «Bu sizmisiz?» deb so‘raydi, tasdiqlansa shu brauzer kiradi. */
function TelegramSignIn({ next }: { next: string }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!url) return;
    const check = async () => {
      const data = await api<{ status: string }>("/api/auth/telegram/status").catch(() => null);
      if (data?.status === "signed-in") return window.location.assign(next);
      if (data?.status === "denied" || data?.status === "expired") {
        setUrl("");
        setError(data.status === "denied" ? "Kirish Telegram'da rad etildi." : "So‘rov eskirdi. Qayta urinib ko‘ring.");
      }
    };
    const timer = setInterval(() => void check(), 2000);
    return () => clearInterval(timer);
  }, [url, next]);
  async function start() {
    setError("");
    // Yangi oynani bosish paytida ochamiz: keyinroq ochilsa, brauzer to‘sib qo‘yadi.
    const tab = window.open("", "_blank");
    try {
      const data = await api<{ url: string }>("/api/auth/telegram/start", { method: "POST" });
      if (tab) tab.location.href = data.url;
      setUrl(data.url);
    } catch (e) {
      tab?.close();
      setError((e as Error).message);
    }
  }
  return (
    <div className="login-alt">
      <span className="login-or">yoki</span>
      <ErrorMessage message={error} />
      {url ? (
        <div className="login-wait">
          <Spinner label="Kutilmoqda" />
          <span>
            Telegram&apos;da «Ha, kirish»ni bosing.{" "}
            <a className="link-inline" href={url} target="_blank" rel="noopener">
              Qayta ochish
            </a>
          </span>
        </div>
      ) : (
        <button type="button" className="btn btn-secondary btn-lg btn-block" onClick={() => void start()}>
          <Send size={17} strokeWidth={1.9} aria-hidden="true" />
          Telegram orqali kirish
        </button>
      )}
    </div>
  );
}

function LoginForm({ context, onRegister }: { context: Context; onRegister: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function login(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password, ...context.extra }) });
      window.location.assign(context.next);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <form className="login-form" onSubmit={login}>
      <div className="stacked-fields">
        <label>
          <span className="sr-only">Login</span>
          <input
            autoComplete="username"
            placeholder="Login"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
            maxLength={32}
            autoCapitalize="none"
            spellCheck={false}
          />
        </label>
        <PasswordInput value={password} onChange={setPassword} placeholder="Parol" autoComplete="current-password" />
      </div>
      <ErrorMessage message={error} />
      <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy}>
        {busy ? <Spinner label="Kirilmoqda" /> : "Kirish"}
      </button>
      <p className="login-help">
        Birinchi marta kiryapsizmi?{" "}
        <button type="button" className="link-inline" onClick={onRegister}>
          Ro‘yxatdan o‘ting
        </button>{" "}
        — administrator bergan login bilan o‘zingizga parol yaratasiz.
      </p>
    </form>
  );
}

function RegisterForm({ context }: { context: Context }) {
  const [username, setUsername] = useState("");
  const [member, setMember] = useState<{ name: string; role: string } | null>(null);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function check(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api<{ member: { name: string; role: string } }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ username }),
      });
      setMember(data.member);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function activate(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== repeat) {
      setError("Parollar mos kelmadi.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/auth/register", { method: "POST", body: JSON.stringify({ username, password, ...context.extra }) });
      window.location.assign(context.next);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  if (!member)
    return (
      <form className="login-form" onSubmit={check}>
        <div className="stacked-fields">
          <label>
            <span className="sr-only">Login</span>
            <input
              autoComplete="username"
              placeholder="Administrator bergan login"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              maxLength={32}
              autoCapitalize="none"
              spellCheck={false}
            />
          </label>
        </div>
        <ErrorMessage message={error} />
        <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy || username.trim().length < 3}>
          {busy ? <Spinner /> : "Davom etish"}
        </button>
        <p className="login-help">Login administrator tomonidan beriladi. Parolni esa faqat siz bilasiz.</p>
      </form>
    );
  return (
    <form className="login-form" onSubmit={activate}>
      <div className="register-hello">
        <button
          type="button"
          className="icon-button"
          aria-label="Loginni o‘zgartirish"
          onClick={() => {
            setMember(null);
            setPassword("");
            setRepeat("");
            setError("");
          }}
        >
          <ArrowLeft size={17} strokeWidth={2} />
        </button>
        <p>
          <strong>{member.name}</strong>
          <span>
            {member.role} · @{username.trim().toLowerCase()}
          </span>
        </p>
      </div>
      <div className="stacked-fields">
        <PasswordInput value={password} onChange={setPassword} placeholder="Yangi parol" autoComplete="new-password" autoFocus />
        <PasswordInput value={repeat} onChange={setRepeat} placeholder="Parolni takrorlang" autoComplete="new-password" />
      </div>
      <p className="field-hint">Kamida 8 ta belgi. Bu parolni hech kimga bermang.</p>
      <ErrorMessage message={error} />
      <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy || password.length < 8}>
        {busy ? <Spinner /> : "Parol yaratish va kirish"}
      </button>
    </form>
  );
}
