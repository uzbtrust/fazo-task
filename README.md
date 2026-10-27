# Fazo Task

Dizayn jamoasi uchun o‘zbekcha vazifa paneli. Har bir rolning o‘z paneli bor. Dizayn asosi: [mankiw-chapters](https://github.com/uzbtrust/mankiw-chapters).

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

- PM vazifani qo‘yadi. Majburiy maydonlar: **nom**, **TZ** (matn yoki fayl, kamida bittasi) va **nechta rasm kerakligi**. Ixtiyoriy: **muddat** va **1–5 yulduz muhimlik**. Vazifa hech kimga biriktirilmaydi.
- Vazifa **«Ochiq vazifalar»**da turadi. Dizaynerlar TZ ni ochib ko‘radi va **«Men olaman»**ni bosadi. Ikki dizayner bir vaqtda bossa, faqat bittasi oladi.
- Dizayner ishni PMga **og‘zaki** ko‘rsatadi. Kelishilgach, o‘zi **«Tugatdim»** deb belgilaydi, xohlasa izoh yoki havola qoldiradi. Rasm yuklash hozircha ixtiyoriy.
- Dizayner vazifani **bo‘shatishi** mumkin, PM esa uni **ochiq ro‘yxatga qaytarishi** mumkin. Bunda yuklangan rasmlar o‘chadi.
- PM istalgan paytda vazifani **tahrirlaydi**, bajarilganini ham. Tugamagan vazifani sabab yozib **bekor qiladi**: dizayner uni «Bekor qilingan» guruhida ko‘radi. Bekor qilingan vazifani **qayta ochish** mumkin — u yana ochiq ro‘yxatga chiqadi. **O‘chirish** esa vazifani tarixi va fayllari bilan butunlay olib tashlaydi.

**Keyinroq «yuklash majburiy» tartibiga o‘tish.** `src/lib/workflow.ts` dagi `REVIEW_STEP` ni `true` qiling. Shunda oqim **Ochiq → Jarayonda → Tekshiruvda → Bajarildi** bo‘ladi: dizayner rasmlarni yuklab topshiradi, PM qabul qiladi yoki sabab yozib qaytaradi. Kod tayyor, faqat o‘chirib qo‘yilgan.

## Kirish va tezlik

- **Login saqlanadi.** Sessiya 180 kun amal qiladi va har kirganda uzayadi. Saytni yopib qayta ochsangiz, o‘sha hisob ochiladi; faqat «Chiqish» bosilganda yoki parol tiklanganda sessiya tugaydi. Kirgan foydalanuvchi `/login` ga kirsa, darhol o‘z paneliga o‘tadi.
- **Bir zumda ochiladi.** Sahifa serverda tayyorlanadi: vazifalar ro‘yxati va TZ matnlari birinchi HTML bilan keladi, brauzer qo‘shimcha so‘rov kutmaydi. Bazaga sovuq ulanish va har bir ro‘yxat bitta tarmoq so‘rovida o‘qiladi.
- **Og‘ir narsalar fonda.** TZ fayllari va rasmlar sahifa ko‘ringandan keyin, brauzer bo‘sh paytida birma-bir yuklanadi (eng ko‘pi 40 ta) va keshga tushadi. Kursor vazifa ustiga kelishi bilan uning fayllari darhol yuklana boshlaydi. Admin statistikasi ham fonda tayyorlanadi.

## Statistika (admin)

Har bir dizayner bo‘yicha:
- bajarilgan vazifalar va ulardagi rasmlar soni;
- muddatli ishlardan qanchasi **vaqtida** tugatilgani (muddat kuni oxirigacha, Toshkent vaqti);
- olishdan tugatishgacha o‘rtacha vaqt (tekshiruv yoqilganda — necha marta qaytarilgani ham);
- hozir qo‘lidagi ishlar.

PM bo‘yicha qo‘ygan va bajarilgan vazifalar ko‘rsatiladi. Bekor qilingan vazifalar statistikaga kirmaydi. Davrni 7 kun, 30 kun yoki butun davr qilib tanlash mumkin. Yangi hodim qo‘shilsa, u jadvalda avtomatik paydo bo‘ladi.

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
- TZ fayllari PM va dizaynerlarga ko‘rinadi. Vazifa olingach, uni faqat olgan dizayner ko‘radi.
- Natija rasmlari faqat PM va shu vazifa dizayneriga ko‘rinadi.
- SVG brauzerda ochilmaydi, faqat yuklab olinadi.

Parollar scrypt bilan xeshlanadi. Sessiyalar HttpOnly cookie orqali ishlaydi. Rol o‘zgarsa, parol tiklansa yoki hodim o‘chirilsa, uning sessiyalari bekor qilinadi.

## Dizayn

[docs/DESIGN.md](docs/DESIGN.md) — manba, tokenlar va interfeys tamoyillari.
