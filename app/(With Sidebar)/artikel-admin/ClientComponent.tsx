"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Article,
  ArticleStatus,
  articleImageUrl,
  ARTICLES_BUCKET,
} from "@/lib/articles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Plus,
  Search,
  Calendar,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  MoreVertical,
  Copy,
  CheckCircle2,
  Clock,
  Archive,
  Loader2,
  X,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";

type ArticleItem = Pick<
  Article,
  | "id"
  | "title"
  | "slug"
  | "excerpt"
  | "cover_image"
  | "status"
  | "tags"
  | "featured"
  | "created_at"
  | "published_at"
  | "views"
>;

interface CategoryCount {
  name: string;
  count: number;
}

const PAGE_SIZE = 6;

function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getCategoryBadgeStyle(tag: string): string {
  const lower = tag.toLowerCase();
  if (lower.includes("troubleshoot")) {
    return "bg-amber-600 text-white dark:bg-amber-700";
  }
  if (lower.includes("tips") || lower.includes("edukasi")) {
    return "bg-slate-900 text-white dark:bg-slate-950";
  }
  if (lower.includes("panduan")) {
    return "bg-blue-600 text-white dark:bg-blue-700";
  }
  if (lower.includes("tutorial")) {
    return "bg-emerald-600 text-white dark:bg-emerald-700";
  }
  return "bg-slate-800 text-white dark:bg-slate-700";
}

export function ArtikelAdminClientContent() {
  const s = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Role
  const [userRole, setUserRole] = useState<string>("user");
  const [roleChecked, setRoleChecked] = useState(false);

  // Data
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [isPending, startTransition] = useTransition();

  // Categories with counts
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [totalAllCount, setTotalAllCount] = useState(0);

  // Admin actions
  const [deleteTarget, setDeleteTarget] = useState<ArticleItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Query Params
  const currentPage = Math.max(1, Number(searchParams.get("page") || "1"));
  const searchTerm = searchParams.get("q") || searchParams.get("search") || "";
  const selectedCategory = searchParams.get("kategori") || searchParams.get("tag") || "all";

  const [searchInput, setSearchInput] = useState(searchTerm);

  // 1. Cek User Role
  useEffect(() => {
    async function checkRole() {
      try {
        const { data } = await s.auth.getUser();
        if (data?.user) {
          const { data: profile } = await s
            .from("users")
            .select("role")
            .eq("id", data.user.id)
            .single();
          if (profile?.role) {
            setUserRole(profile.role);
          }
        }
      } catch (err) {
        console.error("Gagal cek role:", err);
      } finally {
        setRoleChecked(true);
      }
    }
    checkRole();
  }, [s]);

  const isAdmin = userRole === "admin";

  // Helper query string
  const createQueryString = useCallback(
    (paramsToUpdate: Record<string, string | number | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      // bersihkan param alias lama
      params.delete("search");
      params.delete("tag");

      Object.entries(paramsToUpdate).forEach(([name, value]) => {
        if (value && value !== "all") params.set(name, String(value));
        else params.delete(name);
      });
      if (Object.keys(paramsToUpdate).some((k) => k !== "page")) {
        params.set("page", "1");
      }
      return params.toString();
    },
    [searchParams]
  );

  // 2. Fetch Kategori & Hitungan
  const fetchCategoryCounts = useCallback(async () => {
    try {
      let query = s.from("articles").select("tags, status");
      if (!isAdmin) {
        query = query.eq("status", "published");
      }
      const { data, error } = await query;
      if (!error && data) {
        setTotalAllCount(data.length);
        const map: Record<string, number> = {};

        data.forEach((item) => {
          if (Array.isArray(item.tags) && item.tags.length > 0) {
            item.tags.forEach((tag: string) => {
              const trimmed = tag.trim();
              if (trimmed) {
                map[trimmed] = (map[trimmed] || 0) + 1;
              }
            });
          }
        });

        // Pastikan kategori default yang sering ada tetap masuk bila ada artikelnya atau terdaftar
        const defaultList = [
          "Panduan Pengguna",
          "Panduan Cepat",
          "Troubleshooting Umum",
          "Tips & Edukasi",
        ];

        const list: CategoryCount[] = Object.entries(map).map(([name, count]) => ({
          name,
          count,
        }));

        // Urutkan berdasarkan hitungan terbanyak
        list.sort((a, b) => b.count - a.count);

        setCategories(list);
      }
    } catch (err) {
      console.error("Gagal fetch kategori:", err);
    }
  }, [s, isAdmin]);

  // 3. Fetch Daftar Artikel Sesuai Filter
  const fetchArticles = useCallback(async () => {
    setLoading(true);
    const from = (currentPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = s.from("articles").select(
      `id, title, slug, excerpt, cover_image, status, tags, featured, created_at, published_at, views`,
      { count: "exact" }
    );

    if (!isAdmin) {
      query = query.eq("status", "published");
    }

    if (searchTerm.trim()) {
      query = query.ilike("title", `%${searchTerm.trim()}%`);
    }

    if (selectedCategory && selectedCategory !== "all") {
      query = query.contains("tags", [selectedCategory]);
    }

    query = query
      .order("created_at", { ascending: false })
      .range(from, to);

    const { data, error, count } = await query;
    if (error) {
      toast.error("Gagal memuat artikel: " + error.message);
      setArticles([]);
    } else {
      setArticles((data as ArticleItem[]) || []);
      setTotalItems(count || 0);
    }
    setLoading(false);
  }, [s, isAdmin, currentPage, searchTerm, selectedCategory]);

  useEffect(() => {
    if (roleChecked) {
      fetchArticles();
      fetchCategoryCounts();
    }
  }, [roleChecked, fetchArticles, fetchCategoryCounts]);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput !== searchTerm) {
        startTransition(() => {
          router.push(
            `${pathname}?${createQueryString({ q: searchInput || undefined })}`
          );
        });
      }
    }, 400);
    return () => clearTimeout(handler);
  }, [searchInput, searchTerm, pathname, router, createQueryString]);

  const handleCategorySelect = (catName: string) => {
    startTransition(() => {
      router.push(
        `${pathname}?${createQueryString({
          kategori: catName === "all" ? undefined : catName,
        })}`
      );
    });
  };

  const handlePageChange = (newPage: number) => {
    startTransition(() => {
      router.push(`${pathname}?${createQueryString({ page: newPage })}`);
    });
  };

  // Quick Action: Salin Tautan
  const handleCopyLink = (slug: string) => {
    const url = `${window.location.origin}/artikel/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Tautan artikel berhasil disalin!");
  };

  // Quick Action: Ubah Status (Admin)
  const handleQuickStatusChange = async (
    article: ArticleItem,
    newStatus: ArticleStatus
  ) => {
    setActionLoadingId(article.id);
    const updates: Partial<Article> = { status: newStatus };
    if (newStatus === "published" && !article.published_at) {
      updates.published_at = new Date().toISOString();
    }

    const { error } = await s
      .from("articles")
      .update(updates)
      .eq("id", article.id);

    setActionLoadingId(null);
    if (error) {
      toast.error("Gagal mengubah status: " + error.message);
    } else {
      toast.success("Status artikel diperbarui.");
      setArticles((prev) =>
        prev.map((item) =>
          item.id === article.id
            ? { ...item, status: newStatus, published_at: updates.published_at || item.published_at }
            : item
        )
      );
      fetchCategoryCounts();
    }
  };

  // Hapus Artikel (Admin)
  const confirmDeleteArticle = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.cover_image) {
        await s.storage.from(ARTICLES_BUCKET).remove([deleteTarget.cover_image]);
      }
      const { error } = await s
        .from("articles")
        .delete()
        .eq("id", deleteTarget.id);

      if (error) throw error;

      toast.success("Artikel berhasil dihapus permanen.");
      setArticles((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      setTotalItems((prev) => Math.max(0, prev - 1));
      fetchCategoryCounts();
    } catch (err: any) {
      toast.error("Gagal menghapus: " + (err.message || "Terjadi kesalahan"));
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  // Perhitungan Pagination
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(currentPage * PAGE_SIZE, totalItems);

  return (
    <div className="col-span-12 flex flex-col gap-6">
      {/* 1. Header Halaman */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0"></path>
                <path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0"></path>
                <path d="M3 6l0 13"></path>
                <path d="M12 6l0 13"></path>
                <path d="M21 6l0 13"></path>
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Bacaan &amp; Pengetahuan Desain
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Temukan solusi mandiri, panduan instalasi software, dan petunjuk operasional sistem IT.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {isAdmin && (
            <Button asChild variant="outline" size="sm" className="shadow-xs">
              <Link href="/artikel-admin/buat">
                <Plus className="mr-1.5 h-4 w-4" />
                Buat Artikel
              </Link>
            </Button>
          )}

          <Button asChild size="sm" className="shadow-xs bg-primary text-primary-foreground hover:bg-primary/90">
            <Link href="/permintaan-desain/buat">
              <Plus className="mr-1.5 h-4 w-4" />
              Buat Tiket Kendala
            </Link>
          </Button>
        </div>
      </div>

      {/* 2. Tata Letak 2 Kolom (Left: 8 cols, Right: 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* KOLOM KIRI (col-lg-8): Grid Artikel & Pagination */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Grid Kartu Artikel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading || isPending ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border bg-card overflow-hidden shadow-xs space-y-3 animate-pulse"
                >
                  <div className="h-[180px] w-full bg-muted" />
                  <div className="p-4 space-y-3">
                    <div className="h-5 w-4/5 bg-muted rounded" />
                    <div className="h-3.5 w-full bg-muted rounded" />
                    <div className="h-3.5 w-2/3 bg-muted rounded" />
                    <div className="flex justify-between items-center pt-3 border-t">
                      <div className="h-4 w-20 bg-muted rounded" />
                      <div className="h-4 w-12 bg-muted rounded" />
                    </div>
                  </div>
                </div>
              ))
            ) : articles.length > 0 ? (
              articles.map((article) => {
                const coverUrl = articleImageUrl(article.cover_image);
                const firstTag =
                  article.tags && article.tags.length > 0
                    ? article.tags[0]
                    : "Panduan";

                return (
                  <div
                    key={article.id}
                    className="group rounded-xl border bg-card overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col h-full"
                  >
                    {/* Gambar Cover */}
                    <Link
                      href={`/artikel/${article.slug}`}
                      className="block relative h-[180px] w-full overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0"
                    >
                      {coverUrl ? (
                        <Image
                          src={coverUrl}
                          alt={article.title}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                          sizes="(max-width: 768px) 100vw, 400px"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
                          <BookOpen className="h-8 w-8 opacity-40" />
                        </div>
                      )}

                      {/* Badge Kategori di Pojok Kiri Atas */}
                      <div className="absolute top-2 left-2 z-10">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded text-xs font-semibold shadow-xs ${getCategoryBadgeStyle(
                            firstTag
                          )}`}
                        >
                          {firstTag}
                        </span>
                      </div>

                      {/* Admin Quick Action Menu di Pojok Kanan Atas */}
                      {isAdmin && (
                        <div
                          className="absolute top-2 right-2 z-10"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="h-7 w-7 rounded-md bg-background/80 hover:bg-background backdrop-blur-xs flex items-center justify-center text-foreground shadow-xs transition-colors"
                              >
                                {actionLoadingId === article.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <MoreVertical className="h-4 w-4" />
                                )}
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuLabel className="text-xs">
                                Opsi Admin
                              </DropdownMenuLabel>
                              <DropdownMenuItem asChild>
                                <Link href={`/artikel-admin/${article.id}`}>
                                  <Pencil className="mr-2 h-3.5 w-3.5" />
                                  Edit Konten
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleCopyLink(article.slug)}
                              >
                                <Copy className="mr-2 h-3.5 w-3.5" />
                                Salin Tautan
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-xs">
                                Status Artikel
                              </DropdownMenuLabel>
                              {article.status !== "published" && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleQuickStatusChange(article, "published")
                                  }
                                >
                                  <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-emerald-500" />
                                  Terbitkan
                                </DropdownMenuItem>
                              )}
                              {article.status !== "draft" && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleQuickStatusChange(article, "draft")
                                  }
                                >
                                  <Clock className="mr-2 h-3.5 w-3.5 text-amber-500" />
                                  Jadikan Draft
                                </DropdownMenuItem>
                              )}
                              {article.status !== "archived" && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleQuickStatusChange(article, "archived")
                                  }
                                >
                                  <Archive className="mr-2 h-3.5 w-3.5 text-slate-500" />
                                  Arsipkan
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleteTarget(article)}
                                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                              >
                                <Trash2 className="mr-2 h-3.5 w-3.5" />
                                Hapus Artikel
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </Link>

                    {/* Badan Kartu */}
                    <div className="p-3.5 sm:p-4 flex flex-col flex-grow">
                      <h3 className="font-bold text-base leading-snug line-clamp-2 mb-2">
                        <Link
                          href={`/artikel/${article.slug}`}
                          className="text-foreground hover:text-primary transition-colors text-decoration-none"
                        >
                          {article.title}
                        </Link>
                      </h3>

                      <p
                        className="text-muted-foreground text-xs leading-relaxed flex-grow mb-3 line-clamp-3"
                        style={{ lineHeight: 1.55 }}
                      >
                        {article.excerpt ||
                          "Klik baca untuk melihat informasi dan panduan selengkapnya…"}
                      </p>

                      {/* Footer Tanggal & Tombol Baca */}
                      <div className="flex items-center justify-between text-muted-foreground text-xs pt-2.5 border-t mt-auto">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>
                            {formatShortDate(
                              article.published_at || article.created_at
                            )}
                          </span>
                        </div>

                        <Link
                          href={`/artikel/${article.slug}`}
                          className="font-semibold text-primary hover:underline flex items-center gap-1 text-xs"
                        >
                          Baca
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full text-center py-16 px-4 border rounded-xl bg-card border-dashed">
                <Search className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                <h4 className="font-semibold text-base">Tidak ada panduan ditemukan</h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  {searchTerm || selectedCategory !== "all"
                    ? "Tidak ada artikel yang cocok dengan filter atau kata kunci."
                    : "Belum ada panduan yang dipublikasikan saat ini."}
                </p>
                {(searchTerm || selectedCategory !== "all") && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 text-xs"
                    onClick={() => {
                      setSearchInput("");
                      startTransition(() => {
                        router.push(pathname);
                      });
                    }}
                  >
                    Reset Filter
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalItems > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <p className="text-xs sm:text-sm text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{startItem}</span> to{" "}
                <span className="font-semibold text-foreground">{endItem}</span> of{" "}
                <span className="font-semibold text-foreground">{totalItems}</span> results
              </p>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    disabled={currentPage <= 1}
                    onClick={() => handlePageChange(currentPage - 1)}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => {
                      // Tampilkan halaman pertama, terakhir, dan seputar currentPage
                      return (
                        p === 1 ||
                        p === totalPages ||
                        Math.abs(p - currentPage) <= 1
                      );
                    })
                    .map((p, idx, arr) => {
                      const prev = arr[idx - 1];
                      const hasGap = prev && p - prev > 1;

                      return (
                        <div key={p} className="flex items-center">
                          {hasGap && (
                            <span className="px-1 text-xs text-muted-foreground">
                              …
                            </span>
                          )}
                          <Button
                            variant={currentPage === p ? "default" : "outline"}
                            size="sm"
                            className="h-8 w-8 p-0 text-xs"
                            onClick={() => handlePageChange(p)}
                          >
                            {p}
                          </Button>
                        </div>
                      );
                    })}

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    disabled={currentPage >= totalPages}
                    onClick={() => handlePageChange(currentPage + 1)}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* KOLOM KANAN (col-lg-4): Search, Kategori, CTA Box */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Card 1: Cari Panduan */}
          <Card className="shadow-xs border bg-card overflow-hidden">
            <CardHeader className="py-3 px-4 bg-muted/30 border-b flex flex-row items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 text-primary shrink-0"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"></path>
                <path d="M21 21l-6 -6"></path>
              </svg>
              <CardTitle className="text-sm font-bold text-foreground">
                Cari Panduan
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Ketik kata kunci..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-9 pr-8 h-9 text-xs sm:text-sm bg-background"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput("");
                      startTransition(() => {
                        router.push(
                          `${pathname}?${createQueryString({ q: undefined })}`
                        );
                      });
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Kategori Panduan */}
          <Card className="shadow-xs border bg-card overflow-hidden">
            <CardHeader className="py-3 px-4 bg-muted/30 border-b flex flex-row items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 text-primary shrink-0"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <path d="M4 4h6v6h-6z"></path>
                <path d="M14 4h6v6h-6z"></path>
                <path d="M4 14h6v6h-6z"></path>
                <path d="M17 17m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"></path>
              </svg>
              <CardTitle className="text-sm font-bold text-foreground">
                Kategori Panduan
              </CardTitle>
            </CardHeader>

            <div className="divide-y divide-border/60">
              {/* Item: Semua Kategori */}
              <button
                type="button"
                onClick={() => handleCategorySelect("all")}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs transition-colors text-left ${selectedCategory === "all"
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-foreground hover:bg-muted/50"
                  }`}
              >
                <span>Semua Kategori</span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${selectedCategory === "all"
                      ? "bg-primary-foreground text-primary font-bold"
                      : "bg-secondary text-secondary-foreground"
                    }`}
                >
                  {totalAllCount}
                </span>
              </button>

              {/* List Kategori dari DB */}
              {categories.map((cat) => {
                const isActive = selectedCategory === cat.name;
                return (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => handleCategorySelect(cat.name)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs transition-colors text-left ${isActive
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-foreground hover:bg-muted/50"
                      }`}
                  >
                    <span className="truncate mr-2">{cat.name}</span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${isActive
                          ? "bg-primary-foreground text-primary font-bold"
                          : "bg-secondary text-secondary-foreground"
                        }`}
                    >
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Card 3: CTA "Masih Mengalami Kendala?" */}
          <Card className="shadow-xs border border-primary/20 bg-primary/5 dark:bg-primary/10 overflow-hidden">
            <CardContent className="p-4 sm:p-5 text-center flex flex-col items-center">
              {/* Avatar Icon Headset / Support */}
              <div className="h-11 w-11 rounded-full bg-primary text-white flex items-center justify-center mb-3 shadow-xs">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                  <path d="M4 14v-3a8 8 0 1 1 16 0v3"></path>
                  <path d="M18 19c0 1.657 -2.686 3 -6 3s-6 -1.343 -6 -3l.18 -1.26a8.975 8.975 0 0 1 3.82 -3.74h4a8.975 8.975 0 0 1 3.82 3.74l.18 1.26z"></path>
                  <path d="M4 14a2 2 0 0 1 2 -2h1v5h-1a2 2 0 0 1 -2 -2z"></path>
                  <path d="M17 12h1a2 2 0 0 1 2 2v1a2 2 0 0 1 -2 2h-1v-5z"></path>
                </svg>
              </div>

              <h3 className="font-bold text-base text-foreground mb-1">
                Masih Mengalami Kendala?
              </h3>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed max-w-xs">
                Jika panduan di atas belum menyelesaikan masalah Anda, ajukan tiket kendala agar tim IT dapat segera membantu.
              </p>

              <Button
                asChild
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs text-xs font-semibold h-9"
              >
                <Link href="/permintaan-desain/buat">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Buat Tiket Kendala Baru
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 3. Modal Konfirmasi Hapus Artikel (Admin) */}
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Artikel Permanen?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-xs sm:text-sm">
              <p>
                Artikel &quot;<strong>{deleteTarget?.title}</strong>&quot; beserta file
                gambarnya akan dihapus secara permanen.
              </p>
              <p className="text-muted-foreground text-xs">
                Tindakan ini tidak dapat dibatalkan. Jika hanya ingin menyembunyikan artikel, Anda bisa mengubah statusnya ke <strong>Archived</strong>.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="text-xs">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteArticle}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Menghapus…
                </>
              ) : (
                "Ya, Hapus Permanen"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
