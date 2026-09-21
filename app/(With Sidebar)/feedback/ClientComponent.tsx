"use client";

import { useEffect, useState, useCallback } from "react";
import { Content } from "@/components/content";
import { createClient } from "@/lib/supabase/client";
import { PaginationComponent } from "@/components/pagination";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Search,
  Star,
  MessageSquare,
  TrendingUp,
  Award,
  Users,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as indonesiaLocale } from "date-fns/locale";
import Link from "next/link";

interface ReviewItem {
  id: string;
  judul: string;
  rating: number;
  review: string | null;
  created_at: string;
  requester_name?: string;
}

interface RatingSummary {
  total: number;
  avg: number;
  dist: Record<number, number>; // { 1: 2, 2: 1, 3: 4, 4: 8, 5: 15 }
}

const ITEMS_PER_PAGE = 10;

const RATING_LABELS: Record<number, { label: string; color: string }> = {
  5: { label: "Sangat Puas", color: "text-emerald-600" },
  4: { label: "Puas", color: "text-sky-600" },
  3: { label: "Cukup", color: "text-amber-600" },
  2: { label: "Kurang Puas", color: "text-orange-600" },
  1: { label: "Tidak Puas", color: "text-rose-600" },
};

function StarDisplay({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "h-6 w-6" : size === "md" ? "h-5 w-5" : "h-4 w-4";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`${cls} ${
            s <= rating
              ? "fill-yellow-400 text-yellow-400"
              : "fill-muted-foreground/10 text-muted-foreground/30"
          }`}
        />
      ))}
    </div>
  );
}

export function FeedbackClientContent() {
  const s = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [userRole, setUserRole] = useState<string | null>(null);

  const currentPage = Number(searchParams.get("page") || "1");
  const searchTerm = searchParams.get("search") || "";
  const [searchInput, setSearchInput] = useState(searchTerm);

  const createQueryString = useCallback(
    (paramsToUpdate: Record<string, string | number>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [name, value] of Object.entries(paramsToUpdate)) {
        if (value) params.set(name, String(value));
        else params.delete(name);
      }
      if (paramsToUpdate.search !== undefined) params.set("page", "1");
      return params.toString();
    },
    [searchParams]
  );

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await s.auth.getUser();
        if (!user) return;

        // Cek role
        const { data: profile } = await s
          .from("users")
          .select("role")
          .eq("id", user.id)
          .single();
        const role = profile?.role || "user";
        setUserRole(role);

        const from = (currentPage - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;

        // Build query berdasarkan role
        let baseQuery = s
          .from("permintaan")
          .select(
            `id, judul, rating, review, created_at,
            requester_data:user_profiles!permintaan_requester_fkey(name)`,
            { count: "exact" }
          )
          .eq("status", "DONE")
          .not("rating", "is", null);

        // User biasa hanya lihat review milik sendiri
        if (role !== "admin") {
          baseQuery = baseQuery.eq("requester", user.id);
        }

        if (searchTerm) {
          baseQuery = baseQuery.ilike("judul", `%${searchTerm}%`);
        }

        const { data, error, count } = await baseQuery
          .order("created_at", { ascending: false })
          .range(from, to);

        if (error) throw error;

        const mapped: ReviewItem[] = (data || []).map((item: any) => ({
          id: item.id,
          judul: item.judul,
          rating: Number(item.rating),
          review: item.review,
          created_at: item.created_at,
          requester_name:
            item.requester_data?.name || "Pengguna",
        }));

        setReviews(mapped);
        setTotalItems(count || 0);

        // Hitung summary dari semua data (tanpa pagination)
        let sumQuery = s
          .from("permintaan")
          .select("rating")
          .eq("status", "DONE")
          .not("rating", "is", null);
        if (role !== "admin") sumQuery = sumQuery.eq("requester", user.id);
        const { data: allRatings } = await sumQuery;

        if (allRatings && allRatings.length > 0) {
          const nums = allRatings.map((r: any) => Number(r.rating));
          const total = nums.length;
          const avg = Math.round((nums.reduce((a, b) => a + b, 0) / total) * 10) / 10;
          const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
          nums.forEach((n) => { if (n >= 1 && n <= 5) dist[n]++; });
          setSummary({ total, avg, dist });
        }
      } catch (err: any) {
        toast.error("Gagal memuat data review: " + err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [s, currentPage, searchTerm]);

  useEffect(() => {
    const handler = setTimeout(() => {
      router.push(pathname + "?" + createQueryString({ search: searchInput }));
    }, 500);
    return () => clearTimeout(handler);
  }, [searchInput, pathname, router, createQueryString]);

  return (
    <Content
      title="Review & Rating Permintaan Desain"
      description="Kumpulan ulasan dan penilaian kepuasan dari permintaan desain yang telah selesai"
      size="lg"
    >
      {/* SUMMARY CARDS */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {/* Rata-rata */}
          <div className="col-span-2 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center gap-4">
            <div className="flex-shrink-0 w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
              <Award className="h-7 w-7 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Rata-rata Rating
              </p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-3xl font-bold text-amber-700 dark:text-amber-300">
                  {summary.avg}
                </span>
                <span className="text-sm text-muted-foreground">/5</span>
              </div>
              <StarDisplay rating={Math.round(summary.avg)} size="sm" />
            </div>
          </div>

          {/* Total Review */}
          <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-50 dark:bg-sky-950/40 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Review</p>
              <p className="text-2xl font-bold text-foreground">{summary.total}</p>
            </div>
          </div>

          {/* Kepuasan Tinggi */}
          <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Rating 4-5 ★</p>
              <p className="text-2xl font-bold text-foreground">
                {summary.dist[4] + summary.dist[5]}
              </p>
              <p className="text-[11px] text-emerald-600">
                {summary.total > 0
                  ? Math.round(((summary.dist[4] + summary.dist[5]) / summary.total) * 100)
                  : 0}
                % puas
              </p>
            </div>
          </div>

          {/* Distribusi Bintang */}
          <div className="col-span-2 md:col-span-4 bg-card border rounded-xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Distribusi Rating
            </p>
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = summary.dist[star] || 0;
                const pct = summary.total > 0 ? (count / summary.total) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-3">
                    <div className="flex items-center gap-1 w-20 shrink-0">
                      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs font-medium">{star}</span>
                      <span className="text-[11px] text-muted-foreground hidden sm:inline">
                        {RATING_LABELS[star].label.split(" ")[0]}
                      </span>
                    </div>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground w-12 text-right shrink-0">
                      {count} ({Math.round(pct)}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SEARCH */}
      <div className="mb-5">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari berdasarkan judul..."
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
      </div>

      {/* LIST */}
      {loading ? (
        <div className="flex justify-center items-center h-40 gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground text-sm">Memuat ulasan...</span>
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center h-48 flex flex-col justify-center items-center gap-2 text-muted-foreground border border-dashed rounded-xl">
          <MessageSquare className="h-8 w-8 opacity-40" />
          <p className="font-medium">Belum ada ulasan</p>
          <p className="text-sm">Review akan muncul setelah permintaan desain selesai dan diberi penilaian.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((item) => {
            const ratingInfo = RATING_LABELS[item.rating] || RATING_LABELS[3];
            return (
              <div
                key={item.id}
                className="border bg-card rounded-xl p-4 flex flex-col sm:flex-row sm:items-start gap-4 hover:shadow-sm transition-shadow"
              >
                {/* Rating Visual */}
                <div className="flex flex-col items-center justify-center sm:w-20 shrink-0 gap-1">
                  <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-center">
                    <span className="text-lg font-bold text-amber-700 dark:text-amber-300">
                      {item.rating}
                    </span>
                  </div>
                  <span className={`text-[10px] font-semibold ${ratingInfo.color} text-center`}>
                    {ratingInfo.label}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                    <h4 className="font-semibold text-sm text-foreground truncate max-w-xs">
                      {item.judul}
                    </h4>
                    <div className="flex items-center gap-2 shrink-0">
                      {userRole === "admin" && item.requester_name && (
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-1">
                          <Users className="h-2.5 w-2.5" />
                          {item.requester_name}
                        </Badge>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {format(new Date(item.created_at), "dd MMM yyyy", {
                          locale: indonesiaLocale,
                        })}
                      </span>
                    </div>
                  </div>

                  <StarDisplay rating={item.rating} size="sm" />

                  {item.review ? (
                    <blockquote className="mt-2 border-l-2 border-amber-300 dark:border-amber-700 pl-3 italic text-sm text-muted-foreground line-clamp-2">
                      &ldquo;{item.review}&rdquo;
                    </blockquote>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground italic">
                      Tidak ada ulasan tertulis.
                    </p>
                  )}
                </div>

                {/* Action */}
                <div className="shrink-0">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/permintaan-desain/${item.id}`}>Lihat Detail</Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6">
        <PaginationComponent
          basePath={`${pathname}?${createQueryString({ page: "" }).slice(0, -1)}`}
          currentPage={currentPage}
          totalItems={totalItems}
          itemsPerPage={ITEMS_PER_PAGE}
        />
      </div>
    </Content>
  );
}
