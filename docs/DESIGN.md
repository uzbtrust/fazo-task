# Fazo Task — dizayn asosi

Asosiy manba: **[uzbtrust design system](https://github.com/uzbtrust/design-system)**, v1.3.1. Tizim ilovaga ulangan, nusxa emas:

- `src/design-system/` — tizimning o‘zi (`dist/uzbtrust.css`, Inter shrifti). Qo‘lda o‘zgartirilmaydi.
- `src/app/globals.css` — faqat ilovaga xos narsalar: hodim kartalari, fayllar, lightbox, muddat soati. Avval tizimdagi token va klassni ishlating.

Tizim yangilansa: repodan `dist/uzbtrust.css` va `fonts/` ni `src/design-system/` ga ko‘chiring, shu fayldagi versiyani yangilang va ekranlarni tekshiring.

Muallif belgisi: pastda `Signature` («Dizayn: Abdurakhmonov»). Ilovaning o‘z logosi bor, shuning uchun navigatsiya va favicon'da Fazo Task belgisi turadi.

## Til

- **Bo‘sh joy — dizayn.** Katta vertikal ritm, qisqa satrlar. Shubha bo‘lsa, chiziq yoki qutini olib tashlang.
- **Tipografiya ishni bajaradi.** Tizim shrifti (`--font-sans`), katta sarlavha (600) va uning ostida kulrang `.dim` davomi; ikkilamchi matn `--fg-3`; raqamlar `tabular-nums`, oldiga nol qo‘shilmaydi.
- **Harf oralig‘i o‘lchamga qarab:** `--track-super` ≥80px, `--track-hero` ≥64px, `--track-display` 40–56px, `--track-headline` 28–32px, `--track-title` 19–24px, `--track-body` 17px, `--track-small` 14–15px, `--track-caption` 12–13px. Bosh harfli yorliq yo‘q — eyebrow, teg va jadval sarlavhalari oddiy harflarda.
- **Chiziq emas, yuza.** Kartalar `--card` (yorug‘da `#f5f5f7`, qorong‘uda `#1c1c1e`), radius 24px, chegarasiz. Ingichka chiziq faqat ro‘yxat qatorlari orasida.
- **Shisha yuqori panel.** `--glass` + `backdrop-filter: saturate(180%) blur(20px)`. Markazda "Vazifalar / Hodimlar" segmentli tanlovi.
- **Bitta urg‘u rangi** `--accent`. Semantik ranglar faqat ma’no uchun: `--bad` — kechikkan/shoshilinch, `--warn` — bugun/muhim. Holat rang bilan bir qatorda shakl (doiracha) va matn bilan ham ko‘rsatiladi.
- **Pill tugmalar.** Asosiy amal — to‘ldirilgan ko‘k pill (`--accent-fill`), ikkilamchi — chiziqli ko‘k pill yoki `.link-more ›`. Xavfli amal — chiziqli qizil pill, hoverda to‘liq qizil (`--danger-fill`).

## Ekranlar

- **Kirish:** markazlashgan hero. Ostida «Kirish / Ro‘yxatdan o‘tish» segmenti va birlashgan maydonlar (`StackedFields`).
- **Har rolning o‘z paneli.** Yuqori paneldagi segment rolga qarab o‘zgaradi:
  - administrator — Jamoa / Statistika;
  - PM — Vazifalar / Dizaynerlar / Statistika;
  - dizayner — Mening vazifalarim / Ochiq vazifalar / Statistika. «Mening vazifalarim» faqat amaldagi vazifa bo‘lganda chiqadi va birinchi ochiladi; bo‘lmasa, ochiq vazifalar ochiladi.
- **Ish stoli faqat hozirgi ish uchun.** Bajarilgan va bekor qilingan vazifalar Statistika oxiridagi «Tugagan vazifalar» ro‘yxatida.
- **Vazifalar ro‘yxati:** sarlavha, PMda raqamlar qatori (bosilganda saralaydi) va holat bo‘yicha guruhlangan "inset" ro‘yxat.
  - Holat belgisi: bo‘sh doira — ochiq, yarim — jarayonda, nuqtali doira — tekshiruvda, belgi — bajarildi, ✕ — bekor qilingan (nomi chizilgan).
- **Hodim kartalari:** bob kartalari uslubida. Katta raqam dizaynerda hozirgi ishlarni, PMda qo‘ygan vazifalarini ko‘rsatadi.
- **Vazifa varag‘i:**
  - bosqichlar chizig‘i (tekshiruv yoqilsa — to‘rt, hozir uch bosqich);
  - ma’lumotlar ro‘yxati;
  - task (matn va fayllar);
  - natija galereyasi (lightbox bilan);
  - tarix.
- **Statistika:**
  - umumiy ko‘rsatkichlar katta raqamlarda;
  - dizaynerlar jadvalida rasmlar soni bitta rangli gorizontal ustun bilan;
  - telefonda jadval kartalarga aylanadi.
- **Dialoglar:** markazda varaq, telefonda pastdan chiqadi.

## Harakat

Faqat `transform` va `opacity`. Panellar kirish animatsiyasisiz, darhol chiqadi; 26px ko‘tarilish va 70ms zinapoya faqat kirish sahifasida. Raqamlar darhol ko‘rinadi (sanab chiqmaydi). Segment indikatori sirpanadi, bildirishnoma tepadan tushadi, mavzu almashinuvi View Transitions bilan. `prefers-reduced-motion` barcha harakatni o‘chiradi.

**Ilovaga xos istisno:** «Salom, {ism}.» ostidagi kulrang qatorda jumlalar yozilib-o‘chadi (`TypedLine`). uzbtrust tizimi buni tavsiya qilmaydi, lekin bu ilovada ataylab qoldirilgan.

## Tekshiruv

Yorug‘ va qorong‘u, 375 / 768 / 1440 px, klaviatura fokusi, Escape bilan dialog yopilishi, gorizontal skroll yo‘qligi.
