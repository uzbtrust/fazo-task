"use client";
import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import LoginView, { SignedIn, usePreloadWorkspace, type Signed } from "./login-view";
import { api, ErrorMessage, Spinner, Wordmark } from "./ui";
import { STORED_INIT_DATA, type MiniApp } from "./telegram-webapp";

const VIEWS = ["statistika", "dizaynerlar", "yangi-vazifa", "ochiq", "vazifalarim", "hisob"];

/** Ochilgandan keyin qayerga o‘tiladi: faqat ma’lum sahifalar, tashqi manzil yo‘q. */
function target(search: URLSearchParams) {
  const task = search.get("task");
  if (task && /^[a-f0-9-]{36}$/.test(task)) return `/#vazifa=${task}`;
  const view = search.get("view");
  return view && VIEWS.includes(view) ? `/#${view}` : "/";
}

/**
 * Telegram'ga skriptsiz xabar: ilova tayyorligini darhol aytamiz, aks holda Telegram skript yuklanguncha
 * yuklanish pardasini ko‘rsatib turadi. Protokol: core.telegram.org/api/web-events.
 */
function postEvent(eventType: string, eventData: Record<string, unknown> = {}) {
  const w = window as Window & {
    TelegramWebviewProxy?: { postEvent: (type: string, data: string) => void };
    external?: { notify?: (data: string) => void };
  };
  const message = JSON.stringify({ eventType, eventData });
  try {
    if (w.TelegramWebviewProxy) w.TelegramWebviewProxy.postEvent(eventType, JSON.stringify(eventData));
    else if (w.external?.notify) w.external.notify(message);
    else if (window.parent !== window) window.parent.postMessage(message, "https://web.telegram.org");
  } catch {}
}

/** Telegram mavzusi — hisobda mavzu tanlanmagan bo‘lsa. Tanlangan bo‘lsa, ish stoli o‘zi qo‘llaydi. */
function followTelegram() {
  const app = window.Telegram?.WebApp;
  if (!app?.colorScheme) return;
  try {
    if (!localStorage.getItem("fazo-theme")) document.documentElement.classList.toggle("dark", app.colorScheme === "dark");
  } catch {}
  const color = document.documentElement.classList.contains("dark") ? "#000000" : "#ffffff";
  app.setHeaderColor?.(color);
  app.setBackgroundColor?.(color);
}

/**
 * Web-app kirish nuqtasi. Telegram ma’lumoti manzilning o‘zida keladi: uni kutmasdan darhol kiriladi
 * va ish stoli shu sahifada ochiladi — Telegram skripti va qayta yuklash kutilmaydi.
 */
export default function TelegramEntry() {
  const [miniApp, setMiniApp] = useState<MiniApp | null>(null);
  const [session, setSession] = useState<Required<Signed> | null>(null);
  const [error, setError] = useState("");
  const started = useRef(false);
  usePreloadWorkspace();

  async function begin(initData: string) {
    if (started.current) return;
    started.current = true;
    try {
      sessionStorage.setItem(STORED_INIT_DATA, initData);
    } catch {}
    const search = new URLSearchParams(window.location.search);
    const embedded = window.self !== window.top;
    const next = target(search);
    try {
      const data = await api<{ status: string; telegram?: { name: string } } & Partial<Signed>>("/api/auth/telegram", {
        method: "POST",
        body: JSON.stringify({ initData, embedded, load: true }),
      });
      if (data.status === "signed-in" && data.user && data.initial) {
        history.replaceState(null, "", next);
        return setSession({ user: data.user, initial: data.initial });
      }
      setMiniApp({ initData, embedded, next, name: data.telegram?.name || "Telegram", register: search.get("mode") === "register" });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    const fromHash = new URLSearchParams(window.location.hash.slice(1)).get("tgWebAppData");
    if (fromHash) {
      postEvent("web_app_ready");
      postEvent("web_app_expand");
      void begin(fromHash);
    }
    // Hash bo‘lmasa, Telegram skripti kutiladi; u ham kelmasa — oddiy brauzer.
    const timer = setTimeout(() => {
      if (!started.current && !window.Telegram?.WebApp?.initData) window.location.replace("/");
    }, 6000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onTelegram() {
    const app = window.Telegram?.WebApp;
    app?.ready();
    app?.expand();
    followTelegram();
    if (app?.initData) void begin(app.initData);
    else if (!started.current) window.location.replace("/");
  }

  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" onReady={onTelegram} onError={onTelegram} />
      {session ? (
        <SignedIn data={session} />
      ) : miniApp ? (
        <LoginView telegram={miniApp} />
      ) : (
        <div className="app-state">
          <Wordmark />
          {error ? <ErrorMessage message={error} /> : <Spinner label="Kirilmoqda" />}
        </div>
      )}
    </>
  );
}
