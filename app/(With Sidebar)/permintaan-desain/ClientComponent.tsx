"use client";

import { Content } from "@/components/content";
import { PaginationComponent } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { createClient } from "@/lib/supabase/client";
import {
  Loader2,
  Plus,
  Search,
  FileSpreadsheet,
  RotateCcw,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  Pencil,
  Trash2,
  Layers,
  Sparkles,
  Hourglass,
  AlertCircle,
  FolderKanban,
  Printer,
  Monitor,
  Image as ImageIcon,
  Video,
  TrendingUp,
  X,
  Upload,
} from "lucide-react";
import Link from "next/link";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useState,
  useCallback,
  useTransition,
  useMemo,
  useRef,
} from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface Permintaan {
  id: string;
  judul: string;
  project: string;
  status: string;
  due_date: string;
  created_at: string;
  requester?: string;
  requester_name?: string;
  admin?: string | null;
  admin_name?: string;
  departemen?: string;
  deskripsi?: string;
  category?: string;
  is_tercapai?: boolean;
  hasil_label?: string;
}

interface MonthStats {
  total: number;
  todo: number;
  progress: number;
  review: number;
  revision: number;
  done: number;
  hasil?: {
    tercapai: number;
    tercapaiPct: number;
    tidakTercapai: number;
    tidakTercapaiPct: number;
  };
  kategori?: {
    designCetak: number;
    designDigital: number;
    editingFoto: number;
    editingVideo: number;
    totalTiket: number;
  };
}

const LIMIT_OPTIONS = [10, 25, 50, 100];

const MONTH_NAMES: Record<string, string> = {
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
      options.push({
        value: `${y}-${mStr}`,
        label: `${MONTH_NAMES[mStr]} ${y}`,
      });
    }
  }
  return options;
};

const MONTH_OPTIONS = generateMonthOptions();

export default function PermintaanList() {
  const s = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // State User & Data
  const [permintaanList, setPermintaanList] = useState<Permintaan[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>("user");

  // State UI
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [deletingPermintaan, setDeletingPermintaan] = useState<Permintaan | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Month Statistics
  const [monthStats, setMonthStats] = useState<MonthStats>({
    total: 0,
    todo: 0,
    progress: 0,
    review: 0,
    revision: 0,
    done: 0,
  });

  // State Import File
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [importPreviewRows, setImportPreviewRows] = useState<any[]>([]);
  const [targetImportMonth, setTargetImportMonth] = useState<string>(getCurrentMonthPeriod());
  const [importMode, setImportMode] = useState<"append" | "replace_month">("append");

  // Filter Params - Defaults to current month period
  const currentMonth = getCurrentMonthPeriod();
  const selectedMonth = searchParams.get("month") || currentMonth;
  const currentPage = Number(searchParams.get("page") || "1");
  const searchTerm = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "";
  const designerFilter = searchParams.get("designer") || "";
  const scopeFilter = searchParams.get("scope") || "all";
  const categoryFilter = searchParams.get("category") || "";
  const hasilFilter = searchParams.get("hasil") || "";
  const limit = Number(searchParams.get("limit") || 10);

  const [searchInput, setSearchInput] = useState(searchTerm);

  // State Realtime
  const [isRealtimeConnected, setIsRealtimeConnected] = useState<boolean>(true);

  // 1. Cek User & Role
  useEffect(() => {
    async function initUser() {
      const {
        data: { user },
      } = await s.auth.getUser();
      if (user) {
        setCurrentUser(user);
        const { data: profile } = await s
          .from("user_profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        setUserRole(profile?.role || "user");
      }
    }
    initUser();
  }, [s]);

  // 2. Query Data via API (Semua Role Mendapatkan Data Real Tanpa Terblokir)
  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      params.set("limit", String(limit));
      if (selectedMonth) params.set("month", selectedMonth);
      if (searchTerm) params.set("search", searchTerm);
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (designerFilter && designerFilter !== "all") params.set("designer", designerFilter);
      if (scopeFilter === "mine" && currentUser?.id) params.set("requester", currentUser.id);
      if (categoryFilter && categoryFilter !== "all") params.set("category", categoryFilter);
      if (hasilFilter && hasilFilter !== "all") params.set("hasil", hasilFilter);

      const res = await fetch(`/api/permintaan?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
      const json = await res.json();
      setPermintaanList(json.data || []);
      setTotalItems(json.total || 0);
      if (json.stats) {
        setMonthStats(json.stats);
      }
    } catch (err: any) {
      console.error("Fetch permintaan error:", err);
      toast.error("Gagal memuat data permintaan: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    limit,
    selectedMonth,
    searchTerm,
    statusFilter,
    designerFilter,
    scopeFilter,
    categoryFilter,
    hasilFilter,
    currentUser,
  ]);

  // Initial & Dependency Fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 3. Realtime Subscription (Live sync)
  useEffect(() => {
    const channel = s
      .channel("realtime-permintaan-all-roles")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "permintaan",
        },
        (payload) => {
          fetchData();
          if (payload.eventType === "INSERT") {
            toast.info("Permintaan desain baru berhasil ditambahkan!", { duration: 3000 });
          } else if (payload.eventType === "UPDATE") {
            toast.info("Status tiket permintaan diperbarui secara real-time", { duration: 2500 });
          } else if (payload.eventType === "DELETE") {
            toast.info("Tiket permintaan telah dihapus", { duration: 2500 });
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsRealtimeConnected(true);
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          setIsRealtimeConnected(false);
        }
      });

    return () => {
      s.removeChannel(channel);
    };
  }, [s, fetchData]);

  // 4. Handle URL Update
  const createQueryString = useCallback(
    (params: Record<string, string | number | undefined>) => {
      const p = new URLSearchParams(searchParams.toString());
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
        else p.delete(k);
      });
      if (!params.page) p.set("page", "1"); // Reset page on filter change
      return p.toString();
    },
    [searchParams],
  );

  const handleFilter = (key: string, value: string | undefined) => {
    startTransition(() => {
      router.push(pathname + "?" + createQueryString({ [key]: value }));
    });
  };

  const toggleHasilFilter = (val: string) => {
    if (hasilFilter === val) {
      handleFilter("hasil", undefined);
    } else {
      handleFilter("hasil", val);
    }
  };

  const toggleCategoryFilter = (val: string) => {
    if (categoryFilter === val) {
      handleFilter("category", undefined);
    } else {
      handleFilter("category", val);
    }
  };

  const handleShiftMonth = (direction: -1 | 1) => {
    const current = selectedMonth === "all" ? getCurrentMonthPeriod() : selectedMonth;
    const [yearStr, monthStr] = current.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const date = new Date(year, month - 1 + direction, 1);
    const newY = date.getFullYear();
    const newM = String(date.getMonth() + 1).padStart(2, "0");
    const newPeriod = `${newY}-${newM}`;

    handleFilter("month", newPeriod);
  };

  const handleResetFilters = () => {
    setSearchInput("");
    startTransition(() => {
      router.push(pathname + `?month=${currentMonth}`);
    });
  };

  // Debounce Search
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== searchTerm) handleFilter("search", searchInput);
    }, 500);
    return () => clearTimeout(t);
  }, [searchInput]);

  // 5. Export Excel (Sesuai Bulan Aktif untuk SEMUA Role, termasuk Tabel Hasil & Kategori)
  const handleDownloadExcel = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("all", "true");
      if (selectedMonth && selectedMonth !== "all") params.set("month", selectedMonth);
      if (searchTerm) params.set("search", searchTerm);
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (designerFilter && designerFilter !== "all") params.set("designer", designerFilter);
      if (scopeFilter === "mine" && currentUser?.id) params.set("requester", currentUser.id);
      if (categoryFilter && categoryFilter !== "all") params.set("category", categoryFilter);
      if (hasilFilter && hasilFilter !== "all") params.set("hasil", hasilFilter);

      const res = await fetch(`/api/permintaan?${params.toString()}`);
      if (!res.ok) throw new Error("Gagal mengambil data untuk export");
      const json = await res.json();
      const rows = json.data || [];
      const stats = json.stats || monthStats;

      const excelData = rows.map((item: any, i: number) => ({
        No: i + 1,
        "Periode Bulan": selectedMonth === "all" ? "Semua Periode" : formatMonthPeriod(selectedMonth),
        "Tanggal Dibuat": item.created_at
          ? new Date(item.created_at).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "-",
        "Target Selesai (Due Date)": item.due_date
          ? new Date(item.due_date).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          : "-",
        "Judul Permintaan": item.judul,
        "Kategori Desain": item.category || "-",
        "Hasil": item.hasil_label || "-",
        "Jenis Proyek": item.project,
        "Departemen / Divisi": item.departemen,
        "Peminta / Pelapor": item.requester_name || "Pelapor",
        Desainer: item.admin_name || "-",
        Status: item.status,
        "Deskripsi / Kendala": item.deskripsi,
      }));

      const wb = XLSX.utils.book_new();

      // Sheet 1: Ringkasan Hasil & Kategori Desain (Sesuai Format Excel Pengguna)
      const summaryRows = [
        ["LAPORAN RINGKASAN & PERHITUNGAN PERMINTAAN DESAIN"],
        ["Periode:", selectedMonth === "all" ? "Semua Periode" : formatMonthPeriod(selectedMonth)],
        [
          "Tanggal Unduh:",
          new Date().toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
        ],
        [],
        ["HASIL PENGERJAAN", "", ""],
        ["Hasil", "Jumlah", "Persentase"],
        ["Tercapai", stats.hasil?.tercapai ?? 0, `${stats.hasil?.tercapaiPct ?? 0}%`],
        ["Tidak Tercapai", stats.hasil?.tidakTercapai ?? 0, `${stats.hasil?.tidakTercapaiPct ?? 0}%`],
        [],
        ["KATEGORI DESAIN", ""],
        ["Kategori Desain", "Jumlah Tiket"],
        ["Design Cetak", stats.kategori?.designCetak ?? 0],
        ["Design Digital", stats.kategori?.designDigital ?? 0],
        ["Editing Foto", stats.kategori?.editingFoto ?? 0],
        ["Editing Video", stats.kategori?.editingVideo ?? 0],
        ["Total tiket", stats.kategori?.totalTiket ?? rows.length],
      ];

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan & Kategori");

      // Sheet 2: Detail Tiket
      const wsData = XLSX.utils.json_to_sheet(excelData);
      const sheetName = selectedMonth === "all" ? "Semua Tiket" : `Daftar Tiket`;
      XLSX.utils.book_append_sheet(wb, wsData, sheetName);

      const fileNameMonth =
        selectedMonth === "all"
          ? "Semua_Periode"
          : formatMonthPeriod(selectedMonth).replace(/\s+/g, "_");
      XLSX.writeFile(wb, `Laporan_Permintaan_Desain_${fileNameMonth}.xlsx`);
      toast.success(`Excel berhasil diunduh (${rows.length} tiket)`);
    } catch (e: any) {
      toast.error("Gagal export: " + e.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Helper parser tanggal sel Excel
  const parseCellDate = (val: any, timeVal?: any): string => {
    if (!val) return new Date().toISOString();

    if (typeof val === "number") {
      const utcDays = Math.floor(val - 25569);
      const utcValue = utcDays * 86400;
      const dateInfo = new Date(utcValue * 1000);
      const y = dateInfo.getFullYear();
      const m = String(dateInfo.getMonth() + 1).padStart(2, "0");
      const d = String(dateInfo.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}T08:00:00.000Z`;
    }

    const s = String(val).trim();
    const dmYMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dmYMatch) {
      const d = dmYMatch[1].padStart(2, "0");
      const m = dmYMatch[2].padStart(2, "0");
      const y = dmYMatch[3];
      let time = "08:00:00";
      if (timeVal && String(timeVal).trim()) {
        const tStr = String(timeVal).trim();
        if (tStr.length === 5) time = `${tStr}:00`;
        else if (tStr.length === 8) time = tStr;
      }
      return `${y}-${m}-${d}T${time}.000Z`;
    }

    const ymdMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (ymdMatch) {
      const y = ymdMatch[1];
      const m = ymdMatch[2].padStart(2, "0");
      const d = ymdMatch[3].padStart(2, "0");
      return `${y}-${m}-${d}T08:00:00.000Z`;
    }

    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }

    return new Date().toISOString();
  };

  // 6. Handler Import File (Excel / CSV)
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsReadingFile(true);
    setImportFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });

      let targetSheet = workbook.Sheets[workbook.SheetNames[0]];
      for (const name of workbook.SheetNames) {
        const n = name.toLowerCase();
        if (n.includes("tiket") || n.includes("daftar") || n.includes("permintaan") || n.includes("worksheet")) {
          targetSheet = workbook.Sheets[name];
          break;
        }
      }

      const rows = XLSX.utils.sheet_to_json<any[]>(targetSheet, { header: 1, defval: "", raw: true });
      if (!rows || rows.length < 2) {
        throw new Error("File kosong atau tidak memiliki baris data yang cukup.");
      }

      const normalize = (v: any) =>
        String(v ?? "")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, " ")
          .replace(/\s+/g, " ")
          .trim();

      let headerIndex = -1;
      for (let r = 0; r < Math.min(rows.length, 15); r++) {
        const cells = rows[r].map(normalize);
        if (
          (cells.includes("kode tiket") && cells.includes("pelapor")) ||
          (cells.includes("judul permintaan") || cells.includes("judul")) ||
          (cells.includes("unit perangkat") && cells.includes("kendala masalah")) ||
          (cells.includes("task description") && cells.includes("name")) ||
          (cells.includes("nama") && cells.includes("status")) ||
          (cells.includes("project") && cells.includes("status"))
        ) {
          headerIndex = r;
          break;
        }
      }

      if (headerIndex === -1) headerIndex = 0;

      const normHeaders = rows[headerIndex].map(normalize);
      const findCol = (...keywords: string[]) => {
        return normHeaders.findIndex((h: string) =>
          keywords.some((kw) => h === kw || h.includes(kw))
        );
      };

      const colJudul = findCol("judul permintaan", "judul", "title", "unit perangkat", "unit", "task description", "task", "pekerjaan");
      const colProject = findCol("jenis proyek", "project", "proyek", "kategori desain");
      const colDept = findCol("departemen divisi", "departemen", "divisi", "department", "lokasi");
      const colPelapor = findCol("peminta pelapor", "peminta", "pelapor", "requester", "name", "nama");
      const colDesainer = findCol("desainer", "teknisi", "admin", "pic", "designer");
      const colStatus = findCol("status", "keadaan");
      const colDueDate = findCol("target selesai due date", "target selesai", "due date", "tgl selesai", "tanggal selesai");
      const colCreatedAt = findCol("tanggal dibuat", "tgl buat", "tanggal pengajuan", "created at", "activity date", "tanggal", "date");
      const colJamBuat = findCol("jam buat", "time");
      const colJamSelesai = findCol("jam selesai");
      const colDesc = findCol("deskripsi kendala", "deskripsi", "kendala masalah", "kendala", "description", "keterangan");
      const colSolusi = findCol("solusi catatan", "solusi", "catatan", "remarks");
      const colDurasi = findCol("durasi pengerjaan", "durasi");

      const parsed: any[] = [];
      const monthCounts = new Map<string, number>();

      for (let r = headerIndex + 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.every((c: any) => c === null || c === undefined || String(c).trim() === "")) continue;

        let judul = colJudul >= 0 ? String(row[colJudul] || "").trim() : "";
        const desc = colDesc >= 0 ? String(row[colDesc] || "").trim() : "";

        if (!judul && desc) {
          judul = desc.split("\n")[0].slice(0, 80);
        }
        if (!judul) continue;

        const pelapor = colPelapor >= 0 ? String(row[colPelapor] || "").trim() : "Pelapor";
        const desainer = colDesainer >= 0 ? String(row[colDesainer] || "").trim() : "Paulus Sianipar";
        const dept = colDept >= 0 ? String(row[colDept] || "").trim() : "Umum";
        const rawStatus = colStatus >= 0 ? String(row[colStatus] || "").trim() : "DONE";
        const project = colProject >= 0 && row[colProject] ? String(row[colProject]).trim() : "";
        const solusi = colSolusi >= 0 ? String(row[colSolusi] || "").trim() : "";
        const durasi = colDurasi >= 0 ? String(row[colDurasi] || "").trim() : "";

        const createdAt = parseCellDate(row[colCreatedAt], colJamBuat >= 0 ? row[colJamBuat] : null);
        const dueDate = colDueDate >= 0 ? parseCellDate(row[colDueDate], colJamSelesai >= 0 ? row[colJamSelesai] : null) : createdAt;

        const mPeriod = createdAt.slice(0, 7);
        monthCounts.set(mPeriod, (monthCounts.get(mPeriod) || 0) + 1);

        parsed.push({
          id: crypto.randomUUID(),
          judul,
          deskripsi: desc,
          solusi,
          durasi_pengerjaan: durasi,
          pelapor,
          requester_name: pelapor,
          departemen: dept,
          admin_name: desainer,
          status: rawStatus,
          project,
          created_at: createdAt,
          due_date: dueDate,
        });
      }

      if (parsed.length === 0) {
        throw new Error("Tidak ada baris tiket yang valid ditemukan di dalam file ini.");
      }

      let detectedMonth = selectedMonth !== "all" ? selectedMonth : currentMonth;
      let maxMonthCount = 0;
      monthCounts.forEach((count, month) => {
        if (count > maxMonthCount) {
          maxMonthCount = count;
          detectedMonth = month;
        }
      });

      setImportPreviewRows(parsed);
      setTargetImportMonth(detectedMonth);
      setImportMode("append");
      setIsImportModalOpen(true);
      toast.info(`File berhasil dibaca: ${parsed.length} tiket terdeteksi.`);
    } catch (err: any) {
      console.error("Gagal membaca file:", err);
      toast.error("Gagal membaca file: " + err.message);
    } finally {
      setIsReadingFile(false);
    }
  };

  const handleConfirmImport = async () => {
    if (importPreviewRows.length === 0) return;
    setIsProcessingImport(true);

    try {
      const res = await fetch("/api/permintaan/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: importPreviewRows,
          mode: importMode,
          targetMonth: targetImportMonth,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `HTTP error ${res.status}`);
      }

      const result = await res.json();
      toast.success(result.message || `Berhasil mengimpor ${result.count || importPreviewRows.length} tiket.`);
      setIsImportModalOpen(false);

      if (selectedMonth !== targetImportMonth && targetImportMonth) {
        handleFilter("month", targetImportMonth);
      } else {
        fetchData();
      }
    } catch (err: any) {
      console.error("Error import:", err);
      toast.error("Gagal memproses import: " + err.message);
    } finally {
      setIsProcessingImport(false);
    }
  };

  // 7. Hapus Permintaan (Khusus Admin via API)
  const handleDeletePermintaan = async () => {
    if (!deletingPermintaan) return;
    setIsDeleting(true);
    try {
      const {
        data: { session },
      } = await s.auth.getSession();
      const res = await fetch(`/api/permintaan?id=${deletingPermintaan.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || `HTTP error ${res.status}`);
      }
      toast.success("Permintaan desain berhasil dihapus.");
      setDeletingPermintaan(null);
      fetchData();
    } catch (err: any) {
      toast.error("Gagal menghapus permintaan: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || "").toUpperCase();
    if (s === "DONE") {
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 font-medium text-xs">
          Done
        </Badge>
      );
    }
    if (s === "PROGRESS") {
      return (
        <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/20 font-medium text-xs">
          Progress
        </Badge>
      );
    }
    if (s === "REVIEW") {
      return (
        <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30 hover:bg-purple-500/20 font-medium text-xs">
          Review
        </Badge>
      );
    }
    if (s === "REVISION") {
      return (
        <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/20 font-medium text-xs">
          Revision
        </Badge>
      );
    }
    return (
      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20 font-medium text-xs">
        To Do
      </Badge>
    );
  };

  const hasActiveFilters = Boolean(
    searchTerm ||
      (statusFilter && statusFilter !== "all") ||
      (designerFilter && designerFilter !== "all") ||
      (scopeFilter && scopeFilter !== "all") ||
      (categoryFilter && categoryFilter !== "all") ||
      (hasilFilter && hasilFilter !== "all") ||
      selectedMonth !== currentMonth
  );

  return (
    <Content
      title="Daftar Permintaan Desain"
      description={`Menampilkan tiket permintaan desain per bulan riil terintegrasi (${formatMonthPeriod(selectedMonth)}).`}
      size="lg"
      cardAction={
        <div className="flex flex-wrap items-center gap-2">
          {/* Live Real-Time Badge */}
          <Badge
            variant="outline"
            className={`text-xs flex items-center gap-1.5 font-normal py-1 px-2.5 transition-all shadow-sm ${
              isRealtimeConnected
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-amber-500/40 bg-amber-500/10 text-amber-600"
            }`}
          >
            <span className="relative flex h-2 w-2">
              {isRealtimeConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isRealtimeConnected ? "bg-emerald-500" : "bg-amber-500"
                }`}
              ></span>
            </span>
            {isRealtimeConnected ? "Live Real-time" : "Connecting..."}
          </Badge>

          {/* Import File Excel / CSV */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isReadingFile || isProcessingImport}
            variant="outline"
            className="flex items-center gap-1.5 border-primary/30 text-primary hover:bg-primary/10 transition-colors"
            title="Import tiket dari file Excel (.xlsx, .xls) atau CSV"
          >
            {isReadingFile ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            <span>Import File</span>
          </Button>

          {/* Export Excel (Untuk SEMUA Role Sesuai Bulan) */}
          <Button
            onClick={handleDownloadExcel}
            disabled={isExporting}
            variant="outline"
            className="flex items-center gap-1.5"
            title={`Export Excel Periode ${formatMonthPeriod(selectedMonth)}`}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            )}
            <span>Export Excel</span>
          </Button>

          {/* Buat Baru (Untuk SEMUA Role) */}
          <Button asChild>
            <Link href="/permintaan-desain/buat" className="flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> <span>Buat Baru</span>
            </Link>
          </Button>
        </div>
      }
    >
      {/* 1. PEMILIH BULAN (MONTH SELECTOR) */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card border rounded-xl p-3.5 shadow-xs mb-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Tombol Geser Bulan (Prev / Current / Next) */}
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
                {formatMonthPeriod(selectedMonth)}
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

          {/* Dropdown Pilihan Bulan Cepat */}
          <div className="w-full sm:w-[210px]">
            <Select
              value={selectedMonth}
              onValueChange={(val) => handleFilter("month", val)}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Pilih Bulan" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="all">Semua Bulan (Semua Periode)</SelectItem>
                {MONTH_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Input Month Picker Langsung */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground border rounded-lg px-2.5 h-9 bg-background">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            <input
              type="month"
              value={selectedMonth === "all" ? "" : selectedMonth}
              onChange={(e) => {
                if (e.target.value) {
                  handleFilter("month", e.target.value);
                }
              }}
              className="bg-transparent text-xs text-foreground outline-none cursor-pointer"
              title="Pilih Bulan & Tahun Bebas"
            />
          </div>

          {/* Tombol Shortcut Kembali ke Bulan Sekarang */}
          {selectedMonth !== currentMonth && (
            <Button
              size="sm"
              variant="outline"
              className="h-9 text-xs"
              onClick={() => handleFilter("month", currentMonth)}
            >
              Bulan Sekarang
            </Button>
          )}
        </div>

        {/* Info Ringkas Periode Aktif */}
        <div className="flex items-center gap-2 self-start md:self-auto text-xs text-muted-foreground">
          <span>Tabel Periode:</span>
          <Badge variant="outline" className="font-semibold text-primary border-primary/30">
            {formatMonthPeriod(selectedMonth)}
          </Badge>
          <span className="font-mono">({totalItems} tiket)</span>
        </div>
      </div>

      {/* 2. TABEL PERHITUNGAN: HASIL & KATEGORI DESAIN (SESUAI EXCEL) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-5">
        {/* TABEL HASIL */}
        <div className="lg:col-span-5 flex flex-col">
          <div className="border border-border/80 rounded-xl overflow-hidden bg-card shadow-xs flex-1 flex flex-col">
            {/* Header dengan aksen Peach #fce4d6 sesuai screenshot Excel */}
            <div className="border-b bg-[#fce4d6] dark:bg-amber-950/40 px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-stone-800 dark:text-amber-200" />
                <span className="font-bold text-sm text-stone-900 dark:text-amber-100 tracking-wide">
                  Hasil
                </span>
              </div>
              {hasilFilter && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[11px] px-2 text-stone-700 dark:text-amber-200 hover:text-stone-900"
                  onClick={() => handleFilter("hasil", undefined)}
                >
                  Reset Filter
                </Button>
              )}
            </div>

            <div className="p-3.5 flex-1 flex flex-col justify-between">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left font-medium pb-2 px-1.5">Status Pengerjaan</th>
                      <th className="text-right font-medium pb-2 px-1.5">Jumlah</th>
                      <th className="text-right font-medium pb-2 px-1.5">Persentase</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    <tr
                      onClick={() => toggleHasilFilter("Tercapai")}
                      className={`cursor-pointer transition-colors group hover:bg-muted/50 ${
                        hasilFilter === "Tercapai"
                          ? "bg-emerald-500/15 font-semibold ring-1 ring-emerald-500/40"
                          : ""
                      }`}
                      title="Klik untuk memfilter tiket Tercapai"
                    >
                      <td className="py-2.5 px-1.5 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                        <span className="text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 font-medium">
                          Tercapai
                        </span>
                        {hasilFilter === "Tercapai" && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1 border-emerald-500/40 text-emerald-600">
                            Aktif
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 px-1.5 text-right font-semibold font-mono text-foreground text-sm">
                        {monthStats.hasil?.tercapai ?? 0}
                      </td>
                      <td className="py-2.5 px-1.5 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                        {monthStats.hasil?.tercapaiPct ?? 0}%
                      </td>
                    </tr>

                    <tr
                      onClick={() => toggleHasilFilter("Tidak Tercapai")}
                      className={`cursor-pointer transition-colors group hover:bg-muted/50 ${
                        hasilFilter === "Tidak Tercapai"
                          ? "bg-amber-500/15 font-semibold ring-1 ring-amber-500/40"
                          : ""
                      }`}
                      title="Klik untuk memfilter tiket Tidak Tercapai"
                    >
                      <td className="py-2.5 px-1.5 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                        <span className="text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 font-medium">
                          Tidak Tercapai
                        </span>
                        {hasilFilter === "Tidak Tercapai" && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1 border-amber-500/40 text-amber-600">
                            Aktif
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 px-1.5 text-right font-semibold font-mono text-foreground text-sm">
                        {monthStats.hasil?.tidakTercapai ?? 0}
                      </td>
                      <td className="py-2.5 px-1.5 text-right font-bold text-amber-600 dark:text-amber-400 font-mono text-sm">
                        {monthStats.hasil?.tidakTercapaiPct ?? 0}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Progress Bar Visual */}
              <div className="mt-3.5 pt-2.5 border-t">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
                  <span>Pencapaian Target Selesai</span>
                  <span className="font-semibold text-foreground font-mono">
                    {monthStats.hasil?.tercapaiPct ?? 0}% Selesai Tepat Waktu
                  </span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-500"
                    style={{ width: `${monthStats.hasil?.tercapaiPct ?? 0}%` }}
                  />
                  <div
                    className="bg-amber-500 h-full transition-all duration-500"
                    style={{ width: `${monthStats.hasil?.tidakTercapaiPct ?? 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* TABEL KATEGORI DESAIN */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="border border-border/80 rounded-xl overflow-hidden bg-card shadow-xs flex-1 flex flex-col">
            <div className="border-b bg-muted/50 px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-primary" />
                <span className="font-bold text-sm text-foreground tracking-wide">
                  Kategori Desain
                </span>
              </div>
              {categoryFilter && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                  onClick={() => handleFilter("category", undefined)}
                >
                  Reset Filter Kategori
                </Button>
              )}
            </div>

            <div className="p-3.5 flex-1 flex flex-col justify-between">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left font-medium pb-2 px-1.5">Kategori Desain</th>
                      <th className="text-right font-medium pb-2 px-1.5">Jumlah Tiket</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    <tr
                      onClick={() => toggleCategoryFilter("Design Cetak")}
                      className={`cursor-pointer transition-colors group hover:bg-muted/50 ${
                        categoryFilter === "Design Cetak"
                          ? "bg-primary/15 font-semibold ring-1 ring-primary/40"
                          : ""
                      }`}
                      title="Klik untuk memfilter tiket Design Cetak"
                    >
                      <td className="py-2 px-1.5 flex items-center gap-2">
                        <Printer className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                        <span className="text-foreground group-hover:text-primary font-medium">
                          Design Cetak
                        </span>
                        {categoryFilter === "Design Cetak" && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1 border-primary/40 text-primary">
                            Aktif
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 px-1.5 text-right font-semibold font-mono text-foreground text-sm">
                        {monthStats.kategori?.designCetak ?? 0}
                      </td>
                    </tr>

                    <tr
                      onClick={() => toggleCategoryFilter("Design Digital")}
                      className={`cursor-pointer transition-colors group hover:bg-muted/50 ${
                        categoryFilter === "Design Digital"
                          ? "bg-primary/15 font-semibold ring-1 ring-primary/40"
                          : ""
                      }`}
                      title="Klik untuk memfilter tiket Design Digital"
                    >
                      <td className="py-2 px-1.5 flex items-center gap-2">
                        <Monitor className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-foreground group-hover:text-primary font-medium">
                          Design Digital
                        </span>
                        {categoryFilter === "Design Digital" && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1 border-primary/40 text-primary">
                            Aktif
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 px-1.5 text-right font-semibold font-mono text-foreground text-sm">
                        {monthStats.kategori?.designDigital ?? 0}
                      </td>
                    </tr>

                    <tr
                      onClick={() => toggleCategoryFilter("Editing Foto")}
                      className={`cursor-pointer transition-colors group hover:bg-muted/50 ${
                        categoryFilter === "Editing Foto"
                          ? "bg-primary/15 font-semibold ring-1 ring-primary/40"
                          : ""
                      }`}
                      title="Klik untuk memfilter tiket Editing Foto"
                    >
                      <td className="py-2 px-1.5 flex items-center gap-2">
                        <ImageIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-foreground group-hover:text-primary font-medium">
                          Editing Foto
                        </span>
                        {categoryFilter === "Editing Foto" && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1 border-primary/40 text-primary">
                            Aktif
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 px-1.5 text-right font-semibold font-mono text-foreground text-sm">
                        {monthStats.kategori?.editingFoto ?? 0}
                      </td>
                    </tr>

                    <tr
                      onClick={() => toggleCategoryFilter("Editing Video")}
                      className={`cursor-pointer transition-colors group hover:bg-muted/50 ${
                        categoryFilter === "Editing Video"
                          ? "bg-primary/15 font-semibold ring-1 ring-primary/40"
                          : ""
                      }`}
                      title="Klik untuk memfilter tiket Editing Video"
                    >
                      <td className="py-2 px-1.5 flex items-center gap-2">
                        <Video className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                        <span className="text-foreground group-hover:text-primary font-medium">
                          Editing Video
                        </span>
                        {categoryFilter === "Editing Video" && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1 border-primary/40 text-primary">
                            Aktif
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 px-1.5 text-right font-semibold font-mono text-foreground text-sm">
                        {monthStats.kategori?.editingVideo ?? 0}
                      </td>
                    </tr>

                    {/* Total Tiket (Highlight Kuning #ffff00 Sesuai Format Excel) */}
                    <tr
                      onClick={() => handleFilter("category", undefined)}
                      className="bg-[#ffff00] dark:bg-yellow-400 text-neutral-950 font-bold hover:opacity-90 cursor-pointer transition-opacity"
                      title="Total Tiket - Klik untuk menghapus filter kategori"
                    >
                      <td className="py-2.5 px-2 font-bold text-neutral-950 text-xs sm:text-sm">
                        Total tiket
                      </td>
                      <td className="py-2.5 px-2 text-right font-bold font-mono text-neutral-950 text-sm">
                        {monthStats.kategori?.totalTiket ?? monthStats.total ?? 0}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. RINGKASAN STATUS BULANAN (METRIC KPI CARDS) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-5">
        {/* Total Tiket */}
        <button
          type="button"
          onClick={() => handleFilter("status", undefined)}
          className={`p-3 rounded-xl border text-left transition-all ${
            !statusFilter || statusFilter === "all"
              ? "bg-primary/10 border-primary/40 ring-1 ring-primary/30"
              : "bg-card hover:bg-muted/40"
          }`}
        >
          <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
            <span>Total Tiket</span>
            <Layers className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="text-xl font-bold mt-1 text-foreground">
            {monthStats.total}
          </div>
        </button>

        {/* To Do */}
        <button
          type="button"
          onClick={() => handleFilter("status", "TO DO")}
          className={`p-3 rounded-xl border text-left transition-all ${
            statusFilter === "TO DO"
              ? "bg-amber-500/15 border-amber-500/40 ring-1 ring-amber-500/30"
              : "bg-card hover:bg-muted/40"
          }`}
        >
          <div className="text-[11px] font-medium text-amber-700 dark:text-amber-400 flex items-center justify-between">
            <span>To Do</span>
            <Hourglass className="h-3.5 w-3.5 text-amber-600" />
          </div>
          <div className="text-xl font-bold mt-1 text-amber-700 dark:text-amber-400">
            {monthStats.todo}
          </div>
        </button>

        {/* Progress */}
        <button
          type="button"
          onClick={() => handleFilter("status", "PROGRESS")}
          className={`p-3 rounded-xl border text-left transition-all ${
            statusFilter === "PROGRESS"
              ? "bg-blue-500/15 border-blue-500/40 ring-1 ring-blue-500/30"
              : "bg-card hover:bg-muted/40"
          }`}
        >
          <div className="text-[11px] font-medium text-blue-700 dark:text-blue-400 flex items-center justify-between">
            <span>Progress</span>
            <Clock className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <div className="text-xl font-bold mt-1 text-blue-700 dark:text-blue-400">
            {monthStats.progress}
          </div>
        </button>

        {/* Review */}
        <button
          type="button"
          onClick={() => handleFilter("status", "REVIEW")}
          className={`p-3 rounded-xl border text-left transition-all ${
            statusFilter === "REVIEW"
              ? "bg-purple-500/15 border-purple-500/40 ring-1 ring-purple-500/30"
              : "bg-card hover:bg-muted/40"
          }`}
        >
          <div className="text-[11px] font-medium text-purple-700 dark:text-purple-400 flex items-center justify-between">
            <span>Review</span>
            <Sparkles className="h-3.5 w-3.5 text-purple-600" />
          </div>
          <div className="text-xl font-bold mt-1 text-purple-700 dark:text-purple-400">
            {monthStats.review}
          </div>
        </button>

        {/* Revision */}
        <button
          type="button"
          onClick={() => handleFilter("status", "REVISION")}
          className={`p-3 rounded-xl border text-left transition-all ${
            statusFilter === "REVISION"
              ? "bg-rose-500/15 border-rose-500/40 ring-1 ring-rose-500/30"
              : "bg-card hover:bg-muted/40"
          }`}
        >
          <div className="text-[11px] font-medium text-rose-700 dark:text-rose-400 flex items-center justify-between">
            <span>Revisi</span>
            <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
          </div>
          <div className="text-xl font-bold mt-1 text-rose-700 dark:text-rose-400">
            {monthStats.revision}
          </div>
        </button>

        {/* Done */}
        <button
          type="button"
          onClick={() => handleFilter("status", "DONE")}
          className={`p-3 rounded-xl border text-left transition-all ${
            statusFilter === "DONE"
              ? "bg-emerald-500/15 border-emerald-500/40 ring-1 ring-emerald-500/30"
              : "bg-card hover:bg-muted/40"
          }`}
        >
          <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
            <span>Selesai (Done)</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-bold mt-1 text-emerald-700 dark:text-emerald-400">
            {monthStats.done}
          </div>
        </button>
      </div>

      {/* 3. FILTER AREA (SEARCH, SCOPE, DESIGNER, STATUS) */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari judul, divisi, kategori..."
              className="pl-9"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          {/* Filter Scope (Semua vs Milik Saya) */}
          <Select
            value={scopeFilter || "all"}
            onValueChange={(val) =>
              handleFilter("scope", val === "all" ? undefined : val)
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Tampilan Data" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Permintaan (Real Data)</SelectItem>
              <SelectItem value="mine">Permintaan Saya</SelectItem>
            </SelectContent>
          </Select>

          {/* Filter Designer */}
          <Select
            value={designerFilter || "all"}
            onValueChange={(val) =>
              handleFilter("designer", val === "all" ? undefined : val)
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Pilih Desainer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Desainer</SelectItem>
              <SelectItem value="bcfdf89c-d1e2-4602-80aa-005a1beb1d3c">
                Paulus Sianipar
              </SelectItem>
              <SelectItem value="54e6f310-813b-447b-aac0-9052423440da">
                Farel Ramadhan
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Filter Status */}
          <div className="flex gap-2">
            <Select
              value={statusFilter || "all"}
              onValueChange={(val) =>
                handleFilter("status", val === "all" ? undefined : val)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Status Pengerjaan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="TO DO">To Do</SelectItem>
                <SelectItem value="PROGRESS">Progress</SelectItem>
                <SelectItem value="REVIEW">Review</SelectItem>
                <SelectItem value="REVISION">Revision</SelectItem>
                <SelectItem value="DONE">Done</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button
                size="icon"
                variant="outline"
                className="shrink-0"
                title="Reset Semua Filter"
                onClick={handleResetFilters}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Active Filter Pills untuk Kategori atau Hasil */}
        {(categoryFilter || hasilFilter) && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50">
            <span className="text-xs text-muted-foreground font-medium">Filter Aktif:</span>
            {categoryFilter && (
              <Badge
                variant="secondary"
                className="text-xs flex items-center gap-1.5 py-1 px-2.5 bg-primary/10 text-primary border border-primary/30"
              >
                <span>Kategori: {categoryFilter}</span>
                <button
                  type="button"
                  onClick={() => handleFilter("category", undefined)}
                  className="hover:opacity-75 cursor-pointer"
                  title="Hapus filter kategori"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {hasilFilter && (
              <Badge
                variant="secondary"
                className="text-xs flex items-center gap-1.5 py-1 px-2.5 bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30"
              >
                <span>Hasil: {hasilFilter}</span>
                <button
                  type="button"
                  onClick={() => handleFilter("hasil", undefined)}
                  className="hover:opacity-75 cursor-pointer"
                  title="Hapus filter hasil"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground"
              onClick={() => {
                handleFilter("category", undefined);
                handleFilter("hasil", undefined);
              }}
            >
              Reset Filter Tambahan
            </Button>
          </div>
        )}
      </div>

      {/* 4. TABLE AREA (TABEL PER BULAN) */}
      <div className="border rounded-xl overflow-hidden bg-card shadow-2xs">
        {/* Table Month Header Bar */}
        <div className="bg-muted/40 px-4 py-2.5 border-b flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm text-foreground">
              Daftar Tiket Permintaan: {formatMonthPeriod(selectedMonth)}
            </span>
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            Total {totalItems} tiket ditemukan
          </span>
        </div>

        <Table className="min-w-[840px]">
          <TableHeader>
            <TableRow className="bg-muted/20">
              <TableHead className="w-[50px] font-semibold">No</TableHead>
              <TableHead className="font-semibold w-[140px]">Tanggal Pengajuan</TableHead>
              <TableHead className="font-semibold">Judul Permintaan</TableHead>
              <TableHead className="font-semibold">Peminta / Divisi</TableHead>
              <TableHead className="font-semibold">Desainer</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Target Selesai</TableHead>
              <TableHead className="text-right font-semibold">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading || isPending ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center h-32">
                  <div className="flex justify-center items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span>Memuat data tiket {formatMonthPeriod(selectedMonth)}...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : permintaanList.length > 0 ? (
              permintaanList.map((item, idx) => (
                <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                  {/* No */}
                  <TableCell className="text-muted-foreground text-xs font-mono">
                    {(currentPage - 1) * limit + idx + 1}
                  </TableCell>

                  {/* Tanggal Pengajuan (Created At) */}
                  <TableCell className="whitespace-nowrap">
                    {item.created_at ? (
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-foreground">
                          {new Date(item.created_at).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(item.created_at).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>

                  {/* Judul, Project, Kategori & Hasil */}
                  <TableCell className="max-w-[300px]">
                    <div className="font-semibold text-sm text-foreground line-clamp-1" title={item.judul}>
                      {item.judul}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                        {item.project || "Design"}
                      </Badge>
                      {item.category && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 font-normal bg-muted text-muted-foreground"
                        >
                          {item.category}
                        </Badge>
                      )}
                      {item.hasil_label && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 font-normal ${
                            item.is_tercapai
                              ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/10 dark:text-emerald-400"
                              : "border-amber-500/30 text-amber-600 bg-amber-500/10 dark:text-amber-400"
                          }`}
                        >
                          {item.hasil_label}
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  {/* Kolom Peminta (Tampil untuk SEMUA Role) */}
                  <TableCell>
                    <div className="font-medium text-sm text-foreground">
                      {item.requester_name || "Pelapor"}
                    </div>
                    {item.departemen && (
                      <div className="text-xs text-muted-foreground">
                        {item.departemen}
                      </div>
                    )}
                  </TableCell>

                  {/* Kolom Desainer (Tampil untuk SEMUA Role) */}
                  <TableCell>
                    <span className="text-sm font-medium text-foreground">
                      {item.admin_name || "-"}
                    </span>
                  </TableCell>

                  {/* Kolom Status */}
                  <TableCell>
                    {getStatusBadge(item.status)}
                  </TableCell>

                  {/* Due Date */}
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {item.due_date ? (
                      <div className="flex items-center gap-1 text-xs">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>
                          {new Date(item.due_date).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>

                  {/* Aksi */}
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button variant="outline" size="sm" className="h-8 text-xs px-2.5" asChild>
                        <Link href={`/permintaan-desain/${item.id}`}>Detail</Link>
                      </Button>
                      {userRole === "admin" && (
                        <>
                          <Button variant="outline" size="sm" className="h-8 text-xs px-2" asChild>
                            <Link href={`/permintaan-desain/${item.id}/edit`} title="Edit Permintaan">
                              <Pencil className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeletingPermintaan(item)}
                            title="Hapus Permintaan"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <CalendarDays className="h-8 w-8 text-muted-foreground/50" />
                    <p className="font-medium text-foreground">
                      Tidak ada permintaan desain pada {formatMonthPeriod(selectedMonth)}
                    </p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      Tidak ada tiket yang cocok dengan filter yang dipilih untuk bulan ini. Anda dapat berpindah ke bulan lain atau mereset filter.
                    </p>
                    {selectedMonth !== currentMonth && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 text-xs"
                        onClick={() => handleFilter("month", currentMonth)}
                      >
                        Kembali ke Bulan Sekarang ({formatMonthPeriod(currentMonth)})
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* CONFIRM DIALOG DELETE */}
      <AlertDialog
        open={!!deletingPermintaan}
        onOpenChange={(open) => {
          if (!open) setDeletingPermintaan(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Permintaan Desain?</AlertDialogTitle>
            <AlertDialogDescription>
              Anda yakin ingin menghapus &quot;{deletingPermintaan?.judul}&quot;?
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePermintaan}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MODAL DIALOG: PREVIEW & KONFIRMASI IMPORT FILE */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Upload className="h-5 w-5 text-primary" />
              <span>Konfirmasi Import Permintaan Desain</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              File: <span className="font-semibold text-foreground">{importFileName}</span> &bull; Terdeteksi{" "}
              <span className="font-semibold text-foreground">{importPreviewRows.length} tiket</span>
            </DialogDescription>
          </DialogHeader>

          {/* Banner Integrasi ke Daily Activity & KPI */}
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
            <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Sinkronisasi Otomatis Terintegrasi</p>
              <p className="text-[11px] text-emerald-700/90 dark:text-emerald-300/90 mt-0.5">
                Data tiket yang diimpor akan otomatis masuk ke daftar tiket <strong>Permintaan Desain</strong>, tercatat ke <strong>Daily Activity</strong>, serta langsung dihitung dalam metrik <strong>KPI Balanced Scorecard</strong>.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Target Periode Bulan */}
            <div className="space-y-1.5">
              <label className="font-medium text-foreground">Target Periode Bulan</label>
              <Select value={targetImportMonth} onValueChange={setTargetImportMonth}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Pilih Bulan" />
                </SelectTrigger>
                <SelectContent className="max-h-[220px]">
                  {MONTH_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Mode Import */}
            <div className="space-y-1.5">
              <label className="font-medium text-foreground">Metode Penyimpanan</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setImportMode("append")}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    importMode === "append"
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <div className="font-semibold text-xs">Tambah Data</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Gabungkan dengan data yang ada</div>
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode("replace_month")}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    importMode === "replace_month"
                      ? "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-400 font-medium"
                      : "border-border text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <div className="font-semibold text-xs">Timpa Bulan Ini</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Hapus data lama di bulan {targetImportMonth}</div>
                </button>
              </div>
            </div>
          </div>

          {/* Tabel Preview (First 6 Rows) */}
          <div className="flex-1 overflow-auto border rounded-lg max-h-[220px]">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-muted/60 sticky top-0 border-b">
                <tr className="text-left text-[11px] text-muted-foreground">
                  <th className="py-1.5 px-2">No</th>
                  <th className="py-1.5 px-2">Tanggal</th>
                  <th className="py-1.5 px-2">Judul Permintaan</th>
                  <th className="py-1.5 px-2">Peminta</th>
                  <th className="py-1.5 px-2">Desainer</th>
                  <th className="py-1.5 px-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {importPreviewRows.slice(0, 6).map((item, idx) => (
                  <tr key={idx} className="hover:bg-muted/30">
                    <td className="py-1.5 px-2 text-muted-foreground font-mono">{idx + 1}</td>
                    <td className="py-1.5 px-2 font-mono whitespace-nowrap">
                      {item.created_at?.slice(0, 10)}
                    </td>
                    <td className="py-1.5 px-2 max-w-[200px] truncate font-medium text-foreground" title={item.judul}>
                      {item.judul}
                    </td>
                    <td className="py-1.5 px-2 text-muted-foreground truncate max-w-[120px]">{item.pelapor}</td>
                    <td className="py-1.5 px-2 text-muted-foreground">{item.admin_name}</td>
                    <td className="py-1.5 px-2">
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        {item.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {importPreviewRows.length > 6 && (
            <p className="text-[11px] text-muted-foreground text-center">
              ... dan {importPreviewRows.length - 6} baris tiket lainnya akan diproses.
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
              size="sm"
              onClick={handleConfirmImport}
              disabled={isProcessingImport}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              {isProcessingImport ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Mengimpor & Menyinkronkan...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Konfirmasi & Import ({importPreviewRows.length} Tiket)</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* FOOTER & PAGINATION */}
      <div className="mt-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Tampilkan</span>
          <Select
            value={String(limit)}
            onValueChange={(val) => handleFilter("limit", val)}
          >
            <SelectTrigger className="w-[70px] h-8">
              <SelectValue placeholder={String(limit)} />
            </SelectTrigger>
            <SelectContent>
              {LIMIT_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={String(opt)}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>tiket per halaman (Total {totalItems} tiket di {formatMonthPeriod(selectedMonth)})</span>
        </div>

        {totalItems > limit && (
          <PaginationComponent
            basePath={pathname}
            totalItems={totalItems}
            currentPage={currentPage}
            itemsPerPage={limit}
          />
        )}
      </div>
    </Content>
  );
}
