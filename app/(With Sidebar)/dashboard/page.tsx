"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { startOfDay, startOfWeek, startOfMonth, endOfMonth } from "date-fns";

// Components
import { Content } from "@/components/content";
import { LiveClock } from "@/components/live-clock";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { exportRekapExcel } from "@/lib/rekap-bulanan";
import { ExportDashboardDialog } from "@/components/export-dashboard-dialog";

// Icons
import {
  FilePlus2,
  GitPullRequest,
  Loader2,
  MessageSquareQuote,
  Star,
  TrendingUp,
  CheckCircle2,
  CalendarDays,
  CalendarRange,
  Eye,
  Newspaper,
  FileCheck2,
  FileClock,
  FileSpreadsheet,
  Download,
  Printer,
} from "lucide-react";

// Interfaces
interface DashboardStats {
  baru: number;
  sedangDikerjakan: number;
  // Admin specific
  reviewUser?: number;
  selesaiHariIni?: number;
  selesaiMingguIni?: number;
  selesaiBulanIni?: number;
  // User specific
  revisi?: number;
  selesai?: number;

  rataRataRating: number | null;
}

interface PermintaanTerbaru {
  id: string;
  judul: string;
  admin: string;
  requester: string;
  project: string;
  created_at: Date;
  due_date: Date;
  status: string;
}

interface TrenHarian {
  request_date: string;
  total: number;
}

interface ArticleStats {
  total: number;
  published: number;
  draft: number;
  totalViews: number;
}

interface ArtikelPopuler {
  id: string;
  title: string;
  slug: string;
  views: number;
  status: string;
}

export default function DashboardPage() {
  const s = createClient();

  // State
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [permintaanTerbaru, setPermintaanTerbaru] = useState<
    PermintaanTerbaru[]
  >([]);
  const [trenHarian, setTrenHarian] = useState<TrenHarian[]>([]);
  const [articleStats, setArticleStats] = useState<ArticleStats | null>(null);
  const [artikelPopuler, setArtikelPopuler] = useState<ArtikelPopuler[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);
      try {
        // 1. Get User & Role
        const {
          data: { user },
        } = await s.auth.getUser();
        if (!user) return;

        // Ambil role dari tabel users atau user_profiles
        // Sesuaikan nama tabel jika berbeda (di layout.tsx Anda menggunakan 'users', di file lain 'user_profiles')
        // Kita coba ambil dari user_profiles dulu yang ada kolom role
        const { data: userProfile } = await s
          .from("user_profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        const userRole = userProfile?.role || "user";
        setRole(userRole);

        // 2. Fetch Stats berdasarkan Role
        let statsData: DashboardStats = {
          baru: 0,
          sedangDikerjakan: 0,
          rataRataRating: 0,
        };

        const now = new Date();

        // Base Query Helper
        const getCount = async (
          status: string,
          filter?: (query: any) => any,
        ) => {
          let query = s
            .from("permintaan")
            .select("*", { count: "exact", head: true })
            .eq("status", status);
          if (userRole !== "admin") {
            query = query.eq("requester", user.id);
          }
          if (filter) {
            query = filter(query);
          }
          const { count, error } = await query;
          if (error) throw error;
          return count || 0;
        };

        // Parallel Requests for Stats
        if (userRole === "admin") {
          const [
            baru,
            progress,
            review,
            doneToday,
            doneWeek,
            doneMonth,
            ratingRes,
          ] = await Promise.all([
            getCount("TO DO"),
            getCount("PROGRESS"),
            getCount("REVIEW"),
            getCount("DONE", (q) =>
              q.gte("created_at", startOfDay(now).toISOString()),
            ), // Asumsi selesai berdasarkan created_at atau updated_at? Biasanya ada kolom updated_at/finished_at. Jika tidak ada, kita pakai created_at untuk contoh ini atau perlu kolom khusus. (Disini saya pakai created_at sebagai proxy jika updated_at tidak ada, NAMUN idealnya 'updated_at' saat status berubah jadi DONE)
            // *Catatan*: Jika tabel permintaan tidak punya kolom 'updated_at', logic "Selesai Hari Ini" mungkin tidak akurat jika hanya melihat 'created_at'.
            // Mari kita asumsikan kita hitung yang statusnya DONE dan created_at dalam rentang waktu (untuk simplifikasi) atau Anda perlu menambahkan logic tracking waktu selesai.
            getCount("DONE", (q) =>
              q.gte("created_at", startOfWeek(now).toISOString()),
            ),
            getCount("DONE", (q) =>
              q
                .gte("created_at", startOfMonth(now).toISOString())
                .lte("created_at", endOfMonth(now).toISOString()),
            ),
            s.rpc("get_dashboard_stats"), // Pakai RPC lama hanya untuk rating
          ]);

          statsData = {
            baru: baru,
            sedangDikerjakan: progress,
            reviewUser: review,
            selesaiHariIni: doneToday,
            selesaiMingguIni: doneWeek,
            selesaiBulanIni: doneMonth,
            rataRataRating: ratingRes.data?.rataRataRating || 0,
          };
        } else {
          // Non-Admin (User)
          const [baru, progress, revisi, selesai, ratingRes] =
            await Promise.all([
              getCount("TO DO"),
              getCount("PROGRESS"),
              getCount("REVISION"),
              getCount("DONE"),
              s.rpc("get_dashboard_stats"), // RPC mungkin perlu disesuaikan jika ingin rating spesifik user, tapi untuk rata-rata global gapapa
            ]);

          statsData = {
            baru,
            sedangDikerjakan: progress,
            revisi,
            selesai,
            rataRataRating: 0, // User biasanya tidak butuh lihat rata-rata rating kerjanya sendiri secara global
          };
        }

        setStats(statsData);

        // 3. Fetch Tren & Terbaru (Sama untuk keduanya, tapi difilter user untuk non-admin)
        // RPC get_daily_request_trend mungkin global, kalau user mau lihat tren dia sendiri harus bikin RPC baru/query manual.
        // Kita pakai default RPC untuk Admin, dan skip/kosongkan untuk User jika privasi diperlukan.
        // Disini saya tampilkan global trend untuk admin, kosong untuk user (opsional).

        if (userRole === "admin") {
          const { data: trendData } = await s.rpc("get_daily_request_trend", {
            days_limit: 30,
          });
          setTrenHarian(trendData || []);

          // Statistik Artikel
          const [totalArt, publishedArt, draftArt, viewsRes, populerRes] =
            await Promise.all([
              s
                .from("articles")
                .select("*", { count: "exact", head: true }),
              s
                .from("articles")
                .select("*", { count: "exact", head: true })
                .eq("status", "published"),
              s
                .from("articles")
                .select("*", { count: "exact", head: true })
                .eq("status", "draft"),
              s.from("articles").select("views"),
              s
                .from("articles")
                .select("id, title, slug, views, status")
                .order("views", { ascending: false })
                .limit(5),
            ]);

          const totalViews = (viewsRes.data || []).reduce(
            (sum, row: { views: number }) => sum + (row.views || 0),
            0,
          );

          setArticleStats({
            total: totalArt.count || 0,
            published: publishedArt.count || 0,
            draft: draftArt.count || 0,
            totalViews,
          });
          setArtikelPopuler((populerRes.data as ArtikelPopuler[]) || []);
        }

        // Fetch Terbaru
        let queryTerbaru = s
          .from("permintaan")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(5);

        if (userRole !== "admin") {
          queryTerbaru = queryTerbaru.eq("requester", user.id);
        }

        const { data: terbaruData, error: terbaruError } = await queryTerbaru;
        if (terbaruError) throw terbaruError;

        // Map User Names
        if (terbaruData && terbaruData.length > 0) {
          const userIds = Array.from(
            new Set(
              [
                ...terbaruData.map((req) => req.requester),
                ...terbaruData.map((req) => req.admin),
              ].filter(Boolean),
            ),
          );

          const { data: usersData, error: usersError } = await s
            .from("user_profiles")
            .select("id, name")
            .in("id", userIds);
          if (usersError) throw usersError;

          const idToNameMap: Record<string, string> = {};
          usersData?.forEach((u) => {
            if (u.id && u.name) idToNameMap[u.id] = u.name;
          });

          const finalTerbaru = terbaruData.map((req) => ({
            ...req,
            requester: idToNameMap[req.requester] || "User Tidak Dikenal",
            admin: idToNameMap[req.admin] || "-",
          }));
          setPermintaanTerbaru(finalTerbaru);
        } else {
          setPermintaanTerbaru([]);
        }
      } catch (error: any) {
        toast.error("Gagal memuat data: " + error.message);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardData();
  }, [s]);

  const renderLoading = () => <Loader2 className="h-6 w-6 animate-spin" />;

  const getCurrentPeriod = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  };

  const handleExportExcel = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const fileName = await exportRekapExcel(getCurrentPeriod());
      toast.success(`Berhasil mengekspor ${fileName}`);
    } catch (error: any) {
      toast.error("Gagal mengekspor Excel: " + (error?.message || ""));
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = () => {
    window.location.href = "/rekap-bulanan?print=1";
  };

  return (
    <>
      {/* SECTION: Toolbar Atas (Tanggal/Jam, Rekap Bulanan, Export) */}
      <div className="col-span-12 flex flex-wrap items-center justify-end gap-2">
        <LiveClock />

        <Button variant="outline" size="sm" className="h-9 gap-1.5" asChild>
          <Link href="/rekap-bulanan">
            <FileSpreadsheet className="size-4 text-blue-600" />
            Rekap Bulanan
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5">
              {exporting ? (
                <Loader2 className="size-4 animate-spin text-emerald-600" />
              ) : (
                <Download className="size-4 text-emerald-600" />
              )}
              Export Data
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setExportModalOpen(true)}>
              <FileSpreadsheet className="size-4 text-emerald-600" />
              Export Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportPdf}>
              <Printer className="size-4 text-rose-600" />
              Export PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ExportDashboardDialog
          open={exportModalOpen}
          onOpenChange={setExportModalOpen}
        />
      </div>
      {/* SECTION: KPI Cards */}
      {/* SECTION: Aktivitas Terkini */}
      <Content
        size="lg"
        title="Aktivitas Terkini"
        description={
          role === "admin"
            ? "5 permintaan desain terakhir di sistem."
            : "5 permintaan terakhir Anda."
        }
        className="mt-6"
      >
        <div className="w-full overflow-x-auto rounded-md border">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Judul Permintaan</TableHead>
                <TableHead>Tanggal permintaan</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead>Peminta</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : permintaanTerbaru.length > 0 ? (
                permintaanTerbaru.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell
                      className="font-medium truncate max-w-xs"
                      title={req.project}
                    >
                      {req.project}
                    </TableCell>
                    <TableCell
                      className="font-medium truncate max-w-xs"
                      title={req.judul}
                    >
                      {req.judul}
                    </TableCell>
                    <TableCell className="font-medium min-w-[160px]">
                      {new Date(req.created_at.toString()).toLocaleDateString(
                        "id-ID",
                        {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        },
                      )}
                    </TableCell>
                    <TableCell className="font-medium min-w-[160px]">
                      {new Date(req.due_date.toString()).toLocaleDateString(
                        "id-ID",
                        {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        },
                      )}
                    </TableCell>
                    <TableCell>{req.requester}</TableCell>
                    <TableCell>{req.admin || "-"}</TableCell>{" "}
                    <TableCell>
                      <Badge
                        variant={
                          req.status === "DONE" ? "default" : "secondary"
                        }
                      >
                        {req.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/permintaan-desain/${req.id}`}>Lihat</a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    Belum ada aktivitas.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Content>

      {/* CARD 1: BARU (Semua Role) */}
      <Content
        size="xs"
        title={role === "admin" ? "Permintaan Baru" : "Permintaan Saya (Baru)"}
        className="bg-blue-300 dark:bg-blue-950 col-span-1"
        description="Status TO DO"
        cardAction={<FilePlus2 className="h-4 w-4 text-muted-foreground" />}
      >
        <p className="text-2xl font-bold">
          {loading ? renderLoading() : (stats?.baru ?? 0)}
        </p>
      </Content>

      {/* CARD 2: SEDANG DIKERJAKAN (Semua Role) */}
      <Content
        size="xs"
        title="Sedang Dikerjakan"
        className="bg-cyan-400 dark:bg-cyan-950 col-span-1"
        description="Status PROGRESS"
        cardAction={
          <GitPullRequest className="h-4 w-4 text-muted-foreground" />
        }
      >
        <p className="text-2xl font-bold">
          {loading ? renderLoading() : (stats?.sedangDikerjakan ?? 0)}
        </p>
      </Content>

      {/* LOGIC PERBEDAAN ROLE */}
      {role === "admin" ? (
        <>
          {/* Admin: Review User */}
          <Content
            size="xs"
            title="Review User"
            className="bg-yellow-400 dark:bg-yellow-700 col-span-1"
            description="Menunggu persetujuan user"
            cardAction={<Eye className="h-4 w-4 text-muted-foreground" />}
          >
            <p className="text-2xl font-bold">
              {loading ? renderLoading() : (stats?.reviewUser ?? 0)}
            </p>
          </Content>

          {/* Admin: Selesai Hari Ini */}
          <Content
            size="xs"
            title="Selesai Hari Ini"
            className="bg-green-300 dark:bg-green-800 col-span-1"
            description={new Date().toLocaleDateString("id-ID")}
            cardAction={
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            }
          >
            <p className="text-2xl font-bold">
              {loading ? renderLoading() : (stats?.selesaiHariIni ?? 0)}
            </p>
          </Content>

          {/* Admin: Selesai Minggu Ini */}
          <Content
            size="xs"
            title="Selesai Minggu Ini"
            className="bg-green-400 dark:bg-green-900 col-span-1"
            description="Senin s/d Hari ini"
            cardAction={
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            }
          >
            <p className="text-2xl font-bold">
              {loading ? renderLoading() : (stats?.selesaiMingguIni ?? 0)}
            </p>
          </Content>

          {/* Admin: Selesai Bulan Ini */}
          <Content
            size="xs"
            title="Selesai Bulan Ini"
            className="bg-emerald-500 dark:bg-emerald-950 col-span-1"
            description="Total bulan ini"
            cardAction={
              <CalendarRange className="h-4 w-4 text-muted-foreground" />
            }
          >
            <p className="text-2xl font-bold">
              {loading ? renderLoading() : (stats?.selesaiBulanIni ?? 0)}
            </p>
          </Content>
        </>
      ) : (
        <>
          {/* User: Revisi */}
          <Content
            size="xs"
            title="Perlu Revisi"
            className="bg-orange-300 dark:bg-orange-800 col-span-1"
            description="Permintaan dikembalikan (REVISION)"
            cardAction={
              <MessageSquareQuote className="h-4 w-4 text-muted-foreground" />
            }
          >
            <p className="text-2xl font-bold">
              {loading ? renderLoading() : (stats?.revisi ?? 0)}
            </p>
          </Content>

          {/* User: Selesai */}
          <Content
            size="xs"
            title="Selesai"
            className="bg-green-300 dark:bg-green-800 col-span-1"
            description="Total permintaan selesai (DONE)"
            cardAction={
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            }
          >
            <p className="text-2xl font-bold">
              {loading ? renderLoading() : (stats?.selesai ?? 0)}
            </p>
          </Content>
        </>
      )}

      {/* SECTION: Rata-rata Rating */}
      {role === "admin" && (
        <Content
          size="md"
          title="Rata-rata Rating Kepuasan"
          description="Dari semua permintaan yang selesai"
          cardAction={<Star className="h-5 w-5 text-yellow-400" />}
          className="mt-6"
        >
          <p className="text-4xl font-bold">
            {loading
              ? renderLoading()
              : `${stats?.rataRataRating?.toFixed(1) ?? "N/A"} / 10`}
          </p>
        </Content>
      )}

      {/* SECTION: STATISTIK ARTIKEL (Admin) */}
      {role === "admin" && (
        <>
          {/* Total Artikel */}
          <Content
            size="xs"
            title="Total Artikel"
            className="bg-indigo-300 dark:bg-indigo-950 col-span-1 mt-6"
            description="Semua status"
            cardAction={<Newspaper className="h-4 w-4 text-muted-foreground" />}
          >
            <p className="text-2xl font-bold">
              {loading ? renderLoading() : (articleStats?.total ?? 0)}
            </p>
          </Content>

          {/* Published */}
          <Content
            size="xs"
            title="Artikel Terbit"
            className="bg-green-300 dark:bg-green-800 col-span-1 mt-6"
            description="Status PUBLISHED"
            cardAction={<FileCheck2 className="h-4 w-4 text-muted-foreground" />}
          >
            <p className="text-2xl font-bold">
              {loading ? renderLoading() : (articleStats?.published ?? 0)}
            </p>
          </Content>

          {/* Draft */}
          <Content
            size="xs"
            title="Draft"
            className="bg-slate-300 dark:bg-slate-800 col-span-1 mt-6"
            description="Belum dipublikasikan"
            cardAction={<FileClock className="h-4 w-4 text-muted-foreground" />}
          >
            <p className="text-2xl font-bold">
              {loading ? renderLoading() : (articleStats?.draft ?? 0)}
            </p>
          </Content>

          {/* Total Views */}
          <Content
            size="xs"
            title="Total Dilihat"
            className="bg-purple-300 dark:bg-purple-950 col-span-1 mt-6"
            description="Akumulasi semua artikel"
            cardAction={<Eye className="h-4 w-4 text-muted-foreground" />}
          >
            <p className="text-2xl font-bold">
              {loading
                ? renderLoading()
                : (articleStats?.totalViews ?? 0).toLocaleString("id-ID")}
            </p>
          </Content>

          {/* Tabel Artikel Terpopuler */}
          <Content
            size="lg"
            title="Artikel Terpopuler"
            description="5 artikel dengan jumlah dilihat terbanyak."
            className="mt-6"
            cardAction={
              <Button variant="outline" size="sm" asChild>
                <a href="/artikel-admin">Kelola Artikel</a>
              </Button>
            }
          >
            <div className="w-full overflow-x-auto rounded-md border">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">No</TableHead>
                    <TableHead>Judul</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Dilihat</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        Memuat data...
                      </TableCell>
                    </TableRow>
                  ) : artikelPopuler.length > 0 ? (
                    artikelPopuler.map((art, index) => (
                      <TableRow key={art.id}>
                        <TableCell className="font-medium">
                          {index + 1}
                        </TableCell>
                        <TableCell
                          className="font-medium truncate max-w-xs"
                          title={art.title}
                        >
                          {art.title}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              art.status === "published"
                                ? "default"
                                : art.status === "draft"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {art.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {(art.views ?? 0).toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" asChild>
                            <a href={`/artikel-admin/${art.id}`}>Edit</a>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        Belum ada artikel.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Content>
        </>
      )}
    </>
  );
}
