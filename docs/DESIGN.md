# Fazo Task — dizayn asosi

Asosiy manba: [uzbtrust/mankiw-chapters](https://github.com/uzbtrust/mankiw-chapters), ayniqsa `docs/DESIGN.md`, `src/css/00-tokens.css`, `20-chrome.css` va `30-landing.css`. Tokenlar `src/app/globals.css` boshida o‘sha nomlar bilan takrorlangan.

## Til: "Apple, quietly"

- **Bo‘sh joy — dizayn.** Katta vertikal ritm, qisqa satrlar. Shubha bo‘lsa, chiziq yoki qutini olib tashlang.
- **Tipografiya ishni bajaradi.** Tizim San Francisco shrifti, katta sarlavha (700, `--track-hero`) va uning ostida kulrang `.dim` davomi; ikkilamchi matn `--fg-3`; raqamlar `tabular-nums`.
- **Chiziq emas, yuza.** Kartalar `--card` (yorug‘da `#f5f5f7`, qorong‘uda `#1c1c1e`), radius 24px, chegarasiz. Ingichka chiziq faqat ro‘yxat qatorlari orasida.
- **Shisha yuqori panel.** `--glass` + `backdrop-filter: saturate(180%) blur(20px)`. Markazda "Vazifalar / Hodimlar" segmentli tanlovi.
- **Bitta urg‘u rangi** `--accent` (Apple ko‘k). Semantik ranglar faqat ma’no uchun: `--bad` — kechikkan/shoshilinch, `--warn` — bugun/muhim. Holat rang bilan bir qatorda shakl (doiracha) va matn bilan ham ko‘rsatiladi.
- **Pill tugmalar.** Asosiy amal — to‘ldirilgan ko‘k pill, ikkilamchi — yumshoq ko‘k yoki `.link-more ›`.

## Ekranlar

- **Kirish:** mankiw-chapters bosh sahifasi kabi markazlashgan hero. Ostida «Kirish / Ro‘yxatdan o‘tish» segmenti va Apple ID uslubidagi birlashgan maydonlar.
- **Har rolning o‘z paneli.** Yuqori paneldagi segment rolga qarab o‘zgaradi:
  - administrator — Jamoa / Statistika;
  - PM — Vazifalar / Dizaynerlar;
  - dizayner — Mening vazifalarim / Ochiq vazifalar.
- **Vazifalar ro‘yxati:** sarlavha, raqamlar qatori (bosilganda saralaydi) va holat bo‘yicha guruhlangan "inset" ro‘yxat.
  - Holat belgisi: bo‘sh doira — ochiq, yarim — jarayonda, nuqta — tekshiruvda, belgi — bajarildi, ✕ — bekor qilingan (nomi chizilgan).
- **Hodim kartalari:** bob kartalari uslubida. Katta raqam dizaynerda hozirgi ishlarni, PMda qo‘ygan vazifalarini ko‘rsatadi.
- **Vazifa varag‘i:**
  - bosqichlar chizig‘i (tekshiruv yoqilsa — to‘rt, hozir uch bosqich);
  - ma’lumotlar ro‘yxati;
  - TZ (matn va fayllar);
  - natija galereyasi (lightbox bilan);
  - tarix.
- **Statistika:**
  - umumiy ko‘rsatkichlar katta raqamlarda;
  - dizaynerlar jadvalida rasmlar soni bitta rangli gorizontal ustun bilan;
  - telefonda jadval kartalarga aylanadi.
- **Dialoglar:** markazda varaq, telefonda pastdan chiqadi.

## Harakat

Faqat `transform` va `opacity`. Kirish — 26px ko‘tarilish va 70ms zinapoya; segment indikatori sirpanadi; raqamlar sanab chiqadi; mavzu almashinuvi View Transitions bilan. `prefers-reduced-motion` barcha harakatni o‘chiradi.

## Tekshiruv

Yorug‘ va qorong‘u, 375 / 768 / 1440 px, klaviatura fokusi, Escape bilan dialog yopilishi, gorizontal skroll yo‘qligi.
