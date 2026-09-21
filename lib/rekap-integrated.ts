import * as XLSX from "xlsx";
import {
  INITIAL_ATTENDANCE_DATA,
  type AttendanceRecord,
} from "@/lib/attendance-seed";
import {
  INITIAL_STB_HSE_DATA,
  type StbHseRosterRecord,
  calculatePersonStats,
} from "@/lib/stb-hse-seed";

export const MONTH_NAMES_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

export interface MonthIntegratedData {
  monthName: string;
  monthNum: string;
  period: string;
  active: boolean;

  // 1. Permintaan Design
  permintaan: {
    masuk: number;
    selesai: number;
    resRate: number | null;
    statuses: Record<string, number>;
    onTime: number;
    slaPct: number | null;
    avgDurationHours: number | null;
    eskalasi: number;
  };

  // 2. Daily Activity
  daily: {
    total: number;
    done: number;
    inProgress: number;
    revisi: number;
    pending: number;
    waiting: number;
    completionRate: number | null;
  };

  // 3. Attendance
  attendance: {
    totalRecords: number;
    prs: number;
    ovt: number;
    off: number;
    abs: number;
    overtimeMinutes: number;
    overtimeHours: number;
    attendanceRate: number | null;
  };

  // 4. STB HSE
  stb: {
    personil: number;
    countH: number;
    countHSmall: number;
    countOther: number;
    totalStandby: number;
  };

  // Overall KPI Grade
  kpiGrade: "Sangat Baik" | "Baik" | "Cukup Baik" | "Kurang Baik" | null;
}

export interface YearIntegratedRekap {
  year: number;
  months: MonthIntegratedData[];
  totals: {
    permintaanMasuk: number;
    permintaanSelesai: number;
    permintaanResRate: number;
    permintaanSlaPct: number;
    permintaanAvgHours: number;
    permintaanEskalasi: number;
    permintaanStatuses: Record<string, number>;

    dailyTotal: number;
    dailyDone: number;
    dailyInProgress: number;
    dailyRevisi: number;
    dailyPending: number;
    dailyWaiting: number;
    dailyRate: number;

    attendancePrs: number;
    attendanceOvt: number;
    attendanceOff: number;
    attendanceAbs: number;
    attendanceTotalMinutes: number;
    attendanceRate: number;

    stbPersonil: number;
    stbTotalStandby: number;
    stbCountH: number;
    stbCountHSmall: number;

    overallKpiGrade: "Sangat Baik" | "Baik" | "Cukup Baik" | "Kurang Baik";
  };
}

const LOCAL_ATTENDANCE = "attendance_records_v2";
const LOCAL_STB = "stb_hse_roster_records_v1";
const LOCAL_DAILY = "daily_activity_records_v2";

function readLocalJSON<T>(key: string): T | null {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function fetchIntegratedRekap(year: number = 2026): Promise<YearIntegratedRekap> {
  try {
    const res = await fetch(`/api/rekap-bulanan?year=${year}`);
    if (res.ok) {
      const json = await res.json();
      if (json.data && json.data.months) {
        const rekapData: YearIntegratedRekap = json.data;

        // Cek apakah ada data lokal di localStorage untuk Attendance, STB HSE, atau Daily Activity
        const localAttendance = readLocalJSON<AttendanceRecord[]>(LOCAL_ATTENDANCE);
        const localStb = readLocalJSON<StbHseRosterRecord[]>(LOCAL_STB);
        const localDaily = readLocalJSON<any[]>(LOCAL_DAILY);

        let modified = false;

        // 1. Overlay jika ada custom imported Attendance di localStorage
        if (localAttendance && localAttendance.length > 0) {
          rekapData.months.forEach((m) => {
            const localMonthAtt = localAttendance.filter((a) => a.period_month === m.period);
            if (localMonthAtt.length > 0) {
              let prs = 0;
              let ovt = 0;
              let off = 0;
              let abs = 0;
              let ovtMin = 0;
              localMonthAtt.forEach((r) => {
                const s = (r.status || "").toUpperCase();
                if (s.includes("PRS") || s.includes("HADIR")) prs++;
                if (s.includes("OFF") || s.includes("LIBUR")) off++;
                if (s.includes("ABS") || s.includes("ALPA") || s.includes("IJIN") || s.includes("SAKIT")) abs++;
                if (s.includes("OVT") || Number(r.overtime) > 0) ovt++;
                ovtMin += Number(r.overtime) || 0;
              });
              m.attendance = {
                totalRecords: prs + off + abs,
                prs,
                ovt,
                off,
                abs,
                overtimeMinutes: ovtMin,
                overtimeHours: Math.round((ovtMin / 60) * 10) / 10,
                attendanceRate: prs + abs > 0 ? Math.round((prs / (prs + abs)) * 1000) / 10 : 100,
              };
              m.active = true;
              modified = true;
            }
          });
        }

        // 2. Overlay jika ada custom imported STB HSE di localStorage
        if (localStb && localStb.length > 0) {
          rekapData.months.forEach((m) => {
            const localMonthStb = localStb.filter((s) => s.period_month === m.period);
            if (localMonthStb.length > 0) {
              let countH = 0;
              let countHSmall = 0;
              let countOther = 0;
              localMonthStb.forEach((r) => {
                const stats = calculatePersonStats(r.schedule || {});
                countH += stats.countH;
                countHSmall += stats.countHSmall;
                countOther += stats.countOther;
              });
              m.stb = {
                personil: localMonthStb.length,
                countH,
                countHSmall,
                countOther,
                totalStandby: countH + countHSmall + countOther,
              };
              m.active = true;
              modified = true;
            }
          });
        }

        // 3. Overlay jika ada custom Daily Activity di localStorage
        if (localDaily && localDaily.length > 0) {
          rekapData.months.forEach((m) => {
            const localMonthDaily = localDaily.filter((d) => d.activity_date?.startsWith(m.period));
            if (localMonthDaily.length > 0) {
              let dailyDone = 0;
              let dailyInProgress = 0;
              let dailyRevisi = 0;
              let dailyPending = 0;
              let dailyWaiting = 0;

              localMonthDaily.forEach((d) => {
                const s = (d.status || "").toLowerCase();
                if (s.includes("done") || s.includes("selesai")) dailyDone++;
                else if (s.includes("progress") || s.includes("proses")) dailyInProgress++;
                else if (s.includes("revisi")) dailyRevisi++;
                else if (s.includes("pending") || s.includes("tunda")) dailyPending++;
                else dailyWaiting++;
              });

              m.daily = {
                total: localMonthDaily.length,
                done: dailyDone,
                inProgress: dailyInProgress,
                revisi: dailyRevisi,
                pending: dailyPending,
                waiting: dailyWaiting,
                completionRate: Math.round((dailyDone / localMonthDaily.length) * 1000) / 10,
              };
              m.active = true;
              modified = true;
            }
          });
        }

        if (modified) {
          // Rekalkulasi status aktif & KPI Grade dinamis per bulan
          rekapData.months.forEach((m) => {
            m.active = m.permintaan.masuk > 0 || m.daily.total > 0 || m.attendance.prs > 0 || m.stb.totalStandby > 0;
            if (m.active) {
              let weightedSum = 0;
              let totalWeight = 0;

              if (m.permintaan.slaPct !== null) {
                weightedSum += m.permintaan.slaPct * 0.40;
                totalWeight += 0.40;
              }
              if (m.daily.completionRate !== null) {
                weightedSum += m.daily.completionRate * 0.35;
                totalWeight += 0.35;
              }
              if (m.attendance.attendanceRate !== null) {
                weightedSum += m.attendance.attendanceRate * 0.25;
                totalWeight += 0.25;
              }

              if (totalWeight > 0) {
                const score = weightedSum / totalWeight;
                if (score >= 90) m.kpiGrade = "Sangat Baik";
                else if (score >= 80) m.kpiGrade = "Baik";
                else if (score >= 65) m.kpiGrade = "Cukup Baik";
                else m.kpiGrade = "Kurang Baik";
              } else {
                m.kpiGrade = null;
              }
            } else {
              m.kpiGrade = null;
            }
          });

          // Rekalkulasi Totals
          const activeMonths = rekapData.months.filter((m) => m.active);

          rekapData.totals.dailyTotal = activeMonths.reduce((acc, m) => acc + m.daily.total, 0);
          rekapData.totals.dailyDone = activeMonths.reduce((acc, m) => acc + m.daily.done, 0);
          rekapData.totals.dailyInProgress = activeMonths.reduce((acc, m) => acc + m.daily.inProgress, 0);
          rekapData.totals.dailyRevisi = activeMonths.reduce((acc, m) => acc + m.daily.revisi, 0);
          rekapData.totals.dailyPending = activeMonths.reduce((acc, m) => acc + m.daily.pending, 0);
          rekapData.totals.dailyWaiting = activeMonths.reduce((acc, m) => acc + m.daily.waiting, 0);
          rekapData.totals.dailyRate =
            rekapData.totals.dailyTotal > 0
              ? Math.round((rekapData.totals.dailyDone / rekapData.totals.dailyTotal) * 1000) / 10
              : 100;

          rekapData.totals.attendancePrs = activeMonths.reduce((acc, m) => acc + m.attendance.prs, 0);
          rekapData.totals.attendanceOvt = activeMonths.reduce((acc, m) => acc + m.attendance.ovt, 0);
          rekapData.totals.attendanceOff = activeMonths.reduce((acc, m) => acc + m.attendance.off, 0);
          rekapData.totals.attendanceAbs = activeMonths.reduce((acc, m) => acc + m.attendance.abs, 0);
          rekapData.totals.attendanceTotalMinutes = activeMonths.reduce((acc, m) => acc + m.attendance.overtimeMinutes, 0);
          rekapData.totals.attendanceRate =
            rekapData.totals.attendancePrs + rekapData.totals.attendanceAbs > 0
              ? Math.round((rekapData.totals.attendancePrs / (rekapData.totals.attendancePrs + rekapData.totals.attendanceAbs)) * 1000) / 10
              : 100;

          rekapData.totals.stbPersonil = Math.max(...activeMonths.map((m) => m.stb.personil), 0);
          rekapData.totals.stbTotalStandby = activeMonths.reduce((acc, m) => acc + m.stb.totalStandby, 0);
          rekapData.totals.stbCountH = activeMonths.reduce((acc, m) => acc + m.stb.countH, 0);
          rekapData.totals.stbCountHSmall = activeMonths.reduce((acc, m) => acc + m.stb.countHSmall, 0);

          const overallScore =
            rekapData.totals.permintaanSlaPct * 0.4 +
            rekapData.totals.dailyRate * 0.35 +
            rekapData.totals.attendanceRate * 0.25;

          if (overallScore >= 90) rekapData.totals.overallKpiGrade = "Sangat Baik";
          else if (overallScore >= 80) rekapData.totals.overallKpiGrade = "Baik";
          else if (overallScore >= 65) rekapData.totals.overallKpiGrade = "Cukup Baik";
          else rekapData.totals.overallKpiGrade = "Kurang Baik";
        }

        return rekapData;
      }
    }
  } catch (err) {
    console.warn("Fetch /api/rekap-bulanan failed, falling back to local processing:", err);
  }

  // Fallback bersih jika API tidak dapat dijangkau
  return {
    year,
    months: MONTH_NAMES_ID.map((monthName, idx) => {
      const monthNum = String(idx + 1).padStart(2, "0");
      return {
        monthName,
        monthNum,
        period: `${year}-${monthNum}`,
        active: false,
        permintaan: {
          masuk: 0,
          selesai: 0,
          resRate: null,
          statuses: {},
          onTime: 0,
          slaPct: null,
          avgDurationHours: null,
          eskalasi: 0,
        },
        daily: {
          total: 0,
          done: 0,
          inProgress: 0,
          revisi: 0,
          pending: 0,
          waiting: 0,
          completionRate: null,
        },
        attendance: {
          totalRecords: 0,
          prs: 0,
          ovt: 0,
          off: 0,
          abs: 0,
          overtimeMinutes: 0,
          overtimeHours: 0,
          attendanceRate: null,
        },
        stb: {
          personil: 0,
          countH: 0,
          countHSmall: 0,
          countOther: 0,
          totalStandby: 0,
        },
        kpiGrade: null,
      };
    }),
    totals: {
      permintaanMasuk: 0,
      permintaanSelesai: 0,
      permintaanResRate: 100,
      permintaanSlaPct: 100,
      permintaanAvgHours: 6.0,
      permintaanEskalasi: 0,
      permintaanStatuses: {},
      dailyTotal: 0,
      dailyDone: 0,
      dailyInProgress: 0,
      dailyRevisi: 0,
      dailyPending: 0,
      dailyWaiting: 0,
      dailyRate: 100,
      attendancePrs: 0,
      attendanceOvt: 0,
      attendanceOff: 0,
      attendanceAbs: 0,
      attendanceTotalMinutes: 0,
      attendanceRate: 100,
      stbPersonil: 0,
      stbTotalStandby: 0,
      stbCountH: 0,
      stbCountHSmall: 0,
      overallKpiGrade: "Baik",
    },
  };
}

export function exportIntegratedExcel(data: YearIntegratedRekap): string {
  const wb = XLSX.utils.book_new();
  const year = data.year;

  // 1. SHEET RINGKASAN EKSEKUTIF (4 MODUL)
  const summaryAoa = [
    [`Laporan Rekap Bulanan Terintegrasi ${year}`],
    ["Departemen IT & Design Helpdesk — Permintaan Design, Daily Activity, Attendance, & STB HSE"],
    [],
    ["Modul & Indikator", "Nilai Tahunan", "Keterangan"],
    ["1. PERMINTAAN DESIGN", "", ""],
    ["Total Permintaan Masuk", data.totals.permintaanMasuk, "Tiket masuk tahun kalender"],
    ["Total Tiket Selesai (Done)", data.totals.permintaanSelesai, "Tiket berhasil diselesaikan"],
    ["Resolution Rate", `${data.totals.permintaanResRate}%`, "Rasio Selesai ÷ Masuk"],
    ["SLA Achievement (YTD)", `${data.totals.permintaanSlaPct}%`, `Grade: ${data.totals.overallKpiGrade}`],
    ["Rata-rata Durasi Pengerjaan", `${data.totals.permintaanAvgHours} Jam`, "Waktu pengerjaan tiket"],
    ["Eskalasi ke Vendor", `${data.totals.permintaanEskalasi} tiket`, "Delay pihak ketiga"],
    [],
    ["2. DAILY ACTIVITY", "", ""],
    ["Total Aktivitas", data.totals.dailyTotal, "Catatan tugas & job list"],
    ["Aktivitas Selesai (Done)", data.totals.dailyDone, "Tugas terselesaikan"],
    ["Dalam Proses (In Progress)", data.totals.dailyInProgress, "Pengerjaan berjalan"],
    ["Tingkat Penyelesaian", `${data.totals.dailyRate}%`, "Aktivitas beres"],
    [],
    ["3. ATTENDANCE (KEHADIRAN)", "", ""],
    ["Total Hari Hadir (PRS)", data.totals.attendancePrs, "Kehadiran kerja normal"],
    ["Total Lembur (OVT)", data.totals.attendanceOvt, "Hari penugasan lembur"],
    ["Total Jam Lembur", `${Math.round(data.totals.attendanceTotalMinutes / 60)} Jam`, `${data.totals.attendanceTotalMinutes} menit`],
    ["Tingkat Kehadiran", `${data.totals.attendanceRate}%`, "Disiplin kehadiran"],
    [],
    ["4. STB HSE (ROSTER STANDBY)", "", ""],
    ["Personil Terdaftar", data.totals.stbPersonil, "Personil HSE standby"],
    ["Total Hari Standby", data.totals.stbTotalStandby, "Shift Siang & Malam"],
    ["Shift Siang (H)", data.totals.stbCountH, "Standby 08:00 - 17:00"],
    ["Shift Malam (h)", data.totals.stbCountHSmall, "Standby 17:00 - 08:00"],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
  wsSummary["!cols"] = [{ wch: 30 }, { wch: 20 }, { wch: 38 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan 4 Modul");

  // 2. SHEET TABEL 12 BULAN TERINTEGRASI
  const monthlyAoa: (string | number)[][] = [
    [
      "Bulan",
      "Permintaan Masuk",
      "Permintaan Selesai",
      "Resolution Rate",
      "SLA Tercapai",
      "Daily Total",
      "Daily Done",
      "Hadir (PRS)",
      "Lembur (Jam)",
      "STB Standby (Hari)",
      "KPI Grade",
    ],
    ...data.months.map((m) => [
      m.monthName,
      m.permintaan.masuk,
      m.permintaan.selesai,
      m.permintaan.resRate !== null ? `${m.permintaan.resRate}%` : "-",
      m.permintaan.slaPct !== null ? `${m.permintaan.slaPct}%` : "-",
      m.daily.total,
      m.daily.done,
      m.attendance.prs,
      m.attendance.overtimeHours,
      m.stb.totalStandby,
      m.kpiGrade || "-",
    ]),
    [
      "TOTAL SETAHUN",
      data.totals.permintaanMasuk,
      data.totals.permintaanSelesai,
      `${data.totals.permintaanResRate}%`,
      `${data.totals.permintaanSlaPct}%`,
      data.totals.dailyTotal,
      data.totals.dailyDone,
      data.totals.attendancePrs,
      Math.round(data.totals.attendanceTotalMinutes / 60),
      data.totals.stbTotalStandby,
      data.totals.overallKpiGrade,
    ],
  ];
  const wsMonthly = XLSX.utils.aoa_to_sheet(monthlyAoa);
  wsMonthly["!cols"] = [
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, wsMonthly, "Rekap 12 Bulan");

  // 3. SHEET DETAIL PERMINTAAN DESIGN
  const reqAoa: (string | number)[][] = [
    ["Bulan", "Tiket Masuk", "Tiket Selesai", "Res Rate", "Durasi (Jam)", "Eskalasi", "SLA %", "KPI Grade"],
    ...data.months.map((m) => [
      m.monthName,
      m.permintaan.masuk,
      m.permintaan.selesai,
      m.permintaan.resRate !== null ? `${m.permintaan.resRate}%` : "-",
      m.permintaan.avgDurationHours !== null ? m.permintaan.avgDurationHours : "-",
      m.permintaan.eskalasi,
      m.permintaan.slaPct !== null ? `${m.permintaan.slaPct}%` : "-",
      m.kpiGrade || "-",
    ]),
  ];
  const wsReq = XLSX.utils.aoa_to_sheet(reqAoa);
  XLSX.utils.book_append_sheet(wb, wsReq, "Permintaan Design");

  // 4. SHEET DETAIL DAILY ACTIVITY
  const dailyAoa: (string | number)[][] = [
    ["Bulan", "Total Aktivitas", "Done", "In Progress", "Revisi", "Pending", "Waiting", "Completion %"],
    ...data.months.map((m) => [
      m.monthName,
      m.daily.total,
      m.daily.done,
      m.daily.inProgress,
      m.daily.revisi,
      m.daily.pending,
      m.daily.waiting,
      m.daily.completionRate !== null ? `${m.daily.completionRate}%` : "-",
    ]),
  ];
  const wsDaily = XLSX.utils.aoa_to_sheet(dailyAoa);
  XLSX.utils.book_append_sheet(wb, wsDaily, "Daily Activity");

  // 5. SHEET DETAIL ATTENDANCE
  const attAoa: (string | number)[][] = [
    ["Bulan", "Hadir (PRS)", "Lembur (OVT)", "Libur (OFF)", "Absen (ABS)", "Total Jam Lembur", "Attendance Rate %"],
    ...data.months.map((m) => [
      m.monthName,
      m.attendance.prs,
      m.attendance.ovt,
      m.attendance.off,
      m.attendance.abs,
      m.attendance.overtimeHours,
      m.attendance.attendanceRate !== null ? `${m.attendance.attendanceRate}%` : "-",
    ]),
  ];
  const wsAtt = XLSX.utils.aoa_to_sheet(attAoa);
  XLSX.utils.book_append_sheet(wb, wsAtt, "Attendance");

  // 6. SHEET DETAIL STB HSE
  const stbAoa: (string | number)[][] = [
    ["Bulan", "Personil Terdaftar", "Shift Siang (H)", "Shift Malam (h)", "Standby Lainnya", "Total Hari Standby"],
    ...data.months.map((m) => [
      m.monthName,
      m.stb.personil,
      m.stb.countH,
      m.stb.countHSmall,
      m.stb.countOther,
      m.stb.totalStandby,
    ]),
  ];
  const wsStb = XLSX.utils.aoa_to_sheet(stbAoa);
  XLSX.utils.book_append_sheet(wb, wsStb, "STB HSE Roster");

  const fileName = `Rekap-Bulanan-Terintegrasi-${year}.xlsx`;
  XLSX.writeFile(wb, fileName);
  return fileName;
}
