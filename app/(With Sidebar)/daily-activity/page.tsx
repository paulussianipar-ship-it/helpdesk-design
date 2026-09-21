"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileSpreadsheet,
  FileUp,
  Hourglass,
  Layers,
  Loader2,
  PauseCircle,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  UserCheck,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Badge } from "@/components/ui/badge";
import { Content } from "@/components/content";


export interface DailyActivity {
  id: string;
  request_id?: string | null;
  activity_date: string;
  name: string;
  task_description: string;
  status: string;
  remarks: string | null;
  created_at?: string;
}

const activityStatuses = [
  "⏳ Waiting (Menunggu)",
  "⚡ In Progress (Dalam Proses)",
  "🔄 Revisi (Revisi Pengerjaan)",
  "⏸️ Pending (Tertunda)",
  "✅ Done (Selesai)",
] as const;

const LOCAL_STORAGE_KEY = "daily_activity_records_v2";

// Deterministic formatters for safe SSR & zero hydration mismatch
const getTodayDate = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const getCurrentMonthPeriod = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

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

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return "-";
  const parts = dateStr.slice(0, 10).split("-");
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ];
  const mIndex = parseInt(m, 10) - 1;
  const monthName = monthNames[mIndex] || m;
  return `${d} ${monthName} ${y}`;
}

function normalizeActivityDate(value: unknown, monthFirst = false): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data state
  const [activities, setActivities] = useState<DailyActivity[]>([]);
  const [loading, setLoading] = useState(true);

  // Month navigation state
  const [selectedMonth, setSelectedMonth] = useState<string>("2026-09");

  // Filters & Search & Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Import modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreviewRows, setImportPreviewRows] = useState<ParsedImportRow[]>([]);
  const [targetImportMonth, setTargetImportMonth] = useState<string>("2026-09");
  const [importMode, setImportMode] = useState<"replace_month" | "append_month" | "replace_all">("replace_month");
  const [isProcessingImport, setIsProcessingImport] = useState(false);

  // Add / Edit Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<DailyActivity | null>(null);
  const [formData, setFormData] = useState<{
    activity_date: string;
    name: string;
    task_description: string;
    status: string;
    remarks: string;
  }>({
    activity_date: getTodayDate(),
    name: "",
    task_description: "",
    status: activityStatuses[4],
    remarks: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  // Delete modal state
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Detail modal state
  const [detailActivity, setDetailActivity] = useState<DailyActivity | null>(null);

  // Load activities from API (All Roles supported) & fallback to local storage
  const loadActivities = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/daily-activity");
      if (res.ok) {
        const json = await res.json();
        const data = json.data || [];
        if (data.length > 0) {
          const mapped: DailyActivity[] = data.map((d: any) => ({
            id: d.id,
            request_id: d.request_id,
            activity_date: d.activity_date,
            name: d.name || "Staff",
            task_description: d.task_description || "-",
            status: d.status || activityStatuses[4],
            remarks: d.remarks || null,
            created_at: d.created_at,
          }));
          setActivities(mapped);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(mapped));

          // Set default selected month if not yet aligned
          const currentP = getCurrentMonthPeriod();
          if (mapped.length > 0) {
            const hasCurrentMonth = mapped.some((m) => m.activity_date?.startsWith(currentP));
            if (hasCurrentMonth) {
              setSelectedMonth(currentP);
            } else if (mapped[0]?.activity_date) {
              setSelectedMonth(mapped[0].activity_date.slice(0, 7));
            }
          }
          return;
        }
      }

      // Fallback to local storage if user not logged in or Supabase empty
      const localSaved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (localSaved) {
        try {
          const parsed = JSON.parse(localSaved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setActivities(parsed);
            return;
          }
        } catch {
          // ignore error
        }
      }
      setActivities([]);
    } catch (err: any) {
      console.warn("Gagal memuat daily activities:", err);
      const localSaved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (localSaved) {
        try {
          setActivities(JSON.parse(localSaved));
        } catch {
          setActivities([]);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, []);

  // Save to local storage
  const saveLocalActivities = (items: DailyActivity[]) => {
    setActivities(items);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  };

  // Month navigation list
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
    setCurrentPage(1);
  };

  // Status Badge Renderer matching Attendance design
  const renderStatusBadge = (statusStr: string) => {
    const raw = (statusStr || "").trim();
    if (!raw) return <span className="text-muted-foreground">-</span>;

    let badgeClass = "bg-muted text-muted-foreground border-transparent";
    if (raw.includes("Done") || raw.includes("Selesai")) {
      badgeClass =
        "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold";
    } else if (raw.includes("Progress") || raw.includes("Proses")) {
      badgeClass =
        "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 font-semibold";
    } else if (raw.includes("Revisi") || raw.includes("Revision")) {
      badgeClass =
        "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 font-semibold";
    } else if (raw.includes("Pending") || raw.includes("Tertunda")) {
      badgeClass =
        "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 font-semibold";
    } else if (raw.includes("Waiting") || raw.includes("Menunggu")) {
      badgeClass =
        "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30 font-semibold";
    }

    return (
      <Badge
        variant="outline"
        className={`text-[11px] px-2 py-0.5 whitespace-nowrap ${badgeClass}`}
      >
        {raw}
      </Badge>
    );
  };

  // Activities filtered by selected month
  const monthActivities = useMemo(() => {
    if (selectedMonth === "all") return activities;
    return activities.filter((a) => a.activity_date?.startsWith(selectedMonth));
  }, [activities, selectedMonth]);

  // KPI calculations for 6 summary cards
  const stats = useMemo(() => {
    let doneCount = 0;
    let inProgressCount = 0;
    let revisionCount = 0;
    let pendingCount = 0;
    let waitingCount = 0;

    monthActivities.forEach((act) => {
      const s = (act.status || "").toLowerCase();
      if (s.includes("done") || s.includes("selesai")) doneCount++;
      else if (s.includes("progress") || s.includes("proses")) inProgressCount++;
      else if (s.includes("revisi") || s.includes("revision")) revisionCount++;
      else if (s.includes("pending") || s.includes("tunda")) pendingCount++;
      else waitingCount++;
    });

    return {
      total: monthActivities.length,
      doneCount,
      inProgressCount,
      revisionCount,
      pendingCount,
      waitingCount,
    };
  }, [monthActivities]);

  // Unique staff/pelaksana in current month
  const uniqueStaff = useMemo(() => {
    const map = new Map<string, number>();
    monthActivities.forEach((a) => {
      if (a.name) {
        map.set(a.name, (map.get(a.name) || 0) + 1);
      }
    });
    return Array.from(map.entries()).map(([name, count]) => ({
      name,
      count,
    }));
  }, [monthActivities]);

  // Filtered & Paginated records
  const filteredActivities = useMemo(() => {
    return monthActivities.filter((act) => {
      // Search term
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

      // Status filter
      if (statusFilter !== "all") {
        const s = (act.status || "").toLowerCase();
        if (statusFilter === "done" && !(s.includes("done") || s.includes("selesai"))) return false;
        if (statusFilter === "progress" && !(s.includes("progress") || s.includes("proses"))) return false;
        if (statusFilter === "revisi" && !(s.includes("revisi") || s.includes("revision"))) return false;
        if (statusFilter === "pending" && !(s.includes("pending") || s.includes("tunda"))) return false;
        if (statusFilter === "waiting" && !(s.includes("waiting") || s.includes("menunggu"))) return false;
      }

      // Staff filter
      if (staffFilter !== "all" && act.name !== staffFilter) {
        return false;
      }

      return true;
    });
  }, [monthActivities, searchTerm, statusFilter, staffFilter]);

  const totalPages = Math.ceil(filteredActivities.length / pageSize) || 1;
  const paginatedActivities = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredActivities.slice(start, start + pageSize);
  }, [filteredActivities, currentPage, pageSize]);

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setStaffFilter("all");
    setCurrentPage(1);
  };

  // Open Add Dialog
  const handleOpenAddForm = () => {
    setEditingActivity(null);
    const activePeriod = selectedMonth !== "all" ? selectedMonth : getCurrentMonthPeriod();
    setFormData({
      activity_date: `${activePeriod}-01`,
      name: activities[0]?.name || "Paulus Petrus Parlindungan Sianipar",
      task_description: "",
      status: activityStatuses[4],
      remarks: "",
    });
    setIsFormOpen(true);
  };

  // Open Edit Dialog
  const handleOpenEditForm = (activity: DailyActivity) => {
    setEditingActivity(activity);
    setFormData({
      activity_date: activity.activity_date,
      name: activity.name,
      task_description: activity.task_description,
      status: activity.status || activityStatuses[4],
      remarks: activity.remarks || "",
    });
    setIsFormOpen(true);
  };

  // Submit Add or Edit Form
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.task_description.trim() || !formData.activity_date) {
      toast.error("Mohon lengkapi data yang wajib diisi.");
      return;
    }

    setIsSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (editingActivity) {
        // Update
        const updatedList = activities.map((act) =>
          act.id === editingActivity.id
            ? {
              ...act,
              activity_date: formData.activity_date,
              name: formData.name.trim(),
              task_description: formData.task_description.trim(),
              status: formData.status,
              remarks: formData.remarks.trim() || null,
            }
            : act
        );
        saveLocalActivities(updatedList);

        await fetch("/api/daily-activity", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingActivity.id,
            activity_date: formData.activity_date,
            name: formData.name.trim(),
            task_description: formData.task_description.trim(),
            status: formData.status,
            remarks: formData.remarks.trim() || null,
          }),
        });

        toast.success("Aktivitas berhasil diperbarui.");
      } else {
        // Insert
        const newId = `da-${Date.now()}`;
        const newActivity: DailyActivity = {
          id: newId,
          activity_date: formData.activity_date,
          name: formData.name.trim(),
          task_description: formData.task_description.trim(),
          status: formData.status || activityStatuses[4],
          remarks: formData.remarks.trim() || null,
          created_at: new Date().toISOString(),
        };

        const updatedList = [newActivity, ...activities];
        saveLocalActivities(updatedList);

        await fetch("/api/daily-activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: user?.id || null,
            activity_date: newActivity.activity_date,
            name: newActivity.name,
            task_description: newActivity.task_description,
            status: newActivity.status,
            remarks: newActivity.remarks,
          }),
        });

        // Align selected month
        const inputMonth = formData.activity_date.slice(0, 7);
        if (selectedMonth !== "all" && selectedMonth !== inputMonth) {
          setSelectedMonth(inputMonth);
        }

        toast.success("Aktivitas berhasil ditambahkan.");
      }

      setIsFormOpen(false);
      await loadActivities();
    } catch (err: any) {
      toast.error("Gagal menyimpan aktivitas: " + (err?.message || "Terjadi kesalahan"));
    } finally {
      setIsSaving(false);
    }
  };

  // Delete activity
  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      const updatedList = activities.filter((a) => a.id !== deleteTargetId);
      saveLocalActivities(updatedList);

      await fetch(`/api/daily-activity?id=${deleteTargetId}`, {
        method: "DELETE",
      });

      toast.success("Aktivitas berhasil dihapus.");
    } catch (err: any) {
      toast.error("Gagal menghapus: " + (err?.message || "Terjadi kesalahan"));
    } finally {
      setDeleteTargetId(null);
    }
  };

  // Download Excel Template aligned with Attendance Template structure
  const handleDownloadTemplate = () => {
    const activePeriod = selectedMonth !== "all" ? selectedMonth : getCurrentMonthPeriod();
    const templateRows = [
      {
        "No.": 1,
        "Activity Date": `${activePeriod}-01`,
        Name: activities[0]?.name || "Paulus Petrus Parlindungan Sianipar",
        "Task Description": "Mengerjakan materi desain promosi bulanan dan banner katalog produk",
        Status: "✅ Done (Selesai)",
        Remarks: "Selesai tepat waktu dan materi sudah disetujui",
      },
      {
        "No.": 2,
        "Activity Date": `${activePeriod}-02`,
        Name: "Muhammad Farel Ramadhan",
        "Task Description": "Revisi layout katalog produk dan penyesuaian resolusi cetak",
        Status: "⚡ In Progress (Dalam Proses)",
        Remarks: "Menunggu aset foto resolusi tinggi dari tim marketing",
      },
      {
        "No.": 3,
        "Activity Date": `${activePeriod}-03`,
        Name: "Tools Creative",
        "Task Description": "Desain konten media sosial feed dan stories Instagram",
        Status: "🔄 Revisi (Revisi Pengerjaan)",
        Remarks: "Revisi copy teks promosi",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateRows);
    worksheet["!cols"] = [
      { wch: 6 },
      { wch: 16 },
      { wch: 35 },
      { wch: 45 },
      { wch: 30 },
      { wch: 35 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template Bulanan");
    XLSX.writeFile(workbook, "Template_Daily_Activity_Bulanan.xlsx");
    toast.success("Template Excel berhasil diunduh.");
  };

  // Export to Excel
  const handleExportExcel = () => {
    const rowsToExport = filteredActivities.length > 0 ? filteredActivities : monthActivities;
    const rows = rowsToExport.map((activity, index) => ({
      "No.": index + 1,
      "Activity Date": activity.activity_date,
      Name: activity.name,
      "Task Description": activity.task_description,
      Status: activity.status,
      Remarks: activity.remarks || "-",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 6 },
      { wch: 16 },
      { wch: 32 },
      { wch: 45 },
      { wch: 28 },
      { wch: 35 },
    ];
    const workbook = XLSX.utils.book_new();
    const sheetName = selectedMonth !== "all" ? formatPeriodMonth(selectedMonth) : "Daily Activity";
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const filename =
      selectedMonth !== "all"
        ? `Daily_Activity_${selectedMonth}.xlsx`
        : `Daily_Activity_Semua_Bulan.xlsx`;

    XLSX.writeFile(workbook, filename);
    toast.success(`Berhasil mengekspor ${rowsToExport.length} data ke ${filename}.`);
  };

  // Excel File upload & parsing
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImporting(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const normalizeHeader = (value: unknown) =>
        String(value ?? "")
          .replace(/[._]/g, " ")
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
              (headers.includes("task description") || headers.includes("description")) &&
              headers.includes("status")) ||
            (headers.includes("name") && headers.includes("remarks")) ||
            (headers.includes("design") && headers.includes("date")) ||
            (headers.includes("activity date") && headers.includes("task description"))
          );
        });
        return { rows, rowIndex };
      }).find(({ rowIndex }) => rowIndex >= 0);

      if (!matchingSheet) {
        throw new Error(
          "Header tidak ditemukan. Pastikan file memiliki kolom: Activity Date / Date, Name, Task Description, Status, Remarks.",
        );
      }

      const matrix = matchingSheet.rows;
      const headerIndex = matchingSheet.rowIndex;
      const headers = matrix[headerIndex].map(normalizeHeader);
      const findHeaderIndex = (...keywords: string[]) =>
        headers.findIndex((h) => keywords.some((k) => h === k || h.includes(k)));

      const dateIndex = findHeaderIndex("activity date", "date", "tanggal");
      const nameIndex = findHeaderIndex("name", "nama", "employee");
      const taskIndex = findHeaderIndex("task description", "task", "design", "deskripsi", "pekerjaan");
      const statusIndex = findHeaderIndex("status", "keadaan");
      const remarksIndex = findHeaderIndex("remarks", "keterangan", "catatan");

      let previousName = activities[0]?.name || "Staff";
      let previousActivityDate: string | null = null;
      const detectedMonthsCount = new Map<string, number>();
      const parsedRows: ParsedImportRow[] = [];

      matrix.slice(headerIndex + 1).forEach((row) => {
        // Check if this row is a section date delimiter (e.g. "JOB LIST TODAY;1;;;2026-08-03 00:00:00")
        const rowStrings = row.map((cell) => String(cell ?? "").trim());
        const dateInRowMatch = rowStrings.find((str) => /^\d{4}-\d{2}-\d{2}/.test(str));
        const hasJobMarker = rowStrings.some((str) => str.toLowerCase().includes("job list"));
        const taskDesc = taskIndex >= 0 ? String(row[taskIndex] ?? "").trim() : "";

        if ((hasJobMarker || !taskDesc) && dateInRowMatch) {
          const matched = dateInRowMatch.match(/^\d{4}-\d{2}-\d{2}/);
          if (matched) {
            previousActivityDate = matched[0];
            return;
          }
        }

        const rawDate = dateIndex >= 0 ? row[dateIndex] : null;
        const parsedDate = normalizeActivityDate(rawDate);
        const finalActivityDate = parsedDate || previousActivityDate || getTodayDate();

        const activityName =
          nameIndex >= 0 && String(row[nameIndex] ?? "").trim()
            ? String(row[nameIndex] ?? "").trim()
            : previousName;

        const rawStatus = statusIndex >= 0 ? String(row[statusIndex] ?? "").trim() : "";
        const activityStatus = normalizeActivityStatus(rawStatus);
        const activityRemarks =
          remarksIndex >= 0 && row[remarksIndex] ? String(row[remarksIndex]).trim() : "";

        if (!activityName && !taskDesc && !activityStatus && !activityRemarks) {
          return;
        }

        if (taskDesc) {
          previousName = activityName;
          previousActivityDate = finalActivityDate;

          const pMonth = finalActivityDate.slice(0, 7);
          detectedMonthsCount.set(pMonth, (detectedMonthsCount.get(pMonth) || 0) + 1);

          parsedRows.push({
            activity_date: finalActivityDate,
            name: activityName.slice(0, 120),
            task_description: taskDesc.slice(0, 2000),
            status: activityStatus.slice(0, 80) || activityStatuses[4],
            remarks: activityRemarks.slice(0, 1000) || null,
          });
        }
      });

      if (parsedRows.length === 0) {
        throw new Error("File tidak memiliki baris data aktivitas yang valid.");
      }

      let detectedPrimaryMonth = selectedMonth !== "all" ? selectedMonth : getCurrentMonthPeriod();
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
    } catch (error: any) {
      toast.error("Gagal membaca file: " + (error?.message || "Format tidak valid"));
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

      const preparedRows: DailyActivity[] = importPreviewRows.map((r, idx) => {
        let finalDate = r.activity_date;
        if (!finalDate.startsWith(targetImportMonth)) {
          const originalDay = finalDate.slice(8, 10) || "01";
          finalDate = `${targetImportMonth}-${originalDay}`;
        }

        return {
          id: `da-import-${Date.now()}-${idx}`,
          activity_date: finalDate,
          name: r.name,
          task_description: r.task_description,
          status: r.status,
          remarks: r.remarks,
        };
      });

      if (importMode === "replace_month") {
        await fetch(`/api/daily-activity?month=${targetImportMonth}`, {
          method: "DELETE",
        });
      }

      const dbRows = preparedRows.map((r) => ({
        user_id: user?.id || null,
        activity_date: r.activity_date,
        name: r.name,
        task_description: r.task_description,
        title: r.task_description,
        status: r.status,
        remarks: r.remarks,
        description: r.remarks,
      }));

      const importRes = await fetch("/api/daily-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dbRows),
      });

      if (!importRes.ok) {
        throw new Error("Gagal menyimpan data import ke server");
      }

      // Update local storage
      let updatedList = [...activities];
      if (importMode === "replace_month") {
        updatedList = updatedList.filter((a) => !a.activity_date?.startsWith(targetImportMonth));
        updatedList = [...preparedRows, ...updatedList];
      } else if (importMode === "replace_all") {
        updatedList = [...preparedRows];
      } else {
        updatedList = [...preparedRows, ...updatedList];
      }
      saveLocalActivities(updatedList);

      toast.success(
        `Berhasil mengimpor ${preparedRows.length} aktivitas ke periode ${formatPeriodMonth(targetImportMonth)}.`,
      );

      setIsImportModalOpen(false);
      setImportPreviewRows([]);
      setSelectedMonth(targetImportMonth);
      await loadActivities();
    } catch (error: any) {
      toast.error("Gagal menyimpan import: " + (error?.message || "Terjadi kesalahan"));
    } finally {
      setIsProcessingImport(false);
    }
  };

  return (
    <Content
      title="Daily Activity"
      description={`Menampilkan catatan aktivitas pekerjaan harian tim per bulan (${selectedMonth === "all" ? "Semua Periode" : formatPeriodMonth(selectedMonth)}).`}
      size="lg"
      cardAction={
        <div className="flex flex-wrap items-center gap-2">
          {/* Import Excel */}
          <Button
            variant="default"
            size="sm"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {importing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileUp className="size-4" />
            )}
            <span>Import Excel</span>
          </Button>

          {/* Export Excel */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5"
          >
            <Download className="h-4 w-4 text-emerald-600" />
            <span>Export Excel</span>
          </Button>

          {/* Template */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadTemplate}
            title="Download Template Format Excel"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <FileSpreadsheet className="size-4" />
            <span className="hidden md:inline">Template</span>
          </Button>

          {/* Tambah Manual */}
          <Button
            size="sm"
            onClick={handleOpenAddForm}
            className="flex items-center gap-1.5"
          >
            <Plus className="size-4" />
            <span>Tambah</span>
          </Button>
        </div>
      }
    >
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".xlsx,.xls,.csv"
        className="hidden"
      />

      {/* 1. MONTH SELECTOR */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card border rounded-xl p-3.5 shadow-xs mb-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Prev / Label / Next */}
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

            <div className="px-3 py-1 flex items-center gap-2 min-w-[150px] justify-center">
              <CalendarDays className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">
                {selectedMonth === "all" ? "Semua Bulan" : formatPeriodMonth(selectedMonth)}
              </span>
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

          {/* Dropdown Bulan */}
          <div className="w-full sm:w-[210px]">
            <Select
              value={selectedMonth}
              onValueChange={(val) => {
                setSelectedMonth(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Pilih Bulan" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="all">Semua Periode ({activities.length})</SelectItem>
                {availableMonths.map((m) => (
                  <SelectItem key={m.period} value={m.period}>
                    {m.label} ({m.count} data)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Native Month Picker */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground border rounded-lg px-2.5 h-9 bg-background">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            <input
              type="month"
              value={selectedMonth === "all" ? "" : selectedMonth}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedMonth(e.target.value);
                  setCurrentPage(1);
                }
              }}
              className="bg-transparent text-xs text-foreground outline-none cursor-pointer"
              title="Pilih Bulan & Tahun Bebas"
            />
          </div>
        </div>

        {/* Info Periode */}
        <div className="flex items-center gap-2 self-start md:self-auto text-xs text-muted-foreground">
          <span>Tabel Periode:</span>
          <Badge variant="outline" className="font-semibold text-primary border-primary/30">
            {selectedMonth === "all" ? "Semua Periode" : formatPeriodMonth(selectedMonth)}
          </Badge>
          <span className="font-mono">({monthActivities.length} aktivitas)</span>
        </div>
      </div>

      {/* 2. STAT CARDS — clickable filter buttons (matching Permintaan Desain style) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-5">
        {/* Total */}
        <button
          type="button"
          onClick={() => { setStatusFilter("all"); setCurrentPage(1); }}
          className={`p-3 rounded-xl border text-left transition-all ${statusFilter === "all"
            ? "bg-primary/10 border-primary/40 ring-1 ring-primary/30"
            : "bg-card hover:bg-muted/40"
            }`}
        >
          <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
            <span>Total Aktivitas</span>
            <Layers className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="text-xl font-bold mt-1 text-foreground">{stats.total}</div>
        </button>

        {/* Done */}
        <button
          type="button"
          onClick={() => { setStatusFilter("done"); setCurrentPage(1); }}
          className={`p-3 rounded-xl border text-left transition-all ${statusFilter === "done"
            ? "bg-emerald-500/15 border-emerald-500/40 ring-1 ring-emerald-500/30"
            : "bg-card hover:bg-muted/40"
            }`}
        >
          <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
            <span>Selesai (Done)</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-bold mt-1 text-emerald-700 dark:text-emerald-400">{stats.doneCount}</div>
        </button>

        {/* In Progress */}
        <button
          type="button"
          onClick={() => { setStatusFilter("progress"); setCurrentPage(1); }}
          className={`p-3 rounded-xl border text-left transition-all ${statusFilter === "progress"
            ? "bg-blue-500/15 border-blue-500/40 ring-1 ring-blue-500/30"
            : "bg-card hover:bg-muted/40"
            }`}
        >
          <div className="text-[11px] font-medium text-blue-700 dark:text-blue-400 flex items-center justify-between">
            <span>Dalam Proses</span>
            <Zap className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <div className="text-xl font-bold mt-1 text-blue-700 dark:text-blue-400">{stats.inProgressCount}</div>
        </button>

        {/* Revisi */}
        <button
          type="button"
          onClick={() => { setStatusFilter("revisi"); setCurrentPage(1); }}
          className={`p-3 rounded-xl border text-left transition-all ${statusFilter === "revisi"
            ? "bg-amber-500/15 border-amber-500/40 ring-1 ring-amber-500/30"
            : "bg-card hover:bg-muted/40"
            }`}
        >
          <div className="text-[11px] font-medium text-amber-700 dark:text-amber-400 flex items-center justify-between">
            <span>Revisi</span>
            <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
          </div>
          <div className="text-xl font-bold mt-1 text-amber-700 dark:text-amber-400">{stats.revisionCount}</div>
        </button>

        {/* Pending */}
        <button
          type="button"
          onClick={() => { setStatusFilter("pending"); setCurrentPage(1); }}
          className={`p-3 rounded-xl border text-left transition-all ${statusFilter === "pending"
            ? "bg-rose-500/15 border-rose-500/40 ring-1 ring-rose-500/30"
            : "bg-card hover:bg-muted/40"
            }`}
        >
          <div className="text-[11px] font-medium text-rose-700 dark:text-rose-400 flex items-center justify-between">
            <span>Tertunda (Pending)</span>
            <PauseCircle className="h-3.5 w-3.5 text-rose-600" />
          </div>
          <div className="text-xl font-bold mt-1 text-rose-700 dark:text-rose-400">{stats.pendingCount}</div>
        </button>

        {/* Waiting */}
        <button
          type="button"
          onClick={() => { setStatusFilter("waiting"); setCurrentPage(1); }}
          className={`p-3 rounded-xl border text-left transition-all ${statusFilter === "waiting"
            ? "bg-slate-500/15 border-slate-500/40 ring-1 ring-slate-500/30"
            : "bg-card hover:bg-muted/40"
            }`}
        >
          <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400 flex items-center justify-between">
            <span>Menunggu</span>
            <Hourglass className="h-3.5 w-3.5 text-slate-500" />
          </div>
          <div className="text-xl font-bold mt-1 text-slate-600 dark:text-slate-400">{stats.waitingCount}</div>
        </button>
      </div>

      {/* 3. FILTER AREA */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari aktivitas, nama, task description..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Filter Status */}
          <Select
            value={statusFilter}
            onValueChange={(val) => {
              setStatusFilter(val);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Semua Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="done">✅ Done (Selesai)</SelectItem>
              <SelectItem value="progress">⚡ In Progress (Proses)</SelectItem>
              <SelectItem value="revisi">🔄 Revisi</SelectItem>
              <SelectItem value="pending">⏸️ Pending</SelectItem>
              <SelectItem value="waiting">⏳ Waiting</SelectItem>
            </SelectContent>
          </Select>

          {/* Filter Pelaksana */}
          <Select
            value={staffFilter}
            onValueChange={(val) => {
              setStaffFilter(val);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Semua Pelaksana" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Pelaksana</SelectItem>
              {uniqueStaff.map((staff) => (
                <SelectItem key={staff.name} value={staff.name}>
                  {staff.name} ({staff.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Reset Filter */}
          <div className="flex gap-2">
            {(searchTerm || statusFilter !== "all" || staffFilter !== "all") && (
              <Button
                size="icon"
                variant="outline"
                className="shrink-0"
                title="Reset Semua Filter"
                onClick={resetFilters}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 4. TABLE AREA */}
      <div className="border rounded-xl overflow-hidden bg-card shadow-2xs">
        {/* Table Header Bar */}
        <div className="bg-muted/40 px-4 py-2.5 border-b flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm text-foreground">
              Daftar Aktivitas: {selectedMonth === "all" ? "Semua Periode" : formatPeriodMonth(selectedMonth)}
            </span>
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            Total {filteredActivities.length} aktivitas ditemukan
          </span>
        </div>

        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow className="bg-muted/20">
              <TableHead className="w-[50px] font-semibold">No</TableHead>
              <TableHead className="font-semibold w-[140px]">Tanggal Pengajuan</TableHead>
              <TableHead className="font-semibold">Judul Permintaan</TableHead>
              <TableHead className="font-semibold min-w-[180px]">Peminta / Divisi</TableHead>
              <TableHead className="font-semibold min-w-[160px]">Desainer</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold w-[140px]">Target Selesai</TableHead>
              <TableHead className="text-right font-semibold">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center h-32">
                  <div className="flex justify-center items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span>Memuat data daily activity {formatPeriodMonth(selectedMonth)}...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : paginatedActivities.length > 0 ? (
              paginatedActivities.map((activity, index) => {
                const displayIndex = (currentPage - 1) * pageSize + index + 1;
                const isPaulus = activity.name.toLowerCase().includes("paulus");
                const isFarel = activity.name.toLowerCase().includes("farel");
                return (
                  <TableRow key={activity.id || index} className="hover:bg-muted/30 transition-colors">
                    {/* No */}
                    <TableCell className="text-muted-foreground text-xs font-mono">
                      {displayIndex}
                    </TableCell>

                    {/* Tanggal Pengajuan = activity_date */}
                    <TableCell className="whitespace-nowrap">
                      {activity.activity_date ? (
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-foreground">
                            {new Date(activity.activity_date).toLocaleDateString("id-ID", {
                              day: "numeric", month: "short", year: "numeric",
                            })}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {formatDateDisplay(activity.activity_date)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* Judul Permintaan = task_description */}
                    <TableCell className="max-w-[280px]">
                      <div className="font-semibold text-sm text-foreground line-clamp-2" title={activity.task_description}>
                        {activity.task_description}
                      </div>
                      {activity.request_id && (
                        <div className="mt-1">
                          <Badge variant="outline" className="text-[11px] px-1.5 py-0 font-normal">
                            Permintaan Desain
                          </Badge>
                        </div>
                      )}
                    </TableCell>

                    {/* Peminta / Divisi = name + divisi IT/Creative */}
                    <TableCell>
                      <div className="font-medium text-sm text-foreground">
                        {activity.name}
                      </div>
                      <div className="text-xs text-muted-foreground">IT / Creative</div>
                    </TableCell>

                    {/* Desainer = name dengan dot warna */}
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-block size-2 rounded-full shrink-0 ${isPaulus ? "bg-sky-500" : isFarel ? "bg-indigo-500" : "bg-emerald-500"
                            }`}
                        />
                        <span className="font-medium text-sm text-foreground">
                          {activity.name}
                        </span>
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell>{renderStatusBadge(activity.status)}</TableCell>

                    {/* Target Selesai = remarks (catatan / target) */}
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {activity.remarks ? (
                        <div className="flex items-center gap-1 text-xs">
                          <span className="line-clamp-1">{activity.remarks}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* Aksi */}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs px-2.5"
                          onClick={() => setDetailActivity(activity)}
                          title="Lihat Detail"
                        >
                          Detail
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs px-2"
                          onClick={() => handleOpenEditForm(activity)}
                          title="Edit Aktivitas"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTargetId(activity.id)}
                          title="Hapus Aktivitas"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <CalendarCheck2 className="h-8 w-8 text-muted-foreground/50" />
                    <p className="font-medium text-foreground">
                      Tidak ada aktivitas pada {selectedMonth === "all" ? "semua periode" : formatPeriodMonth(selectedMonth)}
                    </p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      Tidak ada aktivitas yang cocok dengan filter yang dipilih. Anda dapat berpindah ke bulan lain atau mereset filter.
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <FileUp className="size-3.5" />
                        <span>Import Excel</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpenAddForm}
                        className="text-xs gap-1.5"
                      >
                        <Plus className="size-3.5" />
                        <span>Tambah Manual</span>
                      </Button>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* 5. PAGINATION (below card — matching Permintaan Desain) */}
      <div className="mt-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Tampilkan</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[70px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <span>
            aktivitas per halaman (Total {filteredActivities.length} aktivitas
            {filteredActivities.length !== monthActivities.length &&
              ` difilter dari ${monthActivities.length} bulan ini`}
            )
          </span>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-8 text-xs"
            >
              Sebelumnya
            </Button>
            <div className="px-2 font-medium text-sm text-foreground">
              Halaman {currentPage} dari {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="h-8 text-xs"
            >
              Berikutnya
            </Button>
          </div>
        )}
      </div>

      {/* MODAL: View Detail Aktivitas */}
      <Dialog open={!!detailActivity} onOpenChange={(open) => { if (!open) setDetailActivity(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="size-4 text-primary" />
              Detail Daily Activity
            </DialogTitle>
            <DialogDescription>
              Informasi lengkap catatan aktivitas pekerjaan harian.
            </DialogDescription>
          </DialogHeader>

          {detailActivity && (
            <div className="space-y-4 text-sm">
              {/* Header info card */}
              <div className="bg-muted/40 rounded-xl border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block size-2.5 rounded-full ${detailActivity.name.toLowerCase().includes("paulus")
                        ? "bg-sky-500"
                        : detailActivity.name.toLowerCase().includes("farel")
                          ? "bg-indigo-500"
                          : "bg-emerald-500"
                        }`}
                    />
                    <span className="font-semibold text-foreground">{detailActivity.name}</span>
                    <Badge variant="outline" className="text-[11px] font-normal">IT / Creative</Badge>
                  </div>
                  <div>{renderStatusBadge(detailActivity.status)}</div>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <span className="text-muted-foreground block">Tanggal Pengajuan</span>
                    <span className="font-medium text-foreground">
                      {new Date(detailActivity.activity_date).toLocaleDateString("id-ID", {
                        weekday: "long", day: "numeric", month: "long", year: "numeric",
                      })}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Desainer</span>
                    <span className="font-medium text-foreground">{detailActivity.name}</span>
                  </div>
                </div>
              </div>

              {/* Judul Permintaan / Task Description */}
              <div>
                <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Judul Permintaan</Label>
                <div className="mt-1.5 bg-background border rounded-lg px-3 py-2.5 text-sm font-medium text-foreground leading-relaxed">
                  {detailActivity.task_description}
                </div>
                {detailActivity.request_id && (
                  <div className="mt-1.5">
                    <Badge variant="outline" className="text-[11px] font-normal">Permintaan Desain</Badge>
                  </div>
                )}
              </div>

              {/* Target Selesai / Remarks */}
              <div>
                <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Target Selesai / Remarks</Label>
                <div className="mt-1.5 bg-background border rounded-lg px-3 py-2.5 text-sm text-muted-foreground leading-relaxed min-h-[52px]">
                  {detailActivity.remarks || <span className="italic text-muted-foreground/60">Tidak ada catatan tambahan</span>}
                </div>
              </div>

              {/* Created at */}
              {detailActivity.created_at && (
                <p className="text-[11px] text-muted-foreground text-right">
                  Dicatat: {new Date(detailActivity.created_at).toLocaleString("id-ID")}
                </p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { if (detailActivity) { handleOpenEditForm(detailActivity); setDetailActivity(null); } }}
            >
              <Pencil className="size-3.5 mr-1.5" /> Edit
            </Button>
            <Button size="sm" onClick={() => setDetailActivity(null)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Import Excel */}
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
                {importPreviewRows.length} baris data aktivitas
              </strong>{" "}
              dari file Excel/CSV yang diunggah.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-muted/40 p-3.5 rounded-xl border space-y-3 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2.5">
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 text-primary" />
                <span className="font-semibold text-foreground">Target Periode Bulan:</span>
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
                <label className={`flex flex-col p-2.5 rounded-lg border cursor-pointer transition-colors ${importMode === "replace_month" ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted/50"}`}>
                  <div className="flex items-center gap-2 font-semibold">
                    <input type="radio" name="daImportMode" checked={importMode === "replace_month"} onChange={() => setImportMode("replace_month")} className="accent-primary" />
                    <span>Ganti Bulan Ini</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground mt-1">Hanya data bulan {formatPeriodMonth(targetImportMonth)} yang diganti. Bulan lain tetap aman!</span>
                </label>
                <label className={`flex flex-col p-2.5 rounded-lg border cursor-pointer transition-colors ${importMode === "append_month" ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted/50"}`}>
                  <div className="flex items-center gap-2 font-semibold">
                    <input type="radio" name="daImportMode" checked={importMode === "append_month"} onChange={() => setImportMode("append_month")} className="accent-primary" />
                    <span>Tambah ke Bulan Ini</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground mt-1">Menambahkan {importPreviewRows.length} aktivitas baru ke dalam periode {formatPeriodMonth(targetImportMonth)}.</span>
                </label>
                <label className={`flex flex-col p-2.5 rounded-lg border cursor-pointer transition-colors ${importMode === "replace_all" ? "border-rose-500 bg-rose-500/5 text-rose-700 dark:text-rose-400" : "border-border hover:bg-muted/50"}`}>
                  <div className="flex items-center gap-2 font-semibold">
                    <input type="radio" name="daImportMode" checked={importMode === "replace_all"} onChange={() => setImportMode("replace_all")} className="accent-primary" />
                    <span>Ganti Semua Bulan</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground mt-1">Menghapus seluruh aktivitas dan hanya menyimpan data baru ini.</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto border rounded-lg max-h-[260px]">
            <Table>
              <TableHeader className="bg-muted text-[11px]">
                <TableRow>
                  <TableHead className="w-10">No.</TableHead>
                  <TableHead className="w-24">Tanggal</TableHead>
                  <TableHead className="w-36">Name</TableHead>
                  <TableHead>Task Description</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-[11px]">
                {importPreviewRows.slice(0, 6).map((r, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono">{idx + 1}</TableCell>
                    <TableCell className="font-mono whitespace-nowrap">{r.activity_date}</TableCell>
                    <TableCell className="font-semibold">{r.name}</TableCell>
                    <TableCell className="max-w-[220px] truncate">{r.task_description}</TableCell>
                    <TableCell>{renderStatusBadge(r.status)}</TableCell>
                    <TableCell className="max-w-[150px] truncate text-muted-foreground">{r.remarks || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {importPreviewRows.length > 6 && (
            <p className="text-[11px] text-muted-foreground text-center">
              ... dan {importPreviewRows.length - 6} baris aktivitas lainnya
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button variant="outline" size="sm" onClick={() => setIsImportModalOpen(false)} disabled={isProcessingImport}>
              Batal
            </Button>
            <Button variant="default" size="sm" onClick={handleConfirmImport} disabled={isProcessingImport} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
              {isProcessingImport ? (
                <><Loader2 className="size-4 animate-spin" /><span>Menyimpan...</span></>
              ) : (
                <><CheckCircle2 className="size-4" /><span>Import ke {formatPeriodMonth(targetImportMonth)}</span></>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Tambah / Edit Aktivitas */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={handleSaveForm} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-lg">
                {editingActivity ? "Edit Daily Activity" : "Tambah Daily Activity"}
              </DialogTitle>
              <DialogDescription>
                {editingActivity
                  ? "Perbarui informasi rincian aktivitas pekerjaan yang telah dicatat."
                  : "Tambahkan catatan aktivitas pekerjaan baru untuk periode yang dipilih."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 text-xs">
              {/* Row 1: Tanggal Pengajuan + Desainer (dropdown) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="form-activity-date" className="text-xs">
                    Tanggal Pengajuan <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="form-activity-date"
                    type="date"
                    value={formData.activity_date}
                    onChange={(e) => setFormData((prev) => ({ ...prev, activity_date: e.target.value }))}
                    required
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="form-activity-desainer" className="text-xs">
                    Desainer <span className="text-rose-500">*</span>
                  </Label>
                  <Select
                    value={formData.name}
                    onValueChange={(val) => setFormData((prev) => ({ ...prev, name: val }))}
                  >
                    <SelectTrigger id="form-activity-desainer" className="h-9 text-xs">
                      <SelectValue placeholder="Pilih Desainer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Paulus Petrus Parlindungan Sianipar" className="text-xs">
                        <div className="flex items-center gap-2">
                          <span className="inline-block size-2 rounded-full bg-sky-500 shrink-0" />
                          Paulus Sianipar
                        </div>
                      </SelectItem>
                      <SelectItem value="Muhammad Farel Ramadhan" className="text-xs">
                        <div className="flex items-center gap-2">
                          <span className="inline-block size-2 rounded-full bg-indigo-500 shrink-0" />
                          Farel Ramadhan
                        </div>
                      </SelectItem>
                      {/* Tampilkan nama lain dari data aktual jika ada */}
                      {uniqueStaff
                        .filter(
                          (s) =>
                            s.name !== "Paulus Sianipar" &&
                            s.name !== "Farel Ramadhan"
                        )
                        .map((s) => (
                          <SelectItem key={s.name} value={s.name} className="text-xs">
                            <div className="flex items-center gap-2">
                              <span className="inline-block size-2 rounded-full bg-emerald-500 shrink-0" />
                              {s.name}
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Peminta / Divisi (readonly info) + Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Peminta / Divisi</Label>
                  <div className="h-9 flex items-center px-3 rounded-md border bg-muted/40 text-xs text-muted-foreground">
                    Creative Design
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="form-activity-status" className="text-xs">
                    Status <span className="text-rose-500">*</span>
                  </Label>
                  <Select value={formData.status} onValueChange={(val) => setFormData((prev) => ({ ...prev, status: val }))}>
                    <SelectTrigger id="form-activity-status" className="h-9 text-xs">
                      <SelectValue placeholder="Pilih status" />
                    </SelectTrigger>
                    <SelectContent>
                      {activityStatuses.map((st) => (
                        <SelectItem key={st} value={st} className="text-xs">{st}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Judul Permintaan (Task Description) */}
              <div className="space-y-1.5">
                <Label htmlFor="form-task-desc" className="text-xs">
                  Judul Permintaan <span className="text-rose-500">*</span>
                </Label>
                <Textarea
                  id="form-task-desc"
                  value={formData.task_description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, task_description: e.target.value }))}
                  placeholder="Uraikan pekerjaan atau tugas yang dilaksanakan..."
                  rows={4}
                  maxLength={2000}
                  required
                  className="text-xs resize-none"
                />
              </div>

              {/* Target Selesai / Remarks */}
              <div className="space-y-1.5">
                <Label htmlFor="form-activity-remarks" className="text-xs">
                  Target Selesai / Remarks (Opsional)
                </Label>
                <Textarea
                  id="form-activity-remarks"
                  value={formData.remarks}
                  onChange={(e) => setFormData((prev) => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Catatan target penyelesaian, kendala, atau keterangan pelengkap..."
                  rows={3}
                  maxLength={1000}
                  className="text-xs resize-none"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsFormOpen(false)} disabled={isSaving}>
                Batal
              </Button>
              <Button type="submit" size="sm" disabled={isSaving} className="gap-1.5">
                {isSaving && <Loader2 className="size-4 animate-spin" />}
                <span>{editingActivity ? "Simpan Perubahan" : "Tambah Aktivitas"}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: Konfirmasi Hapus */}
      <AlertDialog
        open={Boolean(deleteTargetId)}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Aktivitas Ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini akan menghapus baris daily activity secara permanen. Data yang dihapus tidak dapat dipulihkan kembali.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Hapus Permanen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Content>
  );
}

