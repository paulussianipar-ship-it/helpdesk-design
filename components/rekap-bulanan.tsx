"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import {
  ArrowLeft,
  BarChart3,
  CalendarCheck2,
  ChevronDown,
  Clock,
  FileSpreadsheet,
  HelpCircle,
  Info,
  Layers,
  Loader2,
  ShieldCheck,
  Target,
  UserCheck,
  Users,
} from "lucide-react";
import {
  fetchIntegratedRekap,
  exportIntegratedExcel,
  MONTH_NAMES_ID,
  type MonthIntegratedData,
  type YearIntegratedRekap,
} from "@/lib/rekap-integrated";
import { getKpiBadgeClass, getSlaTextClass } from "@/lib/rekap-tiket-data";

export function RekapBulananPage() {
  const [year, setYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedModule, setSelectedModule] = useState<string>("all");
  const [slaReferenceOpen, setSlaReferenceOpen] = useState<boolean>(false);
  const [activeDetailTab, setActiveDetailTab] = useState<"permintaan" | "daily" | "attendance" | "stb">("permintaan");

  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [rekap, setRekap] = useState<YearIntegratedRekap | null>(null);

  // Hidden series toggles for Chart
  const [hiddenSeries, setHiddenSeries] = useState<Record<string, boolean>>({
    masuk: false,
    selesai: false,
    daily: false,
    sla: false,
    att: false,
  });

  const toggleSeries = (key: string) => {
    setHiddenSeries((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      try {
        const result = await fetchIntegratedRekap(year);
        if (!cancelled) {
          setRekap(result);
        }
      } catch (err: any) {
        toast.error("Gagal memuat rekap terintegrasi: " + (err?.message || ""));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    return () => {
      cancelled = true;
    };
  }, [year]);

  const handleExportExcel = async () => {
    if (!rekap) return;
    setExporting(true);
    try {
      const fileName = exportIntegratedExcel(rekap);
      toast.success(`Berhasil mengekspor ${fileName}`);
    } catch (error: any) {
      toast.error("Gagal mengekspor Excel: " + (error?.message || ""));
    } finally {
      setExporting(false);
    }
  };

  // Filtered months if single month is selected
  const displayedMonths = useMemo(() => {
    if (!rekap) return [];
    if (selectedMonth === "all") return rekap.months;
    return rekap.months.filter((m) => m.monthNum === selectedMonth);
  }, [rekap, selectedMonth]);

  // Chart data
  const chartData = useMemo(() => {
    if (!rekap) return [];
    return rekap.months.map((m) => ({
      name: m.monthName.slice(0, 3),
      fullName: m.monthName,
      masuk: m.permintaan.masuk,
      selesai: m.permintaan.selesai,
      dailyDone: m.daily.done,
      dailyTotal: m.daily.total,
      sla: m.permintaan.slaPct,
      attRate: m.attendance.attendanceRate,
      active: m.active,
    }));
  }, [rekap]);

  if (loading || !rekap) {
    return (
      <div className="col-span-12 w-full flex flex-col items-center justify-center p-20 text-muted-foreground">
        <Loader2 className="size-8 animate-spin mb-3 text-primary" />
        <span className="text-sm font-medium">Memuat rekap bulanan terintegrasi 4 modul...</span>
      </div>
    );
  }

  const totals = rekap.totals;

  return (
    <div className="col-span-12 w-full space-y-4">
      {/* ==================== PAGE HEADER ==================== */}
      <div className="d-print-none">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-card border rounded-xl p-4 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400">
              <BarChart3 className="size-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg md:text-xl font-bold tracking-tight text-foreground">
                  Rekap Bulanan Terintegrasi {year}
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
                  KPI 4 Modul: Design · Daily · Attendance · STB HSE
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Laporan komprehensif terintegrasi Permintaan Design, Daily Activity, Attendance, &amp; Standby STB HSE sesuai target SLA.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 print:hidden">
            <button
              onClick={handleExportExcel}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              )}
              Export Excel (4 Modul)
            </button>

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-card hover:bg-muted shadow-xs transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              Kembali ke Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* ==================== FILTER CARD ==================== */}
      <div className="bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          {/* Modul Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
              Filter Modul
            </label>
            <select
              value={selectedModule}
              onChange={(e) => {
                setSelectedModule(e.target.value);
                if (e.target.value !== "all") {
                  setActiveDetailTab(e.target.value as any);
                }
              }}
              className="w-full h-9 px-3 text-xs bg-card border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground cursor-pointer"
            >
              <option value="all">Semua Modul (Overview 4 Modul)</option>
              <option value="permintaan">1. Permintaan Design</option>
              <option value="daily">2. Daily Activity</option>
              <option value="attendance">3. Attendance</option>
              <option value="stb">4. STB HSE</option>
            </select>
          </div>

          {/* Bulan Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
              Filter Bulan
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-card border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground cursor-pointer"
            >
              <option value="all">Semua Bulan (Setahun Penuh)</option>
              {MONTH_NAMES_ID.map((name, idx) => {
                const val = String(idx + 1).padStart(2, "0");
                return (
                  <option key={val} value={val}>
                    {name}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Tahun Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
              Tahun
            </label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full h-9 px-3 text-xs bg-card border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground cursor-pointer"
            >
              <option value={2027}>2027</option>
              <option value={2026}>2026</option>
              <option value={2025}>2025</option>
              <option value={2024}>2024</option>
              <option value={2023}>2023</option>
            </select>
          </div>

          <div className="flex items-end">
            <span className="text-[11px] text-muted-foreground italic pb-2">
              Data tersinkronisasi otomatis dari database &amp; roster operasional.
            </span>
          </div>
        </div>
      </div>

      {/* ==================== ACUAN STANDAR & SLA (COLLAPSIBLE) ==================== */}
      <div className="bg-card border rounded-xl shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => setSlaReferenceOpen((prev) => !prev)}
          className="w-full flex items-center justify-between px-4 py-3 border-b text-left hover:bg-muted/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2 font-bold text-sm text-foreground">
            <ShieldCheck className="size-4 text-primary" />
            Acuan Standar SLA &amp; Kinerja 4 Modul
          </div>
          <ChevronDown
            className={`size-4 text-muted-foreground transition-transform duration-200 ${
              slaReferenceOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {slaReferenceOpen && (
          <div className="border-t bg-card animate-in fade-in-50 duration-200">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground text-[10px] uppercase font-semibold tracking-wider text-left border-b">
                    <th className="py-2 px-4">Modul / Prioritas</th>
                    <th className="py-2 px-4">Deskripsi Standar</th>
                    <th className="py-2 px-4 text-center">Target Waktu</th>
                    <th className="py-2 px-4 text-center">Kriteria Keberhasilan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  <tr className="hover:bg-muted/20">
                    <td className="py-2 px-4 font-bold text-rose-600 dark:text-rose-400">
                      P1 - Kritis (Design)
                    </td>
                    <td className="py-2 px-4 text-muted-foreground">
                      Permintaan Urgent / Kritis dari Manajemen &amp; Operasional Lapangan
                    </td>
                    <td className="py-2 px-4 text-center font-medium">Maks. 2 jam</td>
                    <td className="py-2 px-4 text-center text-emerald-600 font-semibold">Tuntas tanpa revisi</td>
                  </tr>
                  <tr className="hover:bg-muted/20">
                    <td className="py-2 px-4 font-bold text-amber-600 dark:text-amber-400">
                      P2 - Tinggi (Design)
                    </td>
                    <td className="py-2 px-4 text-muted-foreground">
                      Permintaan Prioritas Tinggi (Event, Materi Rapat, Pengumuman)
                    </td>
                    <td className="py-2 px-4 text-center font-medium">Maks. 4 jam</td>
                    <td className="py-2 px-4 text-center text-emerald-600 font-semibold">Approved sebelum due date</td>
                  </tr>
                  <tr className="hover:bg-muted/20">
                    <td className="py-2 px-4 font-bold text-sky-600 dark:text-sky-400">
                      Daily Activity
                    </td>
                    <td className="py-2 px-4 text-muted-foreground">
                      Pencatatan tugas harian &amp; job list seluruh staf operasional
                    </td>
                    <td className="py-2 px-4 text-center font-medium">Harian (Same-Day)</td>
                    <td className="py-2 px-4 text-center text-emerald-600 font-semibold">Status ✅ Done</td>
                  </tr>
                  <tr className="hover:bg-muted/20">
                    <td className="py-2 px-4 font-bold text-purple-600 dark:text-purple-400">
                      Attendance &amp; STB HSE
                    </td>
                    <td className="py-2 px-4 text-muted-foreground">
                      Disiplin Kehadiran (PRS), Jam Lembur (OVT), serta Standby Shift Siang (H) &amp; Malam (h)
                    </td>
                    <td className="py-2 px-4 text-center font-medium">08:00–17:00 / 17:00–08:00</td>
                    <td className="py-2 px-4 text-center text-emerald-600 font-semibold">Kehadiran ≥90%</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 bg-muted/30 border-t text-[11px] text-muted-foreground leading-relaxed">
              Target kepatuhan dihitung secara menyeluruh untuk KPI 4 modul:{" "}
              <strong className="text-foreground">
                &lt;60% Kurang Baik • 60-79% Cukup Baik • 80-89% Baik • ≥90% Sangat Baik.
              </strong>
            </div>
          </div>
        )}
      </div>

      {/* ==================== 5 SUMMARY KPI CARDS ==================== */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Permintaan Design */}
        <div className="col-span-1 bg-card border rounded-xl p-3.5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="text-muted-foreground text-xs font-semibold flex items-center gap-1.5">
              <BarChart3 className="size-3.5 text-blue-600" />
              Permintaan Design
            </div>
            <div className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mt-1">
              {totals.permintaanMasuk}
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            <span className="font-semibold text-emerald-600">{totals.permintaanSelesai} selesai</span> · Res: {totals.permintaanResRate}%
          </div>
        </div>

        {/* Daily Activity */}
        <div className="col-span-1 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 rounded-xl p-3.5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
              <Layers className="size-3.5 text-emerald-600" />
              Daily Activity
            </div>
            <div className="text-2xl md:text-3xl font-bold tracking-tight text-emerald-700 dark:text-emerald-300 mt-1">
              {totals.dailyDone}
            </div>
          </div>
          <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400 mt-1">
            dari {totals.dailyTotal} aktivitas ({totals.dailyRate}%)
          </div>
        </div>

        {/* SLA Achievement */}
        <div className="col-span-2 md:col-span-1 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 rounded-xl p-3.5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="text-amber-700 dark:text-amber-400 text-xs font-semibold flex items-center gap-1">
              <Target className="size-3.5 text-amber-600" />
              <span>SLA Achievement</span>
              <div className="group relative inline-block">
                <HelpCircle className="size-3 text-amber-600/70 hover:text-amber-700 cursor-help" />
                <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-60 p-2 bg-slate-900 text-slate-50 text-[10px] rounded shadow-lg z-50 pointer-events-none leading-tight">
                  Persentase penyelesaian tiket sesuai target prioritas waktu pengerjaan SLA tanpa revisi.
                </div>
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold tracking-tight text-amber-800 dark:text-amber-300 mt-1">
              {totals.permintaanSlaPct}%
            </div>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500 text-white">
              {totals.overallKpiGrade}
            </span>
            <span className="text-[10px] text-muted-foreground">
              Rata-rata: {totals.permintaanAvgHours} Jam
            </span>
          </div>
        </div>

        {/* Attendance */}
        <div className="col-span-1 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/80 rounded-xl p-3.5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="text-purple-700 dark:text-purple-400 text-xs font-semibold flex items-center gap-1.5">
              <UserCheck className="size-3.5 text-purple-600" />
              Kehadiran (PRS)
            </div>
            <div className="text-2xl md:text-3xl font-bold tracking-tight text-purple-700 dark:text-purple-300 mt-1">
              {totals.attendancePrs}
            </div>
          </div>
          <div className="text-[11px] text-purple-700/80 dark:text-purple-400 mt-1">
            Lembur: {Math.round(totals.attendanceTotalMinutes / 60)} Jam ({totals.attendanceRate}% hadir)
          </div>
        </div>

        {/* STB HSE */}
        <div className="col-span-1 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/80 rounded-xl p-3.5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="text-blue-700 dark:text-blue-400 text-xs font-semibold flex items-center gap-1.5">
              <Users className="size-3.5 text-blue-600" />
              Standby STB HSE
            </div>
            <div className="text-2xl md:text-3xl font-bold tracking-tight text-blue-700 dark:text-blue-300 mt-1">
              {totals.stbTotalStandby} <span className="text-sm font-normal text-muted-foreground">Hari</span>
            </div>
          </div>
          <div className="text-[11px] text-blue-700/80 dark:text-blue-400 mt-1">
            {totals.stbPersonil} Personil · H: {totals.stbCountH} · h: {totals.stbCountHSmall}
          </div>
        </div>
      </div>

      {/* ==================== 4 MODULE HIGHLIGHT CARDS ==================== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Modul 1 */}
        <div className="bg-card border rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">1. Permintaan Design</span>
            <BarChart3 className="size-3.5 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-foreground mt-1">
            {totals.permintaanResRate}%
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {totals.permintaanSelesai} selesai dari {totals.permintaanMasuk} tiket
          </div>
        </div>

        {/* Modul 2 */}
        <div className="bg-card border rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">2. Daily Activity</span>
            <Layers className="size-3.5 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-foreground mt-1">
            {totals.dailyRate}%
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {totals.dailyDone} tuntas dari {totals.dailyTotal} tugas
          </div>
        </div>

        {/* Modul 3 */}
        <div className="bg-card border rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">3. Attendance</span>
            <UserCheck className="size-3.5 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-foreground mt-1">
            {totals.attendanceRate}%
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {totals.attendancePrs} Hadir (PRS) · {totals.attendanceOvt} Hari Lembur
          </div>
        </div>

        {/* Modul 4 */}
        <div className="bg-card border rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">4. STB HSE</span>
            <Users className="size-3.5 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-foreground mt-1">
            {totals.stbTotalStandby}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {totals.stbCountH} Siang (H) · {totals.stbCountHSmall} Malam (h)
          </div>
        </div>
      </div>

      {/* ==================== INFO STATUS & PROGRESS BARS ==================== */}
      <div className="bg-card border rounded-xl shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-2 font-bold text-sm text-foreground">
          <Info className="size-4 text-primary" />
          Status Kepatuhan SLA &amp; Produktivitas Operasional
        </div>
        <div className="p-4 space-y-3">
          <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 rounded-lg text-xs leading-relaxed text-muted-foreground">
            <span className="font-bold text-foreground">
              <ShieldCheck className="size-3.5 inline text-emerald-600 mr-1 -mt-0.5" />
              SLA Terintegrasi
            </span>{" "}
            memadukan kecepatan pengerjaan desain, penyelesaian checklist aktivitas harian, tingkat disiplin kehadiran staf, dan konsistensi jadwal standby HSE.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-foreground">SLA Permintaan Design</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">{totals.permintaanSlaPct}%</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${totals.permintaanSlaPct}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {totals.permintaanSelesai} tiket selesai dengan durasi rata-rata {totals.permintaanAvgHours} Jam.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-foreground">Daily Activity Tuntas</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{totals.dailyRate}%</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${totals.dailyRate}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {totals.dailyDone} dari {totals.dailyTotal} aktivitas berstatus ✅ Done.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-foreground">Disiplin Kehadiran (Attendance)</span>
                <span className="font-bold text-purple-600 dark:text-purple-400">{totals.attendanceRate}%</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${totals.attendanceRate}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {totals.attendancePrs} hari hadir kerja normal &amp; {totals.attendanceOvt} penugasan lembur.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== TREND CHART ==================== */}
      <div className="bg-card border rounded-xl shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm text-foreground">
            <BarChart3 className="size-4 text-primary" />
            Grafik Trend Bulanan Terintegrasi {year}
          </div>
        </div>
        <div className="p-4">
          <div className="flex flex-wrap items-center justify-center gap-4 mb-4 text-xs select-none">
            <button
              onClick={() => toggleSeries("masuk")}
              className={`flex items-center gap-1.5 cursor-pointer transition-opacity ${
                hiddenSeries.masuk ? "opacity-35 line-through" : "opacity-100"
              }`}
            >
              <span className="size-3 rounded-full bg-[#206bc4]" />
              <span className="font-medium text-foreground">Permintaan Masuk</span>
            </button>

            <button
              onClick={() => toggleSeries("selesai")}
              className={`flex items-center gap-1.5 cursor-pointer transition-opacity ${
                hiddenSeries.selesai ? "opacity-35 line-through" : "opacity-100"
              }`}
            >
              <span className="size-3 rounded-full bg-[#2fb344]" />
              <span className="font-medium text-foreground">Permintaan Selesai</span>
            </button>

            <button
              onClick={() => toggleSeries("daily")}
              className={`flex items-center gap-1.5 cursor-pointer transition-opacity ${
                hiddenSeries.daily ? "opacity-35 line-through" : "opacity-100"
              }`}
            >
              <span className="size-3 rounded-full bg-[#f59f00]" />
              <span className="font-medium text-foreground">Daily Activity Done</span>
            </button>

            <button
              onClick={() => toggleSeries("sla")}
              className={`flex items-center gap-1.5 cursor-pointer transition-opacity ${
                hiddenSeries.sla ? "opacity-35 line-through" : "opacity-100"
              }`}
            >
              <span className="w-4 h-0.5 bg-[#f76707] inline-block" />
              <span className="font-medium text-foreground">SLA Achievement (%)</span>
            </button>

            <button
              onClick={() => toggleSeries("att")}
              className={`flex items-center gap-1.5 cursor-pointer transition-opacity ${
                hiddenSeries.att ? "opacity-35 line-through" : "opacity-100"
              }`}
            >
              <span className="w-4 h-0.5 border-b border-dashed border-[#ae3ec9] inline-block" />
              <span className="font-medium text-foreground">Attendance Rate (%)</span>
            </button>
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(150,150,150,0.15)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={{ stroke: "rgba(150,150,150,0.3)" }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={{ stroke: "rgba(150,150,150,0.3)" }}
                  tickLine={false}
                  label={{
                    value: "Volume Jumlah",
                    angle: -90,
                    position: "insideLeft",
                    style: { textAnchor: "middle", fontSize: 11, fill: "var(--muted-foreground)" },
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={{ stroke: "rgba(150,150,150,0.3)" }}
                  tickLine={false}
                  label={{
                    value: "Rate (%)",
                    angle: 90,
                    position: "insideRight",
                    style: { textAnchor: "middle", fontSize: 11, fill: "var(--muted-foreground)" },
                  }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const item = payload[0]?.payload;
                    return (
                      <div className="bg-popover text-popover-foreground border rounded-lg shadow-md p-2.5 text-xs space-y-1.5 min-w-[190px]">
                        <div className="font-bold border-b pb-1 text-foreground">
                          {item?.fullName || label}
                        </div>
                        <div className="flex items-center justify-between text-[#206bc4]">
                          <span>Permintaan Masuk:</span>
                          <span className="font-bold">{item?.masuk}</span>
                        </div>
                        <div className="flex items-center justify-between text-[#2fb344]">
                          <span>Permintaan Selesai:</span>
                          <span className="font-bold">{item?.selesai}</span>
                        </div>
                        <div className="flex items-center justify-between text-[#f59f00]">
                          <span>Daily Done:</span>
                          <span className="font-bold">{item?.dailyDone}</span>
                        </div>
                        <div className="flex items-center justify-between text-[#f76707]">
                          <span>SLA Achievement:</span>
                          <span className="font-bold">
                            {item?.sla !== null ? `${item?.sla}%` : "-"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[#ae3ec9]">
                          <span>Attendance Rate:</span>
                          <span className="font-bold">
                            {item?.attRate !== null ? `${item?.attRate}%` : "-"}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />

                {!hiddenSeries.masuk && (
                  <Bar
                    yAxisId="left"
                    dataKey="masuk"
                    name="Permintaan Masuk"
                    fill="rgba(32,107,196,0.85)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                )}

                {!hiddenSeries.selesai && (
                  <Bar
                    yAxisId="left"
                    dataKey="selesai"
                    name="Permintaan Selesai"
                    fill="rgba(47,179,68,0.85)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                )}

                {!hiddenSeries.daily && (
                  <Bar
                    yAxisId="left"
                    dataKey="dailyDone"
                    name="Daily Activity Done"
                    fill="rgba(245,159,0,0.85)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                )}

                {!hiddenSeries.sla && (
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="sla"
                    name="SLA Achievement (%)"
                    stroke="#f76707"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: "#f76707" }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                )}

                {!hiddenSeries.att && (
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="attRate"
                    name="Attendance Rate (%)"
                    stroke="#ae3ec9"
                    strokeWidth={2.5}
                    strokeDasharray="5 5"
                    dot={{ r: 3.5, fill: "#ae3ec9" }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ==================== TABEL REKAP BULANAN TERPADU ==================== */}
      <div className="bg-card border rounded-xl shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="font-bold text-sm text-foreground">
            Tabel Rekap 12 Bulan Terintegrasi 4 Modul
          </h2>
          <span className="text-xs text-muted-foreground">
            {selectedMonth === "all" ? "Seluruh Bulan 2026" : `Bulan ${MONTH_NAMES_ID[Number(selectedMonth) - 1]}`}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground text-[10px] uppercase font-semibold tracking-wider border-b">
                <th className="py-2.5 px-4 text-left">Bulan</th>
                <th className="py-2.5 px-3 text-center">Permintaan (In/Done)</th>
                <th className="py-2.5 px-3 text-center">Res Rate</th>
                <th className="py-2.5 px-3 text-center">Daily Activity</th>
                <th className="py-2.5 px-3 text-center">Hadir (PRS)</th>
                <th className="py-2.5 px-3 text-center">Lembur (Jam)</th>
                <th className="py-2.5 px-3 text-center">STB HSE (Hari)</th>
                <th className="py-2.5 px-3 text-center">SLA %</th>
                <th className="py-2.5 px-4 text-center">KPI Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {displayedMonths.map((m) => (
                <tr
                  key={m.period}
                  className={`hover:bg-muted/20 transition-colors ${
                    !m.active ? "opacity-45" : ""
                  }`}
                >
                  <td className="py-2.5 px-4 font-semibold text-foreground">
                    {m.monthName}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="font-medium">{m.permintaan.masuk}</span> /{" "}
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {m.permintaan.selesai}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {m.permintaan.resRate !== null ? (
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {m.permintaan.resRate}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="font-medium">{m.daily.done}</span>
                    <span className="text-muted-foreground text-[10px] ml-1">
                      ({m.daily.completionRate !== null ? `${m.daily.completionRate}%` : "-"})
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-medium">
                    {m.attendance.prs > 0 ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                        {m.attendance.prs}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center text-muted-foreground">
                    {m.attendance.overtimeHours > 0 ? `${m.attendance.overtimeHours} Jam` : "-"}
                  </td>
                  <td className="py-2.5 px-3 text-center font-medium">
                    {m.stb.totalStandby > 0 ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                        {m.stb.totalStandby}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {m.permintaan.slaPct !== null ? (
                      <span className={getSlaTextClass(m.permintaan.slaPct)}>
                        {m.permintaan.slaPct}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {m.kpiGrade ? (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${getKpiBadgeClass(
                          m.kpiGrade
                        )}`}
                      >
                        {m.kpiGrade}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {selectedMonth === "all" && (
              <tfoot>
                <tr className="bg-slate-100/80 dark:bg-slate-900/60 font-bold border-t-2 border-border">
                  <td className="py-2.5 px-4 text-foreground">TOTAL SETAHUN</td>
                  <td className="py-2.5 px-3 text-center">
                    {totals.permintaanMasuk} /{" "}
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {totals.permintaanSelesai}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center text-emerald-600 dark:text-emerald-400">
                    {totals.permintaanResRate}%
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {totals.dailyDone} ({totals.dailyRate}%)
                  </td>
                  <td className="py-2.5 px-3 text-center text-purple-600 dark:text-purple-400">
                    {totals.attendancePrs}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {Math.round(totals.attendanceTotalMinutes / 60)} Jam
                  </td>
                  <td className="py-2.5 px-3 text-center text-blue-600 dark:text-blue-400">
                    {totals.stbTotalStandby}
                  </td>
                  <td className="py-2.5 px-3 text-center text-amber-600 dark:text-amber-400 font-bold">
                    {totals.permintaanSlaPct}%
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${getKpiBadgeClass(
                        totals.overallKpiGrade
                      )}`}
                    >
                      {totals.overallKpiGrade}
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ==================== DETAIL RINCIAN PER MODUL (TABBED) ==================== */}
      <div className="bg-card border rounded-xl shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-bold text-sm text-foreground">
            <Target className="size-4 text-primary" />
            Rincian Khusus per Modul
          </div>

          <div className="flex flex-wrap items-center gap-1 bg-muted/60 p-1 rounded-lg text-xs">
            <button
              onClick={() => setActiveDetailTab("permintaan")}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                activeDetailTab === "permintaan"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              1. Permintaan
            </button>
            <button
              onClick={() => setActiveDetailTab("daily")}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                activeDetailTab === "daily"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              2. Daily
            </button>
            <button
              onClick={() => setActiveDetailTab("attendance")}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                activeDetailTab === "attendance"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              3. Attendance
            </button>
            <button
              onClick={() => setActiveDetailTab("stb")}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                activeDetailTab === "stb"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              4. STB HSE
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {/* TAB 1: PERMINTAAN DESIGN */}
          {activeDetailTab === "permintaan" && (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground text-[10px] uppercase font-semibold tracking-wider border-b">
                  <th className="py-2.5 px-4 text-left">Bulan</th>
                  <th className="py-2.5 px-3 text-center">Tiket Masuk</th>
                  <th className="py-2.5 px-3 text-center">Selesai (Done)</th>
                  <th className="py-2.5 px-3 text-center">Durasi Rata-rata</th>
                  <th className="py-2.5 px-3 text-center">Eskalasi</th>
                  <th className="py-2.5 px-3 text-center">SLA %</th>
                  <th className="py-2.5 px-4 text-center">KPI Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {displayedMonths.map((m) => (
                  <tr key={m.period} className="hover:bg-muted/20">
                    <td className="py-2.5 px-4 font-semibold text-foreground">{m.monthName}</td>
                    <td className="py-2.5 px-3 text-center font-medium">{m.permintaan.masuk}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                      {m.permintaan.selesai}
                    </td>
                    <td className="py-2.5 px-3 text-center text-muted-foreground">
                      {m.permintaan.avgDurationHours !== null ? `${m.permintaan.avgDurationHours} Jam` : "-"}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {m.permintaan.eskalasi > 0 ? (
                        <span className="inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700">
                          {m.permintaan.eskalasi} tiket
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold">
                      {m.permintaan.slaPct !== null ? `${m.permintaan.slaPct}%` : "-"}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      {m.kpiGrade ? (
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border ${getKpiBadgeClass(m.kpiGrade)}`}>
                          {m.kpiGrade}
                        </span>
                      ) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* TAB 2: DAILY ACTIVITY */}
          {activeDetailTab === "daily" && (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground text-[10px] uppercase font-semibold tracking-wider border-b">
                  <th className="py-2.5 px-4 text-left">Bulan</th>
                  <th className="py-2.5 px-3 text-center">Total Tugas</th>
                  <th className="py-2.5 px-3 text-center">✅ Done</th>
                  <th className="py-2.5 px-3 text-center">⚡ In Progress</th>
                  <th className="py-2.5 px-3 text-center">🔄 Revisi</th>
                  <th className="py-2.5 px-3 text-center">Penyelesaian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {displayedMonths.map((m) => (
                  <tr key={m.period} className="hover:bg-muted/20">
                    <td className="py-2.5 px-4 font-semibold text-foreground">{m.monthName}</td>
                    <td className="py-2.5 px-3 text-center font-medium">{m.daily.total}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                      {m.daily.done}
                    </td>
                    <td className="py-2.5 px-3 text-center text-sky-600 dark:text-sky-400">
                      {m.daily.inProgress}
                    </td>
                    <td className="py-2.5 px-3 text-center text-rose-600 dark:text-rose-400">
                      {m.daily.revisi}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-foreground">
                      {m.daily.completionRate !== null ? `${m.daily.completionRate}%` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* TAB 3: ATTENDANCE */}
          {activeDetailTab === "attendance" && (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground text-[10px] uppercase font-semibold tracking-wider border-b">
                  <th className="py-2.5 px-4 text-left">Bulan</th>
                  <th className="py-2.5 px-3 text-center">Hadir (PRS)</th>
                  <th className="py-2.5 px-3 text-center">Lembur (OVT)</th>
                  <th className="py-2.5 px-3 text-center">Libur (OFF)</th>
                  <th className="py-2.5 px-3 text-center">Absen (ABS)</th>
                  <th className="py-2.5 px-3 text-center">Durasi Lembur</th>
                  <th className="py-2.5 px-3 text-center">Tingkat Hadir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {displayedMonths.map((m) => (
                  <tr key={m.period} className="hover:bg-muted/20">
                    <td className="py-2.5 px-4 font-semibold text-foreground">{m.monthName}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                      {m.attendance.prs}
                    </td>
                    <td className="py-2.5 px-3 text-center font-medium text-purple-600 dark:text-purple-400">
                      {m.attendance.ovt}
                    </td>
                    <td className="py-2.5 px-3 text-center text-amber-600">{m.attendance.off}</td>
                    <td className="py-2.5 px-3 text-center text-rose-600">{m.attendance.abs}</td>
                    <td className="py-2.5 px-3 text-center font-medium text-muted-foreground">
                      {m.attendance.overtimeHours > 0 ? `${m.attendance.overtimeHours} Jam` : "-"}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold">
                      {m.attendance.attendanceRate !== null ? `${m.attendance.attendanceRate}%` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* TAB 4: STB HSE */}
          {activeDetailTab === "stb" && (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground text-[10px] uppercase font-semibold tracking-wider border-b">
                  <th className="py-2.5 px-4 text-left">Bulan</th>
                  <th className="py-2.5 px-3 text-center">Personil Aktif</th>
                  <th className="py-2.5 px-3 text-center">Shift Siang (H)</th>
                  <th className="py-2.5 px-3 text-center">Shift Malam (h)</th>
                  <th className="py-2.5 px-3 text-center">Standby Lainnya</th>
                  <th className="py-2.5 px-3 text-center">Total Hari Standby</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {displayedMonths.map((m) => (
                  <tr key={m.period} className="hover:bg-muted/20">
                    <td className="py-2.5 px-4 font-semibold text-foreground">{m.monthName}</td>
                    <td className="py-2.5 px-3 text-center font-medium">{m.stb.personil} orang</td>
                    <td className="py-2.5 px-3 text-center font-semibold text-blue-600 dark:text-blue-400">
                      {m.stb.countH}
                    </td>
                    <td className="py-2.5 px-3 text-center font-semibold text-indigo-600 dark:text-indigo-400">
                      {m.stb.countHSmall}
                    </td>
                    <td className="py-2.5 px-3 text-center text-muted-foreground">{m.stb.countOther}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-foreground">
                      {m.stb.totalStandby} Hari
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}