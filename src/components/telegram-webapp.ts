/** Telegram web-app obyektining bizga kerakli qismi. */
export interface TelegramWebApp {
  initData: string;
  colorScheme?: "light" | "dark";
  ready(): void;
  expand(): void;
  openLink(url: string): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

/** Web-app ichidagi kirish: login shaklining yuborishiga qo‘shiladi. */
export interface MiniApp {
  initData: string;
  name: string;
  embedded: boolean;
  next: string;
  /** Ro‘yxatdan o‘tish havolasidan ochilganda. */
  register: boolean;
}

/** Web-app ichidagi sahifa: chiqish va havolalar shunga qarab ishlaydi. */
export const STORED_INIT_DATA = "fazo-tg";

export function storedInitData() {
  try {
    return sessionStorage.getItem(STORED_INIT_DATA) || "";
  } catch {
    return "";
  }
}
