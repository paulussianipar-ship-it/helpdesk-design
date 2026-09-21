export interface StbHseRosterRecord {
  id: string;
  period_month: string; // Format: YYYY-MM (e.g. "2026-06")
  employee_no?: string;
  name: string;
  role?: string;
  phone?: string;
  // Mapping date (1..31) to status: e.g. { 1: "H", 4: "h", 8: "H", ... }
  schedule: Record<number, string>;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export const INDONESIAN_MONTHS = [
  { value: "01", label: "Januari" },
  { value: "02", label: "Februari" },
  { value: "03", label: "Maret" },
  { value: "04", label: "April" },
  { value: "05", label: "Mei" },
  { value: "06", label: "Juni" },
  { value: "07", label: "Juli" },
  { value: "08", label: "Agustus" },
  { value: "09", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
] as const;

export const DAY_NAMES_INDO = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"] as const;

/**
 * Mendapatkan jumlah hari dalam bulan tertentu
 * @param year e.g. 2026
 * @param month 1-12
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Mendapatkan singkatan nama hari (Sen, Sel, Rab, Kam, Jum, Sab, Min)
 * @param year e.g. 2026
 * @param month 1-12
 * @param day 1-31
 */
export function getDayNameIndo(year: number, month: number, day: number): string {
  const date = new Date(year, month - 1, day);
  return DAY_NAMES_INDO[date.getDay()];
}

/**
 * Cek apakah tanggal merupakan akhir pekan (Sabtu / Minggu)
 */
export function isWeekend(year: number, month: number, day: number): boolean {
  const date = new Date(year, month - 1, day);
  const dayIndex = date.getDay();
  return dayIndex === 0 || dayIndex === 6; // 0 = Minggu, 6 = Sabtu
}

/**
 * Format teks periode "YYYY-MM" menjadi "Juni 2026"
 */
export function formatMonthYearIndo(period: string): string {
  if (!period || !period.includes("-")) return period || "-";
  const [yearStr, monthStr] = period.split("-");
  const monthObj = INDONESIAN_MONTHS.find((m) => m.value === monthStr.padStart(2, "0"));
  return `${monthObj?.label || monthStr} ${yearStr}`;
}

/**
 * Hitung statistik standby per personil
 */
export function calculatePersonStats(schedule: Record<number, string>) {
  let countH = 0;
  let countHSmall = 0;
  let countOther = 0;

  Object.values(schedule || {}).forEach((status) => {
    const s = String(status || "").trim();
    if (s === "H") {
      countH++;
    } else if (s === "h") {
      countHSmall++;
    } else if (s && s !== "-" && s.toUpperCase() !== "OFF") {
      countOther++;
    }
  });

  return {
    countH,
    countHSmall,
    countOther,
    totalStandby: countH + countHSmall + countOther,
  };
}

/**
 * Data awal (Initial Seed) persis sesuai lampiran Excel untuk bulan Juni 2026
 */
export const INITIAL_STB_HSE_DATA: StbHseRosterRecord[] = [
  {
    id: "stb-2026-06-01",
    period_month: "2026-06",
    employee_no: "GIS19040039",
    name: "Paulus Petrus Parlindungan Sianipar",
    role: "HSE Coordinator",
    phone: "0812-3456-7890",
    schedule: {
      1: "H",
      4: "h",
      8: "H",
      11: "h",
      15: "H",
      18: "H",
      22: "H",
      25: "H",
      29: "H",
    },
    notes: "Roster Standby HSE Juni 2026",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "stb-2026-06-02",
    period_month: "2026-06",
    employee_no: "GIS25100212",
    name: "Muhammad Farel Ramadhan",
    role: "HSE Officer",
    phone: "0813-9876-5432",
    schedule: {
      1: "H",
      4: "h",
      8: "H",
      11: "h",
      15: "H",
      18: "H",
      22: "H",
      25: "H",
      29: "H",
    },
    notes: "Roster Standby HSE Juni 2026",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

/**
 * Deteksi nama bulan dari teks (e.g. "Juni", "June", "06", "Jadwal STB HSE Juli 2026")
 * Mengembalikan format "01".."12" atau null jika tidak ditemukan.
 */
export function detectMonthFromText(text: string): string | null {
  if (!text) return null;
  const t = String(text).toLowerCase();

  const patterns: [RegExp, string][] = [
    [/\b(januari|january|jan)\b/i, "01"],
    [/\b(februari|february|feb)\b/i, "02"],
    [/\b(maret|march|mar)\b/i, "03"],
    [/\b(april|apr)\b/i, "04"],
    [/\b(mei|may)\b/i, "05"],
    [/\b(juni|june|jun)\b/i, "06"],
    [/\b(juli|july|jul)\b/i, "07"],
    [/\b(agustus|august|agu|ags)\b/i, "08"],
    [/\b(september|sep|sept)\b/i, "09"],
    [/\b(oktober|october|okt|oct)\b/i, "10"],
    [/\b(november|nov)\b/i, "11"],
    [/\b(desember|december|des|dec)\b/i, "12"],
  ];

  for (const [re, code] of patterns) {
    if (re.test(t)) {
      return code;
    }
  }

  return null;
}

/**
 * Deteksi tahun 4 digit (2020-2039) dari teks
 */
export function detectYearFromText(text: string): number | null {
  if (!text) return null;
  const match = String(text).match(/\b(20[2-3]\d)\b/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Buat jadwal roster standby operasional untuk 1 bulan tertentu (Paulus & Farel)
 * Hari Senin: Shift Siang (H), Hari Kamis: Shift Malam (h)
 */
export function getStbHseSeedForPeriod(period: string): StbHseRosterRecord[] {
  if (period === "2026-06") {
    return INITIAL_STB_HSE_DATA;
  }

  const [yearStr, monthStr] = period.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (!year || !month || month < 1 || month > 12) {
    return [];
  }

  const totalDays = getDaysInMonth(year, month);
  const paulusSchedule: Record<number, string> = {};
  const farelSchedule: Record<number, string> = {};

  for (let d = 1; d <= totalDays; d++) {
    const dateObj = new Date(year, month - 1, d);
    const dayOfWeek = dateObj.getDay(); // 0 = Sun, 1 = Mon, ..., 4 = Thu

    if (dayOfWeek === 1) {
      // Senin: Shift Siang H
      paulusSchedule[d] = "H";
      farelSchedule[d] = "H";
    } else if (dayOfWeek === 4) {
      // Kamis: Shift Malam h
      paulusSchedule[d] = "h";
      farelSchedule[d] = "h";
    }
  }

  return [
    {
      id: `stb-${period}-01`,
      period_month: period,
      employee_no: "GIS19040039",
      name: "Paulus Petrus Parlindungan Sianipar",
      role: "HSE Coordinator",
      phone: "0812-3456-7890",
      schedule: paulusSchedule,
      notes: `Roster Standby HSE ${formatMonthYearIndo(period)}`,
      created_at: new Date(year, month - 1, 1).toISOString(),
      updated_at: new Date(year, month - 1, 1).toISOString(),
    },
    {
      id: `stb-${period}-02`,
      period_month: period,
      employee_no: "GIS25100212",
      name: "Muhammad Farel Ramadhan",
      role: "HSE Officer",
      phone: "0813-9876-5432",
      schedule: farelSchedule,
      notes: `Roster Standby HSE ${formatMonthYearIndo(period)}`,
      created_at: new Date(year, month - 1, 1).toISOString(),
      updated_at: new Date(year, month - 1, 1).toISOString(),
    },
  ];
}

/**
 * Dapatkan seluruh data roster standby tahunan terintegrasi (Jan - Des)
 */
export function getAllStbHseSeedData(year: number = 2026): StbHseRosterRecord[] {
  const result: StbHseRosterRecord[] = [];
  for (let m = 1; m <= 12; m++) {
    const period = `${year}-${String(m).padStart(2, "0")}`;
    result.push(...getStbHseSeedForPeriod(period));
  }
  return result;
}

