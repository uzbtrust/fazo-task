import { db } from "./db";
import { memberRoles } from "./roles";
import { getMembers, getTasks } from "./tasks";
import type { Account, Member, Task } from "./types";

export interface Initial {
  tasks: Task[];
  members: Member[];
}

/** Sahifa bilan birga keladigan ma’lumot: har bir rol o‘z panelini darhol ko‘radi. */
export async function loadInitial(account: Account): Promise<Initial> {
  const database = await db();
  if (account.role === "admin")
    return { tasks: [], members: await getMembers(database, [...memberRoles]) };
  if (account.role === "pm") {
    const [tasks, members] = await Promise.all([getTasks(database), getMembers(database, ["designer"])]);
    return { tasks, members };
  }
  return { tasks: await getTasks(database, { visibleTo: account.id }), members: [] };
}
