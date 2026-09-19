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
  Article,
  ArticleStatus,
  STATUS_LABEL,
  formatDateID,
} from "@/lib/articles";
import { Eye, Loader2, Plus, Search, Star } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, useTransition } from "react";
import { toast } from "sonner";

type ArticleRow = Pick<
  Article,
  "id" | "title" | "slug" | "status" | "tags" | "featured" | "created_at" | "published_at"
>;

const LIMIT_OPTIONS = [10, 25, 50, 100];

const statusVariant: Record<ArticleStatus, "default" | "secondary" | "outline"> =
  {
    published: "default",
    draft: "secondary",
    archived: "outline",
  };

export function ArtikelAdminClientContent() {
  const s = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [userRole, setUserRole] = useState<string>("user");

  useEffect(() => {
    async function checkRole() {
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
    }
    checkRole();
  }, [s]);

  const isAdmin = userRole === "admin";

  const currentPage = Number(searchParams.get("page") || "1");
  const searchTerm = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "";
  const limit = Number(searchParams.get("limit") || 10);

  const [searchInput, setSearchInput] = useState(searchTerm);

  const createQueryString = useCallback(
    (paramsToUpdate: Record<string, string | number | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(paramsToUpdate).forEach(([name, value]) => {
        if (value) params.set(name, String(value));
        else params.delete(name);
      });
      if (Object.keys(paramsToUpdate).some((k) => k !== "page")) {
        params.set("page", "1");
      }
      return params.toString();
    },
    [searchParams]
  );

  useEffect(() => {
    async function fetchArticles() {
      setLoading(true);
      const from = (currentPage - 1) * limit;
      const to = from + limit - 1;

      let query = s
        .from("articles")
        .select(
          `id, title, slug, status, tags, featured, created_at, published_at`,
          { count: "exact" }
        );

      if (searchTerm) query = query.ilike("title", `%${searchTerm}%`);
      if (statusFilter) query = query.eq("status", statusFilter);

      query = query.range(from, to).order("created_at", { ascending: false });

      const { data, error, count } = await query;
      if (error) {
        toast.error("Gagal mengambil data: " + error.message);
        setArticles([]);
      } else {
        setArticles((data as ArticleRow[]) || []);
        setTotalItems(count || 0);
      }
      setLoading(false);
    }
    fetchArticles();
  }, [s, currentPage, searchTerm, statusFilter, limit]);

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

  return (
    <Content
      title={isAdmin ? "Kelola Artikel" : "Daftar Artikel"}
      description={
        isAdmin
          ? "Buat, terbitkan, arsipkan, atau hapus artikel."
          : "Kumpulan artikel, tips, dan wawasan seputar desain."
      }
      size="lg"
      cardAction={
        isAdmin ? (
          <Button asChild>
            <a href="/artikel-admin/buat">
              <Plus className="mr-2 h-4 w-4" />
              Buat Artikel
            </a>
          </Button>
        ) : null
      }
    >
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Cari berdasarkan judul…"
            className="pl-10"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        {isAdmin && (
          <Select
            onValueChange={(value) =>
              handleFilterChange({ status: value === "all" ? undefined : value })
            }
            defaultValue={statusFilter || "all"}
          >
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">No</TableHead>
              <TableHead>Judul</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Tag</TableHead>
              <TableHead className="hidden lg:table-cell">Tanggal</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading || isPending ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24">
                  <div className="flex justify-center items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Memuat data…
                  </div>
                </TableCell>
              </TableRow>
            ) : articles.length > 0 ? (
              articles.map((article, index) => (
                <TableRow key={article.id}>
                  <TableCell className="font-medium">
                    {(currentPage - 1) * limit + index + 1}
                  </TableCell>
                  <TableCell className="font-semibold">
                    <a
                      href={`/artikel/${article.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 hover:text-primary transition-colors hover:underline"
                    >
                      {article.featured && (
                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 shrink-0" />
                      )}
                      <span>{article.title}</span>
                    </a>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[article.status]}>
                      {STATUS_LABEL[article.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {article.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {article.tags.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{article.tags.length - 3}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {formatDateID(article.published_at || article.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {article.slug && (
                        <Button
                          variant={isAdmin ? "ghost" : "default"}
                          size="sm"
                          asChild
                        >
                          <a
                            href={`/artikel/${article.slug}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Eye className="mr-1.5 h-3.5 w-3.5" />
                            Lihat
                          </a>
                        </Button>
                      )}
                      {isAdmin && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={`/artikel-admin/${article.id}`}>Edit</a>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24">
                  Belum ada artikel.
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
          <span>dari {totalItems} artikel.</span>
        </div>
        <PaginationComponent
          basePath={pathname}
          currentPage={currentPage}
          totalItems={totalItems}
          itemsPerPage={limit}
        />
      </div>
    </Content>
  );
}
