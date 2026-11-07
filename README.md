# Fazo Task

Dizayn jamoasi uchun o‘zbekcha vazifa paneli. Har bir rolning o‘z paneli bor. Dizayn: [uzbtrust design system](https://github.com/uzbtrust/design-system).

## Rollar

| Rol | Panel | Nima qiladi |
|---|---|---|
| **Administrator** | Jamoa · Statistika | Project manager va dizaynerlarni qo‘shadi, tahrirlaydi, o‘chiradi, parolini tiklaydi. Statistikani kuzatadi. Vazifalarga aralashmaydi. |
| **Project manager** | Vazifalar · Dizaynerlar | Vazifa qo‘yadi, tahrirlaydi, bekor qiladi yoki qayta ochadi, ochiq ro‘yxatga qaytaradi, o‘chiradi. |
| **Dizayner** | Mening vazifalarim · Ochiq vazifalar | Ochiq vazifani o‘zi oladi, ishni PMga ko‘rsatadi va «Tugatdim» deb belgilaydi. |

## Hodim qo‘shish va parol

1. Administrator hodimning ism-familiyasini, rolini va **loginini** kiritadi. Parol kiritilmaydi.
2. Hodim kirish sahifasida **«Ro‘yxatdan o‘tish»**ni tanlaydi, loginni kiritadi va **parolni o‘zi yaratadi**. Parolni administrator ko‘rmaydi.
3. Parol unutilsa, administrator **«Parolni tiklash»**ni bosadi — hodim yana ro‘yxatdan o‘tib, yangi parol yaratadi.

Login berilgandan to hodim ro‘yxatdan o‘tguncha o‘sha loginni bilgan istalgan odam parol o‘rnatib qo‘yishi mumkin. Shuning uchun loginni hodimning o‘ziga bering. Kim hali ro‘yxatdan o‘tmaganini jamoa sahifasida ko‘rasiz.

## Vazifa oqimi

**Ochiq → Jarayonda → Bajarildi** (PM xohlasa istalgan bosqichda **Bekor qilingan**)

- PM vazifani qo‘yadi. Majburiy maydonlar: **nom**, **task** (matn yoki fayl, kamida bittasi) va **nechta rasm kerakligi**. Ixtiyoriy: **referenslar** (namuna rasmlar moodboard ko‘rinishida va Pinterest/Behance/Dribbble kabi havolalar), **muddat** (kalendardan sana va soat; soatsiz bo‘lsa — kun oxirigacha) va **1–5 yulduz muhimlik**. Vazifa hech kimga biriktirilmaydi.
- Vazifa **«Ochiq vazifalar»**da turadi. Dizaynerlar taskni ochib ko‘radi va **«Men olaman»**ni bosadi. Ikki dizayner bir vaqtda bossa, faqat bittasi oladi.
- Dizayner ishni PMga **og‘zaki** ko‘rsatadi. Kelishilgach, o‘zi **«Tugatdim»** deb belgilaydi, xohlasa izoh yoki havola qoldiradi. Rasm yuklash hozircha ixtiyoriy.
- Dizayner vazifani **bo‘shatishi** mumkin, PM esa uni **ochiq ro‘yxatga qaytarishi** mumkin. Bunda yuklangan rasmlar o‘chadi.
- PM istalgan paytda vazifani **tahrirlaydi**, bajarilganini ham. Tugamagan vazifani sabab yozib **bekor qiladi**: dizayner uni «Bekor qilingan» guruhida ko‘radi. Bekor qilingan vazifani **qayta ochish** mumkin — u yana ochiq ro‘yxatga chiqadi. **O‘chirish** esa vazifani tarixi va fayllari bilan butunlay olib tashlaydi.

**Keyinroq «yuklash majburiy» tartibiga o‘tish.** `src/lib/workflow.ts` dagi `REVIEW_STEP` ni `true` qiling. Shunda oqim **Ochiq → Jarayonda → Tekshiruvda → Bajarildi** bo‘ladi: dizayner rasmlarni yuklab topshiradi, PM qabul qiladi yoki sabab yozib qaytaradi. Kod tayyor, faqat o‘chirib qo‘yilgan.

## Kirish va tezlik

- **Login saqlanadi.** Sessiya 180 kun amal qiladi va har kirganda uzayadi. Saytni yopib qayta ochsangiz, o‘sha hisob ochiladi; faqat «Chiqish» bosilganda yoki parol tiklanganda sessiya tugaydi. Kirgan foydalanuvchi `/login` ga kirsa, darhol o‘z paneliga o‘tadi.
- **Bir zumda ochiladi.** Sahifa serverda tayyorlanadi: vazifalar ro‘yxati va task matnlari birinchi HTML bilan keladi, brauzer qo‘shimcha so‘rov kutmaydi. Bazaga sovuq ulanish va har bir ro‘yxat bitta tarmoq so‘rovida o‘qiladi.
- **Og‘ir narsalar fonda.** Task fayllari va rasmlar sahifa ko‘ringandan keyin, brauzer bo‘sh paytida birma-bir yuklanadi (eng ko‘pi 40 ta) va keshga tushadi. Kursor vazifa ustiga kelishi bilan uning fayllari darhol yuklana boshlaydi. Admin statistikasi ham fonda tayyorlanadi.

## Statistika

Har bir rolda «Statistika» bo‘limi bor; davr — 7 kun, 30 kun yoki hammasi (grafikda so‘nggi 90 kun):

- **Dizayner** — o‘z natijalari: tayyorlagan dizaynlari, bajargan vazifalari, muddatga rioya va kunlik dizaynlar grafigi.
- **Project manager** — o‘zi bergan tasklar soni, ular bo‘yicha tayyor dizaynlar, kunlik grafik va kim qancha qilgani.
- **Administrator** — butun jamoa: kunlik grafik, har bir dizayner bo‘yicha jadval (dizaynlar, vazifalar, vaqtida %, o‘rtacha vaqt, hozirgi ishi; qatorni bosganda — uning kunlik grafigi) va PMlar jadvali.

Yangi hodim qo‘shilsa, u jadvallarda avtomatik paydo bo‘ladi. Bekor qilingan vazifalar statistikaga kirmaydi.


## Telegram

Bot ([@fazotaskbot](https://t.me/fazotaskbot)) va web-app bitta hisobga bog‘lanadi: bir marta kirilsa, qolganlari o‘zi taniydi.

**Kirish yo‘llari**

- **Bot ichida:** login va parol. Parol xabari darhol o‘chiriladi.
- **Web-app ichida:** kirish shakli yoki ro‘yxatdan o‘tish. Keyin bot ham kirgan bo‘ladi.
- **Brauzer orqali:** bot yoki web-app bir martalik havola beradi. Brauzerda kirilgan bo‘lsa, bitta tasdiq yetadi; shundan keyin bot va web-app o‘zi kiradi.
- **Saytda «Telegram orqali kirish»:** bot «Bu sizmisiz?» deb so‘raydi, tasdiqlansa brauzer kiradi.
- **Saytdan ulash:** hisob menyusida «Telegram'ni ulash».
- **Botdan brauzerga:** «Hisob» bo‘limidagi «Brauzerda ochish» parolsiz kiradi.

Ro‘yxatdan o‘tish faqat web-app yoki saytda. Parol o‘zgarsa, parol tiklansa yoki hodim o‘chirilsa, Telegram ajraladi.

**Botdagi ishlar**

- Dizayner: amaldagi va ochiq vazifalar, «Men olaman», «Tugatdim», «Bo‘shatish», fayllarni olish, statistika.
- PM: hozirgi vazifalar, tugmalar bilan yangi vazifa qo‘yish, bekor qilish, qayta ochish, dizaynerlar, statistika.
- Administrator: jamoa va statistika. Hodim qo‘shish web-app yoki saytda.

**Rasmli xabarlar:** bot matn emas, ilovaning o‘z ko‘rinishini yuboradi: macOS oynasi ichida vazifa varag‘i, ish stoli ro‘yxati, statistika va jamoa. Rasmlar serverda chiziladi (`src/lib/telegram/images.tsx`, uzbtrust ranglari va Inter), tugmalar rasm ostida turadi. Ro‘yxatdagi tugma bosilsa, o‘sha xabarning o‘zida vazifa oynasi ochiladi. Rasm chizilmasa, xabar oddiy matnda ketadi.

**Xabarnomalar:** yangi yoki qayta ochilgan vazifa dizaynerlarga boradi. PMga vazifa olingani, tugagani va bo‘shatilgani, dizaynerga bekor qilingani, o‘zgargani va muddati o‘zgargani haqida xabar keladi.

**Eslatmalar**

| Qachon | Kimga |
|---|---|
| Har kuni 09:00 dan keyin (yakshanbadan tashqari): «Xayrli tong» va bugungi ishlar | Dizayner, PM |
| Muddatga 24 soat qolganda | Vazifadagi dizayner |
| Muddatga 3 soat qolganda | Vazifadagi dizayner |
| Muddat o‘tganda | Dizayner va PM |
| Ochiq vazifani 3 soat hech kim olmaganda | Dizaynerlar |
| Muddat yaqin, vazifa hali ochiq | Dizaynerlar va PM |
| Muddat o‘tdi, vazifa hali ochiq | PM |

- Har bir eslatma bir marta keladi; muddat o‘zgarsa, qayta ishlaydi.
- Yangi olingan vazifa darhol eslatilmaydi: 24 soatlik uchun 4 soat, 3 soatlik uchun 1 soat kutiladi.
- 22:00 dan 09:00 gacha yuborilmaydi, eslatma ertalab keladi.
- «Hisob» bo‘limida eslatmalarni o‘chirish mumkin. Yangi vazifa xabarlari bunga kirmaydi.
- Tekshiruvni [GitHub Actions](.github/workflows/reminders.yml) har 15 daqiqada ishga tushiradi, bot ishlatilganda ham tekshiriladi. Manzil ochiq, chunki u faqat vaqti kelgan eslatmani yuboradi va 5 daqiqada bir martadan ko‘p ishlamaydi. GitHub 60 kun faolligi yo‘q repoda rejali ishni o‘chirib qo‘yadi: shunda Actions sahifasidan qayta yoqiladi.

**Ishga tushirish**

1. Vercel'da `BOT_TOKEN` muhit o‘zgaruvchisini qo‘shing.
2. Saytni deploy qiling.
3. Webhook, buyruqlar va menyu tugmasini o‘rnating:

```sh
node scripts/telegram-setup.mjs https://fazo-task.vercel.app
```

## Salomlashish jumlalari

Har panelda «Salom, …» sarlavhasi ostida jumla klaviaturada yozilayotgandek chiqadi: inson kabi to‘xtab-to‘xtab yoziladi, 5–6 soniya turadi, o‘chiriladi va yangisi yoziladi. Har rolga 100 tadan jumla (`src/components/quotes.ts`) bor, ular holatga qarab tanlanadi: dizaynerning qo‘li bo‘shmi yoki ish ko‘pmi, bugun ko‘p dizayn tayyor bo‘ldimi, muddati o‘tgan ish bormi. Harakat kamaytirilgan rejimda jumlalar animatsiyasiz almashadi.

## Yangi kasb qo‘shish

1. `src/lib/types.ts` dagi `Role` turiga yangi rolni qo‘shing.
2. `src/lib/roles.ts` da `roleInfo` va `memberRoles` ga qo‘shing.
3. `src/components/workspace.tsx` dagi `panels` ga uning panelini ulang.
4. Kerak bo‘lsa, API’dagi `requireUser(...)` ruxsatlarini kengaytiring.

Ma’lumotlar bazasidagi rol va holat ustunlarida cheklov yo‘q, shuning uchun jadvallarni qayta qurish shart emas.

## Mahalliy ishga tushirish

Node.js 22+ talab qilinadi.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Ochish: http://127.0.0.1:3000. Birinchi kirish: **admin / admin**. Kirgach, hisob menyusidan parolni almashtiring.

```bash
npm run typecheck
npm run build
npm run test:integration
```

Batafsil: [docs/TESTING.md](docs/TESTING.md).

## Texnologiyalar va saqlash

Next.js App Router, React, TypeScript, Lucide ikonkalari, Turso/libSQL. Mahalliy rivojlantirishda SQLite (`fazo.db`), Vercel’da esa masofaviy Turso (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`) ishlatiladi.

Server funksiyalari Mumbayda (`bom1`, `vercel.json`) ishlaydi — Turso bazasi bilan bir mintaqada (`aws-ap-south-1`). Baza boshqa mintaqaga ko‘chirilsa, `regions` ham unga mos o‘zgartirilishi kerak: har bir baza so‘rovi server va baza orasidagi masofani bosib o‘tadi.

**Jadvallar:**
- `members` — hisoblar;
- `member_sessions` — kirish sessiyalari;
- `assignments` — vazifalar;
- `attachments` — fayllar (bazada, har biri 4 MB gacha);
- `assignment_events` — vazifa tarixi.

Avvalgi versiyalardan qolgan `users`, `tasks`, `employees`, `team_tasks` va boshqa jadvallarga tegilmaydi. Ulardan faqat administrator hisobi bir marta `members` ga ko‘chiriladi.

**Fayllarga kirish huquqi:**
- Task fayllari PM va dizaynerlarga ko‘rinadi. Vazifa olingach, uni faqat olgan dizayner ko‘radi.
- Natija rasmlari faqat PM va shu vazifa dizayneriga ko‘rinadi.
- SVG brauzerda ochilmaydi, faqat yuklab olinadi.

Parollar scrypt bilan xeshlanadi. Sessiyalar HttpOnly cookie orqali ishlaydi. Rol o‘zgarsa, parol tiklansa yoki hodim o‘chirilsa, uning sessiyalari bekor qilinadi.

## Dizayn

[docs/DESIGN.md](docs/DESIGN.md) — manba, tokenlar va interfeys tamoyillari.
