import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import {
  INITIAL_ATTENDANCE_DATA,
  type AttendanceRecord,
} from "@/lib/attendance-seed";
import {
  INITIAL_STB_HSE_DATA,
  type StbHseRosterRecord,
  calculatePersonStats,
  formatMonthYearIndo,
} from "@/lib/stb-hse-seed";

export const PERMINTaan_STATUSES = ["TO DO", "PROGRESS", "REVIEW", "REVISION", "DONE"] as const;

export const DAILY_STATUSES = [
  "⏳ Waiting (Menunggu)",
  "⚡ In Progress (Dalam Proses)",
  "🔄 Revisi (Revisi Pengerjaan)",
  "⏸️ Pending (Tertunda)",
  "✅ Done (Selesai)",
] as const;

export const DAILY_SHORT: Record<string, string> = {
  "⏳ Waiting (Menunggu)": "Waiting",
  "⚡ In Progress (Dalam Proses)": "In Progress",
  "🔄 Revisi (Revisi Pengerjaan)": "Revisi",
  "⏸️ Pending (Tertunda)": "Pending",
  "✅ Done (Selesai)": "Done",
};

export const PERMINTaan_COLORS: Record<string, string> = {
  "TO DO": "#3b82f6",
  PROGRESS: "#06b6d4",
  REVIEW: "#eab308",
  REVISION: "#f97316",
  DONE: "#10b981",
};

export const DAILY_COLORS: Record<string, string> = {
  "⏳ Waiting (Menunggu)": "#64748b",
  "⚡ In Progress (Dalam Proses)": "#3b82f6",
  "🔄 Revisi (Revisi Pengerjaan)": "#f97316",
  "⏸️ Pending (Tertunda)": "#eab308",
  "✅ Done (Selesai)": "#10b981",
};

const LOCAL_ATTENDANCE = "attendance_records_v2";
const LOCAL_STB = "stb_hse_roster_records_v1";
const LOCAL_DAILY = "daily_activity_records_v2";

export interface PermintaanRow {
  status: string;
}

export interface DailyRow {
  status: string;
  activity_date?: string;
}

export interface AttendanceRow {
  status: string;
  overtime?: number;
}

export interface RekapData {
  permintaan: { total: number; statuses: Record<string, number> };
  attendance: {
    total: number;
    prs: number;
    off: number;
    abs: number;
    ovt: number;
    overtimeMinutes: number;
  };
  daily: { total: number; statuses: Record<string, number> };
  stb: { personil: number; countH: number; countHSmall: number; countOther: number; totalStandby: number };
}

export const EMPTY_REKAP: RekapData = {
  permintaan: { total: 0, statuses: {} },
  attendance: { total: 0, prs: 0, off: 0, abs: 0, ovt: 0, overtimeMinutes: 0 },
  daily: { total: 0, statuses: {} },
  stb: { personil: 0, countH: 0, countHSmall: 0, countOther: 0, totalStandby: 0 },
};

function readLocalJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function countPermintaan(rows: PermintaanRow[]) {
  const statuses: Record<string, number> = {};
  rows.forEach((r) => {
    const k = r.status || "TO DO";
    statuses[k] = (statuses[k] || 0) + 1;
  });
  return { total: rows.length, statuses };
}

export function countAttendance(rows: AttendanceRow[]) {
  let prs = 0;
  let off = 0;
  let abs = 0;
  let ovt = 0;
  let overtimeMinutes = 0;
  rows.forEach((r) => {
    const s = (r.status || "").toUpperCase();
    if (s.includes("PRS")) prs++;
    if (s.includes("OFF")) off++;
    if (s.includes("ABS")) abs++;
    if (s.includes("OVT")) ovt++;
    overtimeMinutes += Number(r.overtime) || 0;
  });
  return { total: rows.length, prs, off, abs, ovt, overtimeMinutes };
}

export function countDaily(rows: DailyRow[]) {
  const statuses: Record<string, number> = {};
  rows.forEach((r) => {
    const k = r.status || DAILY_STATUSES[0];
    statuses[k] = (statuses[k] || 0) + 1;
  });
  return { total: rows.length, statuses };
}

export function countStb(rows: StbHseRosterRecord[]) {
  let countH = 0;
  let countHSmall = 0;
  let countOther = 0;
  rows.forEach((r) => {
    const s = calculatePersonStats(r.schedule || {});
    countH += s.countH;
    countHSmall += s.countHSmall;
    countOther += s.countOther;
  });
  return {
    personil: rows.length,
    countH,
    countHSmall,
    countOther,
    totalStandby: countH + countHSmall + countOther,
  };
}

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) return `${hours} jam${mins > 0 ? ` ${mins} mnt` : ""}`;
  return `${mins} mnt`;
}

/**
 * Ambil ringkasan data rekap bulanan dari 4 modul (Supabase -> fallback localStorage).
 */
export async function fetchRekapData(period: string): Promise<RekapData> {
  const supabase = createClient();
  const [yearStr, monthStr] = period.split("-");
  const yearInt = Number(yearStr);
  const monthInt = Number(monthStr);
  const startIso = new Date(yearInt, monthInt - 1, 1).toISOString();
  const endIso = new Date(yearInt, monthInt, 1).toISOString();
  const nextDate = new Date(yearInt, monthInt, 1);
  const nextMonthStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;

  // 1. Permintaan Design (created dalam bulan terpilih)
  let permintaan = EMPTY_REKAP.permintaan;
  try {
    const { data: rows, error } = await supabase
      .from("permintaan")
      .select("status")
      .gte("created_at", startIso)
      .lt("created_at", endIso);
    if (!error) {
      permintaan = countPermintaan((rows || []) as PermintaanRow[]);
    }
  } catch {
    // abaikan, tampilkan 0
  }

  // 2. Attendance
  let attendance = EMPTY_REKAP.attendance;
  try {
    const { data: rows, error } = await supabase
      .from("attendance")
      .select("period_month, status, overtime")
      .eq("period_month", period);
    if (!error && rows && rows.length > 0) {
      attendance = countAttendance((rows || []) as AttendanceRow[]);
    } else {
      const local = readLocalJSON<AttendanceRecord[]>(LOCAL_ATTENDANCE);
      const seed = (local && local.length > 0 ? local : INITIAL_ATTENDANCE_DATA).filter(
        (r) => r.period_month === period,
      );
      attendance = countAttendance(seed);
    }
  } catch {
    const local = readLocalJSON<AttendanceRecord[]>(LOCAL_ATTENDANCE);
    const seed = (local && local.length > 0 ? local : INITIAL_ATTENDANCE_DATA).filter(
      (r) => r.period_month === period,
    );
    attendance = countAttendance(seed);
  }

  // 3. Daily Activity
  let daily = EMPTY_REKAP.daily;
  try {
    const { data: rows, error } = await supabase
      .from("daily_activities")
      .select("status")
      .gte("activity_date", `${period}-01`)
      .lt("activity_date", `${nextMonthStr}-01`);
    if (!error) {
      if (rows && rows.length > 0) {
        daily = countDaily((rows || []) as DailyRow[]);
      } else {
        const local = readLocalJSON<DailyRow[]>(LOCAL_DAILY);
        if (local && local.length > 0) {
          daily = countDaily(local.filter((r) => r.activity_date?.startsWith(period)));
        }
      }
    }
  } catch {
    // abaikan
  }

  // 4. STB HSE
  let stb = EMPTY_REKAP.stb;
  try {
    const { data: rows, error } = await supabase
      .from("stb_hse_roster")
      .select("*")
      .eq("period_month", period);
    if (!error && rows && rows.length > 0) {
      stb = countStb((rows || []) as StbHseRosterRecord[]);
    } else {
      const local = readLocalJSON<StbHseRosterRecord[]>(LOCAL_STB);
      const seed = (local && local.length > 0 ? local : INITIAL_STB_HSE_DATA).filter(
        (r) => r.period_month === period,
      );
      stb = countStb(seed);
    }
  } catch {
    const local = readLocalJSON<StbHseRosterRecord[]>(LOCAL_STB);
    const seed = (local && local.length > 0 ? local : INITIAL_STB_HSE_DATA).filter(
      (r) => r.period_month === period,
    );
    stb = countStb(seed);
  }

  return { permintaan, attendance, daily, stb };
}

/**
 * Buat & unduh file Excel rekap bulanan.
 */
export async function exportRekapExcel(period: string): Promise<string> {
  const data = await fetchRekapData(period);

  const wb = XLSX.utils.book_new();
  const title = `Rekap Bulanan Tiket Helpdesk Design ${formatMonthYearIndo(period)}`;

  // Sheet Ringkasan
  const summaryRows: (string | number)[][] = [
    [title],
    [],
    ["Modul", "Kategori", "Jumlah"],
    [
      "Permintaan Design",
      "Total Tiket",
      data.permintaan.total,
    ],
    ...PERMINTaan_STATUSES.map((s) => [
      "Permintaan Design",
      `Status ${s}`,
      data.permintaan.statuses[s] || 0,
    ]),
    ["Attendance", "Hadir (PRS)", data.attendance.prs],
    ["Attendance", "Lembur (OVT)", data.attendance.ovt],
    ["Attendance", "Libur (OFF)", data.attendance.off],
    ["Attendance", "Absen (ABS)", data.attendance.abs],
    ["Attendance", "Total Lembur (menit)", data.attendance.overtimeMinutes],
    [
      "Attendance",
      "Total Lembur (durasi)",
      formatMinutes(data.attendance.overtimeMinutes),
    ],
    ["Daily Activity", "Total Aktivitas", data.daily.total],
    ...DAILY_STATUSES.map((s) => [
      "Daily Activity",
      `Status ${DAILY_SHORT[s]}`,
      data.daily.statuses[s] || 0,
    ]),
    ["STB HSE", "Personil Terdaftar", data.stb.personil],
    ["STB HSE", "Total Hari Standby", data.stb.totalStandby],
    ["STB HSE", "Shift Siang (H)", data.stb.countH],
    ["STB HSE", "Shift Malam (h)", data.stb.countHSmall],
    ["STB HSE", "Standby Lainnya", data.stb.countOther],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet["!cols"] = [{ wch: 18 }, { wch: 26 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, "Ringkasan");

  // Sheet per modul
  const permitSheet = XLSX.utils.aoa_to_sheet([
    ["Permintaan Design", formatMonthYearIndo(period)],
    [],
    ["Status", "Jumlah"],
    ...PERMINTaan_STATUSES.map((s) => [s, data.permintaan.statuses[s] || 0]),
    ["Total", data.permintaan.total],
  ]);
  permitSheet["!cols"] = [{ wch: 16 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, permitSheet, "Permintaan Design");

  const attSheet = XLSX.utils.aoa_to_sheet([
    ["Attendance", formatMonthYearIndo(period)],
    [],
    ["Status", "Jumlah"],
    ["Hadir (PRS)", data.attendance.prs],
    ["Lembur (OVT)", data.attendance.ovt],
    ["Libur (OFF)", data.attendance.off],
    ["Absen (ABS)", data.attendance.abs],
    ["Total Lembur (menit)", data.attendance.overtimeMinutes],
    ["Total Lembur (durasi)", formatMinutes(data.attendance.overtimeMinutes)],
  ]);
  attSheet["!cols"] = [{ wch: 22 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, attSheet, "Attendance");

  const dailySheet = XLSX.utils.aoa_to_sheet([
    ["Daily Activity", formatMonthYearIndo(period)],
    [],
    ["Status", "Jumlah"],
    ...DAILY_STATUSES.map((s) => [s, data.daily.statuses[s] || 0]),
    ["Total", data.daily.total],
  ]);
  dailySheet["!cols"] = [{ wch: 34 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, dailySheet, "Daily Activity");

  const stbSheet = XLSX.utils.aoa_to_sheet([
    ["STB HSE", formatMonthYearIndo(period)],
    [],
    ["Keterangan", "Jumlah"],
    ["Personil Terdaftar", data.stb.personil],
    ["Total Hari Standby", data.stb.totalStandby],
    ["Shift Siang (H)", data.stb.countH],
    ["Shift Malam (h)", data.stb.countHSmall],
    ["Standby Lainnya", data.stb.countOther],
  ]);
  stbSheet["!cols"] = [{ wch: 24 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, stbSheet, "STB HSE");

  const fileName = `Rekap-Bulanan-Design-${period}.xlsx`;
  XLSX.writeFile(wb, fileName);
  return fileName;
}