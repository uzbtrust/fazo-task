"use client";
import { FormEvent, useState } from "react";
import {
  ArrowRight,
  Check,
  KeyRound,
  Pencil,
  Plus,
  ShieldCheck,
  UserRound,
  Users,
  LockKeyhole,
} from "lucide-react";
import type { Role, User } from "@/lib/types";
import {
  api,
  Avatar,
  ErrorMessage,
  Modal,
  roleLabels,
  shortDate,
  Spinner,
} from "./ui";
export function Team({
  users,
  onRefresh,
  notify,
}: {
  users: User[];
  onRefresh: () => Promise<void>;
  notify: (s: string) => void;
}) {
  const [editing, setEditing] = useState<User | null | undefined>(undefined);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">BIR JAMOA. BIR FAZO.</p>
          <h1>
            Yaxshi ishlar ortida
            <br />
            yaxshi jamoa bor.
          </h1>
          <p className="page-description">
            Profillar, rollar va jamoangizning ishga kirishi shu yerda.
          </p>
        </div>
        <button
          className="button button-primary"
          onClick={() => setEditing(null)}
        >
          <Plus size={17} />
          Yangi xodim
        </button>
      </div>
      <div className="team-summary">
        <span>
          <strong>{users.filter((u) => u.active).length}</strong> faol xodim
        </span>
        <span>
          <strong>
            {users.filter((u) => u.role === "designer" && u.active).length}
          </strong>{" "}
          dizayner
        </span>
        <span>
          <strong>
            {users.filter((u) => u.role === "creator" && u.active).length}
          </strong>{" "}
          kontent kreator
        </span>
      </div>
      <div className="team-table">
        <div className="team-table-head">
          <span>Jamoa a’zosi</span>
          <span>Rol</span>
          <span>Holat</span>
          <span>Qo‘shilgan sana</span>
          <span />
        </div>
        {users.map((u) => (
          <div
            className={`team-row ${!u.active ? "inactive-row" : ""}`}
            key={u.id}
          >
            <div className="person-line">
              <Avatar name={u.name} />
              <span>
                <strong>{u.name}</strong>
                <small>@{u.username}</small>
              </span>
            </div>
            <span className="role-chip">
              {u.role === "admin" ? (
                <ShieldCheck size={14} />
              ) : (
                <UserRound size={14} />
              )}{" "}
              {roleLabels[u.role]}
            </span>
            <span className={`member-status ${u.active ? "is-active" : ""}`}>
              <span />
              {u.active ? "Faol" : "Nofaol"}
            </span>
            <span className="member-date">{shortDate(u.createdAt)}</span>
            <button
              className="icon-button"
              onClick={() => setEditing(u)}
              aria-label={`${u.name} profilini tahrirlash`}
            >
              <Pencil size={16} />
            </button>
          </div>
        ))}
      </div>
      {users.length === 1 && (
        <div className="team-onboarding">
          <span className="large-icon">
            <Users size={25} />
          </span>
          <div>
            <h3>Jamoangizga joy bor.</h3>
            <p>
              Kontent kreator va dizayner profillarini qo‘shing. Yaratilgan
              login va parolni xodimga bering.
            </p>
          </div>
          <button className="text-button" onClick={() => setEditing(null)}>
            Birinchi xodimni qo‘shish
            <ArrowRight size={16} />
          </button>
        </div>
      )}
      {editing !== undefined && (
        <UserForm
          initial={editing}
          onClose={() => setEditing(undefined)}
          onSaved={async () => {
            await onRefresh();
            setEditing(undefined);
            notify(editing ? "Profil yangilandi" : "Yangi xodim qo‘shildi");
          }}
        />
      )}
    </>
  );
}
function UserForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: User | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [username, setUsername] = useState(initial?.username || "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(initial?.role || "designer");
  const [active, setActive] = useState(initial?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(initial ? `/api/users/${initial.id}` : "/api/users", {
        method: initial ? "PATCH" : "POST",
        body: JSON.stringify({
          name,
          ...(!initial ? { username } : {}),
          ...(password ? { password } : {}),
          role,
          active,
        }),
      });
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={initial ? "Xodim profilini tahrirlash" : "Jamoaga yangi xodim"}
      eyebrow="JAMOA BOSHQARUVI"
      onClose={onClose}
    >
      <form className="form-stack" onSubmit={save}>
        <label>
          Ism va familiya
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
            placeholder="Ism Familiya"
            autoFocus
          />
        </label>
        <div className="form-row">
          <label>
            Login
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={!!initial}
              minLength={3}
              maxLength={32}
              pattern="[a-zA-Z0-9_.-]+"
              placeholder="ism.familiya"
            />
            <span className="field-note">Lotin harflari, raqam va . _ −</span>
          </label>
          <label>
            Rol
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              <option value="designer">Dizayner</option>
              <option value="creator">Kontent kreator</option>
              <option value="admin">Administrator</option>
            </select>
          </label>
        </div>
        <label>
          {initial ? "Yangi parol" : "Boshlang‘ich parol"}
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required={!initial}
            minLength={6}
            maxLength={128}
            placeholder={
              initial
                ? "O‘zgartirmaslik uchun bo‘sh qoldiring"
                : "Kamida 6 ta belgi"
            }
          />
        </label>
        {initial && (
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            <span>
              Profil faol<small>Nofaol xodim tizimga kira olmaydi.</small>
            </span>
          </label>
        )}
        <div className="info-banner">
          <KeyRound size={19} />
          <p>
            Login va parolni xodimga bering. Xodim kirgach parolini sozlamalarda
            yangilay oladi.
          </p>
        </div>
        <ErrorMessage message={error} />
        <div className="modal-footer">
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
          >
            Bekor qilish
          </button>
          <button className="button button-primary" disabled={busy}>
            {busy ? (
              <Spinner />
            ) : (
              <>
                {initial ? "Saqlash" : "Profil yaratish"}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function Settings({
  user,
  onUserChanged,
  notify,
}: {
  user: User;
  onUserChanged: (u: User) => void;
  notify: (s: string) => void;
}) {
  const [name, setName] = useState(user.name);
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function save(e: FormEvent, kind: "profile" | "password") {
    e.preventDefault();
    setError("");
    if (kind === "password" && password !== repeat) {
      setError("Yangi parollar mos kelmadi.");
      return;
    }
    setBusy(kind);
    try {
      const data = await api<{ user: User }>("/api/me", {
        method: "PATCH",
        body: JSON.stringify(
          kind === "profile"
            ? { name }
            : { currentPassword: current, newPassword: password },
        ),
      });
      if (data.user) onUserChanged(data.user);
      if (kind === "password") {
        setCurrent("");
        setPassword("");
        setRepeat("");
      }
      notify(kind === "profile" ? "Profil saqlandi" : "Parolingiz yangilandi");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">O‘ZINGIZGA MOS FAZO</p>
          <h1>Sozlamalar.</h1>
          <p className="page-description">
            Profilingiz va hisob xavfsizligini boshqaring.
          </p>
        </div>
      </div>
      <div className="settings-layout">
        <div className="profile-intro">
          <Avatar name={user.name} />
          <h2>{user.name}</h2>
          <p>@{user.username}</p>
          <span className="role-chip">{roleLabels[user.role]}</span>
          <p className="field-note">
            Profilingiz {shortDate(user.createdAt)} kuni yaratilgan.
          </p>
        </div>
        <div className="settings-forms">
          <section className="settings-card">
            <div className="section-mini-title">
              <UserRound size={19} />
              <h2>Shaxsiy ma’lumotlar</h2>
            </div>
            <form className="form-stack" onSubmit={(e) => save(e, "profile")}>
              <label>
                Ism va familiya
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={80}
                />
              </label>
              <label>
                Login
                <input value={user.username} disabled />
                <span className="field-note">
                  Login administrator tomonidan belgilanadi.
                </span>
              </label>
              <div>
                <button className="button button-primary" disabled={!!busy}>
                  {busy === "profile" ? (
                    <Spinner />
                  ) : (
                    <>
                      <Check size={16} />
                      O‘zgarishlarni saqlash
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
          <section className="settings-card">
            <div className="section-mini-title">
              <LockKeyhole size={19} />
              <h2>Parolni yangilash</h2>
            </div>
            {user.username === "admin" && (
              <div className="info-banner">
                <ShieldCheck size={19} />
                <p>
                  Boshlang‘ich <strong>admin / admin</strong> bilan kirgan
                  bo‘lsangiz, hozir yangi parol belgilang.
                </p>
              </div>
            )}
            <form className="form-stack" onSubmit={(e) => save(e, "password")}>
              <label>
                Joriy parol
                <input
                  type="password"
                  autoComplete="current-password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  required
                />
              </label>
              <div className="form-row">
                <label>
                  Yangi parol
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    maxLength={128}
                    required
                    placeholder="Kamida 6 ta belgi"
                  />
                </label>
                <label>
                  Parolni takrorlang
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={repeat}
                    onChange={(e) => setRepeat(e.target.value)}
                    minLength={6}
                    maxLength={128}
                    required
                  />
                </label>
              </div>
              <div>
                <button className="button button-primary" disabled={!!busy}>
                  {busy === "password" ? (
                    <Spinner />
                  ) : (
                    <>
                      <KeyRound size={16} />
                      Parolni yangilash
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
          <ErrorMessage message={error} />
        </div>
      </div>
    </>
  );
}
