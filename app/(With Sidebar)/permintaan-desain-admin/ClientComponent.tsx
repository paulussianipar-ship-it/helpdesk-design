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
import { Loader2, Newspaper, Search, Pencil } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, useTransition } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx"; // Impor library Excel
import { EditPermintaanDialog } from "@/components/edit-permintaan-dialog";

// Definisikan tipe data untuk konsistensi
interface Permintaan {
  id: string;
  judul: string;
  status: "TO DO" | "PROGRESS" | "REVISION" | "REVIEW" | "DONE" | string;
  due_date: string;
  created_at: string;
  project?: string;
  departemen?: string;
  admin?: string | null;
  admin_name?: string;
  deskripsi?: string;
  requester?: string;
  requester_name?: string;
}

// Tipe data untuk ekspor Excel yang lebih lengkap
interface PermintaanExport {
  id: string;
  created_at: string;
  due_date: string;
  judul: string;
  deskripsi: string;
  status: string;
  departemen: string;
  project: string;
  // Relasi untuk mengambil nama requester
  requester: {
    name: string;
  } | null;
}

const LIMIT_OPTIONS = [10, 25, 50, 100];

export function PermintaanAdminClientContent() {
  const s = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // State
  const [permintaanList, setPermintaanList] = useState<Permintaan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [isPending, startTransition] = useTransition();

  // State dari URL
  const currentPage = Number(searchParams.get("page") || "1");
  const searchTerm = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "";
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";
  const limit = Number(searchParams.get("limit") || 10);

  // State untuk input form
  const [searchInput, setSearchInput] = useState(searchTerm);
  const [startDateInput, setStartDateInput] = useState(startDate);
  const [endDateInput, setEndDateInput] = useState(endDate);

  // State Realtime
  const [isRealtimeConnected, setIsRealtimeConnected] = useState<boolean>(true);

  // State Dialog Edit
  const [editingItem, setEditingItem] = useState<Permintaan | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false);

  const handleOpenEdit = (item: Permintaan) => {
    setEditingItem(item);
    setIsEditDialogOpen(true);
  };

  const createQueryString = useCallback(
    (paramsToUpdate: Record<string, string | number | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(paramsToUpdate).forEach(([name, value]) => {
        if (value) {
          params.set(name, String(value));
        } else {
          params.delete(name);
        }
      });
      if (Object.keys(paramsToUpdate).some((k) => k !== "page")) {
        params.set("page", "1");
      }
      return params.toString();
    },
    [searchParams]
  );

  const fetchPermintaan = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      params.set("limit", String(limit));
      if (searchTerm) params.set("search", searchTerm);
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(`/api/permintaan?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setPermintaanList(json.data || []);
      setTotalItems(json.total || 0);
    } catch (error: any) {
      toast.error("Gagal mengambil data: " + error.message);
      setPermintaanList([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, statusFilter, startDate, endDate, limit]);

  useEffect(() => {
    fetchPermintaan();
  }, [fetchPermintaan]);

  // Realtime Subscription
  useEffect(() => {
    const channel = s
      .channel("realtime-permintaan-admin")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "permintaan",
        },
        (payload) => {
          fetchPermintaan();
          if (payload.eventType === "INSERT") {
            toast.info("Permintaan desain baru masuk!", { duration: 3000 });
          } else if (payload.eventType === "UPDATE") {
            toast.info("Status tiket permintaan diperbarui live", { duration: 2500 });
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
  }, [s, fetchPermintaan]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput !== searchTerm) {
        startTransition(() => {
          router.push(
            `${pathname}?${createQueryString({ search: searchInput })}`
          );
        });
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [searchInput, searchTerm, pathname, router, createQueryString]);

  const handleFilterChange = (
    updates: Record<string, string | number | undefined>
  ) => {
    startTransition(() => {
      router.push(`${pathname}?${createQueryString(updates)}`);
    });
  };

  const handleDownloadExcel = async () => {
    setIsExporting(true);
    toast.info("Mempersiapkan data lengkap untuk diunduh...");

    try {
      // REVISI: Query baru untuk mengambil semua data yang dibutuhkan untuk Excel
      let query = s.from("permintaan").select<string, PermintaanExport>(
        `
            created_at,
            due_date,
            judul,
            deskripsi,
            status,
            departemen,
            project,
            requester:user_profiles (name)
            `
      );

      // Terapkan semua filter yang sedang aktif
      if (searchTerm) query = query.ilike("judul", `%${searchTerm}%`);
      if (statusFilter) query = query.eq("status", statusFilter);
      if (startDate) query = query.gte("created_at", startDate);
      if (endDate) query = query.lte("created_at", `${endDate} 23:59:59`);

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) throw error;
      if (!data || data.length === 0) {
        toast.warning(
          "Tidak ada data untuk diekspor sesuai filter yang dipilih."
        );
        return;
      }

      // REVISI: Format data sesuai kolom yang diminta
      const formattedData = data.map((item) => ({
        "Tanggal Dibuat": new Date(item.created_at).toLocaleString("id-ID", {
          dateStyle: "long",
          timeStyle: "short",
        }),
        "Due Date": new Date(item.due_date).toLocaleDateString("id-ID", {
          dateStyle: "long",
        }),
        "Judul Permintaan": item.judul,
        Deskripsi: item.deskripsi,
        Status: item.status,
        Departemen: item.departemen,
        Project: item.project,
        Requester: item.requester?.name || "N/A",
      }));

      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Permintaan Desain");
      XLSX.writeFile(
        workbook,
        `Laporan_Permintaan_Desain_${
          new Date().toISOString().split("T")[0]
        }.xlsx`
      );

      toast.success("Data berhasil diunduh!");
    } catch (error: any) {
      toast.error("Gagal mengunduh data", { description: error.message });
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusVariant = (status: Permintaan["status"]) => {
    switch (status) {
      case "DONE":
        return "default";
      case "PROGRESS":
        return "secondary";
      case "REVISION":
        return "outline";
      case "REVIEW":
        return "destructive";
      default:
        return "secondary";
    }
  };

  return (
    <Content
      title="Daftar Semua Permintaan Desain"
      size="lg"
      cardAction={
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
      }
    >
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Cari berdasarkan judul..."
              className="pl-10"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Button
            onClick={handleDownloadExcel}
            disabled={isExporting}
            className="w-full md:w-auto"
          >
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Newspaper className="mr-2 h-4 w-4" />
            )}
            Download Excel
          </Button>
        </div>

        <div className="p-4 border rounded-lg bg-muted/50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                onValueChange={(value) =>
                  handleFilterChange({
                    status: value === "all" ? undefined : value,
                  })
                }
                defaultValue={statusFilter || "all"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="PROGRESS">Progress</SelectItem>
                  <SelectItem value="REVISION">Revision</SelectItem>
                  <SelectItem value="REVIEW">Review</SelectItem>
                  <SelectItem value="DONE">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Dari Tanggal</label>
              <Input
                type="date"
                value={startDateInput}
                onChange={(e) => setStartDateInput(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Sampai Tanggal</label>
              <Input
                type="date"
                value={endDateInput}
                onChange={(e) => setEndDateInput(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              className="mt-4 w-full md:w-auto"
              onClick={() =>
                handleFilterChange({
                  startDate: startDateInput,
                  endDate: endDateInput,
                })
              }
            >
              Terapkan Filter Tanggal
            </Button>
          </div>
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">No</TableHead>
              <TableHead>Judul</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading || isPending ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">
                  <div className="flex justify-center items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Memuat data...
                  </div>
                </TableCell>
              </TableRow>
            ) : permintaanList.length > 0 ? (
              permintaanList.map((permintaan, index) => (
                <TableRow key={permintaan.id}>
                  <TableCell className="font-medium">
                    {(currentPage - 1) * limit + index + 1}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {permintaan.judul}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(permintaan.status)}>
                      {permintaan.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(permintaan.due_date).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
                        onClick={() => handleOpenEdit(permintaan)}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 px-2.5" asChild>
                        <Link href={`/permintaan-desain-admin/${permintaan.id}`}>
                          Lihat Detail
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">
                  Tidak ada permintaan yang ditemukan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Tampilkan</span>
          <Select
            value={String(limit)}
            onValueChange={(value) => handleFilterChange({ limit: value })}
          >
            <SelectTrigger className="w-[70px]">
              <SelectValue placeholder={limit} />
            </SelectTrigger>
            <SelectContent>
              {LIMIT_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={String(opt)}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>dari {totalItems} hasil.</span>
        </div>
        <PaginationComponent
          basePath={pathname}
          currentPage={currentPage}
          totalItems={totalItems}
          itemsPerPage={limit}
        />
      </div>

      {/* DIALOG EDIT PERMINTAAN ADMIN */}
      <EditPermintaanDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        item={editingItem}
        onSuccess={fetchPermintaan}
      />
    </Content>
  );
}
