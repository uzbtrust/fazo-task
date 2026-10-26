"use client";
import { FormEvent, useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  CircleCheck,
  PenTool,
  Sparkles,
} from "lucide-react";
import { api, Logo, ErrorMessage, Spinner } from "@/components/ui";
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
    <main className="login-page">
      <div className="login-story">
        <Logo />
        <div className="login-story-content">
          <p className="eyebrow">IJODKOR JAMOALAR UCHUN</p>
          <h1>
            G‘oyaga yo‘l.
            <br />
            Ijodga fazo.
          </h1>
          <p>
            Yaxshi dizayn aniq vazifadan boshlanadi.
            <br />
            Jamoangizning keyingi katta ishini shu yerda yarating.
          </p>
          <div className="login-visual" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="visual-core">
              <PenTool size={30} strokeWidth={1.4} />
            </div>
            <span className="orbit-label orbit-label-one">
              <span className="mini-dot" />
              G‘oya
            </span>
            <span className="orbit-label orbit-label-two">
              <CircleCheck size={15} />
              Tayyor natija
            </span>
            <span className="orbit-label orbit-label-three">
              <Sparkles size={14} />
              Ijod jarayoni
            </span>
          </div>
        </div>
        <span className="login-caption">
          Kamroq tartibsizlik. Ko‘proq yaxshi ishlar.
        </span>
      </div>
      <div className="login-form-side">
        <div className="mobile-login-logo">
          <Logo />
        </div>
        <div className="login-form-wrap">
          <span className="login-kicker">SIZNING ISH FAZONGIZ</span>
          <h2>Yana xush kelibsiz.</h2>
          <p>Jamoangiz bilan bir fazoda ishlash uchun kiring.</p>
          <form onSubmit={login} className="form-stack">
            <label>
              Login
              <input
                autoComplete="username"
                name="username"
                placeholder="Loginingizni kiriting"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                maxLength={60}
              />
            </label>
            <label>
              Parol
              <div className="password-field">
                <input
                  autoComplete="current-password"
                  type={show ? "text" : "password"}
                  name="password"
                  placeholder="Parolingizni kiriting"
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
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            <ErrorMessage message={error} />
            <button
              className="button button-primary login-submit"
              type="submit"
              disabled={busy}
            >
              {busy ? (
                <Spinner />
              ) : (
                <>
                  Ish fazosiga kirish
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
          <p className="login-help">
            Profilingiz administrator tomonidan yaratiladi.
            <br />
            Kirish ma’lumotlarini jamoangiz adminidan oling.
          </p>
          <details className="initial-admin">
            <summary>Birinchi marta sozlayapsizmi?</summary>
            <p>
              Boshlang‘ich administrator: <strong>admin / admin</strong>.<br />
              Kirgach, sozlamalarda parolni yangilang.
            </p>
          </details>
        </div>
        <footer>
          Fazo Task<span>G‘oyadan natijagacha.</span>
        </footer>
      </div>
    </main>
  );
}
