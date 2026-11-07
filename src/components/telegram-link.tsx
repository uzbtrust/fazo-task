"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, Send } from "lucide-react";
import type { Account } from "@/lib/types";
import { roleInfo } from "@/lib/roles";
import { api, Avatar, ErrorMessage, Signature, Spinner, Wordmark } from "./ui";

function Frame({ title, dim, children }: { title: string; dim: string; children: ReactNode }) {
  return (
    <div className="login">
      <header className="login-top">
        <Wordmark />
      </header>
      <main className="login-main">
        <h1 className="login-title">
          {title}
          <span className="dim">{dim}</span>
        </h1>
        <div className="login-card">{children}</div>
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

export function LinkExpired({ botUrl }: { botUrl: string }) {
  return (
    <Frame title="Havola eskirgan." dim="Botda qayta bosing.">
      <p className="login-help">Bir martalik havola ishlatilgan yoki muddati tugagan.</p>
      <a className="btn btn-primary btn-lg btn-block" href={botUrl}>
        Botni ochish
      </a>
    </Frame>
  );
}

/** Bog‘langan Telegram'dan brauzerga parolsiz kirish. */
export function OpenInBrowser({ token, botUrl }: { token: string; botUrl: string }) {
  const [failed, setFailed] = useState(false);
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    api("/api/auth/telegram/link", { method: "POST", body: JSON.stringify({ token }) }).then(
      () => window.location.replace("/"),
      () => setFailed(true),
    );
  }, [token]);
  if (failed) return <LinkExpired botUrl={botUrl} />;
  return (
    <div className="app-state">
      <Wordmark />
      <Spinner label="Kirilmoqda" />
    </div>
  );
}

/** Brauzerdagi hisobga Telegram'ni ulash. Bir marta tasdiqlanadi: begona havola hisobni egallab ololmaydi. */
export function ConfirmLink({
  token,
  telegram,
  account,
  botUrl,
}: {
  token: string;
  telegram: string;
  account: Account;
  botUrl: string;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  async function connect() {
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/telegram/link", { method: "POST", body: JSON.stringify({ token }) });
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function switchAccount() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.reload();
  }
  if (done)
    return (
      <Frame title="Tayyor." dim="Telegram ulandi.">
        <p className="login-help">Bot va ilova endi shu hisob bilan o‘zi ochiladi.</p>
        <a className="btn btn-primary btn-lg btn-block" href={botUrl}>
          Telegram&apos;ga qaytish
        </a>
        <a className="btn btn-quiet btn-lg btn-block" href="/">
          Saytda davom etish
        </a>
      </Frame>
    );
  return (
    <Frame title="Telegram'ni ulash." dim="Bir marta tasdiqlang.">
      <div className="link-pair">
        <p>
          <span className="link-icon">
            <Send size={17} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span>
            <strong>{telegram}</strong>
            <small>Telegram hisobi</small>
          </span>
        </p>
        <ArrowDown className="link-arrow" size={16} strokeWidth={2} aria-hidden="true" />
        <p>
          <Avatar name={account.name} size="sm" />
          <span>
            <strong>{account.name}</strong>
            <small>
              @{account.username} · {roleInfo[account.role].label}
            </small>
          </span>
        </p>
      </div>
      <ErrorMessage message={error} />
      <button type="button" className="btn btn-primary btn-lg btn-block" disabled={busy} onClick={() => void connect()}>
        {busy ? <Spinner label="Ulanmoqda" /> : "Ulash"}
      </button>
      <button type="button" className="btn btn-quiet btn-lg btn-block" onClick={() => void switchAccount()}>
        Boshqa hisob bilan kirish
      </button>
      <p className="login-help">Bu havolani o‘zingiz ochmagan bo‘lsangiz, ulamang.</p>
    </Frame>
  );
}
