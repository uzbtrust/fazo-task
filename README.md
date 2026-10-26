# Fazo Task

Dizaynerlar va kontent jamoasi uchun o‘zbekcha vazifa boshqaruvi. Dizayn asosi: [mankiw-chapters](https://github.com/uzbtrust/mankiw-chapters).

## Ish jarayoni

1. Admin kontent kreator va dizayner profillarini yaratadi.
2. Kontent kreator vazifa nomi, matnli brief yoki fayl, muddat, format va ustuvorlikni kiritadi.
3. Vazifa umumiy ochiq panelga chiqadi. Dizayner **Men qilaman** bilan oladi.
4. Dizayner natijani matn yoki fayl bilan tekshiruvga topshiradi.
5. Vazifani yaratgan kontent kreator yoki admin uni tasdiqlaydi yoki sabab yozib tuzatishga qaytaradi.
6. Tasdiqlangandan keyin dizayner vazifani yakunlaydi.

Bir vazifani bir nechta dizayner bir vaqtda olishga urinsa, server faqat biriga ruxsat beradi. Rollar va vazifa holatlari serverda tekshiriladi. Izohlar va o‘zgarishlar tarixi vazifa ichida saqlanadi.

## Mahalliy ishga tushirish

Node.js 22+ talab qilinadi.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Ochish: http://127.0.0.1:3000. Birinchi kirish: **admin / admin**. Profil sozlamalarida admin parolini almashtirish mumkin. Mustaqil ro‘yxatdan o‘tish yo‘q; ishchilarni admin yaratadi.

```bash
npm run typecheck
npm run build
npm run test:integration
```

Integratsiya testi ishga tushgan serverga ulanadi va vaqtinchalik sinov yozuvlarini yaratadi. Batafsil: [docs/TESTING.md](docs/TESTING.md).

## Texnologiyalar va saqlash

Next.js App Router, React, TypeScript, Lucide SVG ikonkalari, Turso/libSQL. Mahalliy rivojlantirishda SQLite ishlaydi. Vercel’da alohida masofaviy Turso bazasi majburiy: `TURSO_DATABASE_URL` va `TURSO_AUTH_TOKEN` server muhiti o‘zgaruvchilarida saqlanadi. Fayllar ham shu bazada doimiy saqlanadi; Vercel vaqtinchalik diskiga yozilmaydi. Har fayl uchun chegara 3 MB.

Parollar scrypt bilan xeshlanadi; sessiyalar HttpOnly cookie va serverdagi sessiya yozuvlari orqali boshqariladi. Ishchi o‘chirilganda uning kirishi bekor qilinadi. Maxfiy kalitlar, SQLite fayllari va `.env` fayllari Git’ga kiritilmaydi.

Vercel loyihasi: `fazo-task`. Production bazasi shu loyiha uchun alohida Turso Starter ($0/oy) resursidir. Sinov ma’lumotlari production’ga avtomatik qo‘shilmaydi.

## Dizayn

[docs/DESIGN.md](docs/DESIGN.md) — manba, tokenlar va interfeys tamoyillari.
