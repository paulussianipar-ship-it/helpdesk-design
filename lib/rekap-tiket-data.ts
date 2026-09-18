import * as XLSX from "xlsx";

export interface MonthlyRekapItem {
  month: string;
  monthIndex: number;
  masuk: number;
  selesai: number;
  resRate: number | null;
  durasiJam: number | null;
  eskalasiCount: number;
  eskalasiPct: number | null;
  gagalResponPct: number | null;
  gagalSelesaiPct: number | null;
  slaTercapaiPct: number | null;
  kpiGrade: "Sangat Baik" | "Baik" | "Cukup Baik" | "Kurang Baik" | null;
  active: boolean;
  priorityBreakdown: {
    p1: { pct: number | null; done: number; total: number };
    p2: { pct: number | null; done: number; total: number };
    p3: { pct: number | null; done: number; total: number };
    p4: { pct: number | null; done: number; total: number };
  };
}

export interface RekapTiketState {
  year: number;
  team: string;
  category: string;
  totalMasuk: number;
  totalSelesai: number;
  slaAchievementYtd: number;
  slaGradeYtd: string;
  eligibleTickets: number;
  vendorExcluded: number;
  avgDurationHours: number;
  escalationCount: number;
  escalationPct: number;
  lateResponsePct: number;
  lateResponseCount: number;
  revisedCount: number;
  revisedPct: number;
  priorityOverall: {
    p1: { pct: number; done: number; total: number };
    p2: { pct: number; done: number; total: number };
    p3: { pct: number; done: number; total: number };
    p4: { pct: number; done: number; total: number };
  };
  monthlyData: MonthlyRekapItem[];
}

export const INITIAL_REKAP_DATA_2026: RekapTiketState = {
  year: 2026,
  team: "all",
  category: "",
  totalMasuk: 466,
  totalSelesai: 457,
  slaAchievementYtd: 74.6,
  slaGradeYtd: "Cukup Baik",
  eligibleTickets: 457,
  vendorExcluded: 0,
  avgDurationHours: 18.8,
  escalationCount: 6,
  escalationPct: 1.3,
  lateResponsePct: 46,
  lateResponseCount: 210,
  revisedCount: 1,
  revisedPct: 0.2,
  priorityOverall: {
    p1: { pct: 66.7, done: 4, total: 6 },
    p2: { pct: 28.6, done: 2, total: 7 },
    p3: { pct: 70.5, done: 148, total: 210 },
    p4: { pct: 79.9, done: 187, total: 234 },
  },
  monthlyData: [
    {
      month: "Januari",
      monthIndex: 1,
      masuk: 92,
      selesai: 90,
      resRate: 97.8,
      durasiJam: 30.1,
      eskalasiCount: 0,
      eskalasiPct: null,
      gagalResponPct: 47.8,
      gagalSelesaiPct: 22.2,
      slaTercapaiPct: 77.8,
      kpiGrade: "Cukup Baik",
      active: true,
      priorityBreakdown: {
        p1: { pct: null, done: 0, total: 0 },
        p2: { pct: null, done: 0, total: 0 },
        p3: { pct: 87.8, done: 36, total: 41 },
        p4: { pct: 69.4, done: 34, total: 49 },
      },
    },
    {
      month: "Februari",
      monthIndex: 2,
      masuk: 67,
      selesai: 59,
      resRate: 88.1,
      durasiJam: 8.8,
      eskalasiCount: 1,
      eskalasiPct: 1.5,
      gagalResponPct: 22.0,
      gagalSelesaiPct: 11.9,
      slaTercapaiPct: 88.1,
      kpiGrade: "Baik",
      active: true,
      priorityBreakdown: {
        p1: { pct: null, done: 0, total: 0 },
        p2: { pct: null, done: 0, total: 0 },
        p3: { pct: 80.0, done: 28, total: 35 },
        p4: { pct: 100.0, done: 24, total: 24 },
      },
    },
    {
      month: "Maret",
      monthIndex: 3,
      masuk: 26,
      selesai: 34,
      resRate: 130.8,
      durasiJam: 59.0,
      eskalasiCount: 1,
      eskalasiPct: 3.8,
      gagalResponPct: 70.6,
      gagalSelesaiPct: 47.1,
      slaTercapaiPct: 52.9,
      kpiGrade: "Kurang Baik",
      active: true,
      priorityBreakdown: {
        p1: { pct: null, done: 0, total: 0 },
        p2: { pct: null, done: 0, total: 0 },
        p3: { pct: 52.9, done: 9, total: 17 },
        p4: { pct: 52.9, done: 9, total: 17 },
      },
    },
    {
      month: "April",
      monthIndex: 4,
      masuk: 53,
      selesai: 47,
      resRate: 88.7,
      durasiJam: 18.1,
      eskalasiCount: 0,
      eskalasiPct: null,
      gagalResponPct: 63.8,
      gagalSelesaiPct: 40.4,
      slaTercapaiPct: 59.6,
      kpiGrade: "Kurang Baik",
      active: true,
      priorityBreakdown: {
        p1: { pct: null, done: 0, total: 0 },
        p2: { pct: null, done: 0, total: 0 },
        p3: { pct: 52.2, done: 12, total: 23 },
        p4: { pct: 66.7, done: 16, total: 24 },
      },
    },
    {
      month: "Mei",
      monthIndex: 5,
      masuk: 26,
      selesai: 31,
      resRate: 119.2,
      durasiJam: 35.5,
      eskalasiCount: 0,
      eskalasiPct: null,
      gagalResponPct: 58.1,
      gagalSelesaiPct: 48.4,
      slaTercapaiPct: 51.6,
      kpiGrade: "Kurang Baik",
      active: true,
      priorityBreakdown: {
        p1: { pct: null, done: 0, total: 0 },
        p2: { pct: null, done: 0, total: 0 },
        p3: { pct: 21.4, done: 3, total: 14 },
        p4: { pct: 76.5, done: 13, total: 17 },
      },
    },
    {
      month: "Juni",
      monthIndex: 6,
      masuk: 46,
      selesai: 45,
      resRate: 97.8,
      durasiJam: 8.6,
      eskalasiCount: 0,
      eskalasiPct: null,
      gagalResponPct: 44.4,
      gagalSelesaiPct: 22.2,
      slaTercapaiPct: 77.8,
      kpiGrade: "Cukup Baik",
      active: true,
      priorityBreakdown: {
        p1: { pct: null, done: 0, total: 0 },
        p2: { pct: null, done: 0, total: 0 },
        p3: { pct: 65.0, done: 13, total: 20 },
        p4: { pct: 88.0, done: 22, total: 25 },
      },
    },
    {
      month: "Juli",
      monthIndex: 7,
      masuk: 50,
      selesai: 50,
      resRate: 100.0,
      durasiJam: 9.1,
      eskalasiCount: 1,
      eskalasiPct: 2.0,
      gagalResponPct: 58.0,
      gagalSelesaiPct: 28.0,
      slaTercapaiPct: 72.0,
      kpiGrade: "Cukup Baik",
      active: true,
      priorityBreakdown: {
        p1: { pct: null, done: 0, total: 0 },
        p2: { pct: null, done: 0, total: 0 },
        p3: { pct: 66.7, done: 20, total: 30 },
        p4: { pct: 80.0, done: 16, total: 20 },
      },
    },
    {
      month: "Agustus",
      monthIndex: 8,
      masuk: 42,
      selesai: 43,
      resRate: 102.4,
      durasiJam: 5.3,
      eskalasiCount: 0,
      eskalasiPct: null,
      gagalResponPct: 30.2,
      gagalSelesaiPct: 16.3,
      slaTercapaiPct: 83.7,
      kpiGrade: "Baik",
      active: true,
      priorityBreakdown: {
        p1: { pct: null, done: 0, total: 0 },
        p2: { pct: 100.0, done: 1, total: 1 },
        p3: { pct: 81.3, done: 13, total: 16 },
        p4: { pct: 84.6, done: 22, total: 26 },
      },
    },
    {
      month: "September",
      monthIndex: 9,
      masuk: 64,
      selesai: 58,
      resRate: 90.6,
      durasiJam: 5.8,
      eskalasiCount: 3,
      eskalasiPct: 4.7,
      gagalResponPct: 34.5,
      gagalSelesaiPct: 13.8,
      slaTercapaiPct: 86.2,
      kpiGrade: "Baik",
      active: true,
      priorityBreakdown: {
        p1: { pct: 66.7, done: 4, total: 6 },
        p2: { pct: 16.7, done: 1, total: 6 },
        p3: { pct: 100.0, done: 14, total: 14 },
        p4: { pct: 96.9, done: 31, total: 32 },
      },
    },
    {
      month: "Oktober",
      monthIndex: 10,
      masuk: 0,
      selesai: 0,
      resRate: null,
      durasiJam: null,
      eskalasiCount: 0,
      eskalasiPct: null,
      gagalResponPct: null,
      gagalSelesaiPct: null,
      slaTercapaiPct: null,
      kpiGrade: null,
      active: false,
      priorityBreakdown: {
        p1: { pct: null, done: 0, total: 0 },
        p2: { pct: null, done: 0, total: 0 },
        p3: { pct: null, done: 0, total: 0 },
        p4: { pct: null, done: 0, total: 0 },
      },
    },
    {
      month: "November",
      monthIndex: 11,
      masuk: 0,
      selesai: 0,
      resRate: null,
      durasiJam: null,
      eskalasiCount: 0,
      eskalasiPct: null,
      gagalResponPct: null,
      gagalSelesaiPct: null,
      slaTercapaiPct: null,
      kpiGrade: null,
      active: false,
      priorityBreakdown: {
        p1: { pct: null, done: 0, total: 0 },
        p2: { pct: null, done: 0, total: 0 },
        p3: { pct: null, done: 0, total: 0 },
        p4: { pct: null, done: 0, total: 0 },
      },
    },
    {
      month: "Desember",
      monthIndex: 12,
      masuk: 0,
      selesai: 0,
      resRate: null,
      durasiJam: null,
      eskalasiCount: 0,
      eskalasiPct: null,
      gagalResponPct: null,
      gagalSelesaiPct: null,
      slaTercapaiPct: null,
      kpiGrade: null,
      active: false,
      priorityBreakdown: {
        p1: { pct: null, done: 0, total: 0 },
        p2: { pct: null, done: 0, total: 0 },
        p3: { pct: null, done: 0, total: 0 },
        p4: { pct: null, done: 0, total: 0 },
      },
    },
  ],
};

export function getKpiBadgeClass(grade: string | null) {
  switch (grade) {
    case "Sangat Baik":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800";
    case "Baik":
      return "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-300 dark:border-sky-800";
    case "Cukup Baik":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800";
    case "Kurang Baik":
      return "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800";
    default:
      return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-300 dark:border-slate-700";
  }
}

export function getSlaTextClass(pct: number | null) {
  if (pct === null) return "text-muted-foreground";
  if (pct >= 90) return "text-emerald-600 dark:text-emerald-400 font-bold";
  if (pct >= 80) return "text-sky-600 dark:text-sky-400 font-bold";
  if (pct >= 60) return "text-amber-600 dark:text-amber-400 font-bold";
  return "text-rose-600 dark:text-rose-400 font-bold";
}

export function exportRekapTiketExcel(data: RekapTiketState): string {
  const wb = XLSX.utils.book_new();
  const year = data.year;

  // 1. Sheet Ringkasan KPI
  const summaryAoa = [
    [`Rekap Bulanan Tiket Helpdesk IT ${year}`],
    ["Laporan KPI & SLA Departemen IT"],
    [],
    ["Indikator", "Nilai", "Keterangan"],
    ["Total Tiket Masuk", data.totalMasuk, "Tiket dibuat dalam tahun kalender"],
    ["Total Selesai (Done)", data.totalSelesai, "Tiket selesai berstatus Done"],
    ["SLA Achievement (YTD)", `${data.slaAchievementYtd}%`, `Grade: ${data.slaGradeYtd}`],
    ["Tiket Eligible SLA", data.eligibleTickets, `${data.vendorExcluded} dikecualikan vendor`],
    ["Rata-rata Durasi Pengerjaan", `${data.avgDurationHours} Jam`, "Waktu kalender selesai"],
    ["Eskalasi ke Vendor/Lainnya", `${data.escalationCount} (${data.escalationPct}%)`, "Tiket dieskalasi"],
    ["Telat Mulai Diproses", `${data.lateResponseCount} (${data.lateResponsePct}%)`, "Info pemantauan"],
    ["Tiket Pernah Direvisi", `${data.revisedCount} (${data.revisedPct}%)`, "Gagal SLA"],
    [],
    ["Prioritas SLA", "Tercapai (%)", "Rincian Tiket"],
    ["P1 - Kritis (Urgent)", `${data.priorityOverall.p1.pct}%`, `${data.priorityOverall.p1.done} dari ${data.priorityOverall.p1.total} tiket`],
    ["P2 - Tinggi (Prioritas)", `${data.priorityOverall.p2.pct}%`, `${data.priorityOverall.p2.done} dari ${data.priorityOverall.p2.total} tiket`],
    ["P3 - Sedang (Normal)", `${data.priorityOverall.p3.pct}%`, `${data.priorityOverall.p3.done} dari ${data.priorityOverall.p3.total} tiket`],
    ["P4 - Rendah (Normal)", `${data.priorityOverall.p4.pct}%`, `${data.priorityOverall.p4.done} dari ${data.priorityOverall.p4.total} tiket`],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
  wsSummary["!cols"] = [{ wch: 28 }, { wch: 20 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan KPI");

  // 2. Sheet Tabel Rekap Per Bulan
  const monthlyAoa: (string | number)[][] = [
    [
      "Bulan",
      "Tiket Masuk",
      "Selesai",
      "Resolution Rate",
      "Rata-rata Durasi",
      "Eskalasi",
      "Gagal Respon",
      "Gagal Selesai",
      "SLA Tercapai",
      "KPI Grade",
    ],
    ...data.monthlyData.map((m) => [
      m.month,
      m.masuk,
      m.selesai,
      m.resRate !== null ? `${m.resRate}%` : "-",
      m.durasiJam !== null ? `${m.durasiJam} Jam` : "-",
      m.eskalasiCount > 0 ? `${m.eskalasiCount} (${m.eskalasiPct}%)` : "-",
      m.gagalResponPct !== null ? `${m.gagalResponPct}%` : "-",
      m.gagalSelesaiPct !== null ? `${m.gagalSelesaiPct}%` : "-",
      m.slaTercapaiPct !== null ? `${m.slaTercapaiPct}%` : "-",
      m.kpiGrade || "-",
    ]),
    [
      "TOTAL SETAHUN",
      data.totalMasuk,
      data.totalSelesai,
      "98.1%",
      `${data.avgDurationHours} Jam`,
      `${data.escalationCount} (${data.escalationPct}%)`,
      `${data.lateResponsePct}%`,
      "25.4%",
      `${data.slaAchievementYtd}%`,
      data.slaGradeYtd,
    ],
  ];
  const wsMonthly = XLSX.utils.aoa_to_sheet(monthlyAoa);
  wsMonthly["!cols"] = [
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, wsMonthly, "Rekap Bulanan");

  // 3. Sheet SLA per Prioritas
  const priorityAoa: (string | number)[][] = [
    ["Bulan", "P1 - Kritis", "P2 - Tinggi", "P3 - Sedang", "P4 - Rendah", "Overall SLA"],
    ...data.monthlyData.map((m) => [
      m.month,
      m.priorityBreakdown.p1.pct !== null
        ? `${m.priorityBreakdown.p1.pct}% (${m.priorityBreakdown.p1.done}/${m.priorityBreakdown.p1.total})`
        : "-",
      m.priorityBreakdown.p2.pct !== null
        ? `${m.priorityBreakdown.p2.pct}% (${m.priorityBreakdown.p2.done}/${m.priorityBreakdown.p2.total})`
        : "-",
      m.priorityBreakdown.p3.pct !== null
        ? `${m.priorityBreakdown.p3.pct}% (${m.priorityBreakdown.p3.done}/${m.priorityBreakdown.p3.total})`
        : "-",
      m.priorityBreakdown.p4.pct !== null
        ? `${m.priorityBreakdown.p4.pct}% (${m.priorityBreakdown.p4.done}/${m.priorityBreakdown.p4.total})`
        : "-",
      m.slaTercapaiPct !== null ? `${m.slaTercapaiPct}%` : "-",
    ]),
    [
      "TOTAL SETAHUN",
      `${data.priorityOverall.p1.pct}% (${data.priorityOverall.p1.done}/${data.priorityOverall.p1.total})`,
      `${data.priorityOverall.p2.pct}% (${data.priorityOverall.p2.done}/${data.priorityOverall.p2.total})`,
      `${data.priorityOverall.p3.pct}% (${data.priorityOverall.p3.done}/${data.priorityOverall.p3.total})`,
      `${data.priorityOverall.p4.pct}% (${data.priorityOverall.p4.done}/${data.priorityOverall.p4.total})`,
      `${data.slaAchievementYtd}%`,
    ],
  ];
  const wsPriority = XLSX.utils.aoa_to_sheet(priorityAoa);
  wsPriority["!cols"] = [
    { wch: 14 },
    { wch: 20 },
    { wch: 20 },
    { wch: 22 },
    { wch: 22 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, wsPriority, "SLA Prioritas");

  // 4. Sheet Acuan SLA
  const slaRefAoa = [
    ["Acuan SLA Departemen IT"],
    [],
    ["Prioritas", "Mapping Tiket", "Waktu Respon", "Waktu Penyelesaian"],
    ["P1 - Kritis (Urgent)", "tipe_tiket = Urgent", "15 menit", "2 jam"],
    ["P2 - Tinggi (Prioritas)", "tipe_tiket = Prioritas", "30 menit", "4 jam"],
    ["P3 - Sedang (Normal)", "tipe_tiket = Normal & kategori = Troubleshoot", "2 jam", "24 jam (1 hari)"],
    ["P4 - Rendah (Normal)", "tipe_tiket = Normal & kategori = Request/Installasi", "4 jam", "48 jam (2 hari)"],
    [],
    [
      "Catatan:",
      "Waktu dihitung kalender penuh (24 jam nonstop). Status SLA Tercapai hanya dinilai dari Waktu Penyelesaian.",
    ],
    ["", "Tiket pernah Revisi otomatis Gagal SLA. Tiket eskalasi Vendor dikecualikan dari skor SLA."],
    ["", "KPI Grade: <60% Kurang Baik • 60-79% Cukup Baik • 80-89% Baik • ≥90% Sangat Baik."],
  ];
  const wsRef = XLSX.utils.aoa_to_sheet(slaRefAoa);
  wsRef["!cols"] = [{ wch: 24 }, { wch: 46 }, { wch: 16 }, { wch: 26 }];
  XLSX.utils.book_append_sheet(wb, wsRef, "Acuan SLA");

  const fileName = `Rekap-Tiket-IT-${year}.xlsx`;
  XLSX.writeFile(wb, fileName);
  return fileName;
}
