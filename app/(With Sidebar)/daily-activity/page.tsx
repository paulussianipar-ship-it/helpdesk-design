"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileUp,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface DailyActivity {
  id: string;
  request_id: string | null;
  activity_date: string;
  name: string;
  task_description: string;
  status: string;
  remarks: string | null;
}

const activityStatuses = [
  "⏳ Waiting (Menunggu)",
  "⚡ In Progress (Dalam Proses)",
  "🔄 Revisi (Revisi Pengerjaan)",
  "⏸️ Pending (Tertunda)",
  "✅ Done (Selesai)",
] as const;

const today = () => new Date().toISOString().slice(0, 10);
const currentMonthPeriod = () => new Date().toISOString().slice(0, 7);

function formatPeriodMonth(period: string): string {
  if (!period || !period.includes("-")) return period || "-";
  const [year, month] = period.split("-");
  const monthNames: Record<string, string> = {
    "01": "Januari",
    "02": "Februari",
    "03": "Maret",
    "04": "April",
    "05": "Mei",
    "06": "Juni",
    "07": "Juli",
    "08": "Agustus",
    "09": "September",
    "10": "Oktober",
    "11": "November",
    "12": "Desember",
  };
  return `${monthNames[month] || month} ${year}`;
}

function getImportErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const value = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };
    const parts = [value.message, value.details, value.hint]
      .filter((part): part is string => typeof part === "string" && part.trim() !== "")
      .map((part) => part.trim());
    if (value.code && typeof value.code === "string") parts.unshift(`Kode ${value.code}`);
    if (parts.length > 0) return parts.join(". ");
  }
  return "Terjadi kesalahan tidak dikenal.";
}

function normalizeActivityDate(value: unknown, monthFirst = false): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y.toString().padStart(4, "0")}-${parsed.m
        .toString()
        .padStart(2, "0")}-${parsed.d.toString().padStart(2, "0")}`;
    }
  }

  const text = String(value ?? "").trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const localMatch = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (localMatch) {
    const [, first, second, year] = localMatch;
    const day = monthFirst ? second : first;
    const month = monthFirst ? first : second;
    const dayNumber = Number(day);
    const monthNumber = Number(month);
    if (dayNumber < 1 || dayNumber > 31 || monthNumber < 1 || monthNumber > 12) {
      return null;
    }
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // Support textual dates like "Mon, 31 Aug 2026" or "31 Aug 2026" or "31 Agustus 2026"
  const monthMap: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", mei: "05",
    jun: "06", jul: "07", aug: "08", agu: "08", sep: "09", okt: "10",
    oct: "10", nov: "11", nop: "11", des: "12", dec: "12",
  };
  const yearMatch = text.match(/\b(20\d{2})\b/);
  const dayMatch = text.match(/\b(\d{1,2})\b/);
  if (yearMatch) {
    for (const [k, v] of Object.entries(monthMap)) {
      const re = new RegExp(`\\b${k}`, "i");
      if (re.test(text)) {
        const day = dayMatch ? dayMatch[1].padStart(2, "0") : "01";
        return `${yearMatch[1]}-${v}-${day}`;
      }
    }
  }

  return null;
}

function normalizeActivityStatus(value: unknown): string {
  const text = String(value ?? "").trim().toLowerCase();
  if (text.includes("done") || text.includes("selesai")) return activityStatuses[4];
  if (text.includes("progress") || text.includes("proses")) return activityStatuses[1];
  if (text.includes("revisi") || text.includes("revision")) return activityStatuses[2];
  if (text.includes("pending") || text.includes("tunda")) return activityStatuses[3];
  return activityStatuses[0];
}

interface ParsedImportRow {
  activity_date: string;
  name: string;
  task_description: string;
  status: string;
  remarks: string | null;
}

export default function DailyActivityPage() {
  const supabase = createClient();
  const [activities, setActivities] = useState<DailyActivity[]>([]);
  const [activityDate, setActivityDate] = useState(today);
  const [name, setName] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [status, setStatus] = useState<string>(activityStatuses[4]);
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Month navigation state (defaults to current month YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthPeriod);

  // Search in table
  const [searchTerm, setSearchTerm] = useState("");

  // Import modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreviewRows, setImportPreviewRows] = useState<ParsedImportRow[]>([]);
  const [targetImportMonth, setTargetImportMonth] = useState<string>(currentMonthPeriod);
  const [importMode, setImportMode] = useState<"replace_month" | "append_month" | "replace_all">("replace_month");
  const [isProcessingImport, setIsProcessingImport] = useState(false);

  const loadActivities = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("daily_activities")
      .select("id, request_id, activity_date, name, task_description, status, remarks")
      .eq("user_id", user.id)
      .order("activity_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Gagal memuat aktivitas: " + error.message);
    } else {
      const items = (data as DailyActivity[]) || [];
      setActivities(items);

      // Jika selectedMonth belum memiliki data dan ada data lain, pilih bulan aktivitas terbaru
      if (items.length > 0 && selectedMonth === currentMonthPeriod()) {
        const hasCurrentMonth = items.some((item) =>
          item.activity_date?.startsWith(currentMonthPeriod())
        );
        if (!hasCurrentMonth && items[0]?.activity_date) {
          setSelectedMonth(items[0].activity_date.slice(0, 7));
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadActivities();
  }, []);

  // List of available months with activity count
  const availableMonths = useMemo(() => {
    const monthCounts = new Map<string, number>();
    activities.forEach((a) => {
      if (a.activity_date) {
        const p = a.activity_date.slice(0, 7);
        monthCounts.set(p, (monthCounts.get(p) || 0) + 1);
      }
    });

    if (selectedMonth !== "all" && !monthCounts.has(selectedMonth)) {
      monthCounts.set(selectedMonth, 0);
    }

    return Array.from(monthCounts.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([period, count]) => ({
        period,
        label: formatPeriodMonth(period),
        count,
      }));
  }, [activities, selectedMonth]);

  // Navigate months (Prev / Next)
  const handleShiftMonth = (direction: -1 | 1) => {
    if (selectedMonth === "all") {
      if (availableMonths.length > 0) setSelectedMonth(availableMonths[0].period);
      return;
    }

    const [yearStr, monthStr] = selectedMonth.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const date = new Date(year, month - 1 + direction, 1);
    const newY = date.getFullYear();
    const newM = String(date.getMonth() + 1).padStart(2, "0");
    const newPeriod = `${newY}-${newM}`;

    setSelectedMonth(newPeriod);

    // Update form activityDate agar berada di dalam bulan baru jika sesuai
    if (!activityDate.startsWith(newPeriod)) {
      setActivityDate(`${newPeriod}-01`);
    }
  };

  // Filter activities based on selectedMonth & searchTerm
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      // Month filter
      if (selectedMonth !== "all" && !act.activity_date?.startsWith(selectedMonth)) {
        return false;
      }

      // Search filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = act.name?.toLowerCase().includes(q);
        const matchTask = act.task_description?.toLowerCase().includes(q);
        const matchStatus = act.status?.toLowerCase().includes(q);
        const matchRemarks = act.remarks?.toLowerCase().includes(q);
        const matchDate = act.activity_date?.toLowerCase().includes(q);
        if (!matchName && !matchTask && !matchStatus && !matchRemarks && !matchDate) {
          return false;
        }
      }

      return true;
    });
  }, [activities, selectedMonth, searchTerm]);

  // Total activities in current month (without search filter)
  const monthTotalActivities = useMemo(() => {
    if (selectedMonth === "all") return activities.length;
    return activities.filter((a) => a.activity_date?.startsWith(selectedMonth)).length;
  }, [activities, selectedMonth]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !taskDescription.trim() || !activityDate) return;

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi berakhir, silakan login kembali.");

      const { error } = await supabase.from("daily_activities").insert({
        user_id: user.id,
        activity_date: activityDate,
        name: name.trim(),
        task_description: taskDescription.trim(),
        title: taskDescription.trim(),
        status: status || activityStatuses[4],
        remarks: remarks.trim() || null,
        description: remarks.trim() || null,
      });
      if (error) throw error;

      // Pastikan selectedMonth cocok dengan bulan dari tanggal yang diinput
      const inputMonth = activityDate.slice(0, 7);
      if (selectedMonth !== "all" && selectedMonth !== inputMonth) {
        setSelectedMonth(inputMonth);
      }

      setTaskDescription("");
      setStatus(activityStatuses[4]);
      setRemarks("");
      toast.success("Daily activity berhasil ditambahkan.");
      await loadActivities();
    } catch (error) {
      toast.error(
        "Gagal menambahkan aktivitas: " +
          (error instanceof Error ? error.message : "Terjadi kesalahan"),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("daily_activities")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Gagal menghapus aktivitas: " + error.message);
      return;
    }
    setActivities((current) => current.filter((activity) => activity.id !== id));
    toast.success("Aktivitas dihapus.");
  };

  const handleExport = () => {
    const rowsToExport = filteredActivities.length > 0 ? filteredActivities : activities;
    const rows = rowsToExport.map((activity) => ({
      activity_date: activity.activity_date,
      Name: activity.name,
      "Task Description": activity.task_description,
      Status: activity.status,
      Remarks: activity.remarks || "",
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    const sheetName = selectedMonth !== "all" ? formatPeriodMonth(selectedMonth) : "Daily Activity";
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const filename = selectedMonth !== "all"
      ? `daily-activity-${selectedMonth}.xlsx`
      : `daily-activity-semua-bulan.xlsx`;

    XLSX.writeFile(workbook, filename);
    toast.success(`Daily activity periode ${selectedMonth !== "all" ? formatPeriodMonth(selectedMonth) : "Semua"} berhasil diekspor.`);
  };

  const handleDownloadTemplate = () => {
    const defaultDate = selectedMonth !== "all" ? `${selectedMonth}-01` : today();
    const rows = [
      {
        activity_date: defaultDate,
        Name: name || "Nama Staff",
        "Task Description": "Mengerjakan desain materi promosi bulanan",
        Status: "✅ Done (Selesai)",
        Remarks: "Selesai tepat waktu",
      },
      {
        activity_date: defaultDate,
        Name: name || "Nama Staff",
        "Task Description": "Revisi layout katalog produk",
        Status: "⚡ In Progress (Dalam Proses)",
        Remarks: "Menunggu aset foto tambahan",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 15 },
      { wch: 25 },
      { wch: 45 },
      { wch: 30 },
      { wch: 30 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template Daily Activity");
    XLSX.writeFile(workbook, "Template_Daily_Activity.xlsx");
    toast.success("Template Excel berhasil diunduh.");
  };

  // Handle Excel file selection & open monthly preview dialog
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImporting(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const normalizeHeader = (value: unknown) =>
        String(value ?? "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();

      const matchingSheet = workbook.SheetNames.map((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const rows = sheet
          ? XLSX.utils.sheet_to_json<unknown[]>(sheet, {
              header: 1,
              defval: "",
              raw: true,
            })
          : [];
        const rowIndex = rows.findIndex((row) => {
          const headers = row.map(normalizeHeader);
          return (
            (headers.includes("name") &&
              headers.includes("task description") &&
              headers.includes("status") &&
              headers.includes("remarks")) ||
            (headers.includes("design") &&
              headers.includes("date") &&
              headers.includes("remarks"))
          );
        });
        return { rows, rowIndex };
      }).find(({ rowIndex }) => rowIndex >= 0);

      if (!matchingSheet) {
        throw new Error(
          "Header tidak ditemukan. Pastikan file memiliki kolom: Name, Task Description, Status, Remarks, dan activity_date.",
        );
      }

      const matrix = matchingSheet.rows;
      const headerIndex = matchingSheet.rowIndex;
      const headers = matrix[headerIndex].map(normalizeHeader);
      const columnIndex = (label: string) => headers.indexOf(label);
      const sourceFormat = headers.includes("design") && headers.includes("date");
      const nameIndex = columnIndex("name");
      const taskIndex = sourceFormat ? columnIndex("design") : columnIndex("task description");
      const statusIndexes = headers.reduce<number[]>(
        (indexes, header, index) => (header === "status" ? [...indexes, index] : indexes),
        [],
      );
      const statusIndex = statusIndexes[0] ?? -1;
      const remarksIndex = columnIndex("remarks");
      const dateIndex = sourceFormat ? columnIndex("date") : columnIndex("activity_date");

      let reportDate: string | null = null;
      if (dateIndex >= 0) {
        reportDate = normalizeActivityDate(matrix[headerIndex][dateIndex]);
      }
      if (!reportDate && !sourceFormat) {
        for (const row of matrix.slice(0, headerIndex)) {
          for (const cell of row) {
            reportDate = normalizeActivityDate(cell);
            if (reportDate) break;
          }
          if (reportDate) break;
        }
      }

      let previousName = "";
      let previousActivityDate: string | null = reportDate;
      const detectedMonthsCount = new Map<string, number>();

      const parsedRows: ParsedImportRow[] = [];

      matrix.slice(headerIndex + 1).forEach((row) => {
        const activityName = sourceFormat
          ? "Tools Creative"
          : String(row[nameIndex] ?? "").trim() || previousName;
        const taskDesc = String(row[taskIndex] ?? "").trim();
        const rawActivityStatus = sourceFormat
          ? statusIndexes
              .map((statusColumn) => String(row[statusColumn] ?? "").trim())
              .find(Boolean)
          : String(row[statusIndex] ?? "").trim();
        const activityStatus = normalizeActivityStatus(rawActivityStatus);
        const activityRemarks = String(row[remarksIndex] ?? "").trim();
        const parsedActivityDate = sourceFormat
          ? normalizeActivityDate(row[dateIndex], true)
          : normalizeActivityDate(row[dateIndex]) || reportDate;
        const finalActivityDate = parsedActivityDate || previousActivityDate || today();

        if (!activityName && !taskDesc && !activityStatus && !activityRemarks) {
          return;
        }
        if (!taskDesc && sourceFormat) {
          return;
        }

        if (activityName && taskDesc) {
          previousName = activityName;
          previousActivityDate = finalActivityDate;

          const pMonth = finalActivityDate.slice(0, 7);
          detectedMonthsCount.set(pMonth, (detectedMonthsCount.get(pMonth) || 0) + 1);

          parsedRows.push({
            activity_date: finalActivityDate,
            name: activityName.slice(0, 120),
            task_description: taskDesc.slice(0, 2000),
            status: activityStatus.slice(0, 80) || activityStatuses[0],
            remarks: activityRemarks.slice(0, 1000) || null,
          });
        }
      });

      if (parsedRows.length === 0) {
        throw new Error("File tidak memiliki baris data aktivitas yang valid.");
      }

      // Tentukan bulan dominan
      let detectedPrimaryMonth = selectedMonth !== "all" ? selectedMonth : currentMonthPeriod();
      let maxCount = 0;
      detectedMonthsCount.forEach((count, month) => {
        if (count > maxCount) {
          maxCount = count;
          detectedPrimaryMonth = month;
        }
      });

      setImportPreviewRows(parsedRows);
      setTargetImportMonth(detectedPrimaryMonth);
      setImportMode("replace_month");
      setIsImportModalOpen(true);

      toast.success(
        `${parsedRows.length} aktivitas berhasil dibaca. Periode terdeteksi: ${formatPeriodMonth(detectedPrimaryMonth)}.`,
      );
    } catch (error) {
      const message = getImportErrorMessage(error);
      console.error("Daily Activity import failed:", error);
      toast.error("Gagal membaca file: " + message);
    } finally {
      setImporting(false);
    }
  };

  // Confirm monthly import
  const handleConfirmImport = async () => {
    setIsProcessingImport(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi berakhir, silakan login kembali.");

      // Normalisasikan tanggal setiap baris agar sesuai dengan targetImportMonth jika tanggal berbeda
      const preparedRows = importPreviewRows.map((r) => {
        let finalDate = r.activity_date;
        if (!finalDate.startsWith(targetImportMonth)) {
          // Ambil hari asli jika memungkinkan, atau tanggal 01
          const originalDay = finalDate.slice(8, 10) || "01";
          finalDate = `${targetImportMonth}-${originalDay}`;
        }

        return {
          user_id: user.id,
          activity_date: finalDate,
          name: r.name,
          task_description: r.task_description,
          title: r.task_description,
          status: r.status,
          remarks: r.remarks,
          description: r.remarks,
        };
      });

      if (importMode === "replace_month") {
        // Hapus hanya aktivitas user pada bulan target (bulan-bulan lain tetap aman)
        const { error: deleteError } = await supabase
          .from("daily_activities")
          .delete()
          .eq("user_id", user.id)
          .gte("activity_date", `${targetImportMonth}-01`)
          .lte("activity_date", `${targetImportMonth}-31`);

        if (deleteError) {
          console.warn("Delete month warning:", deleteError);
        }
      } else if (importMode === "replace_all") {
        // Hapus semua aktivitas user
        const { error: deleteAllError } = await supabase
          .from("daily_activities")
          .delete()
          .eq("user_id", user.id);

        if (deleteAllError) {
          console.warn("Delete all warning:", deleteAllError);
        }
      }

      // Batch insert data
      const batchSize = 100;
      for (let i = 0; i < preparedRows.length; i += batchSize) {
        const chunk = preparedRows.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from("daily_activities")
          .insert(chunk);
        if (insertError) throw insertError;
      }

      toast.success(
        `Berhasil mengimpor ${preparedRows.length} aktivitas ke periode ${formatPeriodMonth(targetImportMonth)}.`,
      );

      setIsImportModalOpen(false);
      setImportPreviewRows([]);
      setSelectedMonth(targetImportMonth);
      await loadActivities();
    } catch (error) {
      const message = getImportErrorMessage(error);
      console.error("Daily Activity confirm import failed:", error);
      toast.error("Gagal menyimpan import: " + message);
    } finally {
      setIsProcessingImport(false);
    }
  };

  return (
    <Content
      size="lg"
      title="Daily Activity"
      description="Catat dan kelola aktivitas pekerjaan Anda setiap hari per periode bulan."
      cardAction={
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="daily-activity-import"
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={importing}
            onClick={() => document.getElementById("daily-activity-import")?.click()}
            className="gap-1.5 shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            {importing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileUp className="size-4" />
            )}
            <span>Import Excel Bulanan</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={activities.length === 0}
            onClick={handleExport}
            className="gap-1.5 shadow-xs"
          >
            <Download className="size-4" />
            <span>Export</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDownloadTemplate}
            title="Download Template Format Excel"
            className="gap-1 text-muted-foreground hover:text-foreground"
          >
            <FileSpreadsheet className="size-4" />
            <span className="hidden md:inline">Template</span>
          </Button>

          <CalendarCheck2 className="ml-1 h-5 w-5 text-muted-foreground" />
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Navigasi Pemilih Periode Bulan (Monthly Switcher) */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-muted/40 border rounded-xl p-3.5 shadow-2xs">
          {/* Tombol Navigasi Bulan */}
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border bg-background p-1 shadow-2xs">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleShiftMonth(-1)}
                disabled={selectedMonth === "all"}
                title="Bulan Sebelumnya"
                className="size-8 rounded-md hover:bg-muted"
              >
                <ChevronLeft className="size-4" />
              </Button>

              <div className="px-3 py-1 flex items-center gap-2">
                <CalendarDays className="size-4 text-primary" />
                <span className="font-semibold text-sm">
                  {selectedMonth === "all" ? "Semua Bulan" : formatPeriodMonth(selectedMonth)}
                </span>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleShiftMonth(1)}
                disabled={selectedMonth === "all"}
                title="Bulan Berikutnya"
                className="size-8 rounded-md hover:bg-muted"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>

            {/* Dropdown Pemilih Bulan */}
            <div className="w-[190px]">
              <Select
                value={selectedMonth}
                onValueChange={(val) => {
                  setSelectedMonth(val);
                  if (val !== "all" && !activityDate.startsWith(val)) {
                    setActivityDate(`${val}-01`);
                  }
                }}
              >
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder="Pilih Periode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Periode ({activities.length})</SelectItem>
                  {availableMonths.map((m) => (
                    <SelectItem key={m.period} value={m.period}>
                      {m.label} ({m.count} aktivitas)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Native Month Input */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground border rounded-lg px-2.5 h-9 bg-background">
              <Calendar className="size-3.5" />
              <input
                type="month"
                value={selectedMonth === "all" ? "" : selectedMonth}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedMonth(e.target.value);
                    if (!activityDate.startsWith(e.target.value)) {
                      setActivityDate(`${e.target.value}-01`);
                    }
                  }
                }}
                className="bg-transparent text-xs text-foreground outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Info Ringkas Periode Aktif */}
          <div className="flex items-center gap-2 self-start md:self-auto text-xs text-muted-foreground">
            <span>Aktivitas periode:</span>
            <Badge variant="outline" className="font-semibold text-primary border-primary/30">
              {selectedMonth === "all" ? "Semua Periode" : formatPeriodMonth(selectedMonth)}
            </Badge>
            <span className="font-mono">({monthTotalActivities} aktivitas)</span>
          </div>
        </div>

        {/* Grid: Form Tambah (Kiri) & Daftar Aktivitas (Kanan) */}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,360px)_1fr]">
          <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border p-4 bg-card shadow-2xs h-fit">
            <div className="flex items-center gap-2 border-b pb-2.5">
              <Plus className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-sm">Tambah Aktivitas</h2>
            </div>
            <div className="space-y-2">
              <Label htmlFor="activity-date" className="text-xs">Tanggal</Label>
              <Input
                id="activity-date"
                type="date"
                value={activityDate}
                onChange={(event) => setActivityDate(event.target.value)}
                required
                className="text-xs h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="activity-name" className="text-xs">Name</Label>
              <Input
                id="activity-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nama pelaksana aktivitas"
                maxLength={120}
                required
                className="text-xs h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-description" className="text-xs">Task Description</Label>
              <Textarea
                id="task-description"
                value={taskDescription}
                onChange={(event) => setTaskDescription(event.target.value)}
                placeholder="Satu atau beberapa pekerjaan yang dilakukan"
                rows={4}
                maxLength={2000}
                required
                className="text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="activity-status" className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="activity-status" className="text-xs h-9">
                  <SelectValue placeholder="Pilih status" />
                </SelectTrigger>
                <SelectContent>
                  {activityStatuses.map((activityStatus) => (
                    <SelectItem key={activityStatus} value={activityStatus} className="text-xs">
                      {activityStatus}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="activity-remarks" className="text-xs">Remarks</Label>
              <Textarea
                id="activity-remarks"
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                placeholder="Catatan tambahan (opsional)"
                rows={3}
                maxLength={1000}
                className="text-xs"
              />
            </div>
            <Button type="submit" disabled={saving} className="w-full text-xs font-medium">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan Aktivitas
            </Button>
          </form>

          <div className="min-w-0 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold text-sm">
                  Aktivitas Saya
                  {selectedMonth !== "all" && (
                    <span className="text-muted-foreground font-normal ml-1.5">
                      ({formatPeriodMonth(selectedMonth)})
                    </span>
                  )}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Menampilkan {filteredActivities.length} dari {monthTotalActivities} aktivitas
                </p>
              </div>

              {/* Pencarian dalam tabel aktivitas */}
              <div className="relative w-full sm:w-[220px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Cari aktivitas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex h-36 items-center justify-center border rounded-xl bg-card">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : filteredActivities.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground bg-card">
                {searchTerm ? (
                  <p>Tidak ada aktivitas yang sesuai dengan pencarian &quot;{searchTerm}&quot;.</p>
                ) : (
                  <div className="space-y-2">
                    <p>
                      Belum ada daily activity untuk periode{" "}
                      <strong>
                        {selectedMonth === "all" ? "Semua Bulan" : formatPeriodMonth(selectedMonth)}
                      </strong>
                      .
                    </p>
                    <p className="text-xs">
                      Gunakan form di samping untuk menambah aktivitas, atau klik tombol <strong>Import Excel Bulanan</strong> di atas.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full overflow-x-auto rounded-xl border bg-card shadow-2xs">
                <Table className="min-w-[850px] text-xs">
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-[110px] font-bold">Tanggal</TableHead>
                      <TableHead className="w-[150px] font-bold">Name</TableHead>
                      <TableHead className="min-w-[260px] font-bold">Task Description</TableHead>
                      <TableHead className="w-[170px] font-bold">Status</TableHead>
                      <TableHead className="min-w-[180px] font-bold">Remarks</TableHead>
                      <TableHead className="w-[60px] text-right font-bold">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredActivities.map((activity) => (
                      <TableRow key={activity.id} className="hover:bg-muted/40 transition-colors border-b">
                        <TableCell className="whitespace-nowrap font-mono">
                          {new Date(`${activity.activity_date}T00:00:00`).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex flex-col gap-1">
                            <span className="font-semibold">{activity.name}</span>
                            {activity.request_id && (
                              <span className="w-fit rounded-full bg-primary/10 text-primary px-2 py-0.2 text-[10px] font-semibold">
                                Permintaan Desain
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-pre-wrap leading-relaxed">
                          {activity.task_description}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-medium">
                          {activity.status}
                        </TableCell>
                        <TableCell className="whitespace-pre-wrap text-muted-foreground">
                          {activity.remarks || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Hapus aktivitas ${activity.name}`}
                            onClick={() => handleDelete(activity.id)}
                            className="size-7 text-muted-foreground hover:text-rose-600"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL: Import Excel Per Bulan */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FileUp className="size-5 text-emerald-600" />
              <span>Import Daily Activity Bulanan</span>
            </DialogTitle>
            <DialogDescription>
              Ditemukan{" "}
              <strong className="text-foreground">
                {importPreviewRows.length} aktivitas
              </strong>{" "}
              dari file Excel/CSV yang diunggah.
            </DialogDescription>
          </DialogHeader>

          {/* Konfigurasi Target Bulan & Metode Import */}
          <div className="bg-muted/40 p-3.5 rounded-xl border space-y-3 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2.5">
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 text-primary" />
                <span className="font-semibold text-foreground">
                  Target Periode Bulan:
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="month"
                  value={targetImportMonth}
                  onChange={(e) => setTargetImportMonth(e.target.value)}
                  className="px-2.5 py-1 bg-background border rounded-md font-semibold text-xs text-foreground outline-none cursor-pointer"
                />
                <Badge variant="secondary" className="text-[11px]">
                  {formatPeriodMonth(targetImportMonth)}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <span className="font-medium text-foreground block">
                Pilih metode import untuk periode {formatPeriodMonth(targetImportMonth)}:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* 1. Gantikan Bulan Ini */}
                <label
                  className={`flex flex-col p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    importMode === "replace_month"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === "replace_month"}
                      onChange={() => setImportMode("replace_month")}
                      className="accent-primary"
                    />
                    <span>Ganti Bulan Ini</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground mt-1">
                    Hanya data bulan {formatPeriodMonth(targetImportMonth)} yang diganti. Data bulan lain tetap aman!
                  </span>
                </label>

                {/* 2. Tambahkan ke Bulan Ini */}
                <label
                  className={`flex flex-col p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    importMode === "append_month"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === "append_month"}
                      onChange={() => setImportMode("append_month")}
                      className="accent-primary"
                    />
                    <span>Tambah ke Bulan Ini</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground mt-1">
                    Menambahkan {importPreviewRows.length} aktivitas baru ke bulan {formatPeriodMonth(targetImportMonth)}.
                  </span>
                </label>

                {/* 3. Ganti Semua Bulan */}
                <label
                  className={`flex flex-col p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    importMode === "replace_all"
                      ? "border-rose-500 bg-rose-500/5 text-rose-700 dark:text-rose-400"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === "replace_all"}
                      onChange={() => setImportMode("replace_all")}
                      className="accent-primary"
                    />
                    <span>Ganti Semua Bulan</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground mt-1">
                    Menghapus seluruh aktivitas lama dan hanya menyimpan data baru ini.
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Pratinjau Baris Aktivitas */}
          <div className="flex-1 overflow-auto border rounded-lg max-h-[260px]">
            <Table>
              <TableHeader className="bg-muted text-[11px]">
                <TableRow>
                  <TableHead className="w-12">No.</TableHead>
                  <TableHead className="w-[100px]">Tanggal</TableHead>
                  <TableHead className="w-[130px]">Name</TableHead>
                  <TableHead className="min-w-[200px]">Task Description</TableHead>
                  <TableHead className="w-[140px]">Status</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-[11px]">
                {importPreviewRows.slice(0, 8).map((r, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono">{idx + 1}</TableCell>
                    <TableCell className="font-mono whitespace-nowrap">{r.activity_date}</TableCell>
                    <TableCell className="font-semibold">{r.name}</TableCell>
                    <TableCell className="whitespace-pre-wrap">{r.task_description}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.status}</TableCell>
                    <TableCell className="text-muted-foreground">{r.remarks || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {importPreviewRows.length > 8 && (
            <p className="text-[11px] text-muted-foreground text-center">
              ... dan {importPreviewRows.length - 8} aktivitas lainnya
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsImportModalOpen(false)}
              disabled={isProcessingImport}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleConfirmImport}
              disabled={isProcessingImport}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              {isProcessingImport ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Menyimpan Aktivitas...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  <span>Import ke Bulan {formatPeriodMonth(targetImportMonth)}</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Content>
  );
}
