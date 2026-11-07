import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  // Telegram rasmlari uchun shriftlar: serverda fayldan o‘qiladi.
  outputFileTracingIncludes: { "/*": ["src/lib/telegram/fonts/**/*"] },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Web-app Telegram Web ichida iframe'da ochiladi; boshqa hech kim sahifani joylay olmaydi.
          { key: "Content-Security-Policy", value: "frame-ancestors https://web.telegram.org" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // Telegram'ni hisobga ulash sahifasi hech qayerga joylanmaydi.
        source: "/telegram",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};
export default config;
