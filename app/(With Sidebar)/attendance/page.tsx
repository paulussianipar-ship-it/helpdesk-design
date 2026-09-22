"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpDown,
  Award,
  BarChart3,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileUp,
  Info,
  Layers,
  Loader2,
  Moon,
  Pencil,
  Percent,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  UserCheck,
  Users,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AttendanceRecord,
  INITIAL_ATTENDANCE_DATA,
  extractPeriodMonth,
  formatPeriodMonth,
} from "@/lib/attendance-seed";

export interface EmployeeAttendanceSummary {
  employee_no: string;
  name: string;
  totalRecords: number;
  prsCount: number;
  offCount: number;
  absCount: number;
  ovtCount: number;
  totalOvertimeMinutes: number;
  overtimeDuration: string;
  workDays: number;
  attendanceRate: number;
  absenceRate: number;
  predicate: {
    label: string;
    badgeClass: string;
  };
  records: AttendanceRecord[];
}

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

  // View mode tab state
  const [activeTab, setActiveTab] = useState<"presentation" | "table">("presentation");

  // Selected employee for detail presentation modal
  const [selectedEmpForDetail, setSelectedEmpForDetail] = useState<EmployeeAttendanceSummary | null>(null);

  // Sorting state for leaderboard table
  const [leaderboardSort, setLeaderboardSort] = useState<"rate" | "overtime" | "name">("rate");

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

  // Predikat Kinerja Kehadiran Karyawan
  const getAttendancePredicate = (rate: number) => {
    if (rate >= 95) {
      return {
        label: "Sangat Baik",
        badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
      };
    } else if (rate >= 85) {
      return {
        label: "Baik",
        badgeClass: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
      };
    } else if (rate >= 75) {
      return {
        label: "Cukup",
        badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
      };
    } else {
      return {
        label: "Perlu Perhatian",
        badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
      };
    }
  };

  // Perhitungan Absensi & Skor Setiap Karyawan
  const employeeSummaries = useMemo<EmployeeAttendanceSummary[]>(() => {
    const list: EmployeeAttendanceSummary[] = uniqueEmployees.map((emp) => {
      const empRecords = monthRecords.filter((r) => r.employee_no === emp.employee_no);
      const totalRecords = empRecords.length;

      let prsCount = 0;
      let offCount = 0;
      let absCount = 0;
      let ovtCount = 0;
      let totalOvertimeMinutes = 0;

      empRecords.forEach((r) => {
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

      // Hari kerja efektif = total hari kalender dikurangi hari libur (OFF)
      let workDays = totalRecords - offCount;
      if (workDays <= 0 && (prsCount + absCount) > 0) {
        workDays = prsCount + absCount;
      }
      if (workDays <= 0) {
        workDays = totalRecords || 1;
      }

      const rawRate = workDays > 0 ? (prsCount / workDays) * 100 : 0;
      const attendanceRate = Math.min(100, Math.round(rawRate * 10) / 10);

      const rawAbsRate = workDays > 0 ? (absCount / workDays) * 100 : 0;
      const absenceRate = Math.min(100, Math.round(rawAbsRate * 10) / 10);

      return {
        employee_no: emp.employee_no,
        name: emp.name,
        totalRecords,
        prsCount,
        offCount,
        absCount,
        ovtCount,
        totalOvertimeMinutes,
        overtimeDuration,
        workDays,
        attendanceRate,
        absenceRate,
        predicate: getAttendancePredicate(attendanceRate),
        records: empRecords,
      };
    });

    // Urutkan berdasarkan state sorting
    return list.sort((a, b) => {
      if (leaderboardSort === "overtime") {
        return b.totalOvertimeMinutes - a.totalOvertimeMinutes;
      }
      if (leaderboardSort === "name") {
        return a.name.localeCompare(b.name);
      }
      // default: persentase kehadiran tertinggi, lalu jam lembur terbanyak
      return b.attendanceRate - a.attendanceRate || b.totalOvertimeMinutes - a.totalOvertimeMinutes;
    });
  }, [uniqueEmployees, monthRecords, leaderboardSort]);

  // Statistik Keseluruhan Tim
  const teamStats = useMemo(() => {
    if (employeeSummaries.length === 0) {
      return {
        avgAttendanceRate: 0,
        totalOvertimeMinutes: 0,
        totalOvertimeDuration: "0 mnt",
        topAttendanceEmp: null as EmployeeAttendanceSummary | null,
        topOvertimeEmp: null as EmployeeAttendanceSummary | null,
        totalEmployees: 0,
      };
    }

    const sumRate = employeeSummaries.reduce((acc, e) => acc + e.attendanceRate, 0);
    const avgAttendanceRate = Math.round((sumRate / employeeSummaries.length) * 10) / 10;

    const sumOvt = employeeSummaries.reduce((acc, e) => acc + e.totalOvertimeMinutes, 0);
    const hours = Math.floor(sumOvt / 60);
    const mins = sumOvt % 60;
    const totalOvertimeDuration =
      hours > 0 ? `${hours} jam ${mins > 0 ? `${mins} mnt` : ""}` : `${mins} mnt`;

    const byRate = [...employeeSummaries].sort((a, b) => b.attendanceRate - a.attendanceRate);
    const byOvt = [...employeeSummaries].sort(
      (a, b) => b.totalOvertimeMinutes - a.totalOvertimeMinutes
    );

    return {
      avgAttendanceRate,
      totalOvertimeMinutes: sumOvt,
      totalOvertimeDuration,
      topAttendanceEmp: byRate[0] || null,
      topOvertimeEmp: byOvt[0]?.totalOvertimeMinutes > 0 ? byOvt[0] : null,
      totalEmployees: employeeSummaries.length,
    };
  }, [employeeSummaries]);

  // Ekspor Rekap Kehadiran Per Karyawan ke Excel
  const handleExportEmployeeSummaryExcel = () => {
    if (employeeSummaries.length === 0) {
      toast.error("Tidak ada data ringkasan karyawan untuk diekspor.");
      return;
    }

    const exportRows = employeeSummaries.map((emp, idx) => ({
      "Ranking": idx + 1,
      "Employee No (NIK)": emp.employee_no,
      "Nama Karyawan": emp.name,
      "Periode": selectedMonth === "all" ? "Semua Periode" : formatPeriodMonth(selectedMonth),
      "Total Hari Terdata": emp.totalRecords,
      "Hari Libur (OFF)": emp.offCount,
      "Hari Kerja Efektif": emp.workDays,
      "Hadir (PRS)": emp.prsCount,
      "Absen / Mangkir (ABS)": emp.absCount,
      "Persentase Kehadiran (%)": `${emp.attendanceRate}%`,
      "Persentase Absen (%)": `${emp.absenceRate}%`,
      "Predikat Kehadiran": emp.predicate.label,
      "Sesi Lembur": emp.ovtCount,
      "Total Lembur (Menit)": emp.totalOvertimeMinutes,
      "Total Lembur (Jam & Mnt)": emp.overtimeDuration,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Per Karyawan");

    const fileName = `Rekap_Kehadiran_Karyawan_${selectedMonth === "all" ? "Semua" : selectedMonth}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast.success(`Berhasil mengunduh rekapitulasi kehadiran (${fileName})`);
  };

  // Navigasi cepat filter karyawan ke tab log
  const handleFilterToTable = (employeeNo: string) => {
    setEmployeeFilter(employeeNo);
    setActiveTab("table");
    setCurrentPage(1);
    toast.info("Menampilkan log harian untuk karyawan yang dipilih");
  };

  // Helper Inisial Avatar
  const getInitials = (name: string) => {
    if (!name) return "EM";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

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

      {/* Tab Navigasi Mode Tampilan */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "presentation" | "table")}
        className="w-full space-y-4"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-3">
          <TabsList className="bg-muted/70 p-1 border">
            <TabsTrigger
              value="presentation"
              className="gap-2 px-3.5 py-1.5 font-medium text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:text-foreground"
            >
              <BarChart3 className="size-4 text-primary" />
              <span>Presentasi & Analisis Karyawan</span>
            </TabsTrigger>
            <TabsTrigger
              value="table"
              className="gap-2 px-3.5 py-1.5 font-medium text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:text-foreground"
            >
              <Layers className="size-4 text-muted-foreground" />
              <span>Log Presensi Harian ({filteredRecords.length})</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            {activeTab === "presentation" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportEmployeeSummaryExcel}
                className="h-8 gap-1.5 text-xs bg-card hover:bg-muted/60 text-foreground border shadow-2xs"
              >
                <FileSpreadsheet className="size-3.5 text-emerald-600" />
                <span>Ekspor Rekap Per Karyawan (Excel)</span>
              </Button>
            ) : (
              <Badge variant="outline" className="text-xs font-mono text-muted-foreground">
                {monthRecords.length} Catatan Aktif
              </Badge>
            )}
          </div>
        </div>

        {/* TAB 1: PRESENTASI & ANALISIS KARYAWAN */}
        <TabsContent value="presentation" className="space-y-6 mt-0">
          {/* Highlight Performa Tim */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Rata-rata Kehadiran Tim */}
            <div className="p-4 bg-card border rounded-xl shadow-2xs flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Rata-rata Tim</span>
                <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  <TrendingUp className="size-4" />
                </span>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight text-foreground font-mono">
                    {teamStats.avgAttendanceRate}%
                  </span>
                  <Badge variant="outline" className={getAttendancePredicate(teamStats.avgAttendanceRate).badgeClass}>
                    {getAttendancePredicate(teamStats.avgAttendanceRate).label}
                  </Badge>
                </div>
                <div className="mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, teamStats.avgAttendanceRate))}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Dari total {teamStats.totalEmployees} karyawan terdata
                </p>
              </div>
            </div>

            {/* Karyawan Ter-Rajin */}
            <div className="p-4 bg-card border rounded-xl shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Kehadiran Tertinggi</span>
                <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Award className="size-4" />
                </span>
              </div>
              <div className="mt-3">
                <div className="text-base font-bold text-foreground truncate" title={teamStats.topAttendanceEmp?.name || "-"}>
                  {teamStats.topAttendanceEmp?.name || "-"}
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                    {teamStats.topAttendanceEmp ? `${teamStats.topAttendanceEmp.attendanceRate}%` : "0%"}
                  </span>
                  <span>kehadiran</span>
                  {teamStats.topAttendanceEmp && (
                    <span>• {teamStats.topAttendanceEmp.prsCount} hari hadir</span>
                  )}
                </div>
              </div>
            </div>

            {/* Total Lembur Tim */}
            <div className="p-4 bg-card border rounded-xl shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Akumulasi Lembur</span>
                <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Clock className="size-4" />
                </span>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tracking-tight text-purple-600 dark:text-purple-400 font-mono">
                    {teamStats.totalOvertimeMinutes}
                  </span>
                  <span className="text-xs text-muted-foreground">menit</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  Setara dengan <strong className="text-foreground">{teamStats.totalOvertimeDuration}</strong>
                </p>
              </div>
            </div>

            {/* Karyawan Paling Banyak Lembur */}
            <div className="p-4 bg-card border rounded-xl shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Top Lembur</span>
                <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Sparkles className="size-4" />
                </span>
              </div>
              <div className="mt-3">
                <div className="text-base font-bold text-foreground truncate" title={teamStats.topOvertimeEmp?.name || "Belum ada lembur"}>
                  {teamStats.topOvertimeEmp ? teamStats.topOvertimeEmp.name : "Tidak ada"}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {teamStats.topOvertimeEmp ? (
                    <span className="text-purple-600 dark:text-purple-400 font-semibold font-mono">
                      {teamStats.topOvertimeEmp.ovtCount} sesi ({teamStats.topOvertimeEmp.overtimeDuration})
                    </span>
                  ) : (
                    "Belum ada sesi lembur di bulan ini"
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section: Kartu Performa Setiap Nama */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                  <Users className="size-4 text-primary" />
                  <span>Kartu Absensi & Skor Setiap Karyawan</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Perhitungan hadir, libur, mangkir, dan akumulasi lembur otomatis per individu
                </p>
              </div>
              <Badge variant="secondary" className="text-xs font-mono">
                {employeeSummaries.length} Karyawan
              </Badge>
            </div>

            {employeeSummaries.length === 0 ? (
              <div className="p-8 text-center bg-card border rounded-xl text-muted-foreground">
                <UserCheck className="size-8 mx-auto mb-2 opacity-50" />
                <p className="font-medium text-sm">Tidak ada data presensi karyawan pada periode ini.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {employeeSummaries.map((emp) => {
                  const isPaulus = emp.name.toLowerCase().includes("paulus");
                  const isFarel = emp.name.toLowerCase().includes("farel");

                  return (
                    <div
                      key={emp.employee_no}
                      className="bg-card border rounded-xl p-5 shadow-xs hover:shadow-md transition-all hover:border-primary/40 flex flex-col justify-between gap-4"
                    >
                      {/* Card Header: Avatar, Name, NIK, Predicate */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`size-12 rounded-xl flex items-center justify-center font-bold text-sm text-white shrink-0 shadow-xs ${
                              isPaulus
                                ? "bg-gradient-to-br from-sky-500 to-blue-600"
                                : isFarel
                                ? "bg-gradient-to-br from-indigo-500 to-purple-600"
                                : "bg-gradient-to-br from-emerald-500 to-teal-600"
                            }`}
                          >
                            {getInitials(emp.name)}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm sm:text-base text-foreground truncate" title={emp.name}>
                              {emp.name}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-[11px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
                                {emp.employee_no}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                • {emp.workDays} hari kerja
                              </span>
                            </div>
                          </div>
                        </div>

                        <Badge variant="outline" className={`shrink-0 text-xs px-2 py-0.5 ${emp.predicate.badgeClass}`}>
                          {emp.predicate.label}
                        </Badge>
                      </div>

                      {/* Card Body: Attendance Rate Bar & Number */}
                      <div className="p-3.5 bg-muted/30 border rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                            <Percent className="size-3.5 text-primary" />
                            <span>Persentase Kehadiran</span>
                          </span>
                          <span className="text-2xl font-black text-foreground font-mono">
                            {emp.attendanceRate}%
                          </span>
                        </div>
                        <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              emp.attendanceRate >= 95
                                ? "bg-emerald-500"
                                : emp.attendanceRate >= 85
                                ? "bg-blue-500"
                                : emp.attendanceRate >= 75
                                ? "bg-amber-500"
                                : "bg-rose-500"
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, emp.attendanceRate))}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                          <span>
                            Hadir {emp.prsCount} dari {emp.workDays} hari kerja
                          </span>
                          {emp.absCount > 0 ? (
                            <span className="text-rose-600 dark:text-rose-400 font-medium">
                              {emp.absCount} hari mangkir ({emp.absenceRate}%)
                            </span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                              <CheckCircle2 className="size-3" />
                              Nol Mangkir
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Mini Breakdown 4 Kotak */}
                      <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        {/* PRS */}
                        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">Hadir (PRS)</div>
                          <div className="font-bold text-sm text-emerald-700 dark:text-emerald-400 mt-0.5 font-mono">
                            {emp.prsCount}
                          </div>
                          <div className="text-[9px] text-muted-foreground">hari</div>
                        </div>

                        {/* OFF */}
                        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                          <div className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">Libur (OFF)</div>
                          <div className="font-bold text-sm text-amber-700 dark:text-amber-400 mt-0.5 font-mono">
                            {emp.offCount}
                          </div>
                          <div className="text-[9px] text-muted-foreground">hari</div>
                        </div>

                        {/* ABS */}
                        <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                          <div className="text-[10px] text-rose-700 dark:text-rose-400 font-medium">Absen (ABS)</div>
                          <div className="font-bold text-sm text-rose-700 dark:text-rose-400 mt-0.5 font-mono">
                            {emp.absCount}
                          </div>
                          <div className="text-[9px] text-muted-foreground">hari</div>
                        </div>

                        {/* OVT */}
                        <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                          <div className="text-[10px] text-purple-700 dark:text-purple-400 font-medium">Lembur</div>
                          <div className="font-bold text-sm text-purple-700 dark:text-purple-400 mt-0.5 font-mono">
                            {emp.ovtCount}
                          </div>
                          <div className="text-[9px] text-muted-foreground truncate" title={emp.overtimeDuration}>
                            {emp.overtimeDuration}
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t">
                        <span className="text-[11px] text-muted-foreground">
                          Total {emp.totalRecords} baris data
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleFilterToTable(emp.employee_no)}
                            className="h-8 text-xs gap-1 hover:bg-muted"
                          >
                            <ExternalLink className="size-3.5" />
                            <span>Filter di Log</span>
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => setSelectedEmpForDetail(emp)}
                            className="h-8 text-xs gap-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                          >
                            <Eye className="size-3.5" />
                            <span>Lihat Detail</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section: Tabel Leaderboard Komparasi */}
          <div className="border rounded-xl bg-card shadow-xs overflow-hidden">
            <div className="p-4 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-muted/20">
              <div>
                <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Award className="size-4 text-amber-500" />
                  <span>Tabel Komparasi & Ranking Kehadiran</span>
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Bandingkan tingkat kehadiran, mangkir, dan lembur antar seluruh karyawan
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>Urutkan:</span>
                  <Select
                    value={leaderboardSort}
                    onValueChange={(v) => setLeaderboardSort(v as any)}
                  >
                    <SelectTrigger className="h-8 w-[160px] text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rate">Kehadiran Tertinggi</SelectItem>
                      <SelectItem value="overtime">Lembur Terbanyak</SelectItem>
                      <SelectItem value="name">Nama Karyawan (A-Z)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportEmployeeSummaryExcel}
                  className="h-8 text-xs gap-1.5 shrink-0 bg-background"
                >
                  <Download className="size-3.5 text-emerald-600" />
                  <span>Ekspor Excel</span>
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50 text-xs">
                  <TableRow>
                    <TableHead className="w-[60px] text-center font-bold">Rank</TableHead>
                    <TableHead className="min-w-[220px] font-bold">Karyawan</TableHead>
                    <TableHead className="min-w-[100px] text-center font-bold">Hari Kerja</TableHead>
                    <TableHead className="min-w-[90px] text-center font-bold">Hadir (PRS)</TableHead>
                    <TableHead className="min-w-[90px] text-center font-bold">Libur (OFF)</TableHead>
                    <TableHead className="min-w-[90px] text-center font-bold">Absen (ABS)</TableHead>
                    <TableHead className="min-w-[130px] text-center font-bold">Lembur (OVT)</TableHead>
                    <TableHead className="min-w-[180px] font-bold">Tingkat Kehadiran</TableHead>
                    <TableHead className="min-w-[110px] text-center font-bold">Predikat</TableHead>
                    <TableHead className="w-[100px] text-center font-bold">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {employeeSummaries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="h-28 text-center text-muted-foreground">
                        Belum ada data karyawan.
                      </TableCell>
                    </TableRow>
                  ) : (
                    employeeSummaries.map((emp, index) => {
                      const isTop1 = index === 0;
                      const isTop2 = index === 1;
                      const isTop3 = index === 2;

                      return (
                        <TableRow key={emp.employee_no} className="hover:bg-muted/40 transition-colors border-b">
                          {/* Rank */}
                          <TableCell className="text-center font-mono">
                            <span
                              className={`inline-flex items-center justify-center size-6 rounded-full font-bold text-xs ${
                                isTop1
                                  ? "bg-amber-500 text-amber-950 shadow-2xs"
                                  : isTop2
                                  ? "bg-slate-300 text-slate-800 dark:bg-slate-700 dark:text-slate-200"
                                  : isTop3
                                  ? "bg-amber-700/30 text-amber-800 dark:text-amber-300"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {index + 1}
                            </span>
                          </TableCell>

                          {/* Karyawan */}
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <div className="size-8 rounded-lg bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                                {getInitials(emp.name)}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-foreground truncate">{emp.name}</div>
                                <div className="font-mono text-[11px] text-muted-foreground">{emp.employee_no}</div>
                              </div>
                            </div>
                          </TableCell>

                          {/* Hari Kerja */}
                          <TableCell className="text-center font-mono font-medium">
                            {emp.workDays} hari
                          </TableCell>

                          {/* Hadir */}
                          <TableCell className="text-center font-mono">
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {emp.prsCount}
                            </span>
                          </TableCell>

                          {/* Libur */}
                          <TableCell className="text-center font-mono text-amber-600 dark:text-amber-400">
                            {emp.offCount}
                          </TableCell>

                          {/* Absen */}
                          <TableCell className="text-center font-mono">
                            {emp.absCount > 0 ? (
                              <span className="font-bold text-rose-600 dark:text-rose-400">
                                {emp.absCount}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>

                          {/* Lembur */}
                          <TableCell className="text-center font-mono">
                            {emp.ovtCount > 0 ? (
                              <div>
                                <span className="font-semibold text-purple-600 dark:text-purple-400">
                                  {emp.ovtCount} sesi
                                </span>
                                <div className="text-[10px] text-muted-foreground">
                                  ({emp.overtimeDuration})
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>

                          {/* Tingkat Kehadiran Visual Bar */}
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between font-mono">
                                <span className="font-bold text-foreground">{emp.attendanceRate}%</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {emp.prsCount}/{emp.workDays}
                                </span>
                              </div>
                              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    emp.attendanceRate >= 95
                                      ? "bg-emerald-500"
                                      : emp.attendanceRate >= 85
                                      ? "bg-blue-500"
                                      : emp.attendanceRate >= 75
                                      ? "bg-amber-500"
                                      : "bg-rose-500"
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(0, emp.attendanceRate))}%` }}
                                />
                              </div>
                            </div>
                          </TableCell>

                          {/* Predikat */}
                          <TableCell className="text-center">
                            <Badge variant="outline" className={`text-[11px] ${emp.predicate.badgeClass}`}>
                              {emp.predicate.label}
                            </Badge>
                          </TableCell>

                          {/* Aksi */}
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSelectedEmpForDetail(emp)}
                                title="Lihat Detail Presentasi"
                                className="size-7 text-muted-foreground hover:text-foreground"
                              >
                                <Eye className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleFilterToTable(emp.employee_no)}
                                title="Filter di Log Harian"
                                className="size-7 text-muted-foreground hover:text-primary"
                              >
                                <ExternalLink className="size-3.5" />
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
          </div>
        </TabsContent>

        {/* TAB 2: LOG DATA PRESENSI HARIAN */}
        <TabsContent value="table" className="space-y-4 mt-0">
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
    </TabsContent>
  </Tabs>

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

      {/* MODAL: Detail Analisis & Presentasi Karyawan */}
      <Dialog
        open={Boolean(selectedEmpForDetail)}
        onOpenChange={(open) => !open && setSelectedEmpForDetail(null)}
      >
        <DialogContent className="sm:max-w-3xl max-h-[88vh] flex flex-col p-0 overflow-hidden">
          {selectedEmpForDetail && (
            <>
              {/* Modal Header */}
              <div className="p-6 border-b bg-muted/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`size-14 rounded-2xl flex items-center justify-center font-bold text-lg text-white shadow-xs ${
                        selectedEmpForDetail.name.toLowerCase().includes("paulus")
                          ? "bg-gradient-to-br from-sky-500 to-blue-600"
                          : selectedEmpForDetail.name.toLowerCase().includes("farel")
                          ? "bg-gradient-to-br from-indigo-500 to-purple-600"
                          : "bg-gradient-to-br from-emerald-500 to-teal-600"
                      }`}
                    >
                      {getInitials(selectedEmpForDetail.name)}
                    </div>
                    <div>
                      <DialogTitle className="text-xl font-bold tracking-tight">
                        {selectedEmpForDetail.name}
                      </DialogTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-xs px-2 py-0.5 bg-muted rounded text-muted-foreground">
                          {selectedEmpForDetail.employee_no}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          • Periode: {selectedMonth === "all" ? "Semua Periode" : formatPeriodMonth(selectedMonth)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
                    <Badge
                      variant="outline"
                      className={`text-sm px-3 py-1 font-semibold ${selectedEmpForDetail.predicate.badgeClass}`}
                    >
                      {selectedEmpForDetail.predicate.label} ({selectedEmpForDetail.attendanceRate}%)
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      Tingkat Kehadiran Efektif
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Body: Scrollable */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* 4 Metric Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Hadir */}
                  <div className="p-3.5 bg-card border rounded-xl shadow-2xs text-center">
                    <div className="text-xs text-muted-foreground font-medium flex items-center justify-center gap-1">
                      <CheckCircle2 className="size-3.5 text-emerald-600" />
                      <span>Hadir (PRS)</span>
                    </div>
                    <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                      {selectedEmpForDetail.prsCount}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      dari {selectedEmpForDetail.workDays} hari kerja
                    </div>
                  </div>

                  {/* Libur */}
                  <div className="p-3.5 bg-card border rounded-xl shadow-2xs text-center">
                    <div className="text-xs text-muted-foreground font-medium flex items-center justify-center gap-1">
                      <Moon className="size-3.5 text-amber-600" />
                      <span>Libur (OFF)</span>
                    </div>
                    <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 mt-1 font-mono">
                      {selectedEmpForDetail.offCount}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">hari istirahat</div>
                  </div>

                  {/* Absen */}
                  <div className="p-3.5 bg-card border rounded-xl shadow-2xs text-center">
                    <div className="text-xs text-muted-foreground font-medium flex items-center justify-center gap-1">
                      <XCircle className="size-3.5 text-rose-600" />
                      <span>Absen (ABS)</span>
                    </div>
                    <div className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400 mt-1 font-mono">
                      {selectedEmpForDetail.absCount}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {selectedEmpForDetail.absenceRate}% mangkir
                    </div>
                  </div>

                  {/* Lembur */}
                  <div className="p-3.5 bg-card border rounded-xl shadow-2xs text-center">
                    <div className="text-xs text-muted-foreground font-medium flex items-center justify-center gap-1">
                      <Clock className="size-3.5 text-purple-600" />
                      <span>Total Lembur</span>
                    </div>
                    <div className="text-xl font-bold tracking-tight text-purple-600 dark:text-purple-400 mt-1 font-mono">
                      {selectedEmpForDetail.ovtCount} sesi
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {selectedEmpForDetail.overtimeDuration}
                    </div>
                  </div>
                </div>

                {/* Progress Bar Detail */}
                <div className="p-4 bg-muted/30 border rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">Skor Akumulasi Kehadiran</span>
                    <span className="font-mono font-bold text-foreground text-sm">
                      {selectedEmpForDetail.attendanceRate}%
                    </span>
                  </div>
                  <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        selectedEmpForDetail.attendanceRate >= 95
                          ? "bg-emerald-500"
                          : selectedEmpForDetail.attendanceRate >= 85
                          ? "bg-blue-500"
                          : selectedEmpForDetail.attendanceRate >= 75
                          ? "bg-amber-500"
                          : "bg-rose-500"
                      }`}
                      style={{
                        width: `${Math.min(100, Math.max(0, selectedEmpForDetail.attendanceRate))}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      Hari Kerja Efektif: <strong>{selectedEmpForDetail.workDays} hari</strong>
                    </span>
                    <span>
                      Total Kalender: <strong>{selectedEmpForDetail.totalRecords} hari</strong>
                    </span>
                  </div>
                </div>

                {/* Daftar Catatan Riwayat Harian Karyawan */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                      <CalendarDays className="size-4 text-primary" />
                      <span>Riwayat Presensi Harian ({selectedEmpForDetail.records.length} Catatan)</span>
                    </h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const empNo = selectedEmpForDetail.employee_no;
                        setSelectedEmpForDetail(null);
                        handleFilterToTable(empNo);
                      }}
                      className="h-7 text-xs gap-1"
                    >
                      <ExternalLink className="size-3" />
                      <span>Buka di Log Lengkap</span>
                    </Button>
                  </div>

                  <div className="border rounded-xl overflow-hidden max-h-[280px] overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-muted/50 text-xs sticky top-0">
                        <TableRow>
                          <TableHead className="w-[45px] text-center font-bold">No</TableHead>
                          <TableHead className="font-bold min-w-[130px]">Tanggal</TableHead>
                          <TableHead className="font-bold min-w-[160px]">Shift</TableHead>
                          <TableHead className="text-center font-bold">Jam Kerja</TableHead>
                          <TableHead className="font-bold">Status</TableHead>
                          <TableHead className="text-center font-bold">Lembur</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-xs">
                        {selectedEmpForDetail.records.map((r, i) => (
                          <TableRow key={r.id || i} className="hover:bg-muted/30 border-b">
                            <TableCell className="text-center font-mono text-muted-foreground">
                              {i + 1}
                            </TableCell>
                            <TableCell className="font-medium whitespace-nowrap">{r.date}</TableCell>
                            <TableCell>
                              <span className="text-[11px] text-muted-foreground">{r.shift}</span>
                            </TableCell>
                            <TableCell className="text-center font-mono text-[11px]">
                              {r.start_time !== "-" && r.end_time !== "-" ? (
                                <span>
                                  {r.start_time} - {r.end_time}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>{renderStatusBadge(r.status)}</TableCell>
                            <TableCell className="text-center font-mono">
                              {Number(r.overtime) > 0 ? (
                                <span className="px-1.5 py-0.5 bg-purple-500/15 text-purple-700 dark:text-purple-300 font-bold rounded text-[11px]">
                                  {r.overtime} mnt
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <DialogFooter className="p-4 border-t bg-muted/10">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedEmpForDetail(null)}
                >
                  Tutup
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    const empNo = selectedEmpForDetail.employee_no;
                    setSelectedEmpForDetail(null);
                    handleFilterToTable(empNo);
                  }}
                  className="gap-1.5"
                >
                  <ExternalLink className="size-3.5" />
                  <span>Kelola di Log Harian</span>
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
