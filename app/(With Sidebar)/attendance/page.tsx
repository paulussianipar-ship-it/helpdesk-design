"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  FileSpreadsheet,
  FileUp,
  Info,
  Layers,
  Loader2,
  Moon,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  AttendanceRecord,
  INITIAL_ATTENDANCE_DATA,
  extractPeriodMonth,
  formatPeriodMonth,
} from "@/lib/attendance-seed";

const LOCAL_STORAGE_KEY = "attendance_records_v2";

export default function AttendancePage() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data state
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean | null>(null);
  const [showDbNotice, setShowDbNotice] = useState(false);

  // Month navigation state
  // Default to August 2026 ("2026-08") where initial data belongs, or current month
  const [selectedMonth, setSelectedMonth] = useState<string>("2026-08");

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Import modal state
  const [importPreviewRows, setImportPreviewRows] = useState<AttendanceRecord[]>([]);
  const [detectedImportMonth, setDetectedImportMonth] = useState<string>("2026-08");
  const [targetImportMonth, setTargetImportMonth] = useState<string>("2026-08");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importMode, setImportMode] = useState<"replace_month" | "append_month" | "replace_all">("replace_month");
  const [isProcessingImport, setIsProcessingImport] = useState(false);

  // Add / Edit Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [formData, setFormData] = useState<Partial<AttendanceRecord>>({
    no: 1,
    period_month: "2026-08",
    employee_no: "",
    name: "",
    date: "",
    shift: "Shift Daily from 08:00 to 17:00",
    start_time: "08:00",
    end_time: "17:00",
    status: "EAI,PRS",
    overtime: 0,
    overtime_index: "0",
  });
  const [isSavingRecord, setIsSavingRecord] = useState(false);

  // Delete modal state
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Load Data
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Cek tabel di Supabase
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .order("period_month", { ascending: false })
        .order("no_seq", { ascending: true });

      if (!error && data && data.length > 0) {
        const mapped: AttendanceRecord[] = data.map((d: any, idx: number) => ({
          id: d.id,
          no: d.no_seq ?? idx + 1,
          period_month: d.period_month || extractPeriodMonth(d.date_text) || "2026-08",
          employee_no: d.employee_no,
          name: d.name,
          date: d.date_text,
          shift: d.shift || "-",
          start_time: d.start_time || "-",
          end_time: d.end_time || "-",
          status: d.status || "-",
          overtime: Number(d.overtime) || 0,
          overtime_index: String(d.overtime_index ?? "0"),
          created_at: d.created_at,
        }));
        setRecords(mapped);
        setSupabaseConnected(true);
        setShowDbNotice(false);

        // Set selectedMonth jika belum ada
        if (mapped.length > 0 && !mapped.some((m) => m.period_month === selectedMonth)) {
          setSelectedMonth(mapped[0].period_month);
        }
      } else if (!error && data && data.length === 0) {
        // Tabel ada di Supabase tapi kosong -> Gunakan initial seed
        const localSaved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (localSaved) {
          try {
            setRecords(JSON.parse(localSaved));
          } catch {
            setRecords(INITIAL_ATTENDANCE_DATA);
          }
        } else {
          setRecords(INITIAL_ATTENDANCE_DATA);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_ATTENDANCE_DATA));
        }
        setSupabaseConnected(true);
        setShowDbNotice(false);
      } else {
        // Tabel di Supabase belum dibuat -> Gunakan local storage atau seed
        setSupabaseConnected(false);
        setShowDbNotice(true);
        const localSaved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (localSaved) {
          try {
            setRecords(JSON.parse(localSaved));
          } catch {
            setRecords(INITIAL_ATTENDANCE_DATA);
          }
        } else {
          setRecords(INITIAL_ATTENDANCE_DATA);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_ATTENDANCE_DATA));
        }
      }
    } catch (err) {
      console.warn("Error checking Supabase attendance table:", err);
      setSupabaseConnected(false);
      setShowDbNotice(true);
      const localSaved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (localSaved) {
        try {
          setRecords(JSON.parse(localSaved));
        } catch {
          setRecords(INITIAL_ATTENDANCE_DATA);
        }
      } else {
        setRecords(INITIAL_ATTENDANCE_DATA);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Save records with local storage & Supabase sync
  const saveRecords = async (newRecords: AttendanceRecord[]) => {
    setRecords(newRecords);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newRecords));
  };

  // List of available months based on dataset
  const availableMonths = useMemo(() => {
    const monthCounts = new Map<string, number>();
    records.forEach((r) => {
      const p = r.period_month || "2026-08";
      monthCounts.set(p, (monthCounts.get(p) || 0) + 1);
    });

    // Pastikan bulan yang sedang dipilih ada dalam daftar
    if (selectedMonth !== "all" && !monthCounts.has(selectedMonth)) {
      monthCounts.set(selectedMonth, 0);
    }

    // Urutkan descending (terbaru di atas)
    return Array.from(monthCounts.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([period, count]) => ({
        period,
        label: formatPeriodMonth(period),
        count,
      }));
  }, [records, selectedMonth]);

  // Navigate months (Prev / Next)
  const handleShiftMonth = (direction: -1 | 1) => {
    if (selectedMonth === "all") {
      // Jika sedang 'all', pilih bulan pertama
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

  // Helper render badges
  const renderStatusBadge = (statusStr: string) => {
    const raw = statusStr.trim();
    if (!raw) return <span className="text-muted-foreground">-</span>;

    const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);

    return (
      <div className="flex flex-wrap gap-1 items-center">
        {parts.map((p, idx) => {
          let badgeClass = "bg-muted text-muted-foreground border-transparent";
          if (p === "PRS") {
            badgeClass = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold";
          } else if (p === "OVT") {
            badgeClass = "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30 font-semibold";
          } else if (p === "OFF") {
            badgeClass = "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 font-semibold";
          } else if (p === "ABS") {
            badgeClass = "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 font-semibold";
          } else if (p === "EAI") {
            badgeClass = "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
          }

          return (
            <Badge key={idx} variant="outline" className={`text-[11px] px-1.5 py-0 ${badgeClass}`}>
              {p}
            </Badge>
          );
        })}
      </div>
    );
  };

  // Data yang difilter berdasarkan bulan aktif
  const monthRecords = useMemo(() => {
    if (selectedMonth === "all") return records;
    return records.filter((r) => r.period_month === selectedMonth);
  }, [records, selectedMonth]);

  // KPI Calculations untuk bulan yang dipilih
  const stats = useMemo(() => {
    let prsCount = 0;
    let offCount = 0;
    let absCount = 0;
    let ovtCount = 0;
    let totalOvertimeMinutes = 0;

    monthRecords.forEach((r) => {
      const s = r.status.toUpperCase();
      if (s.includes("PRS")) prsCount++;
      if (s.includes("OFF")) offCount++;
      if (s.includes("ABS")) absCount++;
      if (s.includes("OVT")) ovtCount++;
      totalOvertimeMinutes += Number(r.overtime) || 0;
    });

    const hours = Math.floor(totalOvertimeMinutes / 60);
    const mins = totalOvertimeMinutes % 60;
    const overtimeDuration =
      hours > 0 ? `${hours} jam ${mins > 0 ? `${mins} mnt` : ""}` : `${mins} mnt`;

    return {
      total: monthRecords.length,
      prsCount,
      offCount,
      absCount,
      ovtCount,
      totalOvertimeMinutes,
      overtimeDuration,
    };
  }, [monthRecords]);

  // Unique employees in the current month
  const uniqueEmployees = useMemo(() => {
    const map = new Map<string, string>();
    monthRecords.forEach((r) => {
      if (r.employee_no && !map.has(r.employee_no)) {
        map.set(r.employee_no, r.name);
      }
    });
    return Array.from(map.entries()).map(([employee_no, name]) => ({
      employee_no,
      name,
    }));
  }, [monthRecords]);

  // Filtered & Paginated records
  const filteredRecords = useMemo(() => {
    return monthRecords.filter((rec) => {
      // Search term
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchName = rec.name.toLowerCase().includes(query);
        const matchEmp = rec.employee_no.toLowerCase().includes(query);
        const matchShift = rec.shift.toLowerCase().includes(query);
        const matchDate = rec.date.toLowerCase().includes(query);
        if (!matchName && !matchEmp && !matchShift && !matchDate) return false;
      }

      // Status filter
      if (statusFilter !== "all") {
        const s = rec.status.toUpperCase();
        if (statusFilter === "PRS" && !s.includes("PRS")) return false;
        if (statusFilter === "OFF" && !s.includes("OFF")) return false;
        if (statusFilter === "ABS" && !s.includes("ABS")) return false;
        if (statusFilter === "OVT" && !s.includes("OVT")) return false;
      }

      // Employee filter
      if (employeeFilter !== "all" && rec.employee_no !== employeeFilter) {
        return false;
      }

      return true;
    });
  }, [monthRecords, searchTerm, statusFilter, employeeFilter]);

  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  // Reset filter
  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setEmployeeFilter("all");
    setCurrentPage(1);
  };

  // Excel parser
  const parseExcelFile = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];

    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    });

    if (!rows || rows.length === 0) {
      throw new Error("File kosong atau tidak dapat dibaca.");
    }

    // Cari baris header
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = rows[i].map((cell) => String(cell || "").trim().toLowerCase());
      if (
        row.some(
          (c) =>
            c.includes("employee") ||
            c.includes("nik") ||
            c.includes("name") ||
            c.includes("nama") ||
            c.includes("shift")
        )
      ) {
        headerRowIdx = i;
        break;
      }
    }

    if (headerRowIdx === -1) {
      throw new Error(
        "Kolom header tidak ditemukan. Pastikan file memiliki header: No., Employee No, Name, Date, Shift, Start Time, End Time, Status, Overtime, Overtime Index."
      );
    }

    const headers = rows[headerRowIdx].map((c) =>
      String(c || "")
        .trim()
        .toLowerCase()
        .replace(/[._]/g, " ")
        .replace(/\s+/g, " ")
    );

    const findIdx = (keywords: string[]) => {
      return headers.findIndex((h) =>
        keywords.some((k) => h === k || h.includes(k))
      );
    };

    const colNo = findIdx(["no", "nomor"]);
    const colEmp = findIdx(["employee no", "employee", "nik", "no karyawan", "nip"]);
    const colName = findIdx(["name", "nama", "employee name"]);
    const colDate = findIdx(["date", "tanggal", "tgl"]);
    const colShift = findIdx(["shift", "jadwal"]);
    const colStart = findIdx(["start time", "start", "jam masuk", "masuk"]);
    const colEnd = findIdx(["end time", "end", "jam keluar", "keluar", "pulang"]);
    const colStatus = findIdx(["status", "kehadiran"]);
    const colOvt = findIdx(["overtime", "lembur"]);
    const colOvtIdx = findIdx(["overtime index", "ovt index", "index lembur", "index"]);

    const parsed: AttendanceRecord[] = [];
    const detectedMonthsCount = new Map<string, number>();

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every((c) => !String(c || "").trim())) continue;

      const empNo = colEmp !== -1 ? String(row[colEmp] || "").trim() : "";
      const empName = colName !== -1 ? String(row[colName] || "").trim() : "";

      if (!empNo && !empName) continue;

      const noVal = colNo !== -1 ? parseInt(String(row[colNo] || "").replace(/\D/g, "")) || parsed.length + 1 : parsed.length + 1;
      const dateVal = colDate !== -1 ? String(row[colDate] || "").trim() : "";
      const shiftVal = colShift !== -1 ? String(row[colShift] || "").trim() : "-";
      const startVal = colStart !== -1 ? String(row[colStart] || "").trim() || "-" : "-";
      const endVal = colEnd !== -1 ? String(row[colEnd] || "").trim() || "-" : "-";
      const statusVal = colStatus !== -1 ? String(row[colStatus] || "").trim() || "PRS" : "PRS";
      const ovtVal = colOvt !== -1 ? parseFloat(String(row[colOvt] || "").replace(",", ".")) || 0 : 0;
      const ovtIdxVal = colOvtIdx !== -1 ? String(row[colOvtIdx] || "0").trim() : "0";

      const rowMonth = extractPeriodMonth(dateVal) || selectedMonth || "2026-08";
      detectedMonthsCount.set(rowMonth, (detectedMonthsCount.get(rowMonth) || 0) + 1);

      parsed.push({
        id: `att-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        no: noVal,
        period_month: rowMonth,
        employee_no: empNo,
        name: empName,
        date: dateVal,
        shift: shiftVal,
        start_time: startVal,
        end_time: endVal,
        status: statusVal,
        overtime: ovtVal,
        overtime_index: ovtIdxVal,
      });
    }

    // Tentukan bulan dominan dalam file
    let primaryMonth = selectedMonth !== "all" ? selectedMonth : "2026-08";
    let maxCount = 0;
    detectedMonthsCount.forEach((count, month) => {
      if (count > maxCount) {
        maxCount = count;
        primaryMonth = month;
      }
    });

    return { parsed, primaryMonth };
  };

  // Handler file input change
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = "";

    try {
      toast.loading("Menganalisis file Excel...", { id: "import-excel" });
      const { parsed, primaryMonth } = await parseExcelFile(file);

      if (parsed.length === 0) {
        toast.error("Tidak ada data presensi valid yang ditemukan di file.", {
          id: "import-excel",
        });
        return;
      }

      setImportPreviewRows(parsed);
      setDetectedImportMonth(primaryMonth);
      setTargetImportMonth(primaryMonth);
      setImportMode("replace_month");
      setIsImportModalOpen(true);

      toast.success(
        `${parsed.length} baris data berhasil dibaca. Periode terdeteksi: ${formatPeriodMonth(primaryMonth)}.`,
        { id: "import-excel" }
      );
    } catch (err: any) {
      toast.error(err.message || "Gagal memproses file Excel.", {
        id: "import-excel",
      });
    }
  };

  // Konfirmasi Import
  const handleConfirmImport = async () => {
    setIsProcessingImport(true);
    try {
      // Beri period_month target pada setiap baris yang diimpor
      const normalizedImportRows = importPreviewRows.map((r, idx) => ({
        ...r,
        no: idx + 1,
        period_month: targetImportMonth,
      }));

      let finalRecords: AttendanceRecord[];

      if (importMode === "replace_month") {
        // Gantikan hanya data pada bulan target, data bulan lain tetap aman
        const otherMonths = records.filter((r) => r.period_month !== targetImportMonth);
        finalRecords = [...otherMonths, ...normalizedImportRows];
      } else if (importMode === "append_month") {
        // Tambahkan ke data bulan ini
        const existingInMonth = records.filter((r) => r.period_month === targetImportMonth);
        const renumbered = normalizedImportRows.map((r, idx) => ({
          ...r,
          no: existingInMonth.length + idx + 1,
        }));
        finalRecords = [...records, ...renumbered];
      } else {
        // Gantikan semua data dari semua bulan
        finalRecords = normalizedImportRows;
      }

      // Simpan ke local state & storage
      await saveRecords(finalRecords);

      // Sinkronkan ke Supabase jika tabel tersedia
      if (supabaseConnected) {
        try {
          if (importMode === "replace_month") {
            await supabase
              .from("attendance")
              .delete()
              .eq("period_month", targetImportMonth);
          } else if (importMode === "replace_all") {
            await supabase.from("attendance").delete().neq("employee_no", "");
          }

          const dbPayload = normalizedImportRows.map((r, idx) => ({
            no_seq: idx + 1,
            period_month: targetImportMonth,
            employee_no: r.employee_no,
            name: r.name,
            date_text: r.date,
            shift: r.shift,
            start_time: r.start_time,
            end_time: r.end_time,
            status: r.status,
            overtime: r.overtime,
            overtime_index: r.overtime_index,
          }));

          const batchSize = 100;
          for (let b = 0; b < dbPayload.length; b += batchSize) {
            const chunk = dbPayload.slice(b, b + batchSize);
            await supabase.from("attendance").insert(chunk);
          }
        } catch (dbErr) {
          console.warn("Supabase insert warning:", dbErr);
        }
      }

      // Pindahkan tampilan aktif ke bulan yang baru diimpor
      setSelectedMonth(targetImportMonth);
      setCurrentPage(1);

      toast.success(
        `Berhasil mengimpor ${normalizedImportRows.length} data untuk periode ${formatPeriodMonth(targetImportMonth)}.`
      );
      setIsImportModalOpen(false);
      setImportPreviewRows([]);
    } catch (error: any) {
      toast.error("Gagal menyimpan import: " + error.message);
    } finally {
      setIsProcessingImport(false);
    }
  };

  // Export Excel untuk bulan terpilih
  const handleExportExcel = () => {
    if (filteredRecords.length === 0) {
      toast.error("Tidak ada data untuk diekspor pada bulan ini.");
      return;
    }

    const exportRows = filteredRecords.map((r, idx) => ({
      "No.": idx + 1,
      "Employee No": r.employee_no,
      Name: r.name,
      Date: r.date,
      Shift: r.shift,
      "Start Time": r.start_time,
      "End Time": r.end_time,
      Status: r.status,
      Overtime: r.overtime,
      "Overtime Index": r.overtime_index,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    worksheet["!cols"] = [
      { wch: 6 },
      { wch: 15 },
      { wch: 35 },
      { wch: 18 },
      { wch: 32 },
      { wch: 12 },
      { wch: 12 },
      { wch: 15 },
      { wch: 10 },
      { wch: 14 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      selectedMonth !== "all" ? formatPeriodMonth(selectedMonth) : "Attendance"
    );

    const filename =
      selectedMonth !== "all"
        ? `Attendance_List_${selectedMonth}.xlsx`
        : `Attendance_List_Semua_Bulan.xlsx`;

    XLSX.writeFile(workbook, filename);
    toast.success(`Berhasil mengekspor ${filteredRecords.length} data ke ${filename}.`);
  };

  // Download Template
  const handleDownloadTemplate = () => {
    const templateRows = [
      {
        "No.": 1,
        "Employee No": "GIS25100212",
        Name: "Muhammad Farel Ramadhan",
        Date: "Tue, 01 Sep 2026",
        Shift: "Shift Daily from 08:00 to 17:00",
        "Start Time": "07:54",
        "End Time": "17:04",
        Status: "EAI,PRS",
        Overtime: 0,
        "Overtime Index": "0",
      },
      {
        "No.": 2,
        "Employee No": "GIS19040039",
        Name: "Paulus Petrus Parlindungan Sianipar",
        Date: "Tue, 01 Sep 2026",
        Shift: "Shift Daily from 08:00 to 17:00",
        "Start Time": "07:17",
        "End Time": "21:11",
        Status: "EAI,PRS",
        Overtime: 0,
        "Overtime Index": "0",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateRows);
    worksheet["!cols"] = [
      { wch: 6 },
      { wch: 15 },
      { wch: 35 },
      { wch: 18 },
      { wch: 32 },
      { wch: 12 },
      { wch: 12 },
      { wch: 15 },
      { wch: 10 },
      { wch: 14 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template Bulanan");
    XLSX.writeFile(workbook, "Template_Attendance_Bulanan.xlsx");
    toast.success("Template Excel berhasil diunduh.");
  };

  // Buka dialog tambah manual
  const handleOpenAddForm = () => {
    setEditingRecord(null);
    const activePeriod = selectedMonth !== "all" ? selectedMonth : "2026-08";
    setFormData({
      no: monthRecords.length + 1,
      period_month: activePeriod,
      employee_no: "",
      name: "",
      date: new Date().toLocaleDateString("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      shift: "Shift Daily from 08:00 to 17:00",
      start_time: "08:00",
      end_time: "17:00",
      status: "EAI,PRS",
      overtime: 0,
      overtime_index: "0",
    });
    setIsFormOpen(true);
  };

  // Buka dialog edit
  const handleOpenEditForm = (rec: AttendanceRecord) => {
    setEditingRecord(rec);
    setFormData({ ...rec });
    setIsFormOpen(true);
  };

  // Simpan form manual
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim() || !formData.employee_no?.trim()) {
      toast.error("Nama dan Employee No wajib diisi.");
      return;
    }

    setIsSavingRecord(true);
    try {
      const recPeriod =
        formData.period_month ||
        extractPeriodMonth(formData.date || "") ||
        selectedMonth ||
        "2026-08";

      if (editingRecord) {
        const updatedList = records.map((r) =>
          r.id === editingRecord.id
            ? ({
                ...r,
                ...formData,
                period_month: recPeriod,
                overtime: Number(formData.overtime) || 0,
                overtime_index: String(formData.overtime_index ?? "0"),
              } as AttendanceRecord)
            : r
        );
        await saveRecords(updatedList);

        if (supabaseConnected) {
          await supabase
            .from("attendance")
            .update({
              period_month: recPeriod,
              employee_no: formData.employee_no,
              name: formData.name,
              date_text: formData.date,
              shift: formData.shift,
              start_time: formData.start_time,
              end_time: formData.end_time,
              status: formData.status,
              overtime: Number(formData.overtime) || 0,
              overtime_index: String(formData.overtime_index ?? "0"),
            })
            .eq("id", editingRecord.id);
        }

        toast.success("Data presensi berhasil diperbarui.");
      } else {
        const newRecord: AttendanceRecord = {
          id: `att-${Date.now()}`,
          no: monthRecords.length + 1,
          period_month: recPeriod,
          employee_no: formData.employee_no.trim(),
          name: formData.name.trim(),
          date: formData.date?.trim() || "-",
          shift: formData.shift?.trim() || "-",
          start_time: formData.start_time?.trim() || "-",
          end_time: formData.end_time?.trim() || "-",
          status: formData.status?.trim() || "PRS",
          overtime: Number(formData.overtime) || 0,
          overtime_index: String(formData.overtime_index ?? "0").trim(),
        };

        const updatedList = [newRecord, ...records];
        await saveRecords(updatedList);

        if (supabaseConnected) {
          await supabase.from("attendance").insert({
            no_seq: newRecord.no,
            period_month: newRecord.period_month,
            employee_no: newRecord.employee_no,
            name: newRecord.name,
            date_text: newRecord.date,
            shift: newRecord.shift,
            start_time: newRecord.start_time,
            end_time: newRecord.end_time,
            status: newRecord.status,
            overtime: newRecord.overtime,
            overtime_index: newRecord.overtime_index,
          });
        }

        toast.success("Data presensi berhasil ditambahkan.");
      }

      setIsFormOpen(false);
    } catch (err: any) {
      toast.error("Gagal menyimpan: " + err.message);
    } finally {
      setIsSavingRecord(false);
    }
  };

  // Hapus baris
  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      const updatedList = records.filter((r) => r.id !== deleteTargetId);
      await saveRecords(updatedList);

      if (supabaseConnected) {
        await supabase.from("attendance").delete().eq("id", deleteTargetId);
      }

      toast.success("Data presensi berhasil dihapus.");
    } catch (err: any) {
      toast.error("Gagal menghapus: " + err.message);
    } finally {
      setDeleteTargetId(null);
    }
  };

  // Salin SQL
  const handleCopySql = () => {
    const sql = `-- Salin dan jalankan di SQL Editor Supabase:
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  no_seq integer,
  period_month text not null default to_char(now(), 'YYYY-MM'),
  employee_no text not null,
  name text not null,
  date_text text not null,
  shift text,
  start_time text default '-',
  end_time text default '-',
  status text not null,
  overtime numeric default 0,
  overtime_index text default '0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.attendance 
  add column if not exists period_month text not null default to_char(now(), 'YYYY-MM');

create index if not exists attendance_period_month_idx on public.attendance (period_month);
alter table public.attendance enable row level security;
create policy "attendance authenticated read" on public.attendance for select to authenticated using (true);
create policy "attendance authenticated insert" on public.attendance for insert to authenticated with check (true);
create policy "attendance authenticated update" on public.attendance for update to authenticated using (true);
create policy "attendance authenticated delete" on public.attendance for delete to authenticated using (true);
notify pgrst, 'reload schema';`;

    navigator.clipboard.writeText(sql);
    toast.success("SQL skema berhasil disalin ke clipboard!");
  };

  return (
    <div className="col-span-12 flex flex-col gap-5">
      {/* Hidden file input for Excel upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".xlsx,.xls,.csv"
        className="hidden"
      />

      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card border rounded-xl p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Attendance List</h1>
            <Badge variant="secondary" className="font-mono text-xs">
              {monthRecords.length} Records
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Kelola dan impor rekap data presensi karyawan per bulan dengan format kolom presisi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tombol Import Excel Per Bulan */}
          <Button
            variant="default"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="gap-1.5 shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            <FileUp className="size-4" />
            <span>Import Excel Bulanan</span>
          </Button>

          {/* Tombol Export Excel */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="gap-1.5 shadow-xs"
          >
            <Download className="size-4" />
            <span>Ekspor Excel</span>
          </Button>

          {/* Tombol Template */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadTemplate}
            title="Download Template Format Excel"
            className="gap-1 text-muted-foreground hover:text-foreground"
          >
            <FileSpreadsheet className="size-4" />
            <span className="hidden md:inline">Template</span>
          </Button>

          {/* Tombol Tambah Manual */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenAddForm}
            className="gap-1.5 shadow-xs border-primary/40 text-primary hover:bg-primary/5"
          >
            <Plus className="size-4" />
            <span>Tambah</span>
          </Button>

          {/* Refresh Data */}
          <Button
            variant="ghost"
            size="icon"
            onClick={loadData}
            title="Muat Ulang Data"
            className="size-8"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Navigasi Pemilih Bulan (Monthly Switcher) */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card border rounded-xl p-4 shadow-xs">
        {/* Kontrol Bulan Sebelumnya / Berikutnya */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border bg-muted/30 p-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleShiftMonth(-1)}
              disabled={selectedMonth === "all"}
              title="Bulan Sebelumnya"
              className="size-8 rounded-md hover:bg-background"
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
              variant="ghost"
              size="icon"
              onClick={() => handleShiftMonth(1)}
              disabled={selectedMonth === "all"}
              title="Bulan Berikutnya"
              className="size-8 rounded-md hover:bg-background"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          {/* Dropdown Pemilih Periode Bulan */}
          <div className="w-full sm:w-[190px]">
            <Select
              value={selectedMonth}
              onValueChange={(val) => {
                setSelectedMonth(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Pilih Periode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Periode ({records.length})</SelectItem>
                {availableMonths.map((m) => (
                  <SelectItem key={m.period} value={m.period}>
                    {m.label} ({m.count} data)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Input Month Picker Langsung */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground border rounded-lg px-2.5 h-9 bg-background">
            <Calendar className="size-3.5" />
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
            />
          </div>
        </div>

        {/* Info Ringkas Periode Aktif */}
        <div className="flex items-center gap-2 self-start md:self-auto text-xs text-muted-foreground">
          <span>Menampilkan presensi:</span>
          <Badge variant="outline" className="font-semibold text-primary border-primary/30">
            {selectedMonth === "all" ? "Semua Periode" : formatPeriodMonth(selectedMonth)}
          </Badge>
          <span className="font-mono">({monthRecords.length} baris)</span>
        </div>
      </div>

      {/* Database Warning Banner (jika belum migrasi di Supabase) */}
      {showDbNotice && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-sm">
          <div className="flex items-start gap-2.5">
            <Info className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                Penyimpanan Lokal Aktif (Fitur Import Bulanan Siap Digunakan)
              </p>
              <p className="text-xs text-amber-800/90 dark:text-amber-300/90 mt-0.5">
                Tabel <code className="font-mono bg-amber-500/20 px-1 py-0.5 rounded">public.attendance</code> di Supabase belum dibuat. Semua data dan hasil import bulanan tersimpan secara lokal dan otomatis dikelompokkan per bulan. Jalankan migrasi SQL untuk menyinkronkan ke Supabase cloud.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopySql}
              className="text-xs h-8 gap-1.5 border-amber-500/40 bg-background/80 hover:bg-amber-500/10"
            >
              <Copy className="size-3.5" />
              <span>Salin SQL Skema</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDbNotice(false)}
              className="text-xs h-8 text-muted-foreground"
            >
              Tutup
            </Button>
          </div>
        </div>
      )}

      {/* KPI Cards Ringkasan Bulan Terpilih */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Data */}
        <div className="p-3.5 bg-card border rounded-xl shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Presensi Bulan Ini</span>
            <Layers className="size-4 text-primary" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold tracking-tight">{stats.total}</span>
            <span className="text-[11px] text-muted-foreground ml-1.5">baris</span>
          </div>
        </div>

        {/* Hadir (PRS) */}
        <div className="p-3.5 bg-card border rounded-xl shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="text-xs font-medium">Hadir (PRS)</span>
            <CheckCircle2 className="size-4" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {stats.prsCount}
            </span>
            <span className="text-[11px] text-muted-foreground ml-1.5">hari</span>
          </div>
        </div>

        {/* Libur (OFF) */}
        <div className="p-3.5 bg-card border rounded-xl shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
            <span className="text-xs font-medium">Libur (OFF)</span>
            <Moon className="size-4" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {stats.offCount}
            </span>
            <span className="text-[11px] text-muted-foreground ml-1.5">hari</span>
          </div>
        </div>

        {/* Absen (ABS) */}
        <div className="p-3.5 bg-card border rounded-xl shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
            <span className="text-xs font-medium">Absen (ABS)</span>
            <XCircle className="size-4" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
              {stats.absCount}
            </span>
            <span className="text-[11px] text-muted-foreground ml-1.5">hari</span>
          </div>
        </div>

        {/* Sesi Lembur (OVT) */}
        <div className="p-3.5 bg-card border rounded-xl shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400">
            <span className="text-xs font-medium">Sesi Lembur</span>
            <Clock className="size-4" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold tracking-tight text-purple-600 dark:text-purple-400">
              {stats.ovtCount}
            </span>
            <span className="text-[11px] text-muted-foreground ml-1.5">sesi</span>
          </div>
        </div>

        {/* Total Overtime */}
        <div className="p-3.5 bg-card border rounded-xl shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Durasi Lembur</span>
            <Clock className="size-4 text-purple-500" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold tracking-tight text-purple-600 dark:text-purple-400">
              {stats.totalOvertimeMinutes}
            </span>
            <span className="text-[11px] text-muted-foreground ml-1">mnt</span>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              ({stats.overtimeDuration})
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Bar Pencarian */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card border rounded-xl p-4 shadow-xs">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          {/* Pencarian */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Cari nama, NIK/Employee No, shift..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Filter Status */}
          <div className="w-[160px]">
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="PRS">Hadir (PRS)</SelectItem>
                <SelectItem value="OFF">Libur (OFF)</SelectItem>
                <SelectItem value="ABS">Absen (ABS)</SelectItem>
                <SelectItem value="OVT">Lembur (OVT)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filter Karyawan */}
          <div className="w-[200px]">
            <Select
              value={employeeFilter}
              onValueChange={(val) => {
                setEmployeeFilter(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-sm truncate">
                <SelectValue placeholder="Semua Karyawan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Karyawan</SelectItem>
                {uniqueEmployees.map((emp) => (
                  <SelectItem key={emp.employee_no} value={emp.employee_no}>
                    {emp.name} ({emp.employee_no})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tombol Reset Filter */}
          {(searchTerm || statusFilter !== "all" || employeeFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-9 text-xs text-muted-foreground hover:text-foreground"
            >
              Reset Filter
            </Button>
          )}
        </div>

        {/* Kontrol Rows Per Page */}
        <div className="flex items-center gap-2 self-end md:self-auto text-xs text-muted-foreground">
          <span>Baris:</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-[70px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="15">15</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabel Data Presensi (10 Kolom Excel) */}
      <div className="border rounded-xl bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50 text-xs">
              <TableRow>
                <TableHead className="w-[50px] text-center font-bold">No.</TableHead>
                <TableHead className="min-w-[120px] font-bold">Employee No</TableHead>
                <TableHead className="min-w-[220px] font-bold">Name</TableHead>
                <TableHead className="min-w-[140px] font-bold">Date</TableHead>
                <TableHead className="min-w-[210px] font-bold">Shift</TableHead>
                <TableHead className="min-w-[90px] text-center font-bold">Start Time</TableHead>
                <TableHead className="min-w-[90px] text-center font-bold">End Time</TableHead>
                <TableHead className="min-w-[130px] font-bold">Status</TableHead>
                <TableHead className="min-w-[90px] text-center font-bold">Overtime</TableHead>
                <TableHead className="min-w-[110px] text-center font-bold">Overtime Index</TableHead>
                <TableHead className="w-[80px] text-center font-bold">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-xs">
              {loading ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-36 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="size-6 animate-spin text-primary" />
                      <span>Memuat data attendance...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-36 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <UserCheck className="size-8 text-muted-foreground/50" />
                      <p className="font-medium">
                        Belum ada data presensi untuk periode{" "}
                        <span className="text-foreground font-semibold">
                          {selectedMonth === "all" ? "Semua" : formatPeriodMonth(selectedMonth)}
                        </span>
                        .
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <FileUp className="size-3.5" />
                          <span>Import Excel Bulan Ini</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedMonth("2026-08")}
                          className="text-xs"
                        >
                          Lihat Bulan Agustus 2026
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRecords.map((item, index) => {
                  const displayIndex = (currentPage - 1) * pageSize + index + 1;
                  const isPaulus = item.name.toLowerCase().includes("paulus");
                  const isFarel = item.name.toLowerCase().includes("farel");

                  return (
                    <TableRow
                      key={item.id || index}
                      className="hover:bg-muted/40 transition-colors border-b"
                    >
                      {/* 1. No. */}
                      <TableCell className="text-center font-mono text-muted-foreground">
                        {displayIndex}.
                      </TableCell>

                      {/* 2. Employee No */}
                      <TableCell className="font-mono font-medium text-foreground">
                        <span className="px-1.5 py-0.5 bg-muted rounded text-[11px]">
                          {item.employee_no}
                        </span>
                      </TableCell>

                      {/* 3. Name */}
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-block size-2 rounded-full ${
                              isPaulus
                                ? "bg-sky-500"
                                : isFarel
                                ? "bg-indigo-500"
                                : "bg-emerald-500"
                            }`}
                          />
                          <span className="font-semibold text-foreground">
                            {item.name}
                          </span>
                        </div>
                      </TableCell>

                      {/* 4. Date */}
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {item.date}
                      </TableCell>

                      {/* 5. Shift */}
                      <TableCell>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full inline-block ${
                            item.shift.includes("OFF")
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {item.shift}
                        </span>
                      </TableCell>

                      {/* 6. Start Time */}
                      <TableCell className="text-center font-mono">
                        <span
                          className={
                            item.start_time !== "-"
                              ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                              : "text-muted-foreground"
                          }
                        >
                          {item.start_time}
                        </span>
                      </TableCell>

                      {/* 7. End Time */}
                      <TableCell className="text-center font-mono">
                        <span
                          className={
                            item.end_time !== "-"
                              ? "text-foreground font-semibold"
                              : "text-muted-foreground"
                          }
                        >
                          {item.end_time}
                        </span>
                      </TableCell>

                      {/* 8. Status */}
                      <TableCell>{renderStatusBadge(item.status)}</TableCell>

                      {/* 9. Overtime */}
                      <TableCell className="text-center font-mono">
                        {Number(item.overtime) > 0 ? (
                          <span className="px-1.5 py-0.5 bg-purple-500/15 text-purple-700 dark:text-purple-300 font-bold rounded">
                            {item.overtime} mnt
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>

                      {/* 10. Overtime Index */}
                      <TableCell className="text-center font-mono">
                        {item.overtime_index && item.overtime_index !== "0" ? (
                          <span className="px-1.5 py-0.5 bg-purple-500/15 text-purple-700 dark:text-purple-300 font-bold rounded">
                            {item.overtime_index}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>

                      {/* Aksi */}
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEditForm(item)}
                            title="Edit Data"
                            className="size-7 text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTargetId(item.id)}
                            title="Hapus Data"
                            className="size-7 text-muted-foreground hover:text-rose-600"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t bg-muted/20 text-xs text-muted-foreground">
          <div>
            Menampilkan{" "}
            <span className="font-semibold text-foreground">
              {filteredRecords.length === 0
                ? 0
                : (currentPage - 1) * pageSize + 1}
            </span>{" "}
            -{" "}
            <span className="font-semibold text-foreground">
              {Math.min(currentPage * pageSize, filteredRecords.length)}
            </span>{" "}
            dari{" "}
            <span className="font-semibold text-foreground">
              {filteredRecords.length}
            </span>{" "}
            data
            {filteredRecords.length !== monthRecords.length && (
              <span> (difilter dari total {monthRecords.length} bulan ini)</span>
            )}
          </div>

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
            <div className="px-2 font-medium text-foreground">
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
        </div>
      </div>

      {/* MODAL: Import Excel Per Bulan */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FileUp className="size-5 text-emerald-600" />
              <span>Import Data Presensi Bulanan</span>
            </DialogTitle>
            <DialogDescription>
              Ditemukan{" "}
              <strong className="text-foreground">
                {importPreviewRows.length} baris data
              </strong>{" "}
              dari file Excel/CSV yang diunggah.
            </DialogDescription>
          </DialogHeader>

          {/* Konfigurasi Target Bulan & Mode Import */}
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
                    Hanya data bulan {formatPeriodMonth(targetImportMonth)} yang diganti. Bulan lain tetap aman!
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
                    Menambahkan {importPreviewRows.length} data baru ke dalam bulan {formatPeriodMonth(targetImportMonth)}.
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
                    Menghapus seluruh presensi dan hanya menyimpan data baru ini.
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Tabel Preview (8 baris pertama) */}
          <div className="flex-1 overflow-auto border rounded-lg max-h-[260px]">
            <Table>
              <TableHeader className="bg-muted text-[11px]">
                <TableRow>
                  <TableHead className="w-12">No.</TableHead>
                  <TableHead>Employee No</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>In</TableHead>
                  <TableHead>Out</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>OVT</TableHead>
                  <TableHead>Index</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-[11px]">
                {importPreviewRows.slice(0, 8).map((r, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono">{idx + 1}</TableCell>
                    <TableCell className="font-mono font-medium">{r.employee_no}</TableCell>
                    <TableCell className="font-semibold">{r.name}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.date}</TableCell>
                    <TableCell className="text-muted-foreground">{r.shift}</TableCell>
                    <TableCell className="font-mono">{r.start_time}</TableCell>
                    <TableCell className="font-mono">{r.end_time}</TableCell>
                    <TableCell>{renderStatusBadge(r.status)}</TableCell>
                    <TableCell className="font-mono">{r.overtime}</TableCell>
                    <TableCell className="font-mono">{r.overtime_index}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {importPreviewRows.length > 8 && (
            <p className="text-[11px] text-muted-foreground text-center">
              ... dan {importPreviewRows.length - 8} baris data lainnya
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsImportModalOpen(false)}
              disabled={isProcessingImport}
            >
              Batal
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleConfirmImport}
              disabled={isProcessingImport}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              {isProcessingImport ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Menyimpan Data Bulan Ini...</span>
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

      {/* MODAL: Tambah / Edit Manual Data Presensi */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRecord ? "Edit Data Presensi" : "Tambah Data Presensi"}
            </DialogTitle>
            <DialogDescription>
              Isi data presensi karyawan sesuai format 10 kolom.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveForm} className="space-y-3.5 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Periode Bulan (YYYY-MM)</Label>
                <Input
                  type="month"
                  required
                  value={formData.period_month || selectedMonth}
                  onChange={(e) =>
                    setFormData({ ...formData, period_month: e.target.value })
                  }
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Employee No (NIK) *</Label>
                <Input
                  required
                  placeholder="e.g. GIS19040039"
                  value={formData.employee_no || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, employee_no: e.target.value })
                  }
                  className="h-8 text-xs mt-1 font-mono"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Nama Karyawan *</Label>
              <Input
                required
                placeholder="e.g. Paulus Petrus Parlindungan Sianipar"
                value={formData.name || ""}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="h-8 text-xs mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tanggal (Date)</Label>
                <Input
                  placeholder="e.g. Mon, 31 Aug 2026"
                  value={formData.date || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Shift</Label>
                <Input
                  placeholder="e.g. Shift Daily from 08:00 to 17:00"
                  value={formData.shift || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, shift: e.target.value })
                  }
                  className="h-8 text-xs mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Start Time (Jam Masuk)</Label>
                <Input
                  placeholder="e.g. 07:54 atau -"
                  value={formData.start_time || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, start_time: e.target.value })
                  }
                  className="h-8 text-xs mt-1 font-mono"
                />
              </div>
              <div>
                <Label className="text-xs">End Time (Jam Keluar)</Label>
                <Input
                  placeholder="e.g. 17:04 atau -"
                  value={formData.end_time || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, end_time: e.target.value })
                  }
                  className="h-8 text-xs mt-1 font-mono"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Status Kehadiran</Label>
              <Input
                placeholder="e.g. EAI,PRS / OFF / ABS / EAI,OVT,PRS"
                value={formData.status || ""}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value })
                }
                className="h-8 text-xs mt-1 font-semibold"
              />
              <span className="text-[10px] text-muted-foreground mt-0.5 block">
                Contoh: EAI,PRS (Hadir), OFF (Libur), ABS (Absen), EAI,OVT,PRS (Lembur).
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Overtime (Menit)</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formData.overtime ?? 0}
                  onChange={(e) =>
                    setFormData({ ...formData, overtime: Number(e.target.value) })
                  }
                  className="h-8 text-xs mt-1 font-mono"
                />
              </div>
              <div>
                <Label className="text-xs">Overtime Index</Label>
                <Input
                  placeholder="e.g. 0 atau 5,5"
                  value={formData.overtime_index || "0"}
                  onChange={(e) =>
                    setFormData({ ...formData, overtime_index: e.target.value })
                  }
                  className="h-8 text-xs mt-1 font-mono"
                />
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsFormOpen(false)}
                disabled={isSavingRecord}
              >
                Batal
              </Button>
              <Button type="submit" size="sm" disabled={isSavingRecord}>
                {isSavingRecord ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ALERT DIALOG: Konfirmasi Hapus */}
      <AlertDialog
        open={Boolean(deleteTargetId)}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Data Presensi?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini akan menghapus baris data presensi yang dipilih. Data yang telah dihapus tidak dapat dipulihkan kembali.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Ya, Hapus Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
