import type { Role } from "@/lib/types";

/**
 * «Salom, …» ostidagi jumlalar. Har rolga 100 tadan, holatga qarab guruhlangan.
 * Qisqa bo‘lsin (taxminan 36 belgigacha) — sarlavha ikki qatordan oshmasin.
 */
const designer = {
  /** Qo‘lida ish yo‘q, ochiq vazifa bor. */
  idleOpen: [
    "Ochiq vazifalar sizni kutmoqda.",
    "Yangi ish — yangi imkoniyat.",
    "Bittasini tanlang, qolgani oson.",
    "Ochiq vazifalarga nazar tashlang.",
    "Qaysi biri sizga yoqadi?",
    "Yangi g‘oya uchun vaqt keldi.",
    "Tanlov sizda, ilhom ham sizda.",
    "Qo‘lingiz bo‘sh — ish esa tayyor.",
    "Birinchi qadam — «Men olaman».",
    "Kuchingizga mos vazifani oling.",
    "Bugungi ishingiz shu yerda.",
    "Hozir boshlasangiz, tez tugaydi.",
    "Ochiq ro‘yxat sizga qarab turibdi.",
    "Yangi loyiha, toza varaq.",
    "Bir vazifa — bir kichik g‘alaba.",
  ],
  /** Qo‘lida ish yo‘q, ochiq vazifa ham yo‘q. */
  idleEmpty: [
    "Hozir qo‘lingiz bo‘sh.",
    "Ochiq vazifa yo‘q — nafas oling.",
    "Dam olish ham ishning bir qismi.",
    "Yangi vazifa yaqinda keladi.",
    "Bir piyola choy vaqti.",
    "Ilhom yig‘ib turing.",
    "Bugun hammasi joyida.",
    "Tinch kun — toza fikr.",
    "Portfoliongizni ko‘zdan kechiring.",
    "Yangi trendlarni kuzatib turing.",
    "Ko‘zlaringizga dam bering.",
    "Sokinlik — ijod oldidan.",
  ],
  /** 1–2 ta ish qo‘lida. */
  working: [
    "Ish qizg‘in, davom eting.",
    "Har bir piksel muhim.",
    "Siz to‘g‘ri yo‘ldasiz.",
    "Diqqat — eng kuchli vosita.",
    "Oz qoldi, davom eting.",
    "Detallar dizaynni yaratadi.",
    "Oddiylik — oliy murakkablik.",
    "Rang, shrift, joy — hammasi sizda.",
    "Bitta ish ustida chuqur ishlang.",
    "Sifat shoshilmaydi.",
    "TZ ni yana bir bor ko‘rib chiqing.",
    "Yaxshi dizayn ko‘zga tashlanmaydi.",
    "Kichik tuzatish — katta farq.",
    "Fikr tayyor, qo‘l ham tayyor.",
    "Ishingiz ko‘zni quvontiradi.",
    "Tugatgach, PMga ko‘rsating.",
    "Bo‘sh joy ham dizayn.",
    "Har bir chiziqning ma’nosi bor.",
  ],
  /** 3 va undan ko‘p ish qo‘lida — sabr. */
  heavy: [
    "Ish ko‘p, lekin siz uddalaysiz.",
    "Birma-bir, shoshilmasdan.",
    "Sabr — eng yaxshi muharrir.",
    "Avval eng muhimini tugating.",
    "Chuqur nafas oling, keyin davom.",
    "Ko‘p ish — katta ishonch belgisi.",
    "Bittasini yoping, keyin keyingisi.",
    "Yuk og‘ir, siz esa kuchlisiz.",
    "Tartib — tezlikning siri.",
    "Muddati yaqinini birinchi oling.",
    "Kerak bo‘lsa, PMdan yordam so‘rang.",
    "Hammasini birdan emas, ketma-ket.",
    "Bugun ko‘p, ertaga yengil.",
    "Siz bunday kunlarni ko‘rgansiz.",
  ],
  /** Bugun bir nechta ishni tugatgan. */
  productive: [
    "Bugun zo‘r ishladingiz!",
    "Natijalaringiz o‘zi gapiradi.",
    "Qoyil, sur’atingiz ajoyib.",
    "Bugungi kun — sizniki.",
    "Bunday kunlar ko‘paysin.",
    "Mehnatingiz ko‘rinib turibdi.",
    "Dam olishga to‘liq haqlisiz.",
    "Zo‘r natija, rahmat!",
    "Jamoa siz bilan faxrlanadi.",
    "Bugun reja oshig‘i bilan bajarildi.",
    "Siz bugun ilhom manbaisiz.",
    "Har bir ish — bir yulduz.",
    "Kun yakuni — g‘alaba bilan.",
    "Charchagan bo‘lsangiz, dam oling.",
  ],
  /** Muddati o‘tgan ish bor. */
  overdue: [
    "Muddati o‘tgan ish bor — avval u.",
    "Kechikish — bu tugash emas.",
    "PMga holatni aytib qo‘ying.",
    "Avval kechikkanini yoping.",
    "Bitta ish — to‘liq diqqat.",
    "Hali ham yaxshi tugatish mumkin.",
    "Muddat o‘tdi, sifat qolsin.",
    "Kechroq, lekin chiroyli.",
    "Bugun shuni yakunlaymiz.",
    "Kichik qadam, katta yengillik.",
  ],
  general: [
    "Ijod — bu jasorat.",
    "Har bir loyiha — yangi hikoya.",
    "Dizayn — ko‘z bilan gapirish.",
    "Ilhom ishlayotganda keladi.",
    "Bugun nimani go‘zal qilamiz?",
    "Kam — lekin soz.",
    "Siz ko‘rganni boshqalar sezadi.",
    "Ranglar sizni tinglaydi.",
    "Yaxshi dizayn — yaxshi qaror.",
    "Mukammallik — detallarda.",
    "Bugun ham chiroyli ish qilamiz.",
    "Didingiz — brend ovozi.",
    "Har kun — kichik o‘sish.",
    "G‘oya bor — yo‘l bor.",
    "Tasvir ming so‘zdan kuchli.",
    "O‘zingizga ishoning.",
    "Ishingizni seving.",
  ],
};

const pm = {
  /** Hali vazifa yo‘q. */
  empty: [
    "Birinchi vazifani qo‘ying.",
    "Dizaynerlar yangi ish kutmoqda.",
    "Aniq TZ — yarim natija.",
    "Bugungi rejani yozib chiqing.",
    "G‘oyalarni vazifaga aylantiring.",
    "Jamoa tayyor, navbat sizda.",
    "Yangi kampaniya — yangi vazifa.",
    "Referens qo‘shsangiz, yanada aniq.",
    "Yaxshi brif — tez natija.",
    "Bo‘sh ro‘yxat — toza boshlanish.",
    "Bugun nimani yaratamiz?",
    "Boshlash uchun bitta vazifa yetadi.",
  ],
  /** Ochiq vazifalar ko‘p — sabr. */
  manyOpen: [
    "Vazifalar ko‘p — sabr qiling.",
    "Dizaynerlar navbatma-navbat oladi.",
    "Muhimini yulduz bilan belgilang.",
    "Shoshilinchlarga muddat qo‘ying.",
    "Ochiq ro‘yxat to‘lib bormoqda.",
    "Ustuvorlikni aniqlab oling.",
    "Har biri o‘z vaqtida olinadi.",
    "Eng muhimini tepaga chiqaring.",
    "Ko‘p ish aniq tartib talab qiladi.",
    "Keragi yo‘g‘ini bekor qiling.",
    "Navbat bor, natija ham bo‘ladi.",
    "Jamoa kuchiga ishoning.",
    "Bir nafas: hammasi rejada.",
    "Ro‘yxatni ixchamlash vaqti.",
  ],
  /** Jamoa ish ustida. */
  busy: [
    "Jamoa qizg‘in ishlamoqda.",
    "Dizaynerlar ish ustida.",
    "Natijalar yo‘lda.",
    "Ish qaynayapti — bu yaxshi.",
    "Savollar bo‘lsa, javob bering.",
    "Tayyor ishni vaqtida ko‘ring.",
    "Fikr bildirish — eng yaxshi yordam.",
    "Har bir dizayn o‘z vaqtida tayyor.",
    "Jamoa ritmi — sizning ritmingiz.",
    "Kuzating, lekin xalaqit bermang.",
    "Ishonch — tez natija kaliti.",
    "Bugun ko‘p narsa tayyor bo‘ladi.",
    "Zo‘r jamoa, zo‘r jarayon.",
    "Har bir vazifa — bir qadam oldinga.",
  ],
  /** Bugun ko‘p dizayn tayyor bo‘ldi. */
  productive: [
    "Bugun jamoa zo‘r ishladi!",
    "Natijalar ko‘zni quvontiradi.",
    "Bugungi kun — samarali kun.",
    "Dizaynerlarga rahmat ayting.",
    "Bu sur’at hammani ilhomlantiradi.",
    "Guruhga tashlash vaqti keldi.",
    "Reja bajarildi, hatto oshdi.",
    "Jamoa kutganingizdan ham zo‘r.",
    "Mehnat samarasi ko‘rinmoqda.",
    "Bugun ko‘p g‘oya hayotga chiqdi.",
    "Yaxshi kun — yaxshi kayfiyat.",
    "Zo‘r natija, davom etamiz.",
    "Statistika ham quvonmoqda.",
    "Qoyil, bugun rekord kun.",
  ],
  /** Muddati o‘tgan vazifa bor. */
  overdue: [
    "Kechikkan vazifalar bor.",
    "Muddatlarni qayta ko‘rib chiqing.",
    "Dizayner bilan gaplashib oling.",
    "Kerak bo‘lsa, muddatni o‘zgartiring.",
    "Kechikish — signal, xato emas.",
    "Avval kechikkanlarini yopaylik.",
    "Yukni qayta taqsimlash vaqti.",
    "Muddatlar real bo‘lsin.",
    "Bir suhbat ko‘p narsani hal qiladi.",
    "Shoshilinchini aniqlab bering.",
  ],
  general: [
    "Aniq vazifa — chiroyli natija.",
    "Yaxshi menejer — tinch jamoa.",
    "Reja — ijodning poydevori.",
    "Har bir TZ — kichik hikoya.",
    "Ko‘rsating, tushuntiring, ishoning.",
    "Sifat oddiy savoldan boshlanadi.",
    "Jamoa — eng katta kuchingiz.",
    "Muddat va maqsad — ikki qanot.",
    "Bugun nimani ishga tushiramiz?",
    "Fikr aniq bo‘lsa, ish tez bo‘ladi.",
    "Referens — ming so‘zdan aniq.",
    "Dizaynerlarga erkinlik bering.",
    "Kichik g‘alabalarni nishonlang.",
    "Tartib — tinchlik manbai.",
    "Yaxshi brif — yarim yo‘l.",
    "Har kim o‘z ishining ustasi.",
    "Natijani birga ko‘ramiz.",
    "Rejalashtiring, keyin ishoning.",
    "Har loyiha — o‘sish imkoniyati.",
    "Tushunarli TZ — baxtli dizayner.",
    "Vaqtida fikr — vaqtida natija.",
    "Ilhomni tartib bilan birlashtiring.",
    "Bugun ham jamoa siz bilan.",
    "Muhimlikni yulduzlar aytadi.",
    "Bir maqsad, bir jamoa.",
    "Rejangiz — jamoa yo‘li.",
    "Ishonch — eng yaxshi motivatsiya.",
    "Har vazifa ortida inson bor.",
    "Aniqlik — g‘amxo‘rlik belgisi.",
    "Yaxshi savol — yaxshi dizayn.",
    "Bugungi ish — ertangi brend.",
    "Tinglang, keyin topshiriq bering.",
    "Kreativ jamoa — kuchli brend.",
    "Natija — jamoaviy g‘alaba.",
    "Har kuni bir oz yaxshiroq.",
    "Sizsiz bu tartib bo‘lmasdi.",
  ],
};

const admin = {
  /** Ro‘yxatdan o‘tmagan hodim bor. */
  waiting: [
    "Kimdir hali ro‘yxatdan o‘tmagan.",
    "Loginlarni egalariga yuboring.",
    "Yangi hodimlar kirishni kutmoqda.",
    "Ko‘rsatmani nusxalab yuboring.",
    "Har bir login — yangi imkoniyat.",
    "Jamoa to‘liq yig‘ilsin.",
    "Hamma kirsa, ish tezlashadi.",
    "Kim kirmaganini tekshiring.",
    "Bir xabar — bir faol hodim.",
    "Kirish oson: login va parol.",
  ],
  /** Jamoa hali kichik. */
  small: [
    "Jamoa endi shakllanmoqda.",
    "Kichik jamoa — katta orzular.",
    "Yangi hodim — yangi kuch.",
    "Har jamoa kichikdan boshlanadi.",
    "Kerakli odamni toping.",
    "Jamoangizni o‘stiring.",
    "Birinchi qadamlar — eng muhimi.",
    "Ikki kishi ham jamoa.",
    "Har bir rol muhim.",
    "Asos mustahkam bo‘lsin.",
  ],
  /** Bugun jamoa ko‘p dizayn tayyorladi. */
  productive: [
    "Bugun jamoa zo‘r ishladi!",
    "Statistika ko‘zni quvontiradi.",
    "Natijalar o‘sib bormoqda.",
    "Jamoangiz bilan faxrlaning.",
    "Bugungi kun — samarali kun.",
    "Mehnat samarasi ko‘rinmoqda.",
    "Rahmat aytishni unutmang.",
    "Zo‘r sur’at, zo‘r jamoa.",
    "Bunday kunlar ko‘paysin.",
    "Har dizayn — jamoa g‘alabasi.",
    "Bugun reja oshig‘i bilan bajarildi.",
    "Jamoa ritmi ajoyib.",
    "Natija — eng yaxshi hisobot.",
    "Bugun ko‘p g‘oya amalga oshdi.",
    "Qoyil, bugun rekord kun.",
  ],
  general: [
    "Yaxshi jamoa — yaxshi natija.",
    "Har kimga o‘z o‘rni.",
    "Tartib — tinch ishning asosi.",
    "Jamoa — eng katta boylik.",
    "To‘g‘ri odam, to‘g‘ri rol.",
    "Ishonch — boshqaruv kaliti.",
    "Statistika hikoya aytadi.",
    "Raqamlar ortida odamlar bor.",
    "Kichik yaxshilanish — katta farq.",
    "Bugun jamoaga nazar tashlang.",
    "Har bir hodim — bir imkoniyat.",
    "Boshqaruv — xizmat qilish.",
    "Aniq rollar — tinch jamoa.",
    "Jamoa o‘ssa, siz ham o‘sasiz.",
    "Yaxshi muhit — yaxshi ijod.",
    "Har kuni bir oz yaxshiroq.",
    "Natijani o‘lchang, odamni qadrlang.",
    "Tizim ishlaydi, siz yo‘naltirasiz.",
    "Jamoa ruhi — eng kuchli vosita.",
    "Kim nima qilyapti — shu yerda.",
    "Shaffoflik — ishonch asosi.",
    "Bugun kimni maqtaysiz?",
    "Yaxshi rahbar — yaxshi tinglovchi.",
    "Har bir raqam — bir mehnat.",
    "Muvozanat — barqaror o‘sish.",
    "Jamoangiz sizga ishonadi.",
    "Kam gap, ko‘p natija.",
    "To‘g‘ri tizim vaqtni tejaydi.",
    "Har bir login — bir inson.",
    "Bugun ham hammasi nazoratda.",
    "Odamlar — loyihaning yuragi.",
    "Kuchli jamoa — tinch uyqu.",
    "Rahmat — eng arzon motivatsiya.",
    "Har kim o‘z ishining ustasi.",
    "O‘sish — kundalik odat.",
    "Tartibli jamoa — tez jamoa.",
    "Sifat — jamoaviy qaror.",
    "Statistikaga bir nazar tashlang.",
    "Har hodimning hissasi muhim.",
    "Bugun jamoa qanday?",
    "Yaxshi qaror — aniq ma’lumotdan.",
    "Kelajak bugun quriladi.",
    "Birga — kuchliroq.",
    "Rejalar katta, qadamlar aniq.",
    "Jamoa — bitta maqsad.",
    "Har kun — yangi imkoniyat.",
    "Yaxshi tizim — erkin jamoa.",
    "Ishonchli jamoa — ishonchli brend.",
    "Kichik jamoa ham katta ish qiladi.",
    "Odamlarga e’tibor bering.",
    "Har bir g‘alabani nishonlang.",
    "Natijalar barqaror bo‘lsin.",
    "Bugun ham yaxshi kun bo‘ladi.",
    "Boshqarish — ilhomlantirish.",
    "Har rolning o‘z kuchi bor.",
    "Ish oqimi silliq bo‘lsin.",
    "Jamoa — bu bir oila.",
    "Aniq maqsad — tez natija.",
    "Yangi kasblar — yangi imkoniyat.",
    "Sabr va tartib — g‘alaba yo‘li.",
    "Hammasi bir joyda — qulay.",
    "Har bir hodim — brend yuzi.",
    "Yaxshi kayfiyat yuqumli.",
    "Jamoani tinglang.",
    "Siz bilan jamoa kuchli.",
  ],
};

/** Panel holati — jumla shu holatga qarab tanlanadi. */
export interface QuoteContext {
  /** Dizayner: qo‘lidagi ishlar; PM: jarayondagi vazifalar. */
  inProgress?: number;
  /** Ochiq (hali olinmagan) vazifalar. */
  open?: number;
  /** Bugun tugatilgan vazifalar (dizayner — o‘ziniki, PM/admin — jamoa). */
  doneToday?: number;
  /** Bugun tayyorlangan dizaynlar (rasmlar). */
  imagesToday?: number;
  overdue?: number;
  total?: number;
  members?: number;
  waiting?: number;
}

function buckets(role: Role, c: QuoteContext): string[][] {
  if (role === "designer") {
    const list: string[][] = [];
    if (c.overdue) list.push(designer.overdue);
    if ((c.doneToday ?? 0) >= 2 || (c.imagesToday ?? 0) >= 4) list.push(designer.productive);
    const working = c.inProgress ?? 0;
    if (working >= 3) list.push(designer.heavy);
    else if (working > 0) list.push(designer.working);
    else list.push(c.open ? designer.idleOpen : designer.idleEmpty);
    return list;
  }
  if (role === "pm") {
    if (!c.total) return [pm.empty];
    const list: string[][] = [];
    if (c.overdue) list.push(pm.overdue);
    if ((c.imagesToday ?? 0) >= 3 || (c.doneToday ?? 0) >= 2) list.push(pm.productive);
    if ((c.open ?? 0) >= 4) list.push(pm.manyOpen);
    if ((c.inProgress ?? 0) >= 2) list.push(pm.busy);
    return list;
  }
  const list: string[][] = [];
  if (c.waiting) list.push(admin.waiting);
  if ((c.members ?? 0) <= 2) list.push(admin.small);
  if ((c.imagesToday ?? 0) >= 3) list.push(admin.productive);
  return list;
}

const general: Record<Role, string[]> = {
  designer: designer.general,
  pm: pm.general,
  admin: admin.general,
};

/** Holatga mos jumla (70%) yoki umumiy jumla; yaqinda chiqqanlari takrorlanmaydi. */
export function pickQuote(role: Role, context: QuoteContext, recent: string[]): string {
  const matching = buckets(role, context).flat();
  const pool = matching.length && Math.random() < 0.7 ? matching : general[role];
  const fresh = pool.filter((q) => !recent.includes(q));
  const from = fresh.length ? fresh : pool;
  return from[Math.floor(Math.random() * from.length)];
}

/** Sahifa ochilganda birinchi jumla — doim holatga mos. */
export function firstQuote(role: Role, context: QuoteContext): string {
  const matching = buckets(role, context).flat();
  const pool = matching.length ? matching : general[role];
  return pool[Math.floor(Math.random() * pool.length)];
}

export const quoteCounts = {
  designer: Object.values(designer).flat().length,
  pm: Object.values(pm).flat().length,
  admin: Object.values(admin).flat().length,
};
