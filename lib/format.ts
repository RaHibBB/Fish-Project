// Display helpers: Bengali digits, taka with Indian grouping, dd/mm/yyyy dates.
// Dates are stored and passed around as ISO "yyyy-mm-dd" strings (Asia/Dhaka calendar days).

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

export const TIMEZONE = "Asia/Dhaka";

export function toBnDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

/** Indian digit grouping: 300000 -> "3,00,000". */
export function groupIndian(n: number): string {
  const s = String(Math.trunc(Math.abs(n)));
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${rest},${last3}`;
}

/** Bengali number with Indian grouping, no currency sign. */
export function bnNumber(n: number): string {
  const sign = n < 0 ? "−" : "";
  return sign + toBnDigits(groupIndian(n));
}

/** "৳৩,০০,০০০", negatives as "−৳২,৮৩০". `signed` adds "+" for positives. */
export function taka(n: number, opts: { signed?: boolean } = {}): string {
  const sign = n < 0 ? "−" : opts.signed && n > 0 ? "+" : "";
  return `${sign}৳${toBnDigits(groupIndian(n))}`;
}

/** Short amount for chart labels: ৪.৯হা, ১.২লা, ২.৫কো. */
export function compactTaka(n: number): string {
  const abs = Math.abs(n);
  const fmt = (v: number, unit: string) => `${toBnDigits(String(Math.round(v * 10) / 10))}${unit}`;
  if (abs >= 1_00_00_000) return fmt(n / 1_00_00_000, "কো");
  if (abs >= 1_00_000) return fmt(n / 1_00_000, "লা");
  if (abs >= 1_000) return fmt(n / 1_000, "হা");
  return toBnDigits(n);
}

/** Today's date in Dhaka as "yyyy-mm-dd". */
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Timestamp as "০৭/১০/২০২৬, ১৪:০৫" in Dhaka time. */
export function bnDateTime(at: Date | string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(at));
  return toBnDigits(parts);
}

/** Add whole days to an ISO date (calendar arithmetic, timezone independent). */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function isISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** "2026-05-01" -> "01/05/2026" (Latin digits). */
export function ddmmyyyy(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** "2026-05-01" -> "০১/০৫/২০২৬". */
export function bnDate(iso: string): string {
  return toBnDigits(ddmmyyyy(iso));
}

export const BN_MONTHS = [
  "জানুয়ারি",
  "ফেব্রুয়ারি",
  "মার্চ",
  "এপ্রিল",
  "মে",
  "জুন",
  "জুলাই",
  "আগস্ট",
  "সেপ্টেম্বর",
  "অক্টোবর",
  "নভেম্বর",
  "ডিসেম্বর",
];

export const BN_WEEKDAYS = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];

/** "2026-05" -> "মে ২০২৬". */
export function bnMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${BN_MONTHS[m - 1]} ${toBnDigits(y)}`;
}

/** "2026-05-01" -> "শুক্রবার, ০১/০৫/২০২৬". */
export function bnDateLong(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${BN_WEEKDAYS[wd]}, ${bnDate(iso)}`;
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

/** First and last ISO day of a "yyyy-mm" month. */
export function monthRange(ym: string): { from: string; to: string } {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, "0")}` };
}

export function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** Percentage with one decimal in Bengali digits, e.g. "১২.৫%". */
export function bnPercent(part: number, whole: number): string {
  if (whole === 0) return "০%";
  return `${toBnDigits((Math.round((part / whole) * 1000) / 10).toFixed(1))}%`;
}
