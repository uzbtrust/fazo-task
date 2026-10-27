"use client";
import type { Account } from "@/lib/types";
import type { Initial } from "@/lib/initial";
import { ToastProvider } from "./shell";
import { AdminPanel } from "./admin-panel";
import { PmPanel } from "./pm-panel";
import { DesignerPanel } from "./designer-panel";

/** Har bir rolning o‘z paneli. Yangi kasb qo‘shilganda shu yerga panel ulanadi. */
const panels = {
  admin: AdminPanel,
  pm: PmPanel,
  designer: DesignerPanel,
} satisfies Record<Account["role"], (props: { account: Account; initial: Initial }) => React.ReactNode>;

export default function Workspace({ account, initial }: { account: Account; initial: Initial }) {
  const Panel = panels[account.role];
  return (
    <ToastProvider>
      <Panel account={account} initial={initial} />
    </ToastProvider>
  );
}
