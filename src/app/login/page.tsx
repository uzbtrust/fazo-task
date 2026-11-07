import { redirect } from "next/navigation";
import LoginView from "@/components/login-view";
import { currentUser } from "@/lib/auth";
import { telegramEnabled } from "@/lib/telegram/api";

/** Kirgan foydalanuvchi qayta login so‘ralmaydi — to‘g‘ridan-to‘g‘ri o‘z paneliga o‘tadi. */
export default async function Login() {
  if (await currentUser()) redirect("/");
  return <LoginView bot={telegramEnabled()} />;
}
