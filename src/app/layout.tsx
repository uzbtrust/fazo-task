import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Fazo Task — Ijod uchun fazo",
  description:
    "Kontent g‘oyalarini dizaynerlar bilan aniq vazifa va tayyor natijaga aylantiring. Jamoangizning yagona ish fazosi.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('fazo-theme')==='dark'||(!localStorage.getItem('fazo-theme')&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
