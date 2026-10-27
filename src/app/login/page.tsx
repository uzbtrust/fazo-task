"use client";
import { FormEvent, useState, type CSSProperties } from "react";
import { Eye, EyeOff } from "lucide-react";
import { api, ErrorMessage, Spinner, Wordmark } from "@/components/ui";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function login(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      window.location.assign("/");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="login">
      <header className="login-top">
        <Wordmark />
      </header>
      <main className="login-main">
        <p className="eyebrow rise">Hodimlar va vazifalar</p>
        <h1 className="login-title rise" style={{ "--i": 1 } as CSSProperties}>
          Fazo Task.
          <span className="dim">Jamoa bir joyda.</span>
        </h1>
        <p className="login-lead rise" style={{ "--i": 2 } as CSSProperties}>
          Hodim qo‘shing, vazifa belgilang va kim nima qilayotganini bir qarashda ko‘ring.
        </p>
        <form className="login-card rise" style={{ "--i": 3 } as CSSProperties} onSubmit={login}>
          <div className="stacked-fields">
            <label>
              <span className="sr-only">Login</span>
              <input
                autoComplete="username"
                name="username"
                placeholder="Login"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                maxLength={60}
                autoCapitalize="none"
                spellCheck={false}
              />
            </label>
            <label className="password-row">
              <span className="sr-only">Parol</span>
              <input
                autoComplete="current-password"
                type={show ? "text" : "password"}
                name="password"
                placeholder="Parol"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
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
          </div>
          <ErrorMessage message={error} />
          <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy}>
            {busy ? <Spinner label="Kirilmoqda" /> : "Kirish"}
          </button>
          <details className="login-help">
            <summary>Birinchi marta kiryapsizmi?</summary>
            <p>
              Boshlang‘ich login va parol: <strong>admin / admin</strong>. Kirgach, hisob menyusidan
              parolni almashtiring.
            </p>
          </details>
        </form>
      </main>
      <footer className="foot">
        <span>Fazo Task</span>
        <span aria-hidden="true">·</span>
        <span>Jamoa ishlari bir joyda.</span>
      </footer>
    </div>
  );
}
