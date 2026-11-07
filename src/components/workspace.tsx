"use client";
import dynamic from "next/dynamic";
import type { Account } from "@/lib/types";
import type { Initial } from "@/lib/initial";
import { ThemeSync, ToastProvider } from "./shell";

type PanelProps = { account: Account; initial: Initial };

/**
 * Har bir rolning o‘z paneli. Har kim faqat o‘z panelining kodini yuklaydi.
 * Yangi kasb qo‘shilganda shu yerga panel ulanadi.
 */
const panels = {
  admin: dynamic<PanelProps>(() => import("./admin-panel").then((m) => m.AdminPanel)),
  pm: dynamic<PanelProps>(() => import("./pm-panel").then((m) => m.PmPanel)),
  designer: dynamic<PanelProps>(() => import("./designer-panel").then((m) => m.DesignerPanel)),
} satisfies Record<Account["role"], unknown>;

/** Kirish sahifasi bo‘sh turganda panellar oldindan yuklab qo‘yiladi: kirgach kutish bo‘lmaydi. */
export function preloadPanels() {
  void import("./admin-panel");
  void import("./pm-panel");
  void import("./designer-panel");
}

export default function Workspace({ account, initial }: PanelProps) {
  const Panel = panels[account.role];
  return (
    <ToastProvider>
      <ThemeSync theme={initial.theme}>
        <Panel account={account} initial={initial} />
      </ThemeSync>
    </ToastProvider>
  );
}
