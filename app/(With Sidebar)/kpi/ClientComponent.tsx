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
  Pencil,
  Trash2,
  Plus,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
  skor_akhir: number | null;
  nilai_akhir: number | null;
  cara_pengukuran: string;
  divisi: string;
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
  // ACTION MODALS STATE
  // ——————————————————————————————
  const [detailRow, setDetailRow] = useState<KpiRow | null>(null);
  const [editingRow, setEditingRow] = useState<KpiRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KpiRow | null>(null);
  const [isCustomized, setIsCustomized] = useState(false);

  // Form State for Edit Modal
  const [formData, setFormData] = useState<Omit<KpiRow, "id" | "no" | "skor" | "skor_akhir" | "nilai_akhir" | "raw">>({
    perspektif_bsc: "Learning & Growth",
    strategy: "",
    tujuan_strategi: "",
    area_kinerja_utama: "",
    kpi: "",
    bobot: 15,
    polarity: "Max",
    cap: 100,
    target: 100,
    keterangan: "Persentase",
    realisasi: 100,
    cara_pengukuran: "",
    divisi: "Creative",
    data_source: "Daily Activity",
    note: "A1",
  });

  const getStorageKey = useCallback((period: string) => `kpi_custom_rows_v3_${period}`, []);

  const calculateRowScore = (
    realisasi: number | null,
    target: number,
    cap: number,
    bobot: number,
    polarity: "Max" | "Min"
  ): { skor: number | null; skor_akhir: number | null } => {
    if (realisasi === null) return { skor: null, skor_akhir: null };
    let ratio = 0;
    if (polarity === "Max") {
      ratio = target > 0 ? (realisasi / target) * 100 : 0;
    } else {
      ratio = realisasi > 0 ? (target / realisasi) * 100 : cap;
    }
    const skor = Math.round(Math.min(ratio, cap) * 100) / 100;
    const skor_akhir = Math.round((skor / 100) * bobot * 100) / 100;
    return { skor, skor_akhir };
  };

  // ——————————————————————————————
  // FETCH KPI DATA & APPLY CUSTOM
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

      // Check if user has customized rows in localStorage for this period
      const storageKey = `kpi_custom_rows_v3_${selectedMonth}`;
      const saved = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
      if (saved) {
        try {
          const customRows: KpiRow[] = JSON.parse(saved);
          if (Array.isArray(customRows) && customRows.length > 0) {
            const total_bobot = customRows.reduce((sum, r) => sum + (Number(r.bobot) || 0), 0);
            const total_nilai_akhir = customRows.reduce((sum, r) => sum + (Number(r.skor_akhir ?? r.skor) || 0), 0);
            setData({
              ...json,
              rows: customRows,
              total_bobot,
              total_nilai_akhir,
            });
            setIsCustomized(true);
            return;
          }
        } catch (e) {
          console.error("Failed to parse custom KPI rows", e);
        }
      }

      setData(json);
      setIsCustomized(false);
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

  // Open Edit Form
  const handleOpenEdit = (row: KpiRow) => {
    setEditingRow(row);
    setFormData({
      perspektif_bsc: row.perspektif_bsc,
      strategy: row.strategy || "",
      tujuan_strategi: row.tujuan_strategi || "",
      area_kinerja_utama: row.area_kinerja_utama || "",
      kpi: row.kpi,
      bobot: row.bobot,
      polarity: row.polarity,
      cap: row.cap,
      target: row.target,
      keterangan: row.keterangan || "Persentase",
      realisasi: row.realisasi !== null ? row.realisasi : row.target,
      cara_pengukuran: row.cara_pengukuran || "",
      divisi: row.divisi || "Creative",
      data_source: row.data_source || "Manual",
      note: row.note || "",
    });
  };

  // Save Edit Form
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !editingRow) return;

    const { skor: newScore, skor_akhir: newSkorAkhir } = calculateRowScore(
      formData.realisasi,
      formData.target,
      formData.cap,
      formData.bobot,
      formData.polarity
    );

    const updatedRows = data.rows.map((r) => {
      if (r.id === editingRow.id) {
        return {
          ...r,
          ...formData,
          skor: newScore,
          skor_akhir: newSkorAkhir,
          nilai_akhir: newSkorAkhir,
        };
      }
      return r;
    });

    const total_bobot = updatedRows.reduce((sum, r) => sum + (Number(r.bobot) || 0), 0);
    const total_nilai_akhir = updatedRows.reduce((sum, r) => sum + (Number(r.skor_akhir ?? r.skor) || 0), 0);

    const updatedData: KpiApiResponse = {
      ...data,
      rows: updatedRows,
      total_bobot,
      total_nilai_akhir,
    };

    setData(updatedData);
    if (typeof window !== "undefined") {
      localStorage.setItem(`kpi_custom_rows_v3_${selectedMonth}`, JSON.stringify(updatedRows));
    }
    setIsCustomized(true);
    setEditingRow(null);
    toast.success("Indikator KPI berhasil diperbarui.");
  };

  // Confirm Delete KPI Row
  const handleConfirmDelete = () => {
    if (!data || !deleteTarget) return;

    const updatedRows = data.rows
      .filter((r) => r.id !== deleteTarget.id)
      .map((r, idx) => ({ ...r, no: idx + 1 }));

    const total_bobot = updatedRows.reduce((sum, r) => sum + (Number(r.bobot) || 0), 0);
    const total_nilai_akhir = updatedRows.reduce((sum, r) => sum + (Number(r.skor_akhir ?? r.skor) || 0), 0);

    const updatedData: KpiApiResponse = {
      ...data,
      rows: updatedRows,
      total_bobot,
      total_nilai_akhir,
    };

    setData(updatedData);
    if (typeof window !== "undefined") {
      localStorage.setItem(`kpi_custom_rows_v3_${selectedMonth}`, JSON.stringify(updatedRows));
    }
    setIsCustomized(true);
    setDeleteTarget(null);
    toast.success("Indikator KPI berhasil dihapus.");
  };


  // Reset to Default Calculation
  const handleResetDefault = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(`kpi_custom_rows_v3_${selectedMonth}`);
    }
    setIsCustomized(false);
    toast.info("Mengembalikan KPI ke kalkulasi default sistem...");
    await fetchData(true);
    toast.success("KPI berhasil dikembalikan ke kalkulasi default.");
  };

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
        "Perspective BSC": row.perspektif_bsc,
        "Strategy": row.strategy,
        "Tujuan Strategi": row.tujuan_strategi,
        "Area Kinerja Utama": row.area_kinerja_utama,
        "Key Performance Indicators": row.kpi,
        "Bobot": `${row.bobot}%`,
        "Polarity": row.polarity,
        "Cap": `${row.cap}%`,
        "Target": `${row.target}%`,
        "Keterangan": row.keterangan,
        "Realisasi": row.realisasi !== null ? `${row.realisasi}%` : "-",
        "Skor": row.skor !== null ? row.skor.toFixed(2) : "-",
        "Skor Akhir": row.skor_akhir !== null ? `${row.skor_akhir.toFixed(2)}%` : "-",
        "Cara Pengukuran": row.cara_pengukuran,
        "Divisi": row.divisi || "Creative",
      }));

      // Add total row
      kpiRows.push({
        "No": "" as any,
        "Perspective BSC": "",
        "Strategy": "",
        "Tujuan Strategi": "",
        "Area Kinerja Utama": "",
        "Key Performance Indicators": "TOTAL BOBOT & NILAI AKHIR",
        "Bobot": `${data.total_bobot}%`,
        "Polarity": "" as any,
        "Cap": "" as any,
        "Target": "" as any,
        "Keterangan": "",
        "Realisasi": "" as any,
        "Skor": "" as any,
        "Skor Akhir": `${data.total_nilai_akhir.toFixed(2)}%`,
        "Cara Pengukuran": "",
        "Divisi": "",
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
          {isCustomized && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetDefault}
              className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
              title="Kembalikan tabel ke kalkulasi default sistem"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reset Default</span>
            </Button>
          )}
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
              <table className="w-full text-xs border-collapse min-w-[1600px]">
                <thead>
                  <tr className="bg-[#ea580c] text-white border-b border-orange-700 shadow-xs">
                    <th className="px-2.5 py-3 text-center font-bold border-r border-orange-600/70 w-12 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <span>No</span>
                        <span className="text-[10px] opacity-80">▾</span>
                      </div>
                    </th>
                    <th className="px-3 py-3 text-left font-bold border-r border-orange-600/70 min-w-[140px] whitespace-nowrap">
                      <div className="flex items-center justify-between gap-1">
                        <span>Perspective BSC</span>
                        <span className="text-[10px] opacity-80">▾</span>
                      </div>
                    </th>
                    <th className="px-3 py-3 text-left font-bold border-r border-orange-600/70 min-w-[180px] whitespace-nowrap">
                      <div className="flex items-center justify-between gap-1">
                        <span>Strategy</span>
                        <span className="text-[10px] opacity-80">▾</span>
                      </div>
                    </th>
                    <th className="px-3 py-3 text-left font-bold border-r border-orange-600/70 min-w-[180px] whitespace-nowrap">
                      <div className="flex items-center justify-between gap-1">
                        <span>Tujuan Strategi</span>
                        <span className="text-[10px] opacity-80">▾</span>
                      </div>
                    </th>
                    <th className="px-3 py-3 text-left font-bold border-r border-orange-600/70 min-w-[120px] whitespace-nowrap">
                      <div className="flex items-center justify-between gap-1">
                        <span>Area Kinerja Utama</span>
                        <span className="text-[10px] opacity-80">▾</span>
                      </div>
                    </th>
                    <th className="px-3 py-3 text-left font-bold border-r border-orange-600/70 min-w-[220px] whitespace-nowrap">
                      <div className="flex items-center justify-between gap-1">
                        <span>Key Performance Indicators</span>
                        <span className="text-[10px] opacity-80">▾</span>
                      </div>
                    </th>
                    <th className="px-2 py-3 text-center font-bold border-r border-orange-600/70 w-16 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <span>Bobot</span>
                        <span className="text-[10px] opacity-80">▾</span>
                      </div>
                    </th>
                    <th className="px-2 py-3 text-center font-bold border-r border-orange-600/70 w-16 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <span>Polarity</span>
                        <span className="text-[10px] opacity-80">▾</span>
                      </div>
                    </th>
                    <th className="px-2 py-3 text-center font-bold border-r border-orange-600/70 w-14 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <span>Cap</span>
                        <span className="text-[10px] opacity-80">▾</span>
                      </div>
                    </th>
                    <th className="px-2 py-3 text-center font-bold border-r border-orange-600/70 w-16 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <span>Target</span>
                        <span className="text-[10px] opacity-80">▾</span>
                      </div>
                    </th>
                    <th className="px-2.5 py-3 text-center font-bold border-r border-orange-600/70 w-24 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <span>Keterangan</span>
                        <span className="text-[10px] opacity-80">▾</span>
                      </div>
                    </th>
                    <th className="px-3 py-3 text-center font-bold border-r border-orange-600/70 w-24 whitespace-nowrap bg-orange-700/80">
                      <div className="flex items-center justify-center gap-1">
                        <span>Realisasi</span>
                        <span className="text-[10px] opacity-80">▾</span>
                      </div>
                    </th>
                    <th className="px-3 py-3 text-center font-bold border-r border-orange-600/70 w-20 whitespace-nowrap bg-orange-700/80">
                      <div className="flex items-center justify-center gap-1">
                        <span>Skor</span>
                        <span className="text-[10px] opacity-80">▾</span>
                      </div>
                    </th>
                    <th className="px-3 py-3 text-center font-bold border-r border-orange-600/70 w-24 whitespace-nowrap bg-orange-800/90">
                      <div className="flex items-center justify-center gap-1">
                        <span>Skor Akhir</span>
                        <span className="text-[10px] opacity-80">▾</span>
                      </div>
                    </th>
                    <th className="px-3 py-3 text-left font-bold border-r border-orange-600/70 min-w-[220px] whitespace-nowrap">
                      <div className="flex items-center justify-between gap-1">
                        <span>Cara Pengukuran</span>
                        <span className="text-[10px] opacity-80">▾</span>
                      </div>
                    </th>
                    <th className="px-3 py-3 text-center font-bold border-r border-orange-600/70 w-24 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <span>Divisi</span>
                        <span className="text-[10px] opacity-80">▾</span>
                      </div>
                    </th>
                    <th className="px-3 py-3 text-center font-bold w-44 whitespace-nowrap">
                      <span>Aksi</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, index) => {
                    const bscClass = getBscBadgeClass(row.perspektif_bsc);
                    const isAboveTarget = row.realisasi !== null && row.realisasi >= row.target;
                    return (
                      <tr
                        key={row.id}
                        className={`border-b transition-colors hover:bg-muted/30 ${index % 2 === 0 ? "bg-background" : "bg-muted/10"}`}
                      >
                        {/* 1. No */}
                        <td className="px-2.5 py-3 text-center font-medium border-r text-muted-foreground">{row.no}</td>

                        {/* 2. Perspective BSC */}
                        <td className="px-3 py-3 border-r">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-medium leading-tight whitespace-nowrap ${bscClass}`}
                          >
                            {row.perspektif_bsc}
                          </Badge>
                        </td>

                        {/* 3. Strategy */}
                        <td className="px-3 py-3 border-r text-muted-foreground leading-relaxed">
                          {row.strategy || "—"}
                        </td>

                        {/* 4. Tujuan Strategi */}
                        <td className="px-3 py-3 border-r text-muted-foreground leading-relaxed">
                          {row.tujuan_strategi}
                        </td>

                        {/* 5. Area Kinerja Utama */}
                        <td className="px-3 py-3 border-r font-medium">{row.area_kinerja_utama}</td>

                        {/* 6. Key Performance Indicators */}
                        <td className="px-3 py-3 border-r font-medium text-foreground leading-relaxed">{row.kpi}</td>

                        {/* 7. Bobot */}
                        <td className="px-2 py-3 text-center border-r font-semibold">{row.bobot}%</td>

                        {/* 8. Polarity */}
                        <td className="px-2 py-3 text-center border-r">
                          <span className={`inline-flex items-center gap-0.5 font-medium ${row.polarity === "Max" ? "text-emerald-600" : "text-rose-600"}`}>
                            {row.polarity === "Max"
                              ? <TrendingUp className="h-3 w-3" />
                              : <TrendingDown className="h-3 w-3" />}
                            {row.polarity}
                          </span>
                        </td>

                        {/* 9. Cap */}
                        <td className="px-2 py-3 text-center border-r text-muted-foreground">{row.cap}%</td>

                        {/* 10. Target */}
                        <td className="px-2 py-3 text-center border-r font-semibold text-primary">{row.target}%</td>

                        {/* 11. Keterangan */}
                        <td className="px-2.5 py-3 text-center border-r text-muted-foreground text-[11px]">{row.keterangan}</td>

                        {/* 12. Realisasi */}
                        <td className="px-3 py-3 text-center border-r bg-primary/5">
                          {row.realisasi !== null ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className={`font-bold text-sm ${isAboveTarget ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                {row.realisasi}%
                              </span>
                              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${isAboveTarget ? "bg-emerald-500" : "bg-rose-500"}`}
                                  style={{ width: `${Math.min(100, (row.realisasi / row.target) * 100)}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/50 text-[10px]">—</span>
                          )}
                        </td>

                        {/* 13. Skor */}
                        <td className="px-3 py-3 text-center border-r bg-primary/5">
                          {row.skor !== null ? (
                            <span className="font-semibold text-foreground">{row.skor.toFixed(1)}</span>
                          ) : (
                            <span className="text-muted-foreground/50 text-[10px]">—</span>
                          )}
                        </td>

                        {/* 14. Skor Akhir */}
                        <td className="px-3 py-3 text-center border-r bg-primary/10">
                          {row.skor_akhir !== null ? (
                            <span className="font-bold text-sm text-primary">{row.skor_akhir.toFixed(2)}%</span>
                          ) : (
                            <span className="text-muted-foreground/50 text-[10px]">—</span>
                          )}
                        </td>

                        {/* 15. Cara Pengukuran */}
                        <td className="px-3 py-3 border-r text-muted-foreground leading-relaxed text-[11px]">
                          {row.cara_pengukuran}
                        </td>

                        {/* 16. Divisi */}
                        <td className="px-3 py-3 text-center border-r">
                          <Badge variant="secondary" className="text-[10px] font-medium whitespace-nowrap">
                            {row.divisi || "Creative"}
                          </Badge>
                        </td>

                        {/* 17. Aksi: 1. Detail, 2. Edit, 3. Delete */}
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2.5 text-xs font-medium hover:bg-primary/10 hover:text-primary transition-colors"
                              onClick={() => setDetailRow(row)}
                              title="Lihat Rincian KPI"
                            >
                              Detail
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2.5 text-xs font-medium text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 transition-colors"
                              onClick={() => handleOpenEdit(row)}
                              title="Edit Nilai & Parameter KPI"
                            >
                              <Pencil className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2.5 text-xs font-medium text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/10 transition-colors"
                              onClick={() => setDeleteTarget(row)}
                              title="Hapus Indikator KPI"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {/* TOTAL ROW */}
                  <tr className="border-t-2 border-orange-500 bg-primary/5 font-semibold">
                    <td colSpan={6} className="px-3 py-3 border-r text-right text-sm font-bold uppercase tracking-wide text-foreground">
                      Total Bobot & Nilai Akhir
                    </td>
                    <td className="px-3 py-3 text-center border-r font-bold text-foreground">
                      {data.total_bobot}%
                    </td>
                    <td colSpan={6} className="px-3 py-3 border-r" />
                    <td className="px-3 py-3 text-center border-r bg-primary/15">
                      <span className={`text-base font-bold ${scoreCategory.color}`}>
                        {data.total_nilai_akhir.toFixed(2)}%
                      </span>
                    </td>
                    <td colSpan={3} />
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

      {/* ================================================================= */}
      {/* 1. DETAIL MODAL                                                    */}
      {/* ================================================================= */}
      <Dialog open={!!detailRow} onOpenChange={(open) => !open && setDetailRow(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailRow && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    KPI #{detailRow.no}
                  </span>
                  <Badge variant="outline" className={`text-xs ${getBscBadgeClass(detailRow.perspektif_bsc)}`}>
                    {detailRow.perspektif_bsc}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {detailRow.divisi || "Creative"}
                  </Badge>
                  <Badge variant="outline" className={`text-xs ${DATA_SOURCE_COLORS[detailRow.data_source] || "bg-muted/50"}`}>
                    {detailRow.data_source}
                  </Badge>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border ${
                    detailRow.polarity === "Max" ? "text-emerald-600 border-emerald-300" : "text-rose-600 border-rose-300"
                  }`}>
                    {detailRow.polarity === "Max" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    Polarity: {detailRow.polarity}
                  </span>
                </div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  {detailRow.kpi}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Area: {detailRow.area_kinerja_utama} • Target: {detailRow.target}% ({detailRow.keterangan})
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-3 text-sm">
                {/* Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border bg-muted/30 p-3 text-center">
                    <div className="text-[11px] font-medium text-muted-foreground uppercase">Bobot</div>
                    <div className="text-lg font-bold text-foreground mt-0.5">{detailRow.bobot}%</div>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3 text-center">
                    <div className="text-[11px] font-medium text-muted-foreground uppercase">Target</div>
                    <div className="text-lg font-bold text-primary mt-0.5">{detailRow.target}%</div>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3 text-center">
                    <div className="text-[11px] font-medium text-muted-foreground uppercase">Cap Maksimal</div>
                    <div className="text-lg font-bold text-muted-foreground mt-0.5">{detailRow.cap}%</div>
                  </div>
                  <div className="rounded-lg border bg-primary/5 border-primary/20 p-3 text-center">
                    <div className="text-[11px] font-medium text-muted-foreground uppercase">Realisasi</div>
                    <div className={`text-lg font-bold mt-0.5 ${
                      detailRow.realisasi !== null && detailRow.realisasi >= detailRow.target
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}>
                      {detailRow.realisasi !== null ? `${detailRow.realisasi}%` : "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-primary/5 border-primary/20 p-3 text-center">
                    <div className="text-[11px] font-medium text-muted-foreground uppercase">Skor Capaian</div>
                    <div className="text-lg font-bold text-foreground mt-0.5">
                      {detailRow.skor !== null ? detailRow.skor.toFixed(1) : "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-primary/10 border-primary/30 p-3 text-center">
                    <div className="text-[11px] font-medium text-muted-foreground uppercase">Skor Akhir</div>
                    <div className="text-lg font-bold text-primary mt-0.5">
                      {detailRow.skor_akhir !== null ? `${detailRow.skor_akhir.toFixed(2)}%` : "—"}
                    </div>
                  </div>
                </div>

                {/* Realisasi Progress Bar */}
                {detailRow.realisasi !== null && (
                  <div className="space-y-1.5 p-3 rounded-lg border bg-card">
                    <div className="flex justify-between text-xs font-medium">
                      <span>Capaian Terhadap Target</span>
                      <span className={detailRow.realisasi >= detailRow.target ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                        {detailRow.realisasi}% / {detailRow.target}%
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          detailRow.realisasi >= detailRow.target ? "bg-emerald-500" : "bg-rose-500"
                        }`}
                        style={{ width: `${Math.min(100, (detailRow.realisasi / detailRow.target) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Strategy */}
                <div className="space-y-1.5 p-3 rounded-lg border bg-card">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Strategy
                  </div>
                  <p className="text-foreground leading-relaxed">
                    {detailRow.strategy || "—"}
                  </p>
                </div>

                {/* Tujuan Strategi */}
                <div className="space-y-1.5 p-3 rounded-lg border bg-card">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Tujuan Strategi
                  </div>
                  <p className="text-foreground leading-relaxed">
                    {detailRow.tujuan_strategi || "—"}
                  </p>
                </div>

                {/* Cara Pengukuran */}
                <div className="space-y-1.5 p-3 rounded-lg border bg-card">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Cara Pengukuran / Formula
                  </div>
                  <p className="text-foreground text-xs leading-relaxed font-mono bg-muted/40 p-2.5 rounded border">
                    {detailRow.cara_pengukuran}
                  </p>
                </div>

                {/* Raw Database Metadata if present */}
                {detailRow.raw && Object.keys(detailRow.raw).length > 0 && (
                  <div className="space-y-2 p-3 rounded-lg border bg-muted/20">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Data Metrik Mentah (Database Query)
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      {Object.entries(detailRow.raw).map(([key, val]) => (
                        <div key={key} className="p-2 rounded bg-card border">
                          <div className="text-muted-foreground text-[10px] capitalize">
                            {key.replace(/_/g, " ")}
                          </div>
                          <div className="font-semibold text-foreground mt-0.5">
                            {typeof val === "object" ? JSON.stringify(val) : String(val)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailRow(null)}>
                  Tutup
                </Button>
                <Button
                  onClick={() => {
                    const rowToEdit = detailRow;
                    setDetailRow(null);
                    handleOpenEdit(rowToEdit);
                  }}
                  className="gap-1.5"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit KPI Ini
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ================================================================= */}
      {/* 2. EDIT MODAL                                                     */}
      {/* ================================================================= */}
      <Dialog open={!!editingRow} onOpenChange={(open) => !open && setEditingRow(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              <span>Edit Indikator KPI</span>
            </DialogTitle>
            <DialogDescription>
              Perbarui target, realisasi, atau parameter bobot KPI. Skor akan otomatis dihitung ulang.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Perspektif BSC */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-bsc" className="text-xs">Perspektif BSC</Label>
                <Select
                  value={formData.perspektif_bsc}
                  onValueChange={(val) => setFormData((prev) => ({ ...prev, perspektif_bsc: val }))}
                >
                  <SelectTrigger id="edit-bsc" className="h-9">
                    <SelectValue placeholder="Pilih BSC" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Learning & Growth">Learning & Growth</SelectItem>
                    <SelectItem value="Internal Business Process">Internal Business Process</SelectItem>
                    <SelectItem value="Customer / Stakeholder">Customer / Stakeholder</SelectItem>
                    <SelectItem value="Financial">Financial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Divisi */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-divisi" className="text-xs">Divisi</Label>
                <Input
                  id="edit-divisi"
                  value={formData.divisi}
                  onChange={(e) => setFormData((prev) => ({ ...prev, divisi: e.target.value }))}
                  className="h-9"
                  placeholder="Creative"
                  required
                />
              </div>

              {/* Data Source */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-source" className="text-xs">Sumber Data</Label>
                <Select
                  value={formData.data_source}
                  onValueChange={(val) => setFormData((prev) => ({ ...prev, data_source: val }))}
                >
                  <SelectTrigger id="edit-source" className="h-9">
                    <SelectValue placeholder="Sumber Data" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Permintaan Desain">Permintaan Desain</SelectItem>
                    <SelectItem value="Daily Activity">Daily Activity</SelectItem>
                    <SelectItem value="Attendance">Attendance</SelectItem>
                    <SelectItem value="STB HSE">STB HSE</SelectItem>
                    <SelectItem value="Manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Area Kinerja Utama */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-area" className="text-xs">Area Kinerja Utama</Label>
              <Input
                id="edit-area"
                value={formData.area_kinerja_utama}
                onChange={(e) => setFormData((prev) => ({ ...prev, area_kinerja_utama: e.target.value }))}
                className="h-9"
                required
              />
            </div>

            {/* Nama KPI */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-kpi" className="text-xs">Nama Indikator KPI</Label>
              <Textarea
                id="edit-kpi"
                value={formData.kpi}
                onChange={(e) => setFormData((prev) => ({ ...prev, kpi: e.target.value }))}
                rows={2}
                className="resize-none text-xs"
                required
              />
            </div>

            {/* Strategy */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-strategy" className="text-xs">Strategy</Label>
              <Textarea
                id="edit-strategy"
                value={formData.strategy}
                onChange={(e) => setFormData((prev) => ({ ...prev, strategy: e.target.value }))}
                rows={2}
                className="resize-none text-xs"
              />
            </div>

            {/* Tujuan Strategi */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-tujuan" className="text-xs">Tujuan Strategi</Label>
              <Textarea
                id="edit-tujuan"
                value={formData.tujuan_strategi}
                onChange={(e) => setFormData((prev) => ({ ...prev, tujuan_strategi: e.target.value }))}
                rows={2}
                className="resize-none text-xs"
              />
            </div>

            {/* Metrik Angka: Bobot, Target, Realisasi, Cap */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/20 p-3 rounded-lg border">
              {/* Bobot */}
              <div className="space-y-1">
                <Label htmlFor="edit-bobot" className="text-xs font-semibold">Bobot (%)</Label>
                <Input
                  id="edit-bobot"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.bobot}
                  onChange={(e) => setFormData((prev) => ({ ...prev, bobot: parseFloat(e.target.value) || 0 }))}
                  className="h-8"
                  required
                />
              </div>

              {/* Target */}
              <div className="space-y-1">
                <Label htmlFor="edit-target" className="text-xs font-semibold">Target (%)</Label>
                <Input
                  id="edit-target"
                  type="number"
                  step="0.1"
                  value={formData.target}
                  onChange={(e) => setFormData((prev) => ({ ...prev, target: parseFloat(e.target.value) || 0 }))}
                  className="h-8"
                  required
                />
              </div>

              {/* Realisasi */}
              <div className="space-y-1">
                <Label htmlFor="edit-realisasi" className="text-xs font-semibold text-primary">Realisasi (%)</Label>
                <Input
                  id="edit-realisasi"
                  type="number"
                  step="0.01"
                  value={formData.realisasi !== null ? formData.realisasi : ""}
                  onChange={(e) => setFormData((prev) => ({
                    ...prev,
                    realisasi: e.target.value === "" ? null : parseFloat(e.target.value),
                  }))}
                  className="h-8 font-bold"
                  placeholder="0"
                />
              </div>

              {/* Cap */}
              <div className="space-y-1">
                <Label htmlFor="edit-cap" className="text-xs font-semibold">Cap (%)</Label>
                <Input
                  id="edit-cap"
                  type="number"
                  step="1"
                  min="50"
                  max="200"
                  value={formData.cap}
                  onChange={(e) => setFormData((prev) => ({ ...prev, cap: parseFloat(e.target.value) || 100 }))}
                  className="h-8"
                  required
                />
              </div>
            </div>

            {/* Polarity, Satuan/Keterangan, Note */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Polarity */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-polarity" className="text-xs">Polarity</Label>
                <Select
                  value={formData.polarity}
                  onValueChange={(val: "Max" | "Min") => setFormData((prev) => ({ ...prev, polarity: val }))}
                >
                  <SelectTrigger id="edit-polarity" className="h-9">
                    <SelectValue placeholder="Pilih Polarity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Max">Max (Semakin tinggi semakin baik)</SelectItem>
                    <SelectItem value="Min">Min (Semakin rendah semakin baik)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Keterangan */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-keterangan" className="text-xs">Keterangan / Satuan</Label>
                <Input
                  id="edit-keterangan"
                  value={formData.keterangan}
                  onChange={(e) => setFormData((prev) => ({ ...prev, keterangan: e.target.value }))}
                  className="h-9"
                  placeholder="Persentase"
                />
              </div>

              {/* Note */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-note" className="text-xs">Kode / Note</Label>
                <Input
                  id="edit-note"
                  value={formData.note}
                  onChange={(e) => setFormData((prev) => ({ ...prev, note: e.target.value }))}
                  className="h-9"
                  placeholder="A1, B1..."
                />
              </div>
            </div>

            {/* Cara Pengukuran */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-cara" className="text-xs">Cara Pengukuran / Formula</Label>
              <Textarea
                id="edit-cara"
                value={formData.cara_pengukuran}
                onChange={(e) => setFormData((prev) => ({ ...prev, cara_pengukuran: e.target.value }))}
                rows={2}
                className="resize-none text-xs font-mono"
              />
            </div>

            {/* Preview Nilai Terhitung */}
            {(() => {
              const calc = calculateRowScore(
                formData.realisasi,
                formData.target,
                formData.cap,
                formData.bobot,
                formData.polarity
              );
              return (
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Skor Capaian:</span>
                    <span className="font-bold text-foreground">
                      {calc.skor !== null ? `${calc.skor.toFixed(1)}%` : "0%"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Skor Akhir (Tertimbang):</span>
                    <span className="font-bold text-sm text-primary">
                      {calc.skor_akhir !== null ? `${calc.skor_akhir.toFixed(2)}%` : "0.00%"}
                    </span>
                  </div>
                </div>
              );
            })()}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingRow(null)}>
                Batal
              </Button>
              <Button type="submit">
                Simpan Perubahan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================================================================= */}
      {/* 3. DELETE ALERT DIALOG                                            */}
      {/* ================================================================= */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-600">
              <Trash2 className="h-5 w-5" />
              <span>Hapus Indikator KPI</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm">
              <p>
                Apakah Anda yakin ingin menghapus indikator KPI ini dari daftar periode saat ini?
              </p>
              {deleteTarget && (
                <div className="p-2.5 rounded-md bg-muted text-foreground text-xs font-medium border">
                  #{deleteTarget.no} — {deleteTarget.kpi}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Total bobot dan skor akhir akan otomatis dihitung ulang. Anda dapat memulihkan kalkulasi semula kapan saja dengan tombol <strong>Reset Default</strong>.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Content>
  );
}
