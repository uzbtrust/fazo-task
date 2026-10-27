import { redirect } from "next/navigation";
import Workspace from "@/components/workspace";
import { currentUser } from "@/lib/auth";
import { loadInitial } from "@/lib/initial";

export default async function Home() {
  const account = await currentUser();
  if (!account) redirect("/login");
  return <Workspace account={account} initial={await loadInitial(account)} />;
}
