import { redirect } from "next/navigation";
import LoginView from "@/components/login-view";
import { currentUser } from "@/lib/auth";

/** Kirgan foydalanuvchi qayta login so‘ralmaydi — to‘g‘ridan-to‘g‘ri o‘z paneliga o‘tadi. */
export default async function Login() {
  if (await currentUser()) redirect("/");
  return <LoginView />;
}
