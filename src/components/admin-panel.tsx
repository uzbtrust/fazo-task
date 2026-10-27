"use client";
import { FormEvent, useCallback, useEffect, useId, useState } from "react";
import { Check, Copy, KeyRound, Pencil, Plus, Trash2, Users } from "lucide-react";
import type { Account, Member } from "@/lib/types";
import type { Initial } from "@/lib/initial";
import { memberRoles, roleInfo, type MemberRole } from "@/lib/roles";
import {
  api,
  Avatar,
  ConfirmDialog,
  ErrorMessage,
  longDate,
  Modal,
  Segmented,
  Spinner,
} from "./ui";
import { Empty, Facts, PageHead, rise } from "./page-parts";
import { Shell, usePolling, useToast } from "./shell";
import { DesignerFacts, MemberCard } from "./pm-panel";
import { prefetchStats, StatsView } from "./stats-view";

type View = "team" | "stats";

export function AdminPanel({ account, initial }: { account: Account; initial: Initial }) {
  const notify = useToast();
  const [members, setMembers] = useState<Member[]>(initial.members);
  const [form, setForm] = useState<{ member?: Member; role?: MemberRole } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [view, setView] = useState<View>("team");
  const refresh = useCallback(async () => {
    setMembers((await api<{ members: Member[] }>("/api/members")).members);
  }, []);
  useEffect(() => {
    if (window.location.hash === "#statistika") setView("stats");
    // Statistika fonda tayyorlanadi — bo‘limga o‘tilganda darhol ko‘rinadi.
    const timer = setTimeout(() => void prefetchStats("30"), 800);
    return () => clearTimeout(timer);
  }, []);
  usePolling(refresh);

  const open = members.find((m) => m.id === openId);
  const waiting = members.filter((m) => !m.activated).length;
  function go(next: View) {
    setView(next);
    history.replaceState(null, "", next === "stats" ? "#statistika" : "#jamoa");
    window.scrollTo({ top: 0 });
  }
  return (
    <Shell
      account={account}
      view={view}
      onView={go}
      nav={[
        { value: "team", label: "Jamoa" },
        { value: "stats", label: "Statistika" },
      ]}
    >
      {view === "stats" ? (
        <StatsView />
      ) : (
        <>
          <PageHead
            eyebrow={<span className="eyebrow-accent">Boshqaruv</span>}
            title="Jamoa."
            dim="Kim qaysi rolda."
            lead="Hodim qo‘shing va login bering. Parolni hodim o‘zi «Ro‘yxatdan o‘tish» orqali yaratadi."
            action={
              <button className="btn btn-primary btn-lg" onClick={() => setForm({})}>
                <Plus size={19} strokeWidth={2.2} aria-hidden="true" />
                Hodim qo‘shish
              </button>
            }
          />
          {members.length > 0 && (
            <Facts
              items={[
                { key: "all", label: "Hodim", value: members.length },
                ...memberRoles.map((role) => ({
                  key: role,
                  label: roleInfo[role].label,
                  value: members.filter((m) => m.role === role).length,
                })),
                { key: "waiting", label: "Ro‘yxatdan o‘tmagan", value: waiting, tone: "accent" as const },
              ]}
            />
          )}
          {members.length ? (
            memberRoles.map((role, section) => {
              const list = members.filter((m) => m.role === role);
              return (
                <section key={role} className="role-section rise" style={rise(4 + section)} aria-label={roleInfo[role].plural}>
                  <div className="role-head">
                    <h2 className="group-head">
                      {roleInfo[role].plural}
                      <span className="group-count">{list.length}</span>
                    </h2>
                    <p>{roleInfo[role].description}</p>
                  </div>
                  <ul className="people-grid is-compact">
                    {list.map((member) => (
                      <li key={member.id}>
                        <MemberCard member={member} showStatus onOpen={() => setOpenId(member.id)} />
                      </li>
                    ))}
                    <li>
                      <button type="button" className="person-card add-card" onClick={() => setForm({ role })}>
                        <span className="add-icon" aria-hidden="true">
                          <Plus size={26} strokeWidth={1.8} />
                        </span>
                        <span className="pc-name">{roleInfo[role].label} qo‘shish</span>
                        <span className="pc-role">Ism va login — bas.</span>
                      </button>
                    </li>
                  </ul>
                </section>
              );
            })
          ) : (
            <Empty
              icon={<Users size={26} strokeWidth={1.6} />}
              title="Jamoangizga joy bor."
              text="Avval project manager va dizaynerlarni qo‘shing. Har biriga login berasiz, parolni ular o‘zi yaratadi."
              action={
                <button className="btn btn-primary" onClick={() => setForm({})}>
                  <Plus size={17} strokeWidth={2.2} aria-hidden="true" />
                  Birinchi hodimni qo‘shish
                </button>
              }
            />
          )}
        </>
      )}
      {open && (
        <MemberSheet
          member={open}
          onClose={() => setOpenId(null)}
          onEdit={() => {
            setOpenId(null);
            setForm({ member: open });
          }}
          onChanged={refresh}
          onDeleted={() => {
            setMembers((list) => list.filter((m) => m.id !== open.id));
            setOpenId(null);
            notify(`${open.name} jamoadan olindi`);
          }}
        />
      )}
      {form && (
        <MemberForm
          member={form.member}
          defaultRole={form.role}
          onClose={() => setForm(null)}
          onSaved={(member) => {
            setMembers((list) =>
              list.some((m) => m.id === member.id) ? list.map((m) => (m.id === member.id ? member : m)) : [...list, member],
            );
            if (form.member) {
              setForm(null);
              notify("Hodim ma’lumoti saqlandi");
            }
          }}
        />
      )}
    </Shell>
  );
}

/** Ismdan login taklifi: kirill va o‘zbek harflari lotinga, bo‘shliq — nuqta. */
const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k",
  л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "ts",
  ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya", ў: "o", қ: "q", ғ: "g", ҳ: "h",
};
export function suggestLogin(name: string) {
  return name
    .toLowerCase()
    .replace(/[Ѐ-ӿ]/g, (c) => CYRILLIC[c] ?? "")
    .replace(/[ʻʼ‘’`']/g, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 32);
}

function registerLink() {
  return `${window.location.origin}/login#royxatdan-otish`;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-quiet copy-button"
      onClick={() =>
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        })
      }
    >
      {done ? <Check size={15} strokeWidth={2.4} aria-hidden="true" /> : <Copy size={15} strokeWidth={1.9} aria-hidden="true" />}
      {done ? "Nusxa olindi" : label}
    </button>
  );
}

function Instructions({ member }: { member: Member }) {
  const link = registerLink();
  const message = `Salom, ${member.name}! Fazo Task’ga kirish uchun ${link} sahifasida «Ro‘yxatdan o‘tish»ni tanlang, loginingizni kiriting va o‘zingizga parol yarating.\nLogin: ${member.username}`;
  return (
    <div className="instructions">
      <div className="login-chip">
        <span>Login</span>
        <strong>{member.username}</strong>
      </div>
      <ol>
        <li>Hodim kirish sahifasini ochadi.</li>
        <li>«Ro‘yxatdan o‘tish»ni tanlab, shu loginni kiritadi.</li>
        <li>O‘ziga parol yaratadi — parolni siz ko‘rmaysiz.</li>
      </ol>
      <CopyButton text={message} label="Ko‘rsatmani nusxalash" />
    </div>
  );
}

function MemberForm({
  member,
  defaultRole,
  onClose,
  onSaved,
}: {
  member?: Member;
  defaultRole?: MemberRole;
  onClose: () => void;
  onSaved: (member: Member) => void;
}) {
  const formId = useId();
  const [name, setName] = useState(member?.name || "");
  const [role, setRole] = useState<MemberRole>((member?.role as MemberRole) || defaultRole || "designer");
  const [login, setLogin] = useState(member?.username || "");
  const [loginTouched, setLoginTouched] = useState(!!member);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Member | null>(null);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api<{ member: Member }>(member ? `/api/members/${member.id}` : "/api/members", {
        method: member ? "PATCH" : "POST",
        body: JSON.stringify({ name, role, username: login }),
      });
      onSaved(data.member);
      if (!member) setCreated(data.member);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (created)
    return (
      <Modal title={`${created.name} qo‘shildi`} eyebrow={roleInfo[created.role].label} onClose={onClose} size="sm">
        <div className="sheet-body">
          <p className="sheet-text">Endi loginni hodimga yuboring. Parolni u o‘zi yaratadi.</p>
          <Instructions member={created} />
        </div>
        <div className="sheet-foot">
          <button type="button" className="btn btn-quiet" onClick={() => {
            setCreated(null);
            setName("");
            setLogin("");
            setLoginTouched(false);
          }}>
            Yana qo‘shish
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Tayyor
          </button>
        </div>
      </Modal>
    );
  return (
    <Modal title={member ? "Hodimni tahrirlash" : "Hodim qo‘shish"} eyebrow="Jamoa" onClose={onClose} size="sm">
      <form id={formId} className="sheet-body form" onSubmit={save}>
        <label className="field">
          <span className="field-label">Ism va familiya</span>
          <input
            className="input input-lg"
            placeholder="Ism va familiya"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!loginTouched) setLogin(suggestLogin(e.target.value));
            }}
            required
            maxLength={80}
            autoComplete="off"
          />
        </label>
        <div className="field">
          <span className="field-label">Rol</span>
          <Segmented<MemberRole>
            label="Rol"
            className="segmented-block"
            value={role}
            onChange={setRole}
            options={memberRoles.map((r) => ({ value: r, label: roleInfo[r].label }))}
          />
          <p className="field-hint">{roleInfo[role].description}</p>
        </div>
        <label className="field">
          <span className="field-label">Login</span>
          <input
            className="input"
            placeholder="login"
            value={login}
            onChange={(e) => {
              setLogin(e.target.value.toLowerCase());
              setLoginTouched(true);
            }}
            required
            minLength={3}
            maxLength={32}
            pattern="[a-z0-9_.\-]+"
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="field-hint">Lotin harflari, raqam va . _ − · 3–32 belgi</span>
        </label>
        {!member && (
          <div className="notice" role="note">
            <KeyRound size={17} strokeWidth={1.9} aria-hidden="true" />
            <p>Parol kerak emas. Hodim kirish sahifasida «Ro‘yxatdan o‘tish» orqali o‘zi yaratadi.</p>
          </div>
        )}
        <ErrorMessage message={error} />
      </form>
      <div className="sheet-foot">
        <button type="button" className="btn btn-quiet" onClick={onClose}>
          Bekor qilish
        </button>
        <button type="submit" form={formId} className="btn btn-primary" disabled={busy || !name.trim() || login.length < 3}>
          {busy ? <Spinner label="Saqlanmoqda" /> : member ? "Saqlash" : "Qo‘shish"}
        </button>
      </div>
    </Modal>
  );
}

function MemberSheet({
  member,
  onClose,
  onEdit,
  onChanged,
  onDeleted,
}: {
  member: Member;
  onClose: () => void;
  onEdit: () => void;
  onChanged: () => Promise<void>;
  onDeleted: () => void;
}) {
  const notify = useToast();
  const [confirm, setConfirm] = useState<"reset" | "delete" | null>(null);
  return (
    <>
      <Modal title={member.name} onClose={onClose} hideTitle>
        <div className="sheet-body">
          <div className="profile">
            <Avatar name={member.name} size="lg" />
            <div>
              <p className="profile-name" aria-hidden="true">{member.name}</p>
              <p className="profile-role">{roleInfo[member.role].label}</p>
            </div>
          </div>
          <dl className="props">
            <div className="prop">
              <dt>Login</dt>
              <dd>@{member.username}</dd>
            </div>
            <div className="prop">
              <dt>Holat</dt>
              <dd className={member.activated ? "" : "tone-warn"}>
                {member.activated && member.activatedAt
                  ? `Faol · ${longDate(member.activatedAt)}dan`
                  : "Ro‘yxatdan o‘tmagan"}
              </dd>
            </div>
            <div className="prop">
              <dt>Qo‘shilgan</dt>
              <dd>{longDate(member.createdAt)}</dd>
            </div>
            {member.role === "pm" && (
              <div className="prop">
                <dt>Bergan vazifalari</dt>
                <dd>{member.stats.created} ta</dd>
              </div>
            )}
          </dl>
          {member.role === "designer" && <DesignerFacts member={member} />}
          {!member.activated && <Instructions member={member} />}
        </div>
        <div className="sheet-foot">
          <button type="button" className="btn-text is-danger" onClick={() => setConfirm("delete")}>
            <Trash2 size={15} strokeWidth={1.9} aria-hidden="true" />
            O‘chirish
          </button>
          <span className="spacer" />
          {member.activated && (
            <button type="button" className="btn btn-quiet" onClick={() => setConfirm("reset")}>
              <KeyRound size={15} strokeWidth={1.9} aria-hidden="true" />
              Parolni tiklash
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onEdit}>
            <Pencil size={15} strokeWidth={1.9} aria-hidden="true" />
            Tahrirlash
          </button>
        </div>
      </Modal>
      {confirm === "reset" && (
        <ConfirmDialog
          title="Parolni tiklaysizmi?"
          danger={false}
          message={
            <>
              <strong>{member.name}</strong>ning joriy paroli o‘chadi va barcha qurilmalardan chiqariladi. U yana
              «Ro‘yxatdan o‘tish» orqali yangi parol yaratadi.
            </>
          }
          confirmLabel="Tiklash"
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await api(`/api/members/${member.id}/reset`, { method: "POST" });
            await onChanged();
            setConfirm(null);
            notify("Parol tiklandi — hodim qayta ro‘yxatdan o‘tadi");
          }}
        />
      )}
      {confirm === "delete" && (
        <ConfirmDialog
          title="Hodimni o‘chirasizmi?"
          message={
            <>
              <strong>{member.name}</strong> jamoadan olinadi va tizimga kira olmaydi. Uning ismi bajarilgan
              vazifalar tarixida qoladi.
            </>
          }
          confirmLabel="O‘chirish"
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await api(`/api/members/${member.id}`, { method: "DELETE" });
            setConfirm(null);
            onDeleted();
          }}
        />
      )}
    </>
  );
}
