# Fazo Task

Jamoa uchun o‘zbekcha vazifa paneli: hodim qo‘shing, unga vazifa belgilang va kim nima qilayotganini bir qarashda ko‘ring. Dizayn asosi: [mankiw-chapters](https://github.com/uzbtrust/mankiw-chapters).

## Ish jarayoni

1. Ilovaga bitta umumiy login bilan kiriladi. Rollar (admin, kontent kreator, dizayner) yo‘q.
2. **Hodimlar** bo‘limida hodim qo‘shiladi: ism va ixtiyoriy lavozim. Hodimlar tizimga kirmaydi.
3. **Vazifalar** bo‘limida hodimga vazifa belgilanadi: nom, ixtiyoriy tavsif, muddat va muhimlik (Oddiy / Muhim / Shoshilinch).
4. Holat uch bosqichli: **Yangi → Jarayonda → Bajarildi**. Ro‘yxatdagi doirachani bosish holatni keyingisiga o‘tkazadi; xato bosilsa, bildirishnomadagi **Qaytarish** bilan bekor qilinadi.
5. Hodimda tugallanmagan vazifa bo‘lsa, uni o‘chirib bo‘lmaydi. O‘chirilgan hodimning bajarilgan vazifalari tarixda ismi bilan qoladi.

## Mahalliy ishga tushirish

Node.js 22+ talab qilinadi.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Ochish: http://127.0.0.1:3000. Birinchi kirish: **admin / admin**. Kirgach, yuqori o‘ngdagi hisob menyusidan parolni almashtiring.

```bash
npm run typecheck
npm run build
npm run test:integration
```

Integratsiya testi ishga tushgan serverga ulanadi va vaqtinchalik `QA …` yozuvlarini yaratib, oxirida o‘chiradi. Batafsil: [docs/TESTING.md](docs/TESTING.md).

## Texnologiyalar va saqlash

Next.js App Router, React, TypeScript, Lucide SVG ikonkalari, Turso/libSQL. Mahalliy rivojlantirishda SQLite (`fazo.db`) ishlaydi. Vercel’da alohida masofaviy Turso bazasi majburiy: `TURSO_DATABASE_URL` va `TURSO_AUTH_TOKEN` server muhiti o‘zgaruvchilarida saqlanadi.

Ma’lumotlar `employees` va `team_tasks` jadvallarida. Kirish hisobi `users` jadvalida (`role='admin'`); avvalgi versiyadan qolgan kontent kreator va dizayner yozuvlari bilan endi kirib bo‘lmaydi. Eski `tasks`, `files`, `comments`, `activity` jadvallariga tegilmaydi va ilova ularni o‘qimaydi.

Parollar scrypt bilan xeshlanadi; sessiyalar HttpOnly cookie va serverdagi sessiya yozuvlari orqali boshqariladi. Parol almashtirilganda boshqa qurilmalardagi sessiyalar bekor qilinadi. Maxfiy kalitlar, SQLite fayllari va `.env` fayllari Git’ga kiritilmaydi.

## Dizayn

[docs/DESIGN.md](docs/DESIGN.md) — manba, tokenlar va interfeys tamoyillari.
