"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUpDown,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Download,
  FileSpreadsheet,
  FileUp,
  FolderKanban,
  HelpCircle,
  Info,
  Layers,
  LayoutGrid,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Table2,
  Target,
  Trash2,
  TrendingUp,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import { Mounted } from "@/components/mounted";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CANONICAL_QUARTALS,
  INITIAL_PROGRAM_KERJA_2026,
  ProgramKerjaRecord,
  getQuartalColor,
  getStatusBadgeVariant,
  normalizeQuartal,
  parseQuartalAndFocus,
} from "@/lib/program-kerja-seed";

const LOCAL_STORAGE_KEY = "program_kerja_records_v1";

export default function ProgramKerjaPage() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Core Data state
  const [records, setRecords] = useState<ProgramKerjaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean | null>(null);
  const [showDbNotice, setShowDbNotice] = useState(false);

  // Year filter & navigation
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [isAddYearOpen, setIsAddYearOpen] = useState(false);
  const [newYearInput, setNewYearInput] = useState<string>("");

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [quartalFilter, setQuartalFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [picFilter, setPicFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"quartal_asc" | "quartal_desc">("quartal_asc");
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");

  // Add / Edit Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ProgramKerjaRecord | null>(null);
  const [isSavingRecord, setIsSavingRecord] = useState(false);
  const [formData, setFormData] = useState<Partial<ProgramKerjaRecord>>({
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 1",
    quartal_fokus: "",
    program_kerja: "",
    tujuan: "",
    realisasi: "",
    realisasi_aktual: "Proses",
    status: "Planned",
    progress: 0,
    pic: "Designer & Multimedia",
    deadline: "",
    risiko_kendala: "",
    keterangan: "",
  });

  // Delete Alert state
  const [deletingRecord, setDeletingRecord] = useState<ProgramKerjaRecord | null>(null);
  const [isDeletingAllForYear, setIsDeletingAllForYear] = useState(false);

  // Import Modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPreviewRows, setImportPreviewRows] = useState<ProgramKerjaRecord[]>([]);
  const [targetImportYear, setTargetImportYear] = useState<number>(2026);
  const [detectedImportYear, setDetectedImportYear] = useState<number>(2026);
  const [importMode, setImportMode] = useState<"replace_year" | "append_year" | "replace_all">("replace_year");
  const [isProcessingImport, setIsProcessingImport] = useState(false);

  // SQL Modal state
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);

  // ==================== 1. DATA INITIALIZATION & SYNC ====================
  const loadData = async () => {
    setLoading(true);
    let loadedFromDb = false;

    try {
      // Coba fetch dari Supabase
      const { data, error } = await supabase
        .from("program_kerja")
        .select("*")
        .order("year", { ascending: false })
        .order("quartal", { ascending: true })
        .order("created_at", { ascending: true });

      if (!error && data && data.length > 0) {
        // Format DB fields to record interface
        const dbRecords: ProgramKerjaRecord[] = data.map((item: any) => ({
          id: item.id,
          year: Number(item.year) || 2026,
          division: item.division || "Design & Multimedia",
          quartal: item.quartal || "Quartal 1",
          quartal_fokus: item.quartal_fokus || "",
          program_kerja: item.program_kerja || "",
          tujuan: item.tujuan || "",
          realisasi: item.realisasi || "",
          realisasi_aktual: item.realisasi_aktual || "",
          status: item.status || "Planned",
          progress: Number(item.progress) || 0,
          pic: item.pic || "",
          deadline: item.deadline || "",
          risiko_kendala: item.risiko_kendala || "",
          keterangan: item.keterangan || "",
          created_at: item.created_at,
          updated_at: item.updated_at,
        }));

        setRecords(dbRecords);
        setSupabaseConnected(true);
        loadedFromDb = true;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dbRecords));
      } else if (!error && data && data.length === 0) {
        // DB terhubung namun masih kosong, gunakan initial seed
        setSupabaseConnected(true);
      }
    } catch {
      setSupabaseConnected(false);
    }

    if (!loadedFromDb) {
      // Fallback ke localStorage
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setRecords(parsed);
          } else {
            setRecords(INITIAL_PROGRAM_KERJA_2026);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_PROGRAM_KERJA_2026));
          }
        } catch {
          setRecords(INITIAL_PROGRAM_KERJA_2026);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_PROGRAM_KERJA_2026));
        }
      } else {
        setRecords(INITIAL_PROGRAM_KERJA_2026);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_PROGRAM_KERJA_2026));
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Save records to state and LocalStorage, with Supabase sync in background
  const saveRecords = async (newRecords: ProgramKerjaRecord[]) => {
    setRecords(newRecords);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newRecords));
  };

  // ==================== 2. DERIVED DATA & METRICS ====================
  // List of available years
  const availableYears = useMemo(() => {
    const yearSet = new Set<number>();
    records.forEach((r) => {
      if (r.year) yearSet.add(Number(r.year));
    });
    // Ensure selectedYear and default 2026 exist
    yearSet.add(2026);
    yearSet.add(selectedYear);

    return Array.from(yearSet).sort((a, b) => b - a);
  }, [records, selectedYear]);

  // Records for currently selected year
  const yearRecords = useMemo(() => {
    return records.filter((r) => Number(r.year) === selectedYear);
  }, [records, selectedYear]);

  // Unique PICs in current year
  const uniquePics = useMemo(() => {
    const pics = new Set<string>();
    yearRecords.forEach((r) => {
      if (r.pic && r.pic.trim()) pics.add(r.pic.trim());
    });
    return Array.from(pics).sort();
  }, [yearRecords]);

  // Year KPI Statistics
  const stats = useMemo(() => {
    const total = yearRecords.length;
    let doneCount = 0;
    let inProgressCount = 0;
    let pendingCount = 0;
    let totalProgress = 0;

    const quartalStats: Record<string, { total: number; done: number; avgProgress: number }> = {
      "Quartal 1": { total: 0, done: 0, avgProgress: 0 },
      "Quartal 2": { total: 0, done: 0, avgProgress: 0 },
      "Quartal 3": { total: 0, done: 0, avgProgress: 0 },
      "Quartal 4": { total: 0, done: 0, avgProgress: 0 },
    };

    const quartalProgressSum: Record<string, number> = {
      "Quartal 1": 0,
      "Quartal 2": 0,
      "Quartal 3": 0,
      "Quartal 4": 0,
    };

    yearRecords.forEach((r) => {
      const q = normalizeQuartal(r.quartal);
      const prog = Number(r.progress) || 0;
      totalProgress += prog;

      const s = (r.status || "").toLowerCase();
      const ra = (r.realisasi_aktual || "").toLowerCase();

      const isDone = s === "done" || prog >= 100 || ra === "selesai";
      const isProgress = s === "in progress" || s === "review" || ra === "proses" || (prog > 0 && prog < 100);

      if (isDone) doneCount++;
      else if (isProgress) inProgressCount++;
      else pendingCount++;

      if (quartalStats[q]) {
        quartalStats[q].total++;
        if (isDone) quartalStats[q].done++;
        quartalProgressSum[q] += prog;
      }
    });

    // Calculate quartal averages
    Object.keys(quartalStats).forEach((qKey) => {
      const count = quartalStats[qKey].total;
      quartalStats[qKey].avgProgress = count > 0 ? Math.round(quartalProgressSum[qKey] / count) : 0;
    });

    const averageProgress = total > 0 ? Math.round(totalProgress / total) : 0;

    return {
      total,
      doneCount,
      inProgressCount,
      pendingCount,
      averageProgress,
      quartalStats,
    };
  }, [yearRecords]);

  // Filtered records for active display
  const filteredRecords = useMemo(() => {
    const filtered = yearRecords.filter((rec) => {
      // Search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchProgram = (rec.program_kerja || "").toLowerCase().includes(q);
        const matchTujuan = (rec.tujuan || "").toLowerCase().includes(q);
        const matchRealisasi = (rec.realisasi || "").toLowerCase().includes(q);
        const matchPic = (rec.pic || "").toLowerCase().includes(q);
        const matchKet = (rec.keterangan || "").toLowerCase().includes(q);
        const matchKendala = (rec.risiko_kendala || "").toLowerCase().includes(q);
        if (!matchProgram && !matchTujuan && !matchRealisasi && !matchPic && !matchKet && !matchKendala) {
          return false;
        }
      }

      // Quartal filter
      if (quartalFilter !== "all") {
        if (normalizeQuartal(rec.quartal) !== quartalFilter) return false;
      }

      // Status filter
      if (statusFilter !== "all") {
        const s = (rec.status || "").toLowerCase();
        const ra = (rec.realisasi_aktual || "").toLowerCase();
        if (statusFilter === "done" && s !== "done" && ra !== "selesai" && rec.progress < 100) return false;
        if (statusFilter === "in_progress" && s !== "in progress" && s !== "review" && ra !== "proses") return false;
        if (statusFilter === "planned" && s !== "planned" && s !== "tertunda" && ra !== "tertunda" && ra !== "belum dimulai") return false;
      }

      // PIC filter
      if (picFilter !== "all") {
        if (rec.pic !== picFilter) return false;
      }

      return true;
    });

    // Sort by quartal (1 → 4 or 4 → 1), stable with created_at as tiebreaker
    const quartalNumber = (quartal: string) => Number(normalizeQuartal(quartal).replace(/\D/g, "")) || 0;
    return filtered.sort((a, b) => {
      const diff = quartalNumber(a.quartal) - quartalNumber(b.quartal);
      const direction = sortBy === "quartal_asc" ? 1 : -1;
      if (diff !== 0) return diff * direction;
      return String(a.program_kerja).localeCompare(String(b.program_kerja));
    });
  }, [yearRecords, searchTerm, quartalFilter, statusFilter, picFilter, sortBy]);

  // Grouped by quartal for kanban / table sections
  const groupedByQuartal = useMemo(() => {
    const groups: Record<string, ProgramKerjaRecord[]> = {
      "Quartal 1": [],
      "Quartal 2": [],
      "Quartal 3": [],
      "Quartal 4": [],
    };

    filteredRecords.forEach((r) => {
      const q = normalizeQuartal(r.quartal);
      if (!groups[q]) groups[q] = [];
      groups[q].push(r);
    });

    return groups;
  }, [filteredRecords]);

  // ==================== 3. CRUD HANDLERS ====================
  const handleOpenAddForm = () => {
    setEditingRecord(null);
    setFormData({
      year: selectedYear,
      division: "Design & Multimedia",
      quartal: quartalFilter !== "all" ? quartalFilter : "Quartal 1",
      quartal_fokus: "",
      program_kerja: "",
      tujuan: "",
      realisasi: "",
      realisasi_aktual: "Proses",
      status: "Planned",
      progress: 0,
      pic: "Designer & Multimedia",
      deadline: "",
      risiko_kendala: "",
      keterangan: "",
    });
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (record: ProgramKerjaRecord) => {
    setEditingRecord(record);
    setFormData({ ...record });
    setIsFormOpen(true);
  };

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.program_kerja?.trim()) {
      toast.error("Nama Program Kerja wajib diisi!");
      return;
    }

    setIsSavingRecord(true);
    try {
      const progValue = Math.min(100, Math.max(0, Number(formData.progress) || 0));
      const targetYear = Number(formData.year) || selectedYear;
      const targetQuartal = normalizeQuartal(formData.quartal || "Quartal 1");

      if (editingRecord) {
        // Update existing record
        const updatedRecord: ProgramKerjaRecord = {
          ...editingRecord,
          year: targetYear,
          division: formData.division || "Design & Multimedia",
          quartal: targetQuartal,
          quartal_fokus: formData.quartal_fokus?.trim() || "",
          program_kerja: formData.program_kerja.trim(),
          tujuan: formData.tujuan?.trim() || "",
          realisasi: formData.realisasi?.trim() || "",
          realisasi_aktual: formData.realisasi_aktual?.trim() || "",
          status: formData.status?.trim() || "Planned",
          progress: progValue,
          pic: formData.pic?.trim() || "Designer & Multimedia",
          deadline: formData.deadline?.trim() || "",
          risiko_kendala: formData.risiko_kendala?.trim() || "",
          keterangan: formData.keterangan?.trim() || "",
          updated_at: new Date().toISOString(),
        };

        const updatedList = records.map((r) => (r.id === editingRecord.id ? updatedRecord : r));
        await saveRecords(updatedList);

        if (supabaseConnected) {
          await supabase
            .from("program_kerja")
            .update({
              year: updatedRecord.year,
              division: updatedRecord.division,
              quartal: updatedRecord.quartal,
              quartal_fokus: updatedRecord.quartal_fokus,
              program_kerja: updatedRecord.program_kerja,
              tujuan: updatedRecord.tujuan,
              realisasi: updatedRecord.realisasi,
              realisasi_aktual: updatedRecord.realisasi_aktual,
              status: updatedRecord.status,
              progress: updatedRecord.progress,
              pic: updatedRecord.pic,
              deadline: updatedRecord.deadline,
              risiko_kendala: updatedRecord.risiko_kendala,
              keterangan: updatedRecord.keterangan,
            })
            .eq("id", editingRecord.id);
        }

        toast.success("Program kerja berhasil diperbarui!");
      } else {
        // Add new record
        const newRecord: ProgramKerjaRecord = {
          id: `proker-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          year: targetYear,
          division: formData.division || "Design & Multimedia",
          quartal: targetQuartal,
          quartal_fokus: formData.quartal_fokus?.trim() || "",
          program_kerja: formData.program_kerja.trim(),
          tujuan: formData.tujuan?.trim() || "",
          realisasi: formData.realisasi?.trim() || "",
          realisasi_aktual: formData.realisasi_aktual?.trim() || "",
          status: formData.status?.trim() || "Planned",
          progress: progValue,
          pic: formData.pic?.trim() || "Designer & Multimedia",
          deadline: formData.deadline?.trim() || "",
          risiko_kendala: formData.risiko_kendala?.trim() || "",
          keterangan: formData.keterangan?.trim() || "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const updatedList = [newRecord, ...records];
        await saveRecords(updatedList);

        if (supabaseConnected) {
          await supabase.from("program_kerja").insert({
            year: newRecord.year,
            division: newRecord.division,
            quartal: newRecord.quartal,
            quartal_fokus: newRecord.quartal_fokus,
            program_kerja: newRecord.program_kerja,
            tujuan: newRecord.tujuan,
            realisasi: newRecord.realisasi,
            realisasi_aktual: newRecord.realisasi_aktual,
            status: newRecord.status,
            progress: newRecord.progress,
            pic: newRecord.pic,
            deadline: newRecord.deadline,
            risiko_kendala: newRecord.risiko_kendala,
            keterangan: newRecord.keterangan,
          });
        }

        toast.success("Program kerja baru berhasil ditambahkan!");
      }

      setIsFormOpen(false);
    } catch (err: any) {
      toast.error("Gagal menyimpan data: " + err.message);
    } finally {
      setIsSavingRecord(false);
    }
  };

  const handleDeleteRecord = async () => {
    if (!deletingRecord) return;
    try {
      const updatedList = records.filter((r) => r.id !== deletingRecord.id);
      await saveRecords(updatedList);

      if (supabaseConnected) {
        await supabase.from("program_kerja").delete().eq("id", deletingRecord.id);
      }

      toast.success("Program kerja berhasil dihapus.");
    } catch (err: any) {
      toast.error("Gagal menghapus data: " + err.message);
    } finally {
      setDeletingRecord(null);
    }
  };

  const handleDeleteAllForYear = async () => {
    try {
      const updatedList = records.filter((r) => Number(r.year) !== selectedYear);
      await saveRecords(updatedList);

      if (supabaseConnected) {
        await supabase.from("program_kerja").delete().eq("year", selectedYear);
      }

      toast.success(`Semua program kerja untuk tahun ${selectedYear} telah dibersihkan.`);
    } catch (err: any) {
      toast.error("Gagal membersihkan data: " + err.message);
    } finally {
      setIsDeletingAllForYear(false);
    }
  };

  const handleAddNewYear = () => {
    const yr = parseInt(newYearInput, 10);
    if (!yr || yr < 2000 || yr > 2100) {
      toast.error("Masukkan tahun yang valid antara 2000 - 2100");
      return;
    }

    setSelectedYear(yr);
    setIsAddYearOpen(false);
    setNewYearInput("");
    toast.success(`Tahun ${yr} dipilih. Anda dapat menambahkan atau mengimpor data untuk tahun ini.`);
  };

  // ==================== 4. EXCEL & CSV IMPORT (PER-TAHUN) ====================
  const parseExcelOrCsvFile = async (file: File) => {
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

    // Cari header row dan deteksi tahun dari judul (misal "PROGRAM KERJA ACTUAL Design & Multimedia 2026")
    let detectedYear = selectedYear;
    let headerRowIdx = -1;

    // Scan baris awal untuk mendeteksi tahun
    for (let i = 0; i < Math.min(rawRows.length, 6); i++) {
      const rowStr = rawRows[i].join(" ");
      const yrMatch = rowStr.match(/\b(20\d{2})\b/);
      if (yrMatch) {
        detectedYear = parseInt(yrMatch[1], 10);
      }
      const lowerCells = rawRows[i].map((c) => String(c || "").trim().toLowerCase());
      if (
        lowerCells.some(
          (c) =>
            c.includes("quartal") ||
            c.includes("program kerja") ||
            c.includes("proker") ||
            c.includes("kegiatan") ||
            c.includes("tujuan")
        )
      ) {
        headerRowIdx = i;
        break;
      }
    }

    // Jika tidak ditemukan di baris awal, cek nama file
    if (!detectedYear || detectedYear === selectedYear) {
      const fileNameMatch = file.name.match(/\b(20\d{2})\b/);
      if (fileNameMatch) {
        detectedYear = parseInt(fileNameMatch[1], 10);
      }
    }

    if (headerRowIdx === -1) {
      throw new Error(
        "Kolom header tidak ditemukan. Pastikan file memiliki kolom: Quartal, Program Kerja, Tujuan, Realisasi, Status, Progress, PIC, Deadline."
      );
    }

    const headers = rawRows[headerRowIdx].map((c) =>
      String(c || "")
        .trim()
        .toLowerCase()
        .replace(/[._]/g, " ")
        .replace(/\s+/g, " ")
    );

    const findIdx = (keywords: string[]) => {
      return headers.findIndex((h) => keywords.some((k) => h === k || h.includes(k)));
    };

    const quartalIdx = findIdx(["quartal", "kuartal", "quarter", "q"]);
    const programIdx = findIdx(["program kerja", "proker", "program", "kegiatan", "activity"]);
    const tujuanIdx = findIdx(["tujuan", "sasaran", "goal", "objective"]);
    const realisasiIdx = findIdx(["realisasi", "rencana", "plan"]);
    const realisasiAktualIdx = findIdx(["realisasi aktual", "aktual", "catatan aktual"]);
    const statusIdx = findIdx(["status", "tahapan"]);
    const progressIdx = findIdx(["progress", "progres", "%", "persen"]);
    const picIdx = findIdx(["pic", "penanggung jawab", "person"]);
    const deadlineIdx = findIdx(["deadline", "target", "waktu", "due date"]);
    const risikoIdx = findIdx(["risiko", "kendala", "hambatan", "risk"]);
    const ketIdx = findIdx(["keterangan", "ket", "notes", "catatan"]);

    if (programIdx === -1) {
      throw new Error("Kolom 'Program Kerja' tidak ditemukan pada baris header.");
    }

    const parsed: ProgramKerjaRecord[] = [];
    let currentQuartal = "Quartal 1";
    let currentFokus = "";

    for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row || row.every((c) => !c || String(c).trim() === "")) continue;

      // Handle Quartal inheritance for merged rows
      const rawQuartalCell = quartalIdx !== -1 ? String(row[quartalIdx] || "").trim() : "";
      if (rawQuartalCell) {
        const parsedQ = parseQuartalAndFocus(rawQuartalCell);
        currentQuartal = parsedQ.quartal;
        if (parsedQ.fokus) currentFokus = parsedQ.fokus;
      }

      const programKerja = programIdx !== -1 ? String(row[programIdx] || "").trim() : "";
      if (!programKerja) continue; // Skip blank program rows

      const tujuan = tujuanIdx !== -1 ? String(row[tujuanIdx] || "").trim() : "";
      const realisasi = realisasiIdx !== -1 ? String(row[realisasiIdx] || "").trim() : "";
      const realisasiAktual = realisasiAktualIdx !== -1 ? String(row[realisasiAktualIdx] || "").trim() : "";
      const rawStatus = statusIdx !== -1 ? String(row[statusIdx] || "").trim() : "Planned";
      const rawProgress = progressIdx !== -1 ? String(row[progressIdx] || "").trim() : "0";
      const pic = picIdx !== -1 ? String(row[picIdx] || "").trim() : "Designer & Multimedia";
      const deadline = deadlineIdx !== -1 ? String(row[deadlineIdx] || "").trim() : "";
      const risikoKendala = risikoIdx !== -1 ? String(row[risikoIdx] || "").trim() : "";
      const keterangan = ketIdx !== -1 ? String(row[ketIdx] || "").trim() : "";

      // Parse progress number
      let progress = 0;
      const cleanProgStr = rawProgress.replace(/%/g, "").trim();
      const numProg = parseFloat(cleanProgStr);
      if (!isNaN(numProg)) {
        progress = numProg <= 1 && numProg > 0 && cleanProgStr.includes(".") ? Math.round(numProg * 100) : Math.round(numProg);
      }

      parsed.push({
        id: `import-${Date.now()}-${r}`,
        year: detectedYear,
        division: "Design & Multimedia",
        quartal: currentQuartal,
        quartal_fokus: currentFokus,
        program_kerja: programKerja,
        tujuan,
        realisasi,
        realisasi_aktual: realisasiAktual,
        status: rawStatus || "Planned",
        progress: Math.min(100, Math.max(0, progress)),
        pic: pic || "Designer & Multimedia",
        deadline,
        risiko_kendala: risikoKendala,
        keterangan,
      });
    }

    return { parsed, detectedYear };
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    try {
      toast.loading("Menganalisis file...", { id: "import-proker" });
      const { parsed, detectedYear } = await parseExcelOrCsvFile(file);

      if (parsed.length === 0) {
        toast.error("Tidak ditemukan data program kerja yang valid di file.", { id: "import-proker" });
        return;
      }

      setImportPreviewRows(parsed);
      setDetectedImportYear(detectedYear);
      setTargetImportYear(detectedYear || selectedYear);
      setImportMode("replace_year");
      setIsImportModalOpen(true);

      toast.success(
        `${parsed.length} program kerja berhasil dibaca dari file. Tahun terdeteksi: ${detectedYear}.`,
        { id: "import-proker" }
      );
    } catch (err: any) {
      toast.error(err.message || "Gagal memproses file import.", { id: "import-proker" });
    }
  };

  const handleConfirmImport = async () => {
    if (importPreviewRows.length === 0) return;
    setIsProcessingImport(true);

    try {
      const yearToApply = targetImportYear;
      // Adjust year for all parsed rows to match targetImportYear
      const normalizedImportRows = importPreviewRows.map((r) => ({
        ...r,
        year: yearToApply,
      }));

      let finalRecords: ProgramKerjaRecord[] = [];

      if (importMode === "replace_year") {
        // Hapus data tahun ini lalu masukkan yang baru
        const otherYears = records.filter((r) => Number(r.year) !== yearToApply);
        finalRecords = [...normalizedImportRows, ...otherYears];
      } else if (importMode === "append_year") {
        // Tambahkan ke tahun ini
        finalRecords = [...normalizedImportRows, ...records];
      } else if (importMode === "replace_all") {
        // Timpa seluruh data
        finalRecords = normalizedImportRows;
      }

      await saveRecords(finalRecords);
      setSelectedYear(yearToApply);

      // Sinkronisasi ke Supabase jika terhubung
      if (supabaseConnected) {
        if (importMode === "replace_year") {
          await supabase.from("program_kerja").delete().eq("year", yearToApply);
        } else if (importMode === "replace_all") {
          await supabase.from("program_kerja").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        }

        // Batch insert ke Supabase
        const payload = normalizedImportRows.map((r) => ({
          year: r.year,
          division: r.division || "Design & Multimedia",
          quartal: r.quartal,
          quartal_fokus: r.quartal_fokus || "",
          program_kerja: r.program_kerja,
          tujuan: r.tujuan || "",
          realisasi: r.realisasi || "",
          realisasi_aktual: r.realisasi_aktual || "",
          status: r.status || "Planned",
          progress: r.progress || 0,
          pic: r.pic || "",
          deadline: r.deadline || "",
          risiko_kendala: r.risiko_kendala || "",
          keterangan: r.keterangan || "",
        }));

        await supabase.from("program_kerja").insert(payload);
      }

      setIsImportModalOpen(false);
      toast.success(`Berhasil mengimpor ${normalizedImportRows.length} program kerja untuk tahun ${yearToApply}!`);
    } catch (err: any) {
      toast.error("Gagal menyelesaikan import: " + err.message);
    } finally {
      setIsProcessingImport(false);
    }
  };

  // ==================== 5. EXPORT & TEMPLATE DOWNLOAD ====================
  const handleExportExcel = (exportAll = false) => {
    const dataToExport = exportAll ? records : yearRecords;
    if (dataToExport.length === 0) {
      toast.warning("Tidak ada data untuk diekspor.");
      return;
    }

    // Sort by Quartal and Created
    const sorted = [...dataToExport].sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return a.quartal.localeCompare(b.quartal);
    });

    const worksheetData: any[][] = [
      [`PROGRAM KERJA ACTUAL Design & Multimedia ${exportAll ? "Semua Tahun" : selectedYear}`],
      [],
      [],
      [
        "Quartal",
        "Program Kerja",
        "Tujuan",
        "Realisasi",
        "Realisasi Aktual",
        "Status",
        "Progress",
        "PIC",
        "Deadline",
        "Risiko/Kendala",
        "Keterangan",
      ],
    ];

    sorted.forEach((r) => {
      const quartalLabel = r.quartal_fokus ? `${r.quartal}\n\nFokus: ${r.quartal_fokus}` : r.quartal;
      worksheetData.push([
        quartalLabel,
        r.program_kerja,
        r.tujuan || "",
        r.realisasi || "",
        r.realisasi_aktual || "",
        r.status || "",
        `${r.progress}%`,
        r.pic || "",
        r.deadline || "",
        r.risiko_kendala || "",
        r.keterangan || "",
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    worksheet["!cols"] = [
      { wch: 18 }, // Quartal
      { wch: 38 }, // Program Kerja
      { wch: 35 }, // Tujuan
      { wch: 35 }, // Realisasi
      { wch: 16 }, // Realisasi Aktual
      { wch: 14 }, // Status
      { wch: 10 }, // Progress
      { wch: 22 }, // PIC
      { wch: 22 }, // Deadline
      { wch: 30 }, // Risiko/Kendala
      { wch: 30 }, // Keterangan
    ];

    const workbook = XLSX.utils.book_new();
    const sheetName = exportAll ? "Program Kerja All" : `Proker ${selectedYear}`;
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const fileName = exportAll
      ? `Program_Kerja_Design_Multimedia_Semua_Tahun.xlsx`
      : `Program_Kerja_Design_Multimedia_${selectedYear}.xlsx`;

    XLSX.writeFile(workbook, fileName);
    toast.success(`Data berhasil diekspor ke ${fileName}`);
  };

  const handleDownloadTemplate = () => {
    const templateData: any[][] = [
      [`PROGRAM KERJA ACTUAL Design & Multimedia 2027`],
      [],
      [],
      [
        "Quartal",
        "Program Kerja",
        "Tujuan",
        "Realisasi",
        "Realisasi Aktual",
        "Status",
        "Progress",
        "PIC",
        "Deadline",
        "Risiko/Kendala",
        "Keterangan",
      ],
      [
        "Quartal 1\n\nFokus: Perencanaan & Setup",
        "Audit dan Pembaharuan Aset Digital",
        "Merapikan struktur file & aset cloud tahun baru",
        "Audit Google Drive dan Server Desain",
        "Proses",
        "Planned",
        "50%",
        "Designer & Multimedia",
        "Week 2 Januari",
        "",
        "Folder 2027 sudah disiapkan",
      ],
      [
        "Quartal 1",
        "Produksi Konten Marketing Q1",
        "Meningkatkan engagement sosial media",
        "Pembuatan 10 banner promosi produk",
        "Proses",
        "In Progress",
        "80%",
        "Designer",
        "Week 3 Januari",
        "",
        "",
      ],
      [
        "Quartal 2\n\nFokus: Kampanye & Iklan",
        "Kampanye Produk Semester 1",
        "Dukungan materi iklan digital",
        "Shooting dan editing video promosi",
        "Belum dimulai",
        "Planned",
        "0%",
        "Multimedia",
        "Week 1 April",
        "",
        "",
      ],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(templateData);
    worksheet["!cols"] = [
      { wch: 20 },
      { wch: 35 },
      { wch: 32 },
      { wch: 32 },
      { wch: 15 },
      { wch: 14 },
      { wch: 10 },
      { wch: 22 },
      { wch: 20 },
      { wch: 25 },
      { wch: 25 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template Proker");
    XLSX.writeFile(workbook, "Template_Program_Kerja_Tahunan.xlsx");
    toast.success("Template Excel Program Kerja berhasil diunduh.");
  };

  const handleCopySql = () => {
    const sql = `-- Salin dan jalankan di SQL Editor Supabase:
create table if not exists public.program_kerja (
  id uuid primary key default gen_random_uuid(),
  year integer not null default extract(year from now())::integer,
  division text not null default 'Design & Multimedia',
  quartal text not null,
  quartal_fokus text default '',
  program_kerja text not null,
  tujuan text default '',
  realisasi text default '',
  realisasi_aktual text default '',
  status text not null default 'Planned',
  progress numeric not null default 0,
  pic text default '',
  deadline text default '',
  risiko_kendala text default '',
  keterangan text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists program_kerja_year_idx on public.program_kerja (year);
create index if not exists program_kerja_quartal_idx on public.program_kerja (quartal);
alter table public.program_kerja enable row level security;
create policy "program_kerja authenticated read" on public.program_kerja for select to authenticated using (true);
create policy "program_kerja authenticated insert" on public.program_kerja for insert to authenticated with check (true);
create policy "program_kerja authenticated update" on public.program_kerja for update to authenticated using (true);
create policy "program_kerja authenticated delete" on public.program_kerja for delete to authenticated using (true);
notify pgrst, 'reload schema';`;

    navigator.clipboard.writeText(sql);
    toast.success("SQL skema berhasil disalin ke clipboard!");
  };

  return (
    <div className="col-span-12 flex flex-col gap-5">
      {/* Hidden file input for Excel / CSV import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".xlsx,.xls,.csv"
        className="hidden"
      />

      {/* ==================== 1. TOP HEADER & YEAR NAVIGATOR ==================== */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-card border rounded-2xl p-6 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <FolderKanban className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">Program Kerja</h1>
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs font-semibold px-2 py-0.5">
                  Design & Multimedia
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Agenda kerja per quartal, pelacakan realisasi aktual, status, dan import/export tahunan.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Year Selector */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Year Switcher Box */}
          <div className="flex items-center gap-1.5 bg-muted/70 p-1 rounded-xl border">
            <Calendar className="size-4 ml-2 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Tahun:</span>
            <Mounted
              fallback={
                <div className="w-[110px] h-8 rounded-md border bg-background shadow-2xs" />
              }
            >
              <Select
                value={String(selectedYear)}
                onValueChange={(val) => {
                  setSelectedYear(Number(val));
                  setQuartalFilter("all");
                }}
              >
                <SelectTrigger className="w-[110px] h-8 bg-background font-bold text-sm border shadow-2xs">
                  <SelectValue placeholder="Pilih Tahun" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((yr) => (
                    <SelectItem key={yr} value={String(yr)} className="font-medium">
                      {yr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Mounted>

            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground"
              title="Tambah Tahun Baru"
              onClick={() => setIsAddYearOpen(true)}
            >
              <Plus className="size-4" />
            </Button>
          </div>

          {/* Import Button */}
          <Button
            variant="default"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
          >
            <FileUp className="size-4" />
            <span>Import Per-Tahun</span>
          </Button>

          {/* Export Dropdown / Button */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExportExcel(false)}
              className="gap-1.5 font-medium shadow-2xs"
            >
              <Download className="size-4 text-primary" />
              <span>Export {selectedYear}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              title="Download Template Excel"
              onClick={handleDownloadTemplate}
            >
              <FileSpreadsheet className="size-4 text-emerald-600" />
            </Button>
          </div>

          {/* Add Proker Button */}
          <Button
            size="sm"
            onClick={handleOpenAddForm}
            className="gap-1.5 shadow-xs font-semibold"
          >
            <Plus className="size-4" />
            <span>Tambah Program</span>
          </Button>
        </div>
      </div>

      {/* DB / Sync Notice */}
      {supabaseConnected === false && (
        <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              <strong>Mode Offline / Local Storage:</strong> Data disimpan di browser Anda. Untuk menyimpan ke database Supabase, jalankan skema SQL di Dashboard Supabase.
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSqlModalOpen(true)}
            className="h-7 text-xs border-amber-300 dark:border-amber-700"
          >
            Lihat Skema SQL
          </Button>
        </div>
      )}

      {/* ==================== 2. KPI / STATS CARDS ==================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Program */}
        <div className="bg-card border rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Program ({selectedYear})</span>
            <span className="p-1.5 bg-primary/10 text-primary rounded-lg">
              <FolderKanban className="size-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-0.5">Program terdaftar di {selectedYear}</p>
          </div>
        </div>

        {/* Selesai / 100% */}
        <div className="bg-card border rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Selesai (Done)</span>
            <span className="p-1.5 bg-emerald-500/10 text-emerald-600 rounded-lg">
              <CheckCircle2 className="size-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
              {stats.doneCount}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {stats.total > 0 ? `${Math.round((stats.doneCount / stats.total) * 100)}% dari target` : "0%"}
            </p>
          </div>
        </div>

        {/* In Progress */}
        <div className="bg-card border rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Dalam Proses</span>
            <span className="p-1.5 bg-blue-500/10 text-blue-600 rounded-lg">
              <Clock className="size-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 tracking-tight">
              {stats.inProgressCount}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Sedang berjalan / review</p>
          </div>
        </div>

        {/* Tertunda / Planned */}
        <div className="bg-card border rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Tertunda / Planned</span>
            <span className="p-1.5 bg-amber-500/10 text-amber-600 rounded-lg">
              <AlertCircle className="size-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 tracking-tight">
              {stats.pendingCount}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Menunggu jadwal / riset</p>
          </div>
        </div>

        {/* Rata-rata Progres */}
        <div className="bg-card border rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Rata-rata Kemajuan</span>
            <span className="p-1.5 bg-purple-500/10 text-purple-600 rounded-lg">
              <TrendingUp className="size-4" />
            </span>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 tracking-tight">
                {stats.averageProgress}%
              </div>
            </div>
            <div className="w-full bg-muted rounded-full h-2 mt-2 overflow-hidden">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${stats.averageProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Quartal Quick Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CANONICAL_QUARTALS.map((q) => {
          const qStat = stats.quartalStats[q] || { total: 0, done: 0, avgProgress: 0 };
          const color = getQuartalColor(q);
          const isSelected = quartalFilter === q;

          return (
            <div
              key={q}
              role="button"
              tabIndex={0}
              onClick={() => setQuartalFilter(isSelected ? "all" : q)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setQuartalFilter(isSelected ? "all" : q);
                }
              }}
              className={`p-3 rounded-xl border text-left cursor-pointer transition-all select-none ${
                isSelected
                  ? "ring-2 ring-primary bg-primary/5 border-primary"
                  : "bg-card hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">{q}</span>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${color.badge}`}>
                  {qStat.total} Proker
                </Badge>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground">Progress:</span>
                <span className="text-xs font-bold">{qStat.avgProgress}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 mt-1.5 overflow-hidden">
                <div
                  className="h-1.5 bg-primary rounded-full transition-all"
                  style={{ width: `${qStat.avgProgress}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* ==================== 3. FILTER & TOOLBAR ==================== */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card border rounded-xl p-4 shadow-2xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Cari program kerja, tujuan, PIC, kendala..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quartal Filter */}
          <Mounted
            fallback={<div className="w-[140px] h-9 rounded-md border bg-background" />}
          >
            <Select value={quartalFilter} onValueChange={setQuartalFilter}>
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <SelectValue placeholder="Semua Quartal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Quartal</SelectItem>
                <SelectItem value="Quartal 1">Quartal 1</SelectItem>
                <SelectItem value="Quartal 2">Quartal 2</SelectItem>
                <SelectItem value="Quartal 3">Quartal 3</SelectItem>
                <SelectItem value="Quartal 4">Quartal 4</SelectItem>
              </SelectContent>
            </Select>
          </Mounted>

          {/* Status Filter */}
          <Mounted
            fallback={<div className="w-[130px] h-9 rounded-md border bg-background" />}
          >
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] h-9 text-xs">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="done">Selesai (Done)</SelectItem>
                <SelectItem value="in_progress">Dalam Proses</SelectItem>
                <SelectItem value="planned">Planned / Tertunda</SelectItem>
              </SelectContent>
            </Select>
          </Mounted>

          {/* PIC Filter */}
          {uniquePics.length > 0 && (
            <Mounted
              fallback={<div className="w-[150px] h-9 rounded-md border bg-background" />}
            >
              <Select value={picFilter} onValueChange={setPicFilter}>
                <SelectTrigger className="w-[150px] h-9 text-xs">
                  <SelectValue placeholder="Semua PIC" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua PIC</SelectItem>
                  {uniquePics.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Mounted>
          )}

          {/* Sort by Quartal */}
          <Mounted
            fallback={<div className="w-[170px] h-9 rounded-md border bg-background" />}
          >
            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as "quartal_asc" | "quartal_desc")}
            >
              <SelectTrigger className="w-[170px] h-9 text-xs" title="Urutkan berdasarkan quartal">
                <ArrowUpDown className="size-3.5 text-muted-foreground shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quartal_asc">Quartal (1 → 4)</SelectItem>
                <SelectItem value="quartal_desc">Quartal (4 → 1)</SelectItem>
              </SelectContent>
            </Select>
          </Mounted>

          {/* Reset Filters */}
          {(searchTerm || quartalFilter !== "all" || statusFilter !== "all" || picFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setQuartalFilter("all");
                setStatusFilter("all");
                setPicFilter("all");
              }}
              className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3.5 mr-1" />
              Reset
            </Button>
          )}

          {/* View Mode Toggle */}
          <div className="flex items-center border rounded-lg p-0.5 bg-muted/50 ml-auto">
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              className="h-8 px-2.5 text-xs gap-1.5 shadow-2xs"
            >
              <Table2 className="size-3.5" />
              <span className="hidden sm:inline">Tabel Lengkap</span>
            </Button>
            <Button
              variant={viewMode === "kanban" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("kanban")}
              className="h-8 px-2.5 text-xs gap-1.5 shadow-2xs"
            >
              <LayoutGrid className="size-3.5" />
              <span className="hidden sm:inline">Kartu Quartal</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ==================== 4. MAIN CONTENT (TABLE OR KANBAN) ==================== */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 bg-card border rounded-2xl">
          <Loader2 className="size-8 animate-spin text-primary mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Memuat data program kerja {selectedYear}...</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 bg-card border rounded-2xl text-center">
          <FolderKanban className="size-12 text-muted-foreground/40 mb-3" />
          <h3 className="text-lg font-bold">Belum Ada Program Kerja</h3>
          <p className="text-sm text-muted-foreground max-w-md mt-1 mb-5">
            Tidak ada program kerja untuk tahun {selectedYear} dengan filter yang dipilih. Anda dapat menambah secara manual atau mengimpor dari file Excel.
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleOpenAddForm} className="gap-1.5">
              <Plus className="size-4" />
              Tambah Program
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5"
            >
              <FileUp className="size-4" />
              Import Excel {selectedYear}
            </Button>
          </div>
        </div>
      ) : viewMode === "table" ? (
        /* TABLE VIEW (Presisi sesuai template lampiran) */
        <div className="bg-card border rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/60 sticky top-0 z-10">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[140px] min-w-[130px] font-bold text-foreground">Quartal</TableHead>
                  <TableHead className="min-w-[220px] max-w-[320px] font-bold text-foreground">Program Kerja</TableHead>
                  <TableHead className="min-w-[200px] max-w-[300px] font-bold text-foreground">Tujuan</TableHead>
                  <TableHead className="min-w-[200px] max-w-[300px] font-bold text-foreground">Realisasi</TableHead>
                  <TableHead className="min-w-[160px] max-w-[240px] font-bold text-foreground">Realisasi Aktual</TableHead>
                  <TableHead className="w-[110px] min-w-[100px] font-bold text-foreground text-center whitespace-nowrap">Status</TableHead>
                  <TableHead className="w-[110px] min-w-[100px] font-bold text-foreground text-center whitespace-nowrap">Progress</TableHead>
                  <TableHead className="min-w-[130px] max-w-[180px] font-bold text-foreground">PIC</TableHead>
                  <TableHead className="min-w-[130px] max-w-[160px] font-bold text-foreground">Deadline</TableHead>
                  <TableHead className="min-w-[180px] max-w-[260px] font-bold text-foreground">Risiko / Kendala</TableHead>
                  <TableHead className="min-w-[180px] max-w-[260px] font-bold text-foreground">Keterangan</TableHead>
                  <TableHead className="w-[80px] min-w-[80px] font-bold text-foreground text-center whitespace-nowrap">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(groupedByQuartal)
                  .filter(([, items]) => items.length > 0)
                  .sort((a, b) => {
                    const ia = CANONICAL_QUARTALS.indexOf(
                      a[0] as (typeof CANONICAL_QUARTALS)[number],
                    );
                    const ib = CANONICAL_QUARTALS.indexOf(
                      b[0] as (typeof CANONICAL_QUARTALS)[number],
                    );
                    return sortBy === "quartal_asc" ? ia - ib : ib - ia;
                  })
                  .map(([q, items]) => {
                    const qColor = getQuartalColor(q);
                    return (
                      <Fragment key={q}>
                        {/* Group Header per Quartal */}
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={12} className="bg-muted/60 px-4 py-0 border-y">
                            <div className="flex items-center justify-between gap-2 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className={`size-2.5 rounded-full ${qColor.pill}`} />
                                <span className="font-bold text-sm text-foreground">{q}</span>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 font-semibold ${qColor.badge}`}
                                >
                                  {items.length} Proker
                                </Badge>
                                {items[0]?.quartal_fokus && (
                                  <span className="text-[11px] text-muted-foreground italic hidden lg:inline">
                                    Fokus: {items[0].quartal_fokus}
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>

                        {items.map((item, index) => {
                  const qColor = getQuartalColor(item.quartal);
                  const statusVariant = getStatusBadgeVariant(item.status || item.realisasi_aktual);

                  return (
                    <TableRow
                      key={item.id || index}
                      className="hover:bg-muted/40 transition-colors group text-xs sm:text-sm"
                    >
                      {/* Quartal */}
                      <TableCell className="align-top py-3.5 w-[140px] min-w-[130px] whitespace-normal">
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className={`font-semibold w-fit text-[11px] ${qColor.badge}`}>
                            {item.quartal}
                          </Badge>
                          {item.quartal_fokus && (
                            <span className="text-[11px] text-muted-foreground italic leading-tight break-words [overflow-wrap:anywhere]">
                              Fokus: {item.quartal_fokus}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Program Kerja */}
                      <TableCell className="align-top py-3.5 font-semibold text-foreground whitespace-normal min-w-[220px] max-w-[320px]">
                        <div className="leading-snug break-words [overflow-wrap:anywhere]">{item.program_kerja}</div>
                      </TableCell>

                      {/* Tujuan */}
                      <TableCell className="align-top py-3.5 text-muted-foreground leading-relaxed whitespace-normal min-w-[200px] max-w-[300px]">
                        <div className="leading-relaxed break-words [overflow-wrap:anywhere]">{item.tujuan || "-"}</div>
                      </TableCell>

                      {/* Realisasi */}
                      <TableCell className="align-top py-3.5 text-muted-foreground leading-relaxed whitespace-pre-line min-w-[200px] max-w-[300px]">
                        <div className="leading-relaxed whitespace-pre-line break-words [overflow-wrap:anywhere]">{item.realisasi || "-"}</div>
                      </TableCell>

                      {/* Realisasi Aktual */}
                      <TableCell className="align-top py-3.5 whitespace-normal min-w-[160px] max-w-[240px]">
                        <div className="font-medium text-foreground whitespace-pre-line break-words [overflow-wrap:anywhere] leading-snug">
                          {item.realisasi_aktual || "-"}
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="align-top py-3.5 text-center whitespace-nowrap w-[110px] min-w-[100px]">
                        <Badge
                          variant="outline"
                          className={`text-[11px] font-medium px-2 py-0.5 ${statusVariant.bg} ${statusVariant.text} ${statusVariant.border}`}
                        >
                          {item.status || "Planned"}
                        </Badge>
                      </TableCell>

                      {/* Progress */}
                      <TableCell className="align-top py-3.5 text-center whitespace-nowrap w-[110px] min-w-[100px]">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-bold text-xs">{item.progress}%</span>
                          <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full ${
                                item.progress >= 100
                                  ? "bg-emerald-500"
                                  : item.progress >= 50
                                  ? "bg-blue-500"
                                  : item.progress > 0
                                  ? "bg-amber-500"
                                  : "bg-slate-300"
                              }`}
                              style={{ width: `${item.progress}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>

                      {/* PIC */}
                      <TableCell className="align-top py-3.5 whitespace-normal min-w-[130px] max-w-[180px]">
                        <span className="inline-flex items-center gap-1 font-medium text-xs bg-muted/60 px-2 py-1 rounded-md break-words [overflow-wrap:anywhere] leading-tight">
                          <UserCheck className="size-3 text-muted-foreground shrink-0" />
                          <span>{item.pic || "Designer"}</span>
                        </span>
                      </TableCell>

                      {/* Deadline */}
                      <TableCell className="align-top py-3.5 text-xs text-muted-foreground whitespace-normal min-w-[130px] max-w-[160px]">
                        {item.deadline ? (
                          <div className="flex items-start gap-1 font-medium leading-snug break-words [overflow-wrap:anywhere]">
                            <Clock className="size-3 shrink-0 text-primary mt-0.5" />
                            <span>{item.deadline}</span>
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>

                      {/* Risiko / Kendala */}
                      <TableCell className="align-top py-3.5 text-xs whitespace-normal min-w-[180px] max-w-[260px]">
                        {item.risiko_kendala ? (
                          <div className="text-rose-600 dark:text-rose-400 font-medium leading-relaxed break-words [overflow-wrap:anywhere]">
                            {item.risiko_kendala}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>

                      {/* Keterangan */}
                      <TableCell className="align-top py-3.5 text-xs text-muted-foreground whitespace-normal min-w-[180px] max-w-[260px]">
                        <div className="leading-relaxed break-words [overflow-wrap:anywhere]">{item.keterangan || "-"}</div>
                      </TableCell>

                      {/* Aksi */}
                      <TableCell className="align-top py-3.5 text-center whitespace-nowrap w-[80px] min-w-[80px]">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-foreground"
                            title="Edit"
                            onClick={() => handleOpenEditForm(item)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-rose-600"
                            title="Hapus"
                            onClick={() => setDeletingRecord(item)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                        );
                      })}
                      </Fragment>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        /* KANBAN / QUARTAL CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {CANONICAL_QUARTALS.map((q) => {
            const items = groupedByQuartal[q] || [];
            const qColor = getQuartalColor(q);

            return (
              <div
                key={q}
                className="bg-card border rounded-2xl p-4 flex flex-col gap-3 shadow-2xs min-h-[500px]"
              >
                {/* Quartal Column Header */}
                <div className={`border-l-4 ${qColor.accent} pl-3 py-1 flex items-center justify-between`}>
                  <div>
                    <h3 className="font-bold text-base">{q}</h3>
                    <span className="text-xs text-muted-foreground">
                      {items.length} Program Kerja
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => {
                      setEditingRecord(null);
                      setFormData({
                        year: selectedYear,
                        quartal: q,
                        status: "Planned",
                        progress: 0,
                        pic: "Designer & Multimedia",
                      });
                      setIsFormOpen(true);
                    }}
                    title={`Tambah ke ${q}`}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>

                {/* Cards Container */}
                <div className="flex flex-col gap-3 overflow-y-auto max-h-[750px] pr-1">
                  {items.length === 0 ? (
                    <div className="border border-dashed rounded-xl p-8 text-center text-xs text-muted-foreground">
                      Tidak ada program untuk {q}
                    </div>
                  ) : (
                    items.map((item) => {
                      const statusVariant = getStatusBadgeVariant(item.status || item.realisasi_aktual);

                      return (
                        <div
                          key={item.id}
                          className="bg-background border rounded-xl p-3.5 shadow-2xs hover:border-primary/50 transition-all flex flex-col gap-2.5 group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-bold text-xs text-foreground line-clamp-2 leading-snug">
                              {item.program_kerja}
                            </span>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-6 text-muted-foreground hover:text-foreground"
                                onClick={() => handleOpenEditForm(item)}
                              >
                                <Pencil className="size-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-6 text-muted-foreground hover:text-rose-600"
                                onClick={() => setDeletingRecord(item)}
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </div>
                          </div>

                          {item.tujuan && (
                            <p className="text-[11px] text-muted-foreground line-clamp-2">
                              {item.tujuan}
                            </p>
                          )}

                          {/* Progress bar */}
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-muted-foreground">Progress</span>
                              <span className="font-bold">{item.progress}%</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full ${
                                  item.progress >= 100 ? "bg-emerald-500" : "bg-primary"
                                }`}
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                          </div>

                          {/* Footer details */}
                          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t text-[10px] text-muted-foreground">
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 font-medium ${statusVariant.bg} ${statusVariant.text} ${statusVariant.border}`}
                            >
                              {item.status || "Planned"}
                            </Badge>

                            {item.deadline && (
                              <span className="flex items-center gap-1">
                                <Clock className="size-2.5 text-primary" />
                                {item.deadline}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ==================== 5. MODAL IMPORT EXCEL / CSV PER-TAHUN ==================== */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="size-5 text-emerald-600" />
              <span>Import Program Kerja Per-Tahun</span>
            </DialogTitle>
            <DialogDescription>
              Periksa ringkasan data sebelum disimpan. Anda dapat memilih tahun target dan mode penyimpanan.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 my-2 overflow-y-auto pr-1">
            {/* Target Year & Mode Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/40 rounded-xl border">
              <div>
                <Label className="text-xs font-semibold">Tahun Target:</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <Input
                    type="number"
                    value={targetImportYear}
                    onChange={(e) => setTargetImportYear(parseInt(e.target.value, 10) || selectedYear)}
                    className="h-9 font-bold text-sm"
                  />
                  {detectedImportYear !== targetImportYear && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTargetImportYear(detectedImportYear)}
                      className="text-xs h-9 text-muted-foreground"
                    >
                      Gunakan {detectedImportYear}
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Data yang diimpor akan dimasukkan ke dalam tahun target ini.
                </p>
              </div>

              <div>
                <Label className="text-xs font-semibold">Mode Import:</Label>
                <Select
                  value={importMode}
                  onValueChange={(val: any) => setImportMode(val)}
                >
                  <SelectTrigger className="h-9 mt-1.5 text-xs font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="replace_year">
                      Ganti Data Tahun Ini (Hapus data lama di tahun {targetImportYear})
                    </SelectItem>
                    <SelectItem value="append_year">
                      Tambahkan ke Tahun Ini (Gabungkan dengan data yang ada)
                    </SelectItem>
                    <SelectItem value="replace_all">
                      Timpa Semua Data (Reset semua tahun)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Pilih "Ganti Data Tahun Ini" untuk memperbarui program kerja tahun berjalan secara utuh.
                </p>
              </div>
            </div>

            {/* Preview Table */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold text-foreground">
                  Preview Data ({importPreviewRows.length} baris terbaca):
                </span>
                <span className="text-xs text-muted-foreground">Menampilkan 5 baris pertama</span>
              </div>
              <div className="border rounded-xl overflow-hidden max-h-60">
                <div className="max-h-60 overflow-y-auto">
                  <div className="overflow-x-auto">
                    <Table>
                  <TableHeader className="bg-muted text-[11px]">
                    <TableRow>
                      <TableHead className="w-[100px] min-w-[90px]">Quartal</TableHead>
                      <TableHead className="min-w-[180px]">Program Kerja</TableHead>
                      <TableHead className="w-[100px] text-center whitespace-nowrap">Status</TableHead>
                      <TableHead className="w-[80px] text-center whitespace-nowrap">Progress</TableHead>
                      <TableHead className="min-w-[120px]">PIC</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {importPreviewRows.slice(0, 5).map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-semibold align-top whitespace-normal break-words">{row.quartal}</TableCell>
                        <TableCell className="align-top whitespace-normal break-words [overflow-wrap:anywhere]">{row.program_kerja}</TableCell>
                        <TableCell className="align-top text-center whitespace-nowrap">{row.status}</TableCell>
                        <TableCell className="align-top text-center font-bold whitespace-nowrap">{row.progress}%</TableCell>
                        <TableCell className="align-top whitespace-normal break-words [overflow-wrap:anywhere]">{row.pic}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsImportModalOpen(false)}
              disabled={isProcessingImport}
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmImport}
              disabled={isProcessingImport}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {isProcessingImport ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  <span>Konfirmasi & Terapkan ke Tahun {targetImportYear}</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== 6. MODAL TAMBAH / EDIT PROGRAM KERJA ==================== */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderKanban className="size-5 text-primary" />
              <span>{editingRecord ? "Edit Program Kerja" : "Tambah Program Kerja Baru"}</span>
            </DialogTitle>
            <DialogDescription>
              Isi parameter program kerja sesuai dengan template divisi Design & Multimedia.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveRecord} className="flex flex-col gap-4 my-2 overflow-y-auto pr-1">
            {/* Year & Quartal */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold">Tahun</Label>
                <Input
                  type="number"
                  value={formData.year || selectedYear}
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value, 10) || selectedYear })}
                  className="mt-1 h-9 text-xs font-bold"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Quartal</Label>
                <Select
                  value={formData.quartal || "Quartal 1"}
                  onValueChange={(val) => setFormData({ ...formData, quartal: val })}
                >
                  <SelectTrigger className="mt-1 h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Quartal 1">Quartal 1</SelectItem>
                    <SelectItem value="Quartal 2">Quartal 2</SelectItem>
                    <SelectItem value="Quartal 3">Quartal 3</SelectItem>
                    <SelectItem value="Quartal 4">Quartal 4</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Fokus Quartal (Opsional)</Label>
                <Input
                  placeholder="Misal: Audit, Perencanaan..."
                  value={formData.quartal_fokus || ""}
                  onChange={(e) => setFormData({ ...formData, quartal_fokus: e.target.value })}
                  className="mt-1 h-9 text-xs"
                />
              </div>
            </div>

            {/* Program Kerja */}
            <div>
              <Label className="text-xs font-semibold">Nama Program Kerja *</Label>
              <Input
                placeholder="Contoh: Implementasi Dashboard Tiketing Design"
                value={formData.program_kerja || ""}
                onChange={(e) => setFormData({ ...formData, program_kerja: e.target.value })}
                className="mt-1 h-9 text-xs font-medium"
                required
              />
            </div>

            {/* Tujuan */}
            <div>
              <Label className="text-xs font-semibold">Tujuan (Objective)</Label>
              <Textarea
                placeholder="Contoh: Sistem terpusat untuk permintaan desain dengan status jelas..."
                value={formData.tujuan || ""}
                onChange={(e) => setFormData({ ...formData, tujuan: e.target.value })}
                className="mt-1 min-h-[60px] text-xs resize-none"
              />
            </div>

            {/* Realisasi & Realisasi Aktual */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Rencana Realisasi</Label>
                <Textarea
                  placeholder="Contoh: Mapping kebutuhan user..."
                  value={formData.realisasi || ""}
                  onChange={(e) => setFormData({ ...formData, realisasi: e.target.value })}
                  className="mt-1 min-h-[60px] text-xs resize-none"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Realisasi Aktual</Label>
                <Textarea
                  placeholder="Contoh: Proses / Selesai / Riset & Referensi..."
                  value={formData.realisasi_aktual || ""}
                  onChange={(e) => setFormData({ ...formData, realisasi_aktual: e.target.value })}
                  className="mt-1 min-h-[60px] text-xs resize-none"
                />
              </div>
            </div>

            {/* Status, Progress, PIC, Deadline */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs font-semibold">Status</Label>
                <Select
                  value={formData.status || "Planned"}
                  onValueChange={(val) => setFormData({ ...formData, status: val })}
                >
                  <SelectTrigger className="mt-1 h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Planned">Planned</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Review">Review</SelectItem>
                    <SelectItem value="Done">Done</SelectItem>
                    <SelectItem value="Tertunda">Tertunda</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Progress (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={formData.progress ?? 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      progress: Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)),
                    })
                  }
                  className="mt-1 h-9 text-xs font-bold"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">PIC</Label>
                <Input
                  placeholder="Designer / Multimedia"
                  value={formData.pic || ""}
                  onChange={(e) => setFormData({ ...formData, pic: e.target.value })}
                  className="mt-1 h-9 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Deadline</Label>
                <Input
                  placeholder="Week 2 Januari / Q1"
                  value={formData.deadline || ""}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  className="mt-1 h-9 text-xs"
                />
              </div>
            </div>

            {/* Risiko / Kendala & Keterangan */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Risiko / Kendala</Label>
                <Input
                  placeholder="Hambatan atau dependensi pekerjaan"
                  value={formData.risiko_kendala || ""}
                  onChange={(e) => setFormData({ ...formData, risiko_kendala: e.target.value })}
                  className="mt-1 h-9 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Keterangan</Label>
                <Textarea
                  placeholder="Catatan tambahan / revisi"
                  value={formData.keterangan || ""}
                  onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                  className="mt-1 text-xs resize-none min-h-[80px]"
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter className="mt-4 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsFormOpen(false)}
                disabled={isSavingRecord}
              >
                Batal
              </Button>
              <Button type="submit" size="sm" disabled={isSavingRecord} className="gap-1.5">
                {isSavingRecord ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                <span>{editingRecord ? "Simpan Perubahan" : "Tambah Program"}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ==================== 7. ALERT DIALOG HAPUS PROGRAM ==================== */}
      <AlertDialog open={!!deletingRecord} onOpenChange={(open) => !open && setDeletingRecord(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-600">
              <Trash2 className="size-5" />
              <span>Hapus Program Kerja?</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus program kerja{" "}
              <strong>"{deletingRecord?.program_kerja}"</strong>? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRecord}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ==================== 8. DIALOG TAMBAH TAHUN BARU ==================== */}
      <Dialog open={isAddYearOpen} onOpenChange={setIsAddYearOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="size-5 text-primary" />
              <span>Buka Tahun Baru</span>
            </DialogTitle>
            <DialogDescription>
              Masukkan angka tahun kalender (misal: 2027) untuk mulai membuat atau mengimpor agenda proker baru.
            </DialogDescription>
          </DialogHeader>

          <div className="my-3">
            <Label className="text-xs font-semibold">Tahun Baru</Label>
            <Input
              type="number"
              placeholder="Contoh: 2027"
              value={newYearInput}
              onChange={(e) => setNewYearInput(e.target.value)}
              className="mt-1.5 font-bold text-base"
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsAddYearOpen(false)}>
              Batal
            </Button>
            <Button size="sm" onClick={handleAddNewYear}>
              Buka Tahun Ini
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
              <span>Skema Database Supabase</span>
            </DialogTitle>
            <DialogDescription>
              Salin dan jalankan skema SQL ini di Supabase SQL Editor agar data tersinkronisasi secara permanen ke cloud.
            </DialogDescription>
          </DialogHeader>

          <div className="my-2 bg-muted p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-72">
            <pre>{`-- Salin dan jalankan di SQL Editor Supabase:
create table if not exists public.program_kerja (
  id uuid primary key default gen_random_uuid(),
  year integer not null default extract(year from now())::integer,
  division text not null default 'Design & Multimedia',
  quartal text not null,
  quartal_fokus text default '',
  program_kerja text not null,
  tujuan text default '',
  realisasi text default '',
  realisasi_aktual text default '',
  status text not null default 'Planned',
  progress numeric not null default 0,
  pic text default '',
  deadline text default '',
  risiko_kendala text default '',
  keterangan text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists program_kerja_year_idx on public.program_kerja (year);
create index if not exists program_kerja_quartal_idx on public.program_kerja (quartal);
alter table public.program_kerja enable row level security;
create policy "program_kerja authenticated read" on public.program_kerja for select to authenticated using (true);
create policy "program_kerja authenticated insert" on public.program_kerja for insert to authenticated with check (true);
create policy "program_kerja authenticated update" on public.program_kerja for update to authenticated using (true);
create policy "program_kerja authenticated delete" on public.program_kerja for delete to authenticated using (true);
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
    </div>
  );
}
