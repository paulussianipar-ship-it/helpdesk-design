"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import {
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Loader2,
  RotateCcw,
  Target,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Info,
  BarChart2,
  ClipboardList,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Content } from "@/components/content";

// =====================================================================
// TYPES
// =====================================================================
interface KpiRow {
  id: string;
  no: number;
  perspektif_bsc: string;
  strategy: string;
  tujuan_strategi: string;
  area_kinerja_utama: string;
  kpi: string;
  bobot: number;
  polarity: "Max" | "Min";
  cap: number;
  target: number;
  keterangan: string;
  realisasi: number | null;
  skor: number | null;
  nilai_akhir: number | null;
  cara_pengukuran: string;
  data_source: string;
  note: string;
  raw?: Record<string, any>;
}

interface KpiApiResponse {
  period: string;
  period_label: string;
  rows: KpiRow[];
  total_bobot: number;
  total_nilai_akhir: number;
  meta: Record<string, any>;
}

// =====================================================================
// HELPERS
// =====================================================================
const MONTH_NAMES: Record<string, string> = {
  "01": "Januari", "02": "Februari", "03": "Maret", "04": "April",
  "05": "Mei", "06": "Juni", "07": "Juli", "08": "Agustus",
  "09": "September", "10": "Oktober", "11": "November", "12": "Desember",
};

const getCurrentMonthPeriod = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

const formatMonthPeriod = (period: string) => {
  if (!period || period === "all") return "Semua Periode";
  const [year, month] = period.split("-");
  return `${MONTH_NAMES[month] || month} ${year}`;
};

const generateMonthOptions = () => {
  const options = [];
  const years = [2026, 2025];
  for (const y of years) {
    for (let m = 12; m >= 1; m--) {
      const mStr = String(m).padStart(2, "0");
      options.push({ value: `${y}-${mStr}`, label: `${MONTH_NAMES[mStr]} ${y}` });
    }
  }
  return options;
};
const MONTH_OPTIONS = generateMonthOptions();

// Nilai KPI Scoring
function getScoreCategory(score: number) {
  if (score >= 90) return { label: "Baik Sekali", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" };
  if (score >= 75) return { label: "Baik", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10 border-blue-500/30" };
  if (score >= 60) return { label: "Cukup", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10 border-amber-500/30" };
  if (score >= 40) return { label: "Kurang", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10 border-orange-500/30" };
  return { label: "Sangat Kurang", color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10 border-rose-500/30" };
}

function getRealisasiBadgeClass(realisasi: number | null, target: number) {
  if (realisasi === null) return "bg-muted/50 text-muted-foreground";
  if (realisasi >= target) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
  if (realisasi >= target * 0.75) return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
  return "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30";
}

function getBscBadgeClass(perspektif: string) {
  if (perspektif.toLowerCase().includes("learning")) {
    return "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30";
  }
  return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
}

const DATA_SOURCE_COLORS: Record<string, string> = {
  "Permintaan Desain": "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30",
  "Daily Activity": "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30",
  "Attendance": "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30",
  "STB HSE": "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/30",
};

// =====================================================================
// MAIN COMPONENT
// =====================================================================
export default function KpiClientComponent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentMonth = getCurrentMonthPeriod();
  const selectedMonth = searchParams.get("month") || currentMonth;

  const [data, setData] = useState<KpiApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ——————————————————————————————
  // FETCH KPI DATA
  // ——————————————————————————————
  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedMonth && selectedMonth !== "all") {
        params.set("month", selectedMonth);
      }
      const res = await fetch(`/api/kpi?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json: KpiApiResponse = await res.json();
      setData(json);
    } catch (err: any) {
      toast.error("Gagal memuat data KPI: " + err.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ——————————————————————————————
  // NAVIGATION HELPERS
  // ——————————————————————————————
  const createQueryString = useCallback(
    (params: Record<string, string | undefined>) => {
      const p = new URLSearchParams(searchParams.toString());
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== "") p.set(k, v);
        else p.delete(k);
      });
      return p.toString();
    },
    [searchParams]
  );

  const handleFilter = (key: string, value: string | undefined) => {
    startTransition(() => {
      router.push(pathname + "?" + createQueryString({ [key]: value }));
    });
  };

  const handleShiftMonth = (direction: -1 | 1) => {
    const current = selectedMonth === "all" ? getCurrentMonthPeriod() : selectedMonth;
    const [yearStr, monthStr] = current.split("-");
    const date = new Date(parseInt(yearStr), parseInt(monthStr) - 1 + direction, 1);
    const newY = date.getFullYear();
    const newM = String(date.getMonth() + 1).padStart(2, "0");
    handleFilter("month", `${newY}-${newM}`);
  };

  // ——————————————————————————————
  // EXPORT EXCEL
  // ——————————————————————————————
  const handleExportExcel = async () => {
    if (!data) return;
    setIsExporting(true);
    try {
      const periodLabel = formatMonthPeriod(selectedMonth);
      const now = new Date().toLocaleString("id-ID");

      // Sheet 1: KPI Table
      const kpiRows = data.rows.map((row) => ({
        "No": row.no,
        "Perspektif BSC": row.perspektif_bsc,
        "Strategy": row.strategy,
        "Tujuan Strategi": row.tujuan_strategi,
        "Area Kinerja Utama": row.area_kinerja_utama,
        "Key Performance Indicators": row.kpi,
        "Bobot (%)": row.bobot,
        "Polarity": row.polarity,
        "Cap (%)": row.cap,
        "Target (%)": row.target,
        "Keterangan": row.keterangan,
        "Realisasi (%)": row.realisasi !== null ? row.realisasi : "-",
        "Skor": row.skor !== null ? row.skor.toFixed(2) : "-",
        "Cara Pengukuran": row.cara_pengukuran,
        "Sumber Data": row.data_source,
        "Note": row.note,
      }));

      // Add total row
      kpiRows.push({
        "No": "" as any,
        "Perspektif BSC": "",
        "Strategy": "",
        "Tujuan Strategi": "",
        "Area Kinerja Utama": "",
        "Key Performance Indicators": "TOTAL",
        "Bobot (%)": data.total_bobot,
        "Polarity": "" as any,
        "Cap (%)": "" as any,
        "Target (%)": "" as any,
        "Keterangan": "",
        "Realisasi (%)": "" as any,
        "Skor": data.total_nilai_akhir.toFixed(2) as any,
        "Cara Pengukuran": "",
        "Sumber Data": "",
        "Note": "",
      });

      // Sheet 2: Meta data
      const metaRows = [
        { "Info": "Periode", "Nilai": data.period_label },
        { "Info": "Tanggal Export", "Nilai": now },
        { "Info": "Total KPI Items", "Nilai": data.rows.length },
        { "Info": "Total Bobot", "Nilai": `${data.total_bobot}%` },
        { "Info": "Nilai Akhir KPI", "Nilai": `${data.total_nilai_akhir.toFixed(2)}%` },
        { "Info": "Kategori", "Nilai": getScoreCategory(data.total_nilai_akhir).label },
        { "Info": "", "Nilai": "" },
        { "Info": "Detail Data Aktual", "Nilai": "" },
        { "Info": "Hari Kerja Bulan", "Nilai": data.meta.workingDays },
        { "Info": "Total Permintaan Desain", "Nilai": data.meta.totalPermintaan },
        { "Info": "Permintaan Done", "Nilai": data.meta.donePermintaan },
        { "Info": "Permintaan On-Time", "Nilai": data.meta.onTimePermintaan },
        { "Info": "Total Daily Activity", "Nilai": data.meta.totalDailyEntries },
        { "Info": "Hari Ada Aktivitas Done", "Nilai": data.meta.daysWithDoneActivity },
        { "Info": "Hari Hadir (Attendance)", "Nilai": data.meta.presentDays },
        { "Info": "Expected Hari Hadir", "Nilai": data.meta.expectedAttendanceDays },
        { "Info": "STB HSE Terpenuhi", "Nilai": data.meta.fulfilledStandbyDays },
        { "Info": "STB HSE Expected", "Nilai": data.meta.totalExpectedStandby },
      ];

      const ws1 = XLSX.utils.json_to_sheet(kpiRows);
      const ws2 = XLSX.utils.json_to_sheet(metaRows);

      // Auto-width
      const maxW = (rows: any[], key: string) =>
        Math.max(key.length, ...rows.map((r) => String(r[key] || "").length));

      ws1["!cols"] = [
        { wch: 4 }, { wch: 18 }, { wch: 40 }, { wch: 40 }, { wch: 20 },
        { wch: 55 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 10 },
        { wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 55 }, { wch: 20 }, { wch: 8 },
      ];
      ws2["!cols"] = [{ wch: 30 }, { wch: 30 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws1, "KPI " + periodLabel);
      XLSX.utils.book_append_sheet(wb, ws2, "Meta Data");

      const fileName = `KPI_${selectedMonth || getCurrentMonthPeriod()}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success(`File KPI berhasil diunduh: ${fileName}`);
    } catch (err: any) {
      toast.error("Gagal export: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // ——————————————————————————————
  // SCORE CATEGORY
  // ——————————————————————————————
  const totalScore = data?.total_nilai_akhir ?? 0;
  const scoreCategory = getScoreCategory(totalScore);

  // ——————————————————————————————
  // RENDER
  // ——————————————————————————————
  return (
    <Content
      title="Key Performance Indicator (KPI)"
      description={`Laporan KPI Departemen IT / Divisi Creative — Periode ${formatMonthPeriod(selectedMonth)}`}
      size="lg"
      cardAction={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={isRefreshing || loading}
            className="flex items-center gap-1.5"
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={isExporting || loading || !data}
            className="flex items-center gap-1.5"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            )}
            <span>Export Excel</span>
          </Button>
        </div>
      }
    >
      {/* ——— MONTH SELECTOR ——— */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card border rounded-xl p-3.5 shadow-xs mb-5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Prev / Current Label / Next */}
          <div className="flex items-center rounded-lg border bg-muted/40 p-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleShiftMonth(-1)}
              disabled={selectedMonth === "all"}
              title="Bulan Sebelumnya"
              className="h-8 w-8 rounded-md hover:bg-background"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="px-3 py-1 flex items-center gap-2 min-w-[160px] justify-center">
              <CalendarDays className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">{formatMonthPeriod(selectedMonth)}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleShiftMonth(1)}
              disabled={selectedMonth === "all"}
              title="Bulan Berikutnya"
              className="h-8 w-8 rounded-md hover:bg-background"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Dropdown */}
          <div className="w-full sm:w-[210px]">
            <Select
              value={selectedMonth}
              onValueChange={(val) => handleFilter("month", val)}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Pilih Bulan" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {MONTH_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Native month picker */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground border rounded-lg px-2.5 h-9 bg-background">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            <input
              type="month"
              value={selectedMonth === "all" ? "" : selectedMonth}
              onChange={(e) => { if (e.target.value) handleFilter("month", e.target.value); }}
              className="bg-transparent text-xs text-foreground outline-none cursor-pointer"
            />
          </div>

          {selectedMonth !== currentMonth && (
            <Button size="sm" variant="outline" className="h-9 text-xs" onClick={() => handleFilter("month", currentMonth)}>
              Bulan Sekarang
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground self-start md:self-auto">
          <span>Periode:</span>
          <Badge variant="outline" className="font-semibold text-primary border-primary/30">
            {formatMonthPeriod(selectedMonth)}
          </Badge>
        </div>
      </div>

      {/* ——— LOADING ——— */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary/60" />
          <p className="text-sm text-muted-foreground">Memuat data KPI dari semua sumber...</p>
        </div>
      )}

      {!loading && data && (
        <>
          {/* ——— SUMMARY CARDS ——— */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
            {/* Nilai KPI */}
            <div className={`col-span-2 sm:col-span-3 lg:col-span-1 p-4 rounded-xl border text-center flex flex-col items-center justify-center gap-1 ${scoreCategory.bg}`}>
              <div className="text-xs font-medium text-muted-foreground">Nilai KPI</div>
              <div className={`text-3xl font-bold ${scoreCategory.color}`}>
                {totalScore.toFixed(1)}%
              </div>
              <Badge className={`text-xs ${scoreCategory.bg} ${scoreCategory.color} border`}>
                {scoreCategory.label}
              </Badge>
            </div>

            {/* Permintaan Desain */}
            <div className="p-4 rounded-xl border bg-card flex flex-col gap-1">
              <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <ClipboardList className="h-3 w-3" /> Permintaan Desain
              </div>
              <div className="text-2xl font-bold text-foreground">{data.meta.donePermintaan}</div>
              <div className="text-[11px] text-muted-foreground">dari {data.meta.totalPermintaan} tiket selesai</div>
            </div>

            {/* Daily Activity */}
            <div className="p-4 rounded-xl border bg-card flex flex-col gap-1">
              <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <BarChart2 className="h-3 w-3" /> Daily Activity
              </div>
              <div className="text-2xl font-bold text-foreground">{data.meta.totalDailyEntries}</div>
              <div className="text-[11px] text-muted-foreground">{data.meta.daysWithDoneActivity} hari ada entri Done</div>
            </div>

            {/* Attendance */}
            <div className="p-4 rounded-xl border bg-card flex flex-col gap-1">
              <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Kehadiran
              </div>
              <div className="text-2xl font-bold text-foreground">{data.meta.presentDays}</div>
              <div className="text-[11px] text-muted-foreground">dari {data.meta.expectedAttendanceDays} hari hadir</div>
            </div>

            {/* STB HSE */}
            <div className="p-4 rounded-xl border bg-card flex flex-col gap-1">
              <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Target className="h-3 w-3" /> STB HSE
              </div>
              <div className="text-2xl font-bold text-foreground">{data.meta.fulfilledStandbyDays}</div>
              <div className="text-[11px] text-muted-foreground">dari {data.meta.totalExpectedStandby} standby terpenuhi</div>
            </div>
          </div>

          {/* ——— KPI TABLE ——— */}
          <div className="rounded-xl border overflow-hidden mb-5 shadow-xs">
            {/* Table Header Info */}
            <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b">
              <div>
                <div className="font-semibold text-sm text-foreground">KEY PERFORMANCE INDICATOR (KPI)</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Departemen IT / Divisi Creative — Periode {formatMonthPeriod(selectedMonth)}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-purple-500/60"></span>
                  Learning & Growth
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500/60"></span>
                  Internal Process
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse min-w-[1400px]">
                <thead>
                  <tr className="bg-muted/60 border-b">
                    <th className="px-3 py-2.5 text-center font-semibold border-r w-8">#</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r min-w-[120px]">Perspektif BSC</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r min-w-[180px]">Tujuan Strategi</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r min-w-[110px]">Area Kinerja Utama</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r min-w-[240px]">Key Performance Indicators</th>
                    <th className="px-3 py-2.5 text-center font-semibold border-r w-16">Bobot</th>
                    <th className="px-3 py-2.5 text-center font-semibold border-r w-16">Polarity</th>
                    <th className="px-3 py-2.5 text-center font-semibold border-r w-12">Cap</th>
                    <th className="px-3 py-2.5 text-center font-semibold border-r w-16">Target</th>
                    <th className="px-3 py-2.5 text-center font-semibold border-r w-16">Keterangan</th>
                    <th className="px-3 py-2.5 text-center font-semibold border-r w-20 bg-primary/5">Realisasi</th>
                    <th className="px-3 py-2.5 text-center font-semibold border-r w-16 bg-primary/5">Skor</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r min-w-[200px]">Cara Pengukuran</th>
                    <th className="px-3 py-2.5 text-center font-semibold border-r w-20">Data</th>
                    <th className="px-3 py-2.5 text-center font-semibold w-10">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, index) => {
                    const realisasiClass = getRealisasiBadgeClass(row.realisasi, row.target);
                    const bscClass = getBscBadgeClass(row.perspektif_bsc);
                    const isAboveTarget = row.realisasi !== null && row.realisasi >= row.target;
                    return (
                      <tr
                        key={row.id}
                        className={`border-b transition-colors hover:bg-muted/30 ${index % 2 === 0 ? "bg-background" : "bg-muted/10"}`}
                      >
                        {/* # */}
                        <td className="px-3 py-3 text-center font-medium border-r text-muted-foreground">{row.no}</td>

                        {/* Perspektif BSC */}
                        <td className="px-3 py-3 border-r">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-medium leading-tight whitespace-nowrap ${bscClass}`}
                          >
                            {row.perspektif_bsc}
                          </Badge>
                        </td>

                        {/* Tujuan Strategi */}
                        <td className="px-3 py-3 border-r text-muted-foreground leading-relaxed">
                          {row.tujuan_strategi}
                        </td>

                        {/* Area Kinerja Utama */}
                        <td className="px-3 py-3 border-r font-medium">{row.area_kinerja_utama}</td>

                        {/* KPI */}
                        <td className="px-3 py-3 border-r font-medium text-foreground leading-relaxed">{row.kpi}</td>

                        {/* Bobot */}
                        <td className="px-3 py-3 text-center border-r font-semibold">{row.bobot}%</td>

                        {/* Polarity */}
                        <td className="px-3 py-3 text-center border-r">
                          <span className={`inline-flex items-center gap-0.5 font-medium ${row.polarity === "Max" ? "text-emerald-600" : "text-rose-600"}`}>
                            {row.polarity === "Max"
                              ? <TrendingUp className="h-3 w-3" />
                              : <TrendingDown className="h-3 w-3" />}
                            {row.polarity}
                          </span>
                        </td>

                        {/* Cap */}
                        <td className="px-3 py-3 text-center border-r text-muted-foreground">{row.cap}%</td>

                        {/* Target */}
                        <td className="px-3 py-3 text-center border-r font-semibold text-primary">{row.target}%</td>

                        {/* Keterangan */}
                        <td className="px-3 py-3 text-center border-r text-muted-foreground text-[11px]">{row.keterangan}</td>

                        {/* Realisasi */}
                        <td className="px-3 py-3 text-center border-r bg-primary/5">
                          {row.realisasi !== null ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className={`font-bold text-sm ${isAboveTarget ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                {row.realisasi}%
                              </span>
                              {/* Progress bar */}
                              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${isAboveTarget ? "bg-emerald-500" : "bg-rose-500"}`}
                                  style={{ width: `${Math.min(100, row.realisasi)}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/50 text-[10px]">—</span>
                          )}
                        </td>

                        {/* Skor */}
                        <td className="px-3 py-3 text-center border-r bg-primary/5">
                          {row.skor !== null ? (
                            <span className="font-semibold text-primary">{row.skor.toFixed(2)}</span>
                          ) : (
                            <span className="text-muted-foreground/50 text-[10px]">—</span>
                          )}
                        </td>

                        {/* Cara Pengukuran */}
                        <td className="px-3 py-3 border-r text-muted-foreground leading-relaxed text-[11px]">
                          {row.cara_pengukuran}
                        </td>

                        {/* Data Source */}
                        <td className="px-3 py-3 text-center border-r">
                          <Badge
                            variant="outline"
                            className={`text-[9px] font-medium leading-tight ${DATA_SOURCE_COLORS[row.data_source] || "bg-muted/50"}`}
                          >
                            {row.data_source}
                          </Badge>
                        </td>

                        {/* Note */}
                        <td className="px-3 py-3 text-center text-muted-foreground text-[11px] font-medium">{row.note}</td>
                      </tr>
                    );
                  })}

                  {/* TOTAL ROW */}
                  <tr className="border-t-2 border-primary/20 bg-primary/5 font-semibold">
                    <td colSpan={5} className="px-3 py-3 border-r text-right text-sm font-bold uppercase tracking-wide text-foreground">
                      Total Bobot & Nilai Akhir
                    </td>
                    <td className="px-3 py-3 text-center border-r font-bold text-foreground">
                      {data.total_bobot}%
                    </td>
                    <td colSpan={5} className="px-3 py-3 border-r" />
                    <td className="px-3 py-3 text-center border-r bg-primary/10">
                      <span className={`text-base font-bold ${scoreCategory.color}`}>
                        {data.total_nilai_akhir.toFixed(2)}%
                      </span>
                    </td>
                    <td colSpan={4} />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ——— INDIKATOR PENILAIAN ——— */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {/* Legend scoring */}
            <div className="rounded-xl border bg-card p-4 shadow-xs">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Indikator Penilaian</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { range: "Nilai ≥ 90", label: "Baik Sekali", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
                  { range: "75 ≤ Nilai < 90", label: "Baik", color: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30" },
                  { range: "60 ≤ Nilai < 75", label: "Cukup", color: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" },
                  { range: "40 ≤ Nilai < 60", label: "Kurang", color: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30" },
                  { range: "Nilai < 40", label: "Sangat Kurang", color: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30" },
                ].map((item) => (
                  <div key={item.label} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${item.color}`}>
                    <span className="text-xs font-medium">{item.range}</span>
                    <Badge variant="outline" className={`text-[10px] border ${item.color}`}>{item.label}</Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Hasil penilaian */}
            <div className="rounded-xl border bg-card p-4 shadow-xs">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Hasil Penilaian Periode</div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Periode</span>
                  <span className="text-sm font-semibold">{formatMonthPeriod(selectedMonth)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Nilai KPI</span>
                  <span className={`text-xl font-bold ${scoreCategory.color}`}>{totalScore.toFixed(2)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Kategori Penilaian</span>
                  <Badge variant="outline" className={`font-semibold text-sm px-3 py-1 border ${scoreCategory.bg} ${scoreCategory.color}`}>
                    {scoreCategory.label}
                  </Badge>
                </div>
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                  <div className="w-full h-4 bg-muted/40 rounded-full overflow-hidden border">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        totalScore >= 90 ? "bg-gradient-to-r from-emerald-400 to-emerald-500" :
                        totalScore >= 75 ? "bg-gradient-to-r from-blue-400 to-blue-500" :
                        totalScore >= 60 ? "bg-gradient-to-r from-amber-400 to-amber-500" :
                        totalScore >= 40 ? "bg-gradient-to-r from-orange-400 to-orange-500" :
                        "bg-gradient-to-r from-rose-400 to-rose-500"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, totalScore))}%` }}
                    />
                  </div>
                </div>

                {/* Copas / Catatan */}
                <div className="mt-2 flex flex-col gap-1">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Skor = min(Realisasi / Target, Cap) × Bobot
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ——— DATA SOURCE LEGEND ——— */}
          <div className="rounded-xl border bg-card p-4 shadow-xs">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Sumber Data</div>
            <div className="flex flex-wrap gap-3 text-xs">
              {Object.entries(DATA_SOURCE_COLORS).map(([source, cls]) => (
                <Badge key={source} variant="outline" className={`${cls} text-xs`}>
                  {source}
                </Badge>
              ))}
              <span className="text-muted-foreground self-center">
                — Data diambil secara real-time dari database sistem
              </span>
            </div>
          </div>
        </>
      )}

      {!loading && !data && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <AlertTriangle className="h-10 w-10 text-amber-500/60" />
          <p className="text-sm text-muted-foreground">Tidak ada data KPI untuk periode ini.</p>
          <Button variant="outline" size="sm" onClick={() => fetchData()}>
            Coba Lagi
          </Button>
        </div>
      )}
    </Content>
  );
}
