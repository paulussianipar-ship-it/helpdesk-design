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
  User,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useState,
  useCallback,
  useTransition,
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
}

const LIMIT_OPTIONS = [10, 25, 50, 100];

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

  // Filter Params
  const currentPage = Number(searchParams.get("page") || "1");
  const searchTerm = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "";
  const designerFilter = searchParams.get("designer") || "";
  const scopeFilter = searchParams.get("scope") || "all";
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";
  const limit = Number(searchParams.get("limit") || 10);

  const [searchInput, setSearchInput] = useState(searchTerm);
  const [startDateInput, setStartDateInput] = useState(startDate);
  const [endDateInput, setEndDateInput] = useState(endDate);

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
          .single();
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
      if (searchTerm) params.set("search", searchTerm);
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (designerFilter && designerFilter !== "all") params.set("designer", designerFilter);
      if (scopeFilter === "mine" && currentUser?.id) params.set("requester", currentUser.id);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(`/api/permintaan?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
      const json = await res.json();
      setPermintaanList(json.data || []);
      setTotalItems(json.total || 0);
    } catch (err: any) {
      console.error("Fetch permintaan error:", err);
      toast.error("Gagal memuat data permintaan: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    limit,
    searchTerm,
    statusFilter,
    designerFilter,
    scopeFilter,
    startDate,
    endDate,
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

  const handleResetFilters = () => {
    setSearchInput("");
    setStartDateInput("");
    setEndDateInput("");
    startTransition(() => {
      router.push(pathname);
    });
  };

  // Debounce Search
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== searchTerm) handleFilter("search", searchInput);
    }, 500);
    return () => clearTimeout(t);
  }, [searchInput]);

  // 5. Export Excel (Dapat digunakan oleh SEMUA role)
  const handleDownloadExcel = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("all", "true");
      if (searchTerm) params.set("search", searchTerm);
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (designerFilter && designerFilter !== "all") params.set("designer", designerFilter);
      if (scopeFilter === "mine" && currentUser?.id) params.set("requester", currentUser.id);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(`/api/permintaan?${params.toString()}`);
      if (!res.ok) throw new Error("Gagal mengambil data untuk export");
      const json = await res.json();
      const rows = json.data || [];

      const excelData = rows.map((item: any, i: number) => ({
        No: i + 1,
        "Tanggal Dibuat": item.created_at
          ? new Date(item.created_at).toLocaleDateString("id-ID")
          : "-",
        "Target Selesai (Due Date)": item.due_date
          ? new Date(item.due_date).toLocaleDateString("id-ID")
          : "-",
        "Judul Permintaan": item.judul,
        "Jenis Proyek": item.project,
        "Departemen / Divisi": item.departemen,
        "Peminta / Pelapor": item.requester_name || "Unknown",
        Desainer: item.admin_name || "-",
        Status: item.status,
        "Deskripsi / Kendala": item.deskripsi,
      }));

      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data Permintaan Desain");
      XLSX.writeFile(
        wb,
        `Laporan_Permintaan_Desain_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
      toast.success(`Excel berhasil diunduh (${rows.length} tiket)`);
    } catch (e: any) {
      toast.error("Gagal export: " + e.message);
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusVariant = (s: string) => {
    if (s === "DONE") return "default";
    if (s === "PROGRESS") return "secondary";
    if (s === "REVISION") return "outline";
    if (s === "REVIEW") return "destructive";
    return "secondary";
  };

  const hasActiveFilters = Boolean(
    searchTerm || statusFilter || designerFilter || (scopeFilter && scopeFilter !== "all") || startDate || endDate
  );

  return (
    <Content
      title="Daftar Permintaan Desain"
      description={`Menampilkan ${totalItems} tiket permintaan desain riil terintegrasi.`}
      size="lg"
      cardAction={
        <div className="flex items-center gap-2">
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

          {/* Export Excel (Untuk SEMUA Role) */}
          <Button
            onClick={handleDownloadExcel}
            disabled={isExporting}
            variant="outline"
            className="flex items-center gap-1.5"
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
      {/* FILTER AREA */}
      <div className="flex flex-col gap-3 mb-6">
        {/* Baris 1: Search, Scope, Designer, & Status */}
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
        </div>

        {/* Baris 2: Date Range Filter (Tersedia untuk SEMUA Role) */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-muted/40 p-3 rounded-lg border">
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                Dari:
              </span>
              <Input
                type="date"
                className="h-9 w-auto text-xs"
                value={startDateInput}
                onChange={(e) => setStartDateInput(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                Sampai:
              </span>
              <Input
                type="date"
                className="h-9 w-auto text-xs"
                value={endDateInput}
                onChange={(e) => setEndDateInput(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="h-9"
              onClick={() => {
                handleFilter("startDate", startDateInput);
                handleFilter("endDate", endDateInput);
              }}
            >
              Filter Tanggal
            </Button>
          </div>

          {hasActiveFilters && (
            <Button
              size="sm"
              variant="ghost"
              className="h-9 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5"
              onClick={handleResetFilters}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset Filter
            </Button>
          )}
        </div>
      </div>

      {/* TABLE AREA */}
      <div className="border rounded-lg overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[50px] font-semibold">No</TableHead>
              <TableHead className="font-semibold">Judul Permintaan</TableHead>
              <TableHead className="font-semibold">Project</TableHead>
              <TableHead className="font-semibold">Peminta / Divisi</TableHead>
              <TableHead className="font-semibold">Desainer</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Due Date</TableHead>
              <TableHead className="text-right font-semibold">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading || isPending ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center h-28">
                  <div className="flex justify-center items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span>Memuat data real tiket...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : permintaanList.length > 0 ? (
              permintaanList.map((item, idx) => (
                <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="text-muted-foreground">
                    {(currentPage - 1) * limit + idx + 1}
                  </TableCell>
                  <TableCell className="font-semibold max-w-[280px]">
                    <div className="line-clamp-2" title={item.judul}>
                      {item.judul}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs font-normal">
                      {item.project || "Design"}
                    </Badge>
                  </TableCell>

                  {/* Kolom Peminta (Tampil untuk SEMUA Role) */}
                  <TableCell>
                    <div className="font-medium text-sm">
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
                    <Badge variant={getStatusVariant(item.status) as any}>
                      {item.status}
                    </Badge>
                  </TableCell>

                  {/* Due Date */}
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {item.due_date
                      ? new Date(item.due_date).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "-"}
                  </TableCell>

                  {/* Aksi */}
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/permintaan-desain/${item.id}`}>Detail</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center h-28 text-muted-foreground">
                  Tidak ada data permintaan ditemukan sesuai filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* FOOTER & PAGINATION */}
      <div className="mt-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
          <span>tiket per halaman (Total {totalItems} tiket)</span>
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
