"use client";
import { useState } from "react";
import Script from "next/script";
import LoginView from "./login-view";
import { api, ErrorMessage, Spinner, Wordmark } from "./ui";
import { STORED_INIT_DATA, type MiniApp } from "./telegram-webapp";

const VIEWS = ["statistika", "dizaynerlar", "yangi-vazifa", "ochiq", "vazifalarim"];

/** Ochilgandan keyin qayerga o‘tiladi: faqat ma’lum sahifalar, tashqi manzil yo‘q. */
function target(search: URLSearchParams) {
  const task = search.get("task");
  if (task && /^[a-f0-9-]{36}$/.test(task)) return `/#vazifa=${task}`;
  const view = search.get("view");
  return view && VIEWS.includes(view) ? `/#${view}` : "/";
}

function applyTheme() {
  const app = window.Telegram?.WebApp;
  if (!app?.colorScheme) return;
  const dark = app.colorScheme === "dark";
  try {
    localStorage.setItem("fazo-theme", app.colorScheme);
  } catch {}
  document.documentElement.classList.toggle("dark", dark);
  const color = dark ? "#000000" : "#ffffff";
  app.setHeaderColor?.(color);
  app.setBackgroundColor?.(color);
}

/** Web-app kirish nuqtasi: Telegram bog‘langan bo‘lsa to‘g‘ri hisobga kiradi, bo‘lmasa kirish shakli chiqadi. */
export default function TelegramEntry() {
  const [miniApp, setMiniApp] = useState<MiniApp | null>(null);
  const [error, setError] = useState("");

  async function start() {
    const app = window.Telegram?.WebApp;
    const initData =
      app?.initData || new URLSearchParams(window.location.hash.slice(1)).get("tgWebAppData") || "";
    // Oddiy brauzerda ochilgan.
    if (!initData) return window.location.replace("/");
    app?.ready();
    app?.expand();
    applyTheme();
    try {
      sessionStorage.setItem(STORED_INIT_DATA, initData);
    } catch {}
    const search = new URLSearchParams(window.location.search);
    const embedded = window.self !== window.top;
    const next = target(search);
    try {
      const data = await api<{ status: string; telegram?: { name: string } }>("/api/auth/telegram", {
        method: "POST",
        body: JSON.stringify({ initData, embedded }),
      });
      if (data.status === "signed-in") return window.location.replace(next);
      setMiniApp({
        initData,
        embedded,
        next,
        name: data.telegram?.name || "Telegram",
        register: search.get("mode") === "register",
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" onReady={() => void start()} onError={() => void start()} />
      {miniApp ? (
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
