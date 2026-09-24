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
  HardHat,
  Info,
  Layers,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
  Wand2,
  X,
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
import {
  INDONESIAN_MONTHS,
  INITIAL_STB_HSE_DATA,
  StbHseRosterRecord,
  calculatePersonStats,
  detectMonthFromText,
  detectYearFromText,
  formatMonthYearIndo,
  getDayNameIndo,
  getDaysInMonth,
  getAllStbHseSeedData,
  isWeekend,
} from "@/lib/stb-hse-seed";

const LOCAL_STORAGE_KEY = "stb_hse_roster_records_v1";

export default function StbHsePage() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Core Data state
  const [records, setRecords] = useState<StbHseRosterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Month & Year Filter
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<string>("06"); // Juni
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Period string e.g. "2026-06"
  const currentPeriod = useMemo(() => {
    return `${selectedYear}-${selectedMonth.padStart(2, "0")}`;
  }, [selectedYear, selectedMonth]);

  // Days in selected month
  const totalDays = useMemo(() => {
    return getDaysInMonth(selectedYear, parseInt(selectedMonth, 10));
  }, [selectedYear, selectedMonth]);

  const daysArray = useMemo(() => {
    return Array.from({ length: totalDays }, (_, i) => i + 1);
  }, [totalDays]);

  // Modals state
  const [isPersonModalOpen, setIsPersonModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<StbHseRosterRecord | null>(null);
  const [personFormData, setPersonFormData] = useState<Partial<StbHseRosterRecord>>({
    name: "",
    employee_no: "",
    role: "HSE Officer",
    phone: "",
    notes: "",
    schedule: {},
  });

  const [deletingRecord, setDeletingRecord] = useState<StbHseRosterRecord | null>(null);
  const [isResetMonthOpen, setIsResetMonthOpen] = useState(false);

  // Quick Pattern Generator Modal
  const [isPatternModalOpen, setIsPatternModalOpen] = useState(false);
  const [patternTargetPersonId, setPatternTargetPersonId] = useState<string>("all");
  const [patternDaysOfWeek, setPatternDaysOfWeek] = useState<number[]>([1, 4]); // 1 = Sen, 4 = Kam
  const [patternStatusCode, setPatternStatusCode] = useState<string>("H");

  // Copy to Another Month Modal
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [targetCopyMonth, setTargetCopyMonth] = useState<string>("07");
  const [targetCopyYear, setTargetCopyYear] = useState<number>(2026);

  // Import Modal (Per-Bulan)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPreviewRows, setImportPreviewRows] = useState<StbHseRosterRecord[]>([]);
  const [targetImportMonth, setTargetImportMonth] = useState<string>("06");
  const [targetImportYear, setTargetImportYear] = useState<number>(2026);
  const [detectedImportMonth, setDetectedImportMonth] = useState<string | null>(null);
  const [detectedImportYear, setDetectedImportYear] = useState<number | null>(null);
  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const [importMode, setImportMode] = useState<"replace" | "append">("replace");

  // SQL Modal
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);

  // ==================== 1. DATA INITIALIZATION & SYNC ====================
  const loadData = async () => {
    setLoading(true);
    let loadedFromDb = false;

    // Seed data lengkap 12 bulan sebagai fallback
    const fullYearSeed = getAllStbHseSeedData(selectedYear);

    try {
      const { data, error } = await supabase
        .from("stb_hse_roster")
        .select("*")
        .order("created_at", { ascending: true });

      if (!error && data && data.length > 0) {
        const dbRecords: StbHseRosterRecord[] = data.map((item: any) => ({
          id: item.id,
          period_month: item.period_month || "2026-06",
          employee_no: item.employee_no || "",
          name: item.name || "",
          role: item.role || "HSE Officer",
          phone: item.phone || "",
          schedule: typeof item.schedule === "object" && item.schedule !== null ? item.schedule : {},
          notes: item.notes || "",
          created_at: item.created_at,
          updated_at: item.updated_at,
        }));

        setRecords(dbRecords);
        setSupabaseConnected(true);
        loadedFromDb = true;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dbRecords));
      } else if (!error && data && data.length === 0) {
        setSupabaseConnected(true);
      }
    } catch {
      setSupabaseConnected(false);
    }

    if (!loadedFromDb) {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Pastikan semua 12 bulan tersedia — tambahkan bulan yang belum ada dari seed
            const existingPeriods = new Set(parsed.map((r: StbHseRosterRecord) => r.period_month));
            const missingSeedRecords = fullYearSeed.filter(
              (r) => !existingPeriods.has(r.period_month)
            );
            const merged = missingSeedRecords.length > 0
              ? [...parsed, ...missingSeedRecords]
              : parsed;
            setRecords(merged);
            if (missingSeedRecords.length > 0) {
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
            }
          } else {
            // localStorage kosong — isi dengan seed lengkap 12 bulan
            setRecords(fullYearSeed);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fullYearSeed));
          }
        } catch {
          setRecords(fullYearSeed);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fullYearSeed));
        }
      } else {
        // Tidak ada localStorage — isi dengan seed lengkap 12 bulan
        setRecords(fullYearSeed);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fullYearSeed));
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    setIsMounted(true);
    loadData();
  }, []);

  const saveRecords = async (newRecords: StbHseRosterRecord[]) => {
    setRecords(newRecords);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newRecords));
  };

  // ==================== 2. DERIVED DATA FOR CURRENT PERIOD ====================
  // Current month's records
  const monthRecords = useMemo(() => {
    return records.filter((r) => r.period_month === currentPeriod);
  }, [records, currentPeriod]);

  // Filtered by search term
  const filteredMonthRecords = useMemo(() => {
    if (!searchTerm.trim()) return monthRecords;
    const q = searchTerm.toLowerCase();
    return monthRecords.filter(
      (r) =>
        (r.name || "").toLowerCase().includes(q) ||
        (r.employee_no || "").toLowerCase().includes(q) ||
        (r.role || "").toLowerCase().includes(q)
    );
  }, [monthRecords, searchTerm]);

  // Daily totals of scheduled personnel
  const dailyTotals = useMemo(() => {
    const totals: Record<number, number> = {};
    daysArray.forEach((day) => {
      let count = 0;
      monthRecords.forEach((person) => {
        const s = (person.schedule?.[day] || "").trim();
        if (s && s !== "-" && s.toUpperCase() !== "OFF") {
          count++;
        }
      });
      totals[day] = count;
    });
    return totals;
  }, [daysArray, monthRecords]);

  // Month Statistics
  const monthStats = useMemo(() => {
    const totalPersonnel = monthRecords.length;
    let totalShifts = 0;
    let totalH = 0;
    let totalHSmall = 0;

    monthRecords.forEach((p) => {
      const stats = calculatePersonStats(p.schedule);
      totalH += stats.countH;
      totalHSmall += stats.countHSmall;
      totalShifts += stats.totalStandby;
    });

    const avgPerPerson = totalPersonnel > 0 ? (totalShifts / totalPersonnel).toFixed(1) : "0";

    // Standby Today Check (only active when mounted to prevent SSR hydration mismatch)
    const today = new Date();
    const currentYearNum = today.getFullYear();
    const currentMonthStr = String(today.getMonth() + 1).padStart(2, "0");
    const currentDayNum = today.getDate();
    const isTodayInSelectedPeriod =
      isMounted &&
      currentYearNum === selectedYear &&
      currentMonthStr === selectedMonth;

    const todayStandbyList: { name: string; status: string }[] = [];
    if (isTodayInSelectedPeriod) {
      monthRecords.forEach((p) => {
        const status = (p.schedule?.[currentDayNum] || "").trim();
        if (status && status !== "-" && status.toUpperCase() !== "OFF") {
          todayStandbyList.push({ name: p.name, status });
        }
      });
    }

    return {
      totalPersonnel,
      totalShifts,
      totalH,
      totalHSmall,
      avgPerPerson,
      isTodayInSelectedPeriod,
      currentDayNum,
      todayStandbyList,
    };
  }, [monthRecords, selectedYear, selectedMonth]);

  // Month Navigation helpers
  const handlePrevMonth = () => {
    let m = parseInt(selectedMonth, 10) - 1;
    let y = selectedYear;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    setSelectedMonth(String(m).padStart(2, "0"));
    setSelectedYear(y);
  };

  const handleNextMonth = () => {
    let m = parseInt(selectedMonth, 10) + 1;
    let y = selectedYear;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    setSelectedMonth(String(m).padStart(2, "0"));
    setSelectedYear(y);
  };

  // ==================== 3. CRUD ACTIONS ====================
  // Quick cell status toggle (Cycle: "" -> "H" -> "h" -> "")
  const handleToggleDayStatus = async (recordId: string, day: number) => {
    const record = records.find((r) => r.id === recordId);
    if (!record) return;

    const currentVal = (record.schedule?.[day] || "").trim();
    let nextVal = "";
    if (!currentVal) nextVal = "H";
    else if (currentVal === "H") nextVal = "h";
    else if (currentVal === "h") nextVal = "";
    else nextVal = "";

    const updatedSchedule = { ...(record.schedule || {}) };
    if (nextVal) {
      updatedSchedule[day] = nextVal;
    } else {
      delete updatedSchedule[day];
    }

    const updatedRecord: StbHseRosterRecord = {
      ...record,
      schedule: updatedSchedule,
      updated_at: new Date().toISOString(),
    };

    const updatedList = records.map((r) => (r.id === recordId ? updatedRecord : r));
    await saveRecords(updatedList);

    // Sync with Supabase in background
    if (supabaseConnected) {
      supabase
        .from("stb_hse_roster")
        .update({
          schedule: updatedRecord.schedule,
          updated_at: updatedRecord.updated_at,
        })
        .eq("id", recordId)
        .then();
    }
  };

  // Open Add Person modal
  const handleOpenAddPerson = () => {
    setEditingPerson(null);
    setPersonFormData({
      name: "",
      employee_no: "",
      role: "HSE Officer",
      phone: "",
      notes: "",
      schedule: {},
    });
    setIsPersonModalOpen(true);
  };

  // Open Edit Person modal
  const handleOpenEditPerson = (record: StbHseRosterRecord) => {
    setEditingPerson(record);
    setPersonFormData({
      name: record.name,
      employee_no: record.employee_no || "",
      role: record.role || "HSE Officer",
      phone: record.phone || "",
      notes: record.notes || "",
      schedule: { ...(record.schedule || {}) },
    });
    setIsPersonModalOpen(true);
  };

  // Save Person form
  const handleSavePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personFormData.name?.trim()) {
      toast.error("Nama personil wajib diisi!");
      return;
    }

    try {
      if (editingPerson) {
        const updatedRecord: StbHseRosterRecord = {
          ...editingPerson,
          name: personFormData.name.trim(),
          employee_no: personFormData.employee_no?.trim() || "",
          role: personFormData.role?.trim() || "HSE Officer",
          phone: personFormData.phone?.trim() || "",
          notes: personFormData.notes?.trim() || "",
          schedule: personFormData.schedule || {},
          updated_at: new Date().toISOString(),
        };

        const updatedList = records.map((r) => (r.id === editingPerson.id ? updatedRecord : r));
        await saveRecords(updatedList);

        if (supabaseConnected) {
          await supabase
            .from("stb_hse_roster")
            .update({
              name: updatedRecord.name,
              employee_no: updatedRecord.employee_no,
              role: updatedRecord.role,
              phone: updatedRecord.phone,
              notes: updatedRecord.notes,
              schedule: updatedRecord.schedule,
              updated_at: updatedRecord.updated_at,
            })
            .eq("id", editingPerson.id);
        }

        toast.success(`Data ${updatedRecord.name} berhasil diperbarui!`);
      } else {
        const newRecord: StbHseRosterRecord = {
          id: `stb-${currentPeriod}-${Date.now().toString(36)}`,
          period_month: currentPeriod,
          name: personFormData.name.trim(),
          employee_no: personFormData.employee_no?.trim() || "",
          role: personFormData.role?.trim() || "HSE Officer",
          phone: personFormData.phone?.trim() || "",
          notes: personFormData.notes?.trim() || "",
          schedule: personFormData.schedule || {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const updatedList = [...records, newRecord];
        await saveRecords(updatedList);

        if (supabaseConnected) {
          await supabase.from("stb_hse_roster").insert({
            period_month: newRecord.period_month,
            name: newRecord.name,
            employee_no: newRecord.employee_no,
            role: newRecord.role,
            phone: newRecord.phone,
            notes: newRecord.notes,
            schedule: newRecord.schedule,
          });
        }

        toast.success(`Personil ${newRecord.name} berhasil ditambahkan ke roster!`);
      }

      setIsPersonModalOpen(false);
    } catch (err: any) {
      toast.error("Gagal menyimpan data: " + err.message);
    }
  };

  // Delete person from current month
  const handleDeletePerson = async () => {
    if (!deletingRecord) return;
    try {
      const updatedList = records.filter((r) => r.id !== deletingRecord.id);
      await saveRecords(updatedList);

      if (supabaseConnected) {
        await supabase.from("stb_hse_roster").delete().eq("id", deletingRecord.id);
      }

      toast.success(`Personil ${deletingRecord.name} telah dihapus dari roster.`);
    } catch (err: any) {
      toast.error("Gagal menghapus data: " + err.message);
    } finally {
      setDeletingRecord(null);
    }
  };

  // Reset current month schedule
  const handleResetCurrentMonth = async () => {
    try {
      const updatedList = records.filter((r) => r.period_month !== currentPeriod);
      await saveRecords(updatedList);

      if (supabaseConnected) {
        await supabase.from("stb_hse_roster").delete().eq("period_month", currentPeriod);
      }

      toast.success(`Jadwal bulan ${formatMonthYearIndo(currentPeriod)} telah dibersihkan.`);
    } catch (err: any) {
      toast.error("Gagal membersihkan jadwal: " + err.message);
    } finally {
      setIsResetMonthOpen(false);
    }
  };

  // Apply Quick Pattern (e.g. Every Monday & Thursday)
  const handleApplyPattern = async () => {
    if (monthRecords.length === 0) {
      toast.error("Belum ada personil di bulan ini. Tambahkan personil terlebih dahulu.");
      return;
    }

    try {
      const targetList =
        patternTargetPersonId === "all"
          ? monthRecords
          : monthRecords.filter((r) => r.id === patternTargetPersonId);

      const updatedRecords = records.map((rec) => {
        if (!targetList.some((t) => t.id === rec.id)) return rec;

        const newSched = { ...(rec.schedule || {}) };
        daysArray.forEach((day) => {
          const dateObj = new Date(selectedYear, parseInt(selectedMonth, 10) - 1, day);
          const dow = dateObj.getDay(); // 0 = Sun, 1 = Mon...
          if (patternDaysOfWeek.includes(dow)) {
            newSched[day] = patternStatusCode;
          }
        });

        return {
          ...rec,
          schedule: newSched,
          updated_at: new Date().toISOString(),
        };
      });

      await saveRecords(updatedRecords);

      if (supabaseConnected) {
        for (const target of targetList) {
          const rec = updatedRecords.find((r) => r.id === target.id);
          if (rec) {
            await supabase
              .from("stb_hse_roster")
              .update({ schedule: rec.schedule, updated_at: rec.updated_at })
              .eq("id", rec.id);
          }
        }
      }

      toast.success("Pola jadwal berhasil diterapkan ke personil terpilih!");
      setIsPatternModalOpen(false);
    } catch (err: any) {
      toast.error("Gagal menerapkan pola: " + err.message);
    }
  };

  // Copy roster to another month
  const handleCopyMonth = async () => {
    if (monthRecords.length === 0) {
      toast.error("Tidak ada data jadwal untuk disalin.");
      return;
    }

    const targetPeriod = `${targetCopyYear}-${targetCopyMonth.padStart(2, "0")}`;
    if (targetPeriod === currentPeriod) {
      toast.error("Bulan tujuan tidak boleh sama dengan bulan saat ini.");
      return;
    }

    try {
      const newClones: StbHseRosterRecord[] = monthRecords.map((orig, idx) => ({
        id: `stb-${targetPeriod}-${Date.now().toString(36)}-${idx}`,
        period_month: targetPeriod,
        name: orig.name,
        employee_no: orig.employee_no,
        role: orig.role,
        phone: orig.phone,
        notes: orig.notes,
        schedule: { ...(orig.schedule || {}) },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      // Filter out existing target month data if user confirms
      const otherRecords = records.filter((r) => r.period_month !== targetPeriod);
      const combined = [...otherRecords, ...newClones];
      await saveRecords(combined);

      if (supabaseConnected) {
        await supabase.from("stb_hse_roster").delete().eq("period_month", targetPeriod);
        const payload = newClones.map((c) => ({
          period_month: c.period_month,
          name: c.name,
          employee_no: c.employee_no,
          role: c.role,
          phone: c.phone,
          notes: c.notes,
          schedule: c.schedule,
        }));
        await supabase.from("stb_hse_roster").insert(payload);
      }

      setSelectedMonth(targetCopyMonth);
      setSelectedYear(targetCopyYear);
      setIsCopyModalOpen(false);
      toast.success(
        `Jadwal berhasil disalin ke bulan ${formatMonthYearIndo(targetPeriod)}!`
      );
    } catch (err: any) {
      toast.error("Gagal menyalin jadwal: " + err.message);
    }
  };

  // ==================== 4. EXPORT & IMPORT EXCEL ====================
  // Export to Excel with exact 3-level header from prompt attachment
  const handleExportExcel = () => {
    if (monthRecords.length === 0) {
      toast.error("Belum ada data untuk diekspor pada bulan ini.");
      return;
    }

    try {
      const monthLabel =
        INDONESIAN_MONTHS.find((m) => m.value === selectedMonth)?.label || "Bulan";

      // Row 1: No, Nama, Month Name (spanning days), Summary headers
      const row1: string[] = ["No", "Nama", monthLabel];
      for (let d = 2; d <= totalDays; d++) {
        row1.push("");
      }
      row1.push("Total H", "Total h", "Total STB");

      // Row 2: Empty, Empty, 1, 2, ..., totalDays, Total cols
      const row2: (string | number)[] = ["", ""];
      for (let d = 1; d <= totalDays; d++) {
        row2.push(d);
      }
      row2.push("", "", "");

      // Row 3: Empty, Empty, Sen, Sel, Rab, ..., Day names
      const row3: string[] = ["", ""];
      for (let d = 1; d <= totalDays; d++) {
        row3.push(getDayNameIndo(selectedYear, parseInt(selectedMonth, 10), d));
      }
      row3.push("", "", "");

      // Data Rows
      const dataRows: any[][] = [];
      monthRecords.forEach((person, idx) => {
        const pStats = calculatePersonStats(person.schedule);
        const row: any[] = [idx + 1, person.name];

        for (let d = 1; d <= totalDays; d++) {
          row.push(person.schedule?.[d] || "");
        }

        row.push(pStats.countH, pStats.countHSmall, pStats.totalStandby);
        dataRows.push(row);
      });

      // Total Standby Harian Footer Row
      const totalRow: any[] = ["", "TOTAL STANDBY"];
      for (let d = 1; d <= totalDays; d++) {
        totalRow.push(dailyTotals[d] || 0);
      }
      totalRow.push(
        monthStats.totalH,
        monthStats.totalHSmall,
        monthStats.totalShifts
      );
      dataRows.push(totalRow);

      const allRows = [row1, row2, row3, ...dataRows];
      const worksheet = XLSX.utils.aoa_to_sheet(allRows);

      // Set merges:
      // Row 1 Month title spans columns C to (C + totalDays - 1)
      worksheet["!merges"] = [
        // Merge Month Name across day columns: Row 0, col 2 to col (2 + totalDays - 1)
        { s: { r: 0, c: 2 }, e: { r: 0, c: 2 + totalDays - 1 } },
        // Merge 'No': Row 0-2, Col 0
        { s: { r: 0, c: 0 }, e: { r: 2, c: 0 } },
        // Merge 'Nama': Row 0-2, Col 1
        { s: { r: 0, c: 1 }, e: { r: 2, c: 1 } },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `STB HSE ${monthLabel}`);

      const fileName = `STB_HSE_${monthLabel}_${selectedYear}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast.success(`Jadwal STB HSE berhasil diunduh: ${fileName}`);
    } catch (err: any) {
      toast.error("Gagal mengekspor Excel: " + err.message);
    }
  };

  // Parse Excel or CSV (supports both semicolon ';' and comma ',' matrix format)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    try {
      toast.loading("Menganalisis file STB HSE...", { id: "import-stb" });

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];

      const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, {
        header: 1,
        defval: "",
        raw: false,
      });

      if (!rawRows || rawRows.length === 0) {
        throw new Error("File kosong atau tidak dapat dibaca.");
      }

      // Deteksi bulan dan tahun secara otomatis
      let detectedM: string | null = null;
      let detectedY: number | null = null;

      // 1. Cek nama sheet (misal: "Juni", "STB HSE Juni")
      detectedM = detectMonthFromText(firstSheetName);
      detectedY = detectYearFromText(firstSheetName);

      // 2. Cek nama file (misal: "STB_HSE_Juni_2026.xlsx")
      if (!detectedM) detectedM = detectMonthFromText(file.name);
      if (!detectedY) detectedY = detectYearFromText(file.name);

      // 3. Cek baris 0-6 pada tabel (misal cell C1 berisi "Juni")
      for (let r = 0; r < Math.min(rawRows.length, 6); r++) {
        const rowStr = rawRows[r].join(" ");
        if (!detectedM) detectedM = detectMonthFromText(rowStr);
        if (!detectedY) detectedY = detectYearFromText(rowStr);
      }

      const finalMonth = detectedM || selectedMonth;
      const finalYear = detectedY || selectedYear;

      setDetectedImportMonth(detectedM);
      setDetectedImportYear(detectedY);
      setTargetImportMonth(finalMonth);
      setTargetImportYear(finalYear);

      // Cari baris tanggal (1, 2, 3, ...)
      let dateRowIdx = -1;
      let nameColIdx = 1;
      let firstDayColIdx = -1;

      for (let r = 0; r < Math.min(rawRows.length, 6); r++) {
        const row = rawRows[r];
        for (let c = 0; c < row.length; c++) {
          const val = String(row[c]).trim();
          if (val === "1" && String(row[c + 1]).trim() === "2") {
            dateRowIdx = r;
            firstDayColIdx = c;
            break;
          }
        }
        if (dateRowIdx !== -1) break;
      }

      // Jika tidak ditemukan baris angka 1..2, cari kata "nama"
      if (dateRowIdx === -1) {
        for (let r = 0; r < Math.min(rawRows.length, 6); r++) {
          const row = rawRows[r].map((c) => String(c || "").toLowerCase().trim());
          const nIdx = row.findIndex((c) => c === "nama" || c.includes("nama"));
          if (nIdx !== -1) {
            nameColIdx = nIdx;
            // Anggap baris berikutnya adalah baris tanggal
            dateRowIdx = r + 1;
            firstDayColIdx = nIdx + 1;
            break;
          }
        }
      }

      if (dateRowIdx === -1 || firstDayColIdx === -1) {
        throw new Error(
          "Format tabel tidak sesuai. Pastikan ada baris nomor tanggal (1, 2, 3, ...) dan kolom Nama."
        );
      }

      // Deteksi hari apa saja di baris dateRowIdx
      const dateRow = rawRows[dateRowIdx];
      const dayColumnMap: Record<number, number> = {}; // dayNum -> columnIndex

      for (let c = firstDayColIdx; c < dateRow.length; c++) {
        const val = parseInt(String(dateRow[c]).trim(), 10);
        if (!isNaN(val) && val >= 1 && val <= 31) {
          dayColumnMap[val] = c;
        }
      }

      // Mulai baca data dari baris setelah nama hari (biasanya dateRowIdx + 2)
      let dataStartRow = dateRowIdx + 1;
      // Cek apakah baris berikutnya adalah nama hari (Sen, Sel, ...)
      const nextRow = rawRows[dateRowIdx + 1];
      if (
        nextRow &&
        nextRow.some((c) => ["sen", "sel", "rab", "kam", "jum", "sab", "min"].includes(String(c).trim().toLowerCase()))
      ) {
        dataStartRow = dateRowIdx + 2;
      }

      const parsedRecords: StbHseRosterRecord[] = [];
      const targetPeriodStr = `${finalYear}-${finalMonth.padStart(2, "0")}`;

      for (let r = dataStartRow; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || row.length === 0) continue;

        const nameVal = String(row[nameColIdx] || "").trim();
        // Skip baris kosong atau baris total
        if (!nameVal || nameVal.toLowerCase().includes("total") || nameVal.toLowerCase().includes("standby")) {
          continue;
        }

        const schedule: Record<number, string> = {};
        Object.entries(dayColumnMap).forEach(([dayNumStr, colIdx]) => {
          const dayNum = parseInt(dayNumStr, 10);
          const cellVal = String(row[colIdx] || "").trim();
          if (cellVal && cellVal !== "-") {
            schedule[dayNum] = cellVal;
          }
        });

        parsedRecords.push({
          id: `stb-import-${Date.now().toString(36)}-${r}`,
          period_month: targetPeriodStr,
          name: nameVal,
          employee_no: "",
          role: "HSE Officer",
          phone: "",
          notes: `Diimpor dari ${file.name}`,
          schedule,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      if (parsedRecords.length === 0) {
        throw new Error("Tidak ada data personil yang valid ditemukan pada file.");
      }

      setImportPreviewRows(parsedRecords);
      setIsImportModalOpen(true);
      toast.success(
        `${parsedRecords.length} personil berhasil dibaca dari file.${
          detectedM ? ` Terdeteksi bulan: ${formatMonthYearIndo(targetPeriodStr)}.` : ""
        }`,
        { id: "import-stb" }
      );
    } catch (err: any) {
      toast.error(err.message || "Gagal memproses file import.", { id: "import-stb" });
    }
  };

  const handleConfirmImport = async () => {
    if (importPreviewRows.length === 0) return;
    setIsProcessingImport(true);

    try {
      const targetPeriod = `${targetImportYear}-${targetImportMonth.padStart(2, "0")}`;
      const normalizedRows: StbHseRosterRecord[] = importPreviewRows.map((r) => ({
        ...r,
        period_month: targetPeriod,
      }));

      let finalRecords: StbHseRosterRecord[] = [];

      if (importMode === "replace") {
        const otherMonths = records.filter((r) => r.period_month !== targetPeriod);
        finalRecords = [...otherMonths, ...normalizedRows];
      } else {
        // Append mode
        finalRecords = [...records, ...normalizedRows];
      }

      await saveRecords(finalRecords);

      if (supabaseConnected) {
        if (importMode === "replace") {
          await supabase.from("stb_hse_roster").delete().eq("period_month", targetPeriod);
        }

        const payload = normalizedRows.map((r) => ({
          period_month: targetPeriod,
          name: r.name,
          employee_no: r.employee_no || "",
          role: r.role || "HSE Officer",
          phone: r.phone || "",
          notes: r.notes || "",
          schedule: r.schedule || {},
        }));

        await supabase.from("stb_hse_roster").insert(payload);
      }

      // Otomatis pindahkan tampilan tabel ke bulan dan tahun target yang baru saja diimpor
      setSelectedMonth(targetImportMonth);
      setSelectedYear(targetImportYear);

      toast.success(
        `Jadwal STB HSE bulan ${formatMonthYearIndo(targetPeriod)} berhasil diimpor! (${normalizedRows.length} personil)`
      );
      setIsImportModalOpen(false);
    } catch (err: any) {
      toast.error("Gagal menyimpan data impor: " + err.message);
    } finally {
      setIsProcessingImport(false);
    }
  };

  // Copy SQL script to clipboard
  const handleCopySql = () => {
    const sql = `-- Skema Database Supabase untuk Modul STB HSE (Standby HSE)
create table if not exists public.stb_hse_roster (
  id uuid primary key default gen_random_uuid(),
  period_month text not null default to_char(now(), 'YYYY-MM'),
  employee_no text default '',
  name text not null,
  role text default 'HSE Officer',
  phone text default '',
  schedule jsonb not null default '{}'::jsonb,
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stb_hse_roster_period_idx on public.stb_hse_roster (period_month);
alter table public.stb_hse_roster enable row level security;
create policy "stb_hse_roster authenticated read" on public.stb_hse_roster for select to authenticated using (true);
create policy "stb_hse_roster authenticated insert" on public.stb_hse_roster for insert to authenticated with check (true);
create policy "stb_hse_roster authenticated update" on public.stb_hse_roster for update to authenticated using (true);
create policy "stb_hse_roster authenticated delete" on public.stb_hse_roster for delete to authenticated using (true);
notify pgrst, 'reload schema';`;

    navigator.clipboard.writeText(sql);
    toast.success("Skema SQL Supabase berhasil disalin ke clipboard!");
  };

  return (
    <div className="col-span-12 flex flex-col gap-6 max-w-full overflow-x-hidden">
      {/* Hidden file input for Excel/CSV */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".xlsx, .xls, .csv"
        className="hidden"
      />

      {/* ==================== 1. HEADER & ACTION BUTTONS ==================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20 shadow-xs">
            <ShieldCheck className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Jadwal Standby (STB) HSE
              </h1>
              <Badge variant="outline" className="text-xs font-semibold bg-primary/5 text-primary border-primary/20">
                {formatMonthYearIndo(currentPeriod)}
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Kelola jadwal dan roster standby personil Health, Safety & Environment (HSE) secara bulanan.
            </p>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={handleOpenAddPerson}
            className="gap-1.5 shadow-xs"
          >
            <Plus className="size-4" />
            <span>Tambah Personil</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPatternModalOpen(true)}
            className="gap-1.5"
            title="Terapkan pola otomatis (misal: setiap Senin & Kamis)"
          >
            <Wand2 className="size-4 text-primary" />
            <span className="hidden sm:inline">Pola Otomatis</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCopyModalOpen(true)}
            className="gap-1.5"
            title="Salin roster bulan ini ke bulan lain"
          >
            <Copy className="size-4" />
            <span className="hidden md:inline">Salin ke Bulan Lain</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="gap-1.5"
            title="Unduh Excel sesuai format lampiran"
          >
            <Download className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span>Export Excel</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="gap-1.5 font-medium shadow-2xs border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
            title="Import Excel atau CSV Roster Per-Bulan"
          >
            <FileUp className="size-4" />
            <span>Import Per-Bulan</span>
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsSqlModalOpen(true)}
            title="Lihat Skema SQL Supabase"
            className="size-8"
          >
            <Sparkles className="size-4 text-amber-500" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsResetMonthOpen(true)}
            title="Bersihkan Roster Bulan Ini"
            className="size-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
          >
            <RotateCcw className="size-4" />
          </Button>
        </div>
      </div>

      {/* ==================== 2. PERIOD SELECTOR & SEARCH BAR ==================== */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/40 p-3 rounded-2xl border">
        {/* Month & Year Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevMonth}
            className="size-8 text-muted-foreground hover:text-foreground"
            title="Bulan Sebelumnya"
          >
            <ChevronLeft className="size-4" />
          </Button>

          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[140px] bg-background font-semibold text-xs sm:text-sm h-9">
              <SelectValue placeholder="Bulan" />
            </SelectTrigger>
            <SelectContent>
              {INDONESIAN_MONTHS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(selectedYear)}
            onValueChange={(val) => setSelectedYear(parseInt(val, 10))}
          >
            <SelectTrigger className="w-[100px] bg-background font-semibold text-xs sm:text-sm h-9">
              <SelectValue placeholder="Tahun" />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027, 2028].map((yr) => (
                <SelectItem key={yr} value={String(yr)}>
                  {yr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextMonth}
            className="size-8 text-muted-foreground hover:text-foreground"
            title="Bulan Selanjutnya"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama atau NIK personil..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-9 text-xs sm:text-sm bg-background"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* ==================== 3. KPI STATISTIC CARDS ==================== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Personnel */}
        <div className="bg-card border rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-medium">Personil HSE</span>
            <Users className="size-4 text-primary" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              {monthStats.totalPersonnel}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Petugas terdaftar di {formatMonthYearIndo(currentPeriod)}
            </div>
          </div>
        </div>

        {/* Card 2: Standby Hari Ini */}
        <div className="bg-card border rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-medium">Standby Hari Ini</span>
            <HardHat className="size-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            {monthStats.isTodayInSelectedPeriod ? (
              monthStats.todayStandbyList.length > 0 ? (
                <div>
                  <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 leading-tight">
                    <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{monthStats.todayStandbyList.length} Petugas</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-1">
                    {monthStats.todayStandbyList.map((p) => p.name.split(" ")[0]).join(", ")}
                  </p>
                </div>
              ) : (
                <div>
                  <div className="text-base font-semibold text-muted-foreground">Tidak Ada Standby</div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Tgl {monthStats.currentDayNum} (Hari ini)</p>
                </div>
              )
            ) : (
              <div>
                <div className="text-base font-semibold text-muted-foreground">Di Luar Periode</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Pilih bulan saat ini</p>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Total Shifts */}
        <div className="bg-card border rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-medium">Total Shift Standby</span>
            <CalendarDays className="size-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              {monthStats.totalShifts}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
              <span>H: <strong className="text-emerald-600 dark:text-emerald-400">{monthStats.totalH}</strong></span>
              <span>•</span>
              <span>h: <strong className="text-blue-600 dark:text-blue-400">{monthStats.totalHSmall}</strong></span>
            </div>
          </div>
        </div>

        {/* Card 4: Avg Standby */}
        <div className="bg-card border rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-medium">Rata-rata Standby</span>
            <Clock className="size-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              {monthStats.avgPerPerson}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Shift per personil bulan ini
            </div>
          </div>
        </div>
      </div>

      {/* ==================== 4. ROSTER MATRIX TABLE ==================== */}
      <div className="bg-card border rounded-2xl shadow-xs overflow-hidden">
        {/* Table Instructions / Legend Bar */}
        <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-muted/40 border-b text-xs text-muted-foreground gap-3">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-foreground">Keterangan Kode:</span>
            <div className="flex items-center gap-1.5">
              <span className="size-5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-bold text-[11px] flex items-center justify-center">
                H
              </span>
              <span>Standby Utama (Hadir)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-5 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-700 dark:text-blue-400 font-bold text-[11px] flex items-center justify-center">
                h
              </span>
              <span>Standby Pendukung / Parsial</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-5 rounded-md bg-muted border text-muted-foreground font-medium text-[11px] flex items-center justify-center">
                -
              </span>
              <span>Libur / Off</span>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[11px] italic">
            <Info className="size-3.5 text-primary shrink-0" />
            <span>Klik pada sel tanggal untuk mengubah status (Kosong → H → h → Kosong).</span>
          </div>
        </div>

        {/* Scrollable Matrix */}
        <div className="overflow-x-auto max-w-full">
          <table className="w-full border-collapse text-xs">
            {/* Multi-tier 3-row Header matching Excel Attachment */}
            <thead>
              {/* Header Row 1: No, Nama, Month Header, Summary Columns, Action */}
              <tr className="bg-muted/70 text-foreground border-b font-bold">
                <th
                  rowSpan={3}
                  className="w-12 min-w-12 px-2 py-2 text-center border-r bg-muted/90 sticky left-0 z-20 shadow-2xs"
                >
                  No
                </th>
                <th
                  rowSpan={3}
                  className="w-64 min-w-[240px] px-3 py-2 text-left border-r bg-muted/90 sticky left-12 z-20 shadow-2xs"
                >
                  Nama Personil
                </th>
                <th
                  colSpan={totalDays}
                  className="py-2 text-center text-sm font-bold uppercase tracking-wider bg-primary/10 text-primary border-b border-r"
                >
                  {formatMonthYearIndo(currentPeriod)}
                </th>
                <th
                  rowSpan={3}
                  className="w-14 min-w-14 px-1 py-2 text-center font-bold border-r bg-muted/70 text-emerald-700 dark:text-emerald-400"
                  title="Total Standby Utama (H)"
                >
                  Total H
                </th>
                <th
                  rowSpan={3}
                  className="w-14 min-w-14 px-1 py-2 text-center font-bold border-r bg-muted/70 text-blue-700 dark:text-blue-400"
                  title="Total Standby Pendukung (h)"
                >
                  Total h
                </th>
                <th
                  rowSpan={3}
                  className="w-16 min-w-16 px-1 py-2 text-center font-bold border-r bg-primary/10 text-primary"
                  title="Total Shift Standby (H + h)"
                >
                  Total STB
                </th>
                <th rowSpan={3} className="w-16 min-w-16 px-2 py-2 text-center font-bold bg-muted/70">
                  Aksi
                </th>
              </tr>

              {/* Header Row 2: Dates 1..N */}
              <tr className="bg-muted/50 text-foreground border-b text-center font-bold">
                {daysArray.map((day) => {
                  const weekend = isWeekend(selectedYear, parseInt(selectedMonth, 10), day);
                  const isCurrentToday =
                    monthStats.isTodayInSelectedPeriod && monthStats.currentDayNum === day;

                  return (
                    <th
                      key={`day-num-${day}`}
                      className={`w-9 min-w-9 max-w-9 py-1 px-0.5 border-r font-bold text-[11px] ${
                        isCurrentToday
                          ? "bg-primary text-primary-foreground"
                          : weekend
                          ? "bg-rose-500/10 text-rose-700 dark:text-rose-400"
                          : "text-foreground"
                      }`}
                    >
                      {day}
                    </th>
                  );
                })}
              </tr>

              {/* Header Row 3: Day Names Sen, Sel, Rab, Kam, Jum, Sab, Min */}
              <tr className="bg-muted/40 border-b text-center text-[10px] font-semibold text-muted-foreground">
                {daysArray.map((day) => {
                  const dayName = getDayNameIndo(selectedYear, parseInt(selectedMonth, 10), day);
                  const weekend = isWeekend(selectedYear, parseInt(selectedMonth, 10), day);
                  const isCurrentToday =
                    monthStats.isTodayInSelectedPeriod && monthStats.currentDayNum === day;

                  return (
                    <th
                      key={`day-name-${day}`}
                      className={`w-9 min-w-9 max-w-9 py-1 px-0.5 border-r ${
                        isCurrentToday
                          ? "bg-primary/90 text-primary-foreground font-bold"
                          : weekend
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold"
                          : ""
                      }`}
                    >
                      {dayName}
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Table Body: Personnel Rows */}
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={totalDays + 6} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="size-6 animate-spin mx-auto mb-2 text-primary" />
                    <span>Memuat data jadwal STB HSE...</span>
                  </td>
                </tr>
              ) : filteredMonthRecords.length === 0 ? (
                <tr>
                  <td colSpan={totalDays + 6} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                      <ShieldAlert className="size-8 text-muted-foreground" />
                      <p className="font-semibold text-foreground text-sm">
                        Belum ada personil di bulan {formatMonthYearIndo(currentPeriod)}
                      </p>
                      <p className="text-xs text-muted-foreground text-center">
                        Tambahkan personil baru, impor data dari Excel, atau salin jadwal dari bulan sebelumnya.
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Button size="sm" onClick={handleOpenAddPerson} className="gap-1.5">
                          <Plus className="size-4" />
                          Tambah Personil
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          className="gap-1.5"
                        >
                          <FileUp className="size-4" />
                          Import Excel
                        </Button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredMonthRecords.map((person, index) => {
                  const pStats = calculatePersonStats(person.schedule);

                  return (
                    <tr
                      key={person.id || index}
                      className="hover:bg-muted/30 transition-colors group"
                    >
                      {/* No */}
                      <td className="w-12 min-w-12 py-2 px-2 text-center border-r font-medium text-muted-foreground bg-card group-hover:bg-muted/40 sticky left-0 z-10">
                        {index + 1}
                      </td>

                      {/* Nama & Role */}
                      <td className="w-64 min-w-[240px] py-2 px-3 border-r bg-card group-hover:bg-muted/40 sticky left-12 z-10">
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground leading-snug whitespace-normal break-words">
                            {person.name}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {person.employee_no && (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {person.employee_no}
                              </span>
                            )}
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1 py-0 font-normal text-muted-foreground"
                            >
                              {person.role || "HSE"}
                            </Badge>
                          </div>
                        </div>
                      </td>

                      {/* Day Columns 1..N */}
                      {daysArray.map((day) => {
                        const cellVal = (person.schedule?.[day] || "").trim();
                        const weekend = isWeekend(selectedYear, parseInt(selectedMonth, 10), day);
                        const isCurrentToday =
                          monthStats.isTodayInSelectedPeriod && monthStats.currentDayNum === day;

                        return (
                          <td
                            key={`cell-${person.id}-${day}`}
                            onClick={() => handleToggleDayStatus(person.id, day)}
                            title={`Tgl ${day}: ${
                              cellVal === "H"
                                ? "Standby Utama"
                                : cellVal === "h"
                                ? "Standby Pendukung"
                                : "Libur / Kosong"
                            } (Klik untuk ubah)`}
                            className={`w-9 min-w-9 max-w-9 py-1 px-0.5 text-center border-r select-none cursor-pointer transition-colors ${
                              isCurrentToday
                                ? "ring-1 ring-inset ring-primary/40 bg-primary/5"
                                : weekend
                                ? "bg-rose-500/5 dark:bg-rose-950/10 hover:bg-rose-500/15"
                                : "hover:bg-primary/10"
                            }`}
                          >
                            {cellVal === "H" ? (
                              <span className="inline-flex items-center justify-center size-6 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-500/30 text-[11px] shadow-2xs">
                                H
                              </span>
                            ) : cellVal === "h" ? (
                              <span className="inline-flex items-center justify-center size-6 rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-400 font-bold border border-blue-500/30 text-[11px] shadow-2xs">
                                h
                              </span>
                            ) : cellVal && cellVal !== "-" && cellVal.toUpperCase() !== "OFF" ? (
                              <span className="inline-flex items-center justify-center size-6 rounded-md bg-purple-500/15 text-purple-700 dark:text-purple-400 font-bold border border-purple-500/30 text-[11px]">
                                {cellVal}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/30 font-light">-</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Total H */}
                      <td className="w-14 min-w-14 py-2 px-1 text-center border-r font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/5">
                        {pStats.countH}
                      </td>

                      {/* Total h */}
                      <td className="w-14 min-w-14 py-2 px-1 text-center border-r font-bold text-blue-700 dark:text-blue-400 bg-blue-500/5">
                        {pStats.countHSmall}
                      </td>

                      {/* Total STB */}
                      <td className="w-16 min-w-16 py-2 px-1 text-center border-r font-extrabold text-foreground bg-primary/5">
                        <Badge
                          variant="secondary"
                          className="font-bold text-xs bg-primary/15 text-primary px-1.5 py-0.5"
                        >
                          {pStats.totalStandby}
                        </Badge>
                      </td>

                      {/* Aksi */}
                      <td className="w-16 min-w-16 py-2 px-1 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-foreground"
                            title="Edit Data & Jadwal"
                            onClick={() => handleOpenEditPerson(person)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-rose-600"
                            title="Hapus Personil"
                            onClick={() => setDeletingRecord(person)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Table Footer: Daily Total Standby Personnel */}
            {filteredMonthRecords.length > 0 && (
              <tfoot>
                <tr className="bg-muted/70 font-bold border-t-2 text-foreground">
                  <td
                    colSpan={2}
                    className="py-2.5 px-3 text-right border-r uppercase tracking-wider text-[11px] sticky left-0 bg-muted/90 z-10"
                  >
                    Total Standby Harian
                  </td>

                  {daysArray.map((day) => {
                    const totalCount = dailyTotals[day] || 0;
                    const weekend = isWeekend(selectedYear, parseInt(selectedMonth, 10), day);

                    return (
                      <td
                        key={`total-day-${day}`}
                        className={`py-2 text-center border-r font-bold text-xs ${
                          totalCount > 0
                            ? "text-primary font-extrabold bg-primary/10"
                            : weekend
                            ? "text-rose-600/70 dark:text-rose-400/70"
                            : "text-muted-foreground"
                        }`}
                      >
                        {totalCount}
                      </td>
                    );
                  })}

                  {/* Footer Totals */}
                  <td className="py-2 text-center border-r font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10">
                    {monthStats.totalH}
                  </td>
                  <td className="py-2 text-center border-r font-extrabold text-blue-700 dark:text-blue-400 bg-blue-500/10">
                    {monthStats.totalHSmall}
                  </td>
                  <td className="py-2 text-center border-r font-extrabold text-primary bg-primary/15">
                    {monthStats.totalShifts}
                  </td>
                  <td className="py-2 text-center bg-muted/70">-</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ==================== 5. MODAL TAMBAH / EDIT PERSONIL ==================== */}
      <Dialog open={isPersonModalOpen} onOpenChange={setIsPersonModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="size-5 text-primary" />
              <span>{editingPerson ? "Edit Personil HSE" : "Tambah Personil HSE"}</span>
            </DialogTitle>
            <DialogDescription>
              {editingPerson
                ? `Perbarui informasi personil untuk bulan ${formatMonthYearIndo(currentPeriod)}`
                : `Tambahkan petugas baru ke dalam jadwal roster bulan ${formatMonthYearIndo(currentPeriod)}`}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePerson} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="person-name">Nama Lengkap Petugas *</Label>
              <Input
                id="person-name"
                placeholder="Contoh: Paulus Petrus Parlindungan Sianipar"
                value={personFormData.name || ""}
                onChange={(e) => setPersonFormData({ ...personFormData, name: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="person-emp-no">NIK / No. Pegawai</Label>
                <Input
                  id="person-emp-no"
                  placeholder="Contoh: GIS19040039"
                  value={personFormData.employee_no || ""}
                  onChange={(e) => setPersonFormData({ ...personFormData, employee_no: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="person-role">Jabatan / Role</Label>
                <Input
                  id="person-role"
                  placeholder="Contoh: HSE Officer"
                  value={personFormData.role || ""}
                  onChange={(e) => setPersonFormData({ ...personFormData, role: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="person-phone">No. WhatsApp / Kontak</Label>
              <Input
                id="person-phone"
                placeholder="Contoh: 0812-3456-7890"
                value={personFormData.phone || ""}
                onChange={(e) => setPersonFormData({ ...personFormData, phone: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="person-notes">Catatan Tambahan</Label>
              <Textarea
                id="person-notes"
                placeholder="Catatan shift atau penugasan khusus..."
                value={personFormData.notes || ""}
                onChange={(e) => setPersonFormData({ ...personFormData, notes: e.target.value })}
                rows={2}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsPersonModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit">
                {editingPerson ? "Simpan Perubahan" : "Tambahkan ke Roster"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ==================== 6. MODAL QUICK PATTERN GENERATOR ==================== */}
      <Dialog open={isPatternModalOpen} onOpenChange={setIsPatternModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="size-5 text-primary" />
              <span>Generator Pola Standby Otomatis</span>
            </DialogTitle>
            <DialogDescription>
              Terapkan jadwal standby rutin secara instan (misal: setiap hari Senin & Kamis) untuk seluruh atau personil tertentu.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div className="space-y-1.5">
              <Label>Pilih Target Personil</Label>
              <Select value={patternTargetPersonId} onValueChange={setPatternTargetPersonId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Personil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Personil ({monthRecords.length} orang)</SelectItem>
                  {monthRecords.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Pilih Hari dalam Seminggu</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { id: 1, name: "Senin" },
                  { id: 2, name: "Selasa" },
                  { id: 3, name: "Rabu" },
                  { id: 4, name: "Kamis" },
                  { id: 5, name: "Jumat" },
                  { id: 6, name: "Sabtu" },
                  { id: 0, name: "Minggu" },
                ].map((d) => {
                  const isChecked = patternDaysOfWeek.includes(d.id);
                  return (
                    <button
                      type="button"
                      key={d.id}
                      onClick={() => {
                        if (isChecked) {
                          setPatternDaysOfWeek(patternDaysOfWeek.filter((x) => x !== d.id));
                        } else {
                          setPatternDaysOfWeek([...patternDaysOfWeek, d.id]);
                        }
                      }}
                      className={`py-1.5 px-2 text-xs rounded-lg border font-medium transition-all ${
                        isChecked
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-muted/40 text-foreground border-border hover:bg-muted"
                      }`}
                    >
                      {d.name}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Default: Senin & Kamis (sesuai pola lampiran Excel).
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Kode Standby yang Diterapkan</Label>
              <Select value={patternStatusCode} onValueChange={setPatternStatusCode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="H">H (Standby Utama)</SelectItem>
                  <SelectItem value="h">h (Standby Pendukung)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsPatternModalOpen(false)}>
              Batal
            </Button>
            <Button size="sm" onClick={handleApplyPattern}>
              Terapkan Pola
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== 7. MODAL SALIN JADWAL KE BULAN LAIN ==================== */}
      <Dialog open={isCopyModalOpen} onOpenChange={setIsCopyModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="size-5 text-primary" />
              <span>Salin Roster ke Bulan Lain</span>
            </DialogTitle>
            <DialogDescription>
              Salin daftar personil dan format jadwal dari bulan{" "}
              <strong>{formatMonthYearIndo(currentPeriod)}</strong> ke bulan tujuan.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-3">
            <div className="space-y-1.5">
              <Label>Bulan Tujuan</Label>
              <Select value={targetCopyMonth} onValueChange={setTargetCopyMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INDONESIAN_MONTHS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Tahun Tujuan</Label>
              <Select
                value={String(targetCopyYear)}
                onValueChange={(val) => setTargetCopyYear(parseInt(val, 10))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027, 2028].map((yr) => (
                    <SelectItem key={yr} value={String(yr)}>
                      {yr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsCopyModalOpen(false)}>
              Batal
            </Button>
            <Button size="sm" onClick={handleCopyMonth}>
              Salin Roster
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== 8. MODAL IMPORT EXCEL / CSV (PER-BULAN) ==================== */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="size-5 text-emerald-600" />
              <span>Import Jadwal STB HSE Per-Bulan</span>
            </DialogTitle>
            <DialogDescription>
              Terbaca <strong>{importPreviewRows.length} personil</strong> dari file. Tentukan target periode bulan & tahun serta mode impor di bawah.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Target Periode (Bulan & Tahun) */}
            <div className="bg-muted/50 p-3.5 rounded-xl border space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-primary" />
                  <span>Target Periode Impor (Bulan & Tahun):</span>
                </Label>
                {detectedImportMonth && (
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-medium"
                  >
                    ✓ Terdeteksi Otomatis: {INDONESIAN_MONTHS.find((m) => m.value === detectedImportMonth)?.label} {detectedImportYear || selectedYear}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1 block">Bulan Target</Label>
                  <Select value={targetImportMonth} onValueChange={setTargetImportMonth}>
                    <SelectTrigger className="h-9 text-xs bg-background font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INDONESIAN_MONTHS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1 block">Tahun Target</Label>
                  <Select
                    value={String(targetImportYear)}
                    onValueChange={(val) => setTargetImportYear(parseInt(val, 10))}
                  >
                    <SelectTrigger className="h-9 text-xs bg-background font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2024, 2025, 2026, 2027, 2028].map((yr) => (
                        <SelectItem key={yr} value={String(yr)}>
                          {yr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Info className="size-3 text-primary shrink-0" />
                <span>
                  Data jadwal akan dimasukkan ke bulan{" "}
                  <strong className="text-foreground">
                    {formatMonthYearIndo(`${targetImportYear}-${targetImportMonth}`)}
                  </strong>.
                </span>
              </div>
            </div>

            {/* Mode Impor */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Mode Impor</Label>
              <div className="grid grid-cols-2 gap-2">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setImportMode("replace")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setImportMode("replace");
                    }
                  }}
                  className={`p-3 text-left rounded-xl border text-xs cursor-pointer select-none transition-all ${
                    importMode === "replace"
                      ? "border-primary bg-primary/10 text-primary font-bold shadow-2xs"
                      : "border-border hover:bg-muted text-muted-foreground"
                  }`}
                >
                  <div className="font-semibold text-foreground">Ganti (Replace)</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Hapus data lama bulan{" "}
                    {INDONESIAN_MONTHS.find((m) => m.value === targetImportMonth)?.label}{" "}
                    {targetImportYear}, lalu ganti dengan data baru.
                  </div>
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setImportMode("append")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setImportMode("append");
                    }
                  }}
                  className={`p-3 text-left rounded-xl border text-xs cursor-pointer select-none transition-all ${
                    importMode === "append"
                      ? "border-primary bg-primary/10 text-primary font-bold shadow-2xs"
                      : "border-border hover:bg-muted text-muted-foreground"
                  }`}
                >
                  <div className="font-semibold text-foreground">Gabungkan (Append)</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Tambahkan personil dari file ke bulan{" "}
                    {INDONESIAN_MONTHS.find((m) => m.value === targetImportMonth)?.label}{" "}
                    {targetImportYear}.
                  </div>
                </div>
              </div>
            </div>

            {/* Preview List */}
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">Daftar Personil Terbaca:</Label>
              <div className="max-h-44 overflow-y-auto border rounded-xl divide-y text-xs">
                {importPreviewRows.map((r, i) => {
                  const s = calculatePersonStats(r.schedule);
                  return (
                    <div key={i} className="p-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-foreground">{r.name}</span>
                        <div className="text-[11px] text-muted-foreground">
                          {s.totalStandby} hari shift standby ({s.countH} H, {s.countHSmall} h)
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        Siap Diimpor
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsImportModalOpen(false)}
              disabled={isProcessingImport}
            >
              Batal
            </Button>
            <Button size="sm" onClick={handleConfirmImport} disabled={isProcessingImport}>
              {isProcessingImport ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                  Memproses...
                </>
              ) : (
                `Impor ke Bulan ${INDONESIAN_MONTHS.find((m) => m.value === targetImportMonth)?.label}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== 9. MODAL SKEMA SQL SUPABASE ==================== */}
      <Dialog open={isSqlModalOpen} onOpenChange={setIsSqlModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              <span>Skema Database Supabase STB HSE</span>
            </DialogTitle>
            <DialogDescription>
              Salin dan jalankan skema SQL ini di Supabase SQL Editor agar data jadwal STB HSE tersinkronisasi permanen ke cloud.
            </DialogDescription>
          </DialogHeader>

          <div className="my-2 bg-muted p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-72">
            <pre>{`-- Salin dan jalankan di SQL Editor Supabase:
create table if not exists public.stb_hse_roster (
  id uuid primary key default gen_random_uuid(),
  period_month text not null default to_char(now(), 'YYYY-MM'),
  employee_no text default '',
  name text not null,
  role text default 'HSE Officer',
  phone text default '',
  schedule jsonb not null default '{}'::jsonb,
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stb_hse_roster_period_idx on public.stb_hse_roster (period_month);
alter table public.stb_hse_roster enable row level security;
create policy "stb_hse_roster authenticated read" on public.stb_hse_roster for select to authenticated using (true);
create policy "stb_hse_roster authenticated insert" on public.stb_hse_roster for insert to authenticated with check (true);
create policy "stb_hse_roster authenticated update" on public.stb_hse_roster for update to authenticated using (true);
create policy "stb_hse_roster authenticated delete" on public.stb_hse_roster for delete to authenticated using (true);
notify pgrst, 'reload schema';`}</pre>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsSqlModalOpen(false)}>
              Tutup
            </Button>
            <Button size="sm" onClick={handleCopySql} className="gap-1.5">
              <Copy className="size-4" />
              <span>Salin SQL</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== 10. ALERT DIALOG HAPUS PERSONIL ==================== */}
      <AlertDialog
        open={!!deletingRecord}
        onOpenChange={(open) => !open && setDeletingRecord(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Personil dari Roster?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus <strong>"{deletingRecord?.name}"</strong> dari jadwal
              bulan {formatMonthYearIndo(currentPeriod)}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePerson}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ==================== 11. ALERT DIALOG RESET BULAN ==================== */}
      <AlertDialog open={isResetMonthOpen} onOpenChange={setIsResetMonthOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bersihkan Roster Bulan Ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini akan menghapus seluruh data jadwal personil untuk bulan{" "}
              <strong>{formatMonthYearIndo(currentPeriod)}</strong>. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetCurrentMonth}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Ya, Bersihkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
