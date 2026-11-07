import LoginView from "@/components/login-view";
import { ConfirmLink, LinkExpired, OpenInBrowser } from "@/components/telegram-link";
import { currentUser } from "@/lib/auth";
import { botLink, readToken } from "@/lib/telegram/accounts";

export const metadata = { title: "Telegram — Fazo Task" };

/** Botdagi bir martalik havola shu sahifaga keladi. */
export default async function TelegramLink({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const botUrl = await botLink().catch(() => "https://t.me");
  const row = await readToken(t);
  if (!t || !row) return <LinkExpired botUrl={botUrl} />;
  if (row.kind === "open") return <OpenInBrowser token={t} botUrl={botUrl} />;
  if (row.kind !== "browser") return <LinkExpired botUrl={botUrl} />;
  const account = await currentUser();
  if (!account)
    return <LoginView next={`/telegram?t=${t}`} note={`Kirgach, «${row.telegramName}» Telegram hisobi shu akkauntga ulanadi.`} />;
  return <ConfirmLink token={t} telegram={row.telegramName} account={account} botUrl={botUrl} />;
}
