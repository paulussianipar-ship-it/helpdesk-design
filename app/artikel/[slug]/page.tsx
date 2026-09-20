import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PrintArticleButton } from "@/components/print-article-button";
import { ArticleRating } from "@/components/article-rating";
import { Button } from "@/components/ui/button";
import {
  Article,
  articleImageUrl,
} from "@/lib/articles";
import {
  Calendar,
  Plus,
  BookOpen,
} from "lucide-react";
import type { Metadata } from "next";

type DetailArticle = Pick<
  Article,
  | "title"
  | "slug"
  | "excerpt"
  | "content"
  | "cover_image"
  | "tags"
  | "author"
  | "published_at"
  | "created_at"
  | "views"
>;

type RelatedArticle = Pick<
  Article,
  "title" | "slug" | "cover_image" | "tags" | "published_at" | "created_at"
>;

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createServiceClient(url, key);
}

async function getArticle(slug: string): Promise<DetailArticle | null> {
  const supabase = getServiceSupabase();
  const { data } = await supabase
    .from("articles")
    .select(
      "title, slug, excerpt, content, cover_image, tags, author, published_at, created_at, views"
    )
    .eq("slug", slug)
    .maybeSingle();
  return (data as DetailArticle) || null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: "Artikel tidak ditemukan — DesignDesk" };
  return {
    title: `${article.title} — Artikel Desain`,
    description: article.excerpt ?? undefined,
    openGraph: {
      title: article.title,
      description: article.excerpt ?? undefined,
      images: article.cover_image
        ? [articleImageUrl(article.cover_image)]
        : undefined,
      type: "article",
    },
  };
}

function formatLongDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getCategoryBadgeClass(tag: string): string {
  const lower = tag.toLowerCase();
  if (lower.includes("troubleshoot")) {
    return "bg-amber-600 text-white dark:bg-amber-700";
  }
  if (lower.includes("tips") || lower.includes("edukasi")) {
    return "bg-slate-800 text-white dark:bg-slate-900";
  }
  if (lower.includes("Atikel")) {
    return "bg-blue-600 text-white dark:bg-blue-700";
  }
  if (lower.includes("tutorial")) {
    return "bg-emerald-600 text-white dark:bg-emerald-700";
  }
  return "bg-slate-800 text-white dark:bg-slate-700";
}

export default async function ArtikelDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  const supabase = await createClient();

  // Hitung views (best-effort)
  await supabase.rpc("increment_article_views", { article_slug: slug });

  // Ambil Artikel lainnya
  let related: RelatedArticle[] = [];
  if (article.tags && article.tags.length > 0) {
    const { data } = await supabase
      .from("articles")
      .select("title, slug, cover_image, tags, published_at, created_at")
      .eq("status", "published")
      .neq("slug", slug)
      .overlaps("tags", article.tags)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(3);
    related = (data as RelatedArticle[]) || [];
  }

  // Fallback jika tidak ada tag yang overlap, ambil 3 artikel terbaru
  if (related.length === 0) {
    const { data } = await supabase
      .from("articles")
      .select("title, slug, cover_image, tags, published_at, created_at")
      .eq("status", "published")
      .neq("slug", slug)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(3);
    related = (data as RelatedArticle[]) || [];
  }

  const cover = article.cover_image ? articleImageUrl(article.cover_image) : null;
  const contentText = (article.content || "").replace(/<[^>]*>/g, "").trim();
  const contentHasOnlyImage = Boolean(
    article.content && !contentText && /<img\s+[^>]*>/i.test(article.content)
  );

  const primaryTag = article.tags?.[0] || "Tips & Edukasi";
  let authorName = "Admin Desain";
  if (article.author) {
    if (/^[0-9a-fA-F-]{36}$/.test(article.author)) {
      const { data: userData } = await getServiceSupabase()
        .from("users")
        .select("name")
        .eq("id", article.author)
        .maybeSingle();
      if (userData?.name) {
        authorName = userData.name;
      }
    } else {
      authorName = article.author;
    }
  }
  const authorInitial = authorName.charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
      {/* CSS Khusus Tipografi Konten Artikel & Print Styling */}
      <style>{`
        .artikel-article-body {
          font-size: 16px;
          line-height: 1.85;
          color: #1e293b;
        }

        .dark .artikel-article-body,
        [data-theme="dark"] .artikel-article-body {
          color: #cbd5e1 !important;
        }

        .artikel-article-body p {
          margin-bottom: 1.25rem;
        }

        .artikel-article-body h1,
        .artikel-article-body h2,
        .artikel-article-body h3,
        .artikel-article-body h4 {
          color: #0f172a;
          font-weight: 700;
          margin-top: 2rem;
          margin-bottom: 1rem;
          line-height: 1.35;
        }

        .dark .artikel-article-body h1,
        .dark .artikel-article-body h2,
        .dark .artikel-article-body h3,
        .dark .artikel-article-body h4,
        [data-theme="dark"] .artikel-article-body h1,
        [data-theme="dark"] .artikel-article-body h2,
        [data-theme="dark"] .artikel-article-body h3,
        [data-theme="dark"] .artikel-article-body h4 {
          color: #f8fafc !important;
        }

        .artikel-article-body ul,
        .artikel-article-body ol {
          padding-left: 1.5rem;
          margin-bottom: 1.25rem;
        }

        .artikel-article-body ul {
          list-style-type: disc;
        }

        .artikel-article-body ol {
          list-style-type: decimal;
        }

        .artikel-article-body li {
          margin-bottom: 0.5rem;
        }

        .artikel-article-body img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          margin: 1.5rem 0;
        }

        .artikel-article-body blockquote {
          border-left: 4px solid #206bc4;
          padding: 0.75rem 1.25rem;
          background: #f8fafc;
          border-radius: 0 8px 8px 0;
          margin: 1.5rem 0;
          color: #475569;
          font-style: italic;
        }

        .dark .artikel-article-body blockquote,
        [data-theme="dark"] .artikel-article-body blockquote {
          background: #151f2e;
          color: #94a3b8;
          border-left-color: #3b82f6;
        }

        .artikel-article-body table {
          width: 100%;
          border-collapse: collapse;
          margin: 1.5rem 0;
          font-size: 14px;
        }

        .artikel-article-body table th,
        .artikel-article-body table td {
          border: 1px solid #e2e8f0;
          padding: 10px 14px;
          vertical-align: top;
        }

        .dark .artikel-article-body table th,
        .dark .artikel-article-body table td,
        [data-theme="dark"] .artikel-article-body table th,
        [data-theme="dark"] .artikel-article-body table td {
          border-color: #334155;
          color: #cbd5e1;
        }

        .artikel-article-body table th {
          background-color: #f1f5f9;
          font-weight: 600;
          text-align: left;
        }

        .dark .artikel-article-body table th,
        [data-theme="dark"] .artikel-article-body table th {
          background-color: #131b26;
          color: #94a3b8;
        }

        .artikel-article-body code {
          background: #f1f5f9;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 14px;
          color: #d63939;
        }

        .dark .artikel-article-body code,
        [data-theme="dark"] .artikel-article-body code {
          background: #151f2e;
          color: #ff7d7d;
          border: 1px solid #334155;
        }

        .artikel-article-body pre {
          background: #1e293b;
          color: #f8fafc;
          padding: 1rem;
          border-radius: 8px;
          overflow-x: auto;
          margin: 1.5rem 0;
          border: 1px solid #334155;
        }

        @media print {
          .d-print-none {
            display: none !important;
          }
          body {
            background: white !important;
            color: black !important;
          }
        }
      `}</style>

      {/* Header Situs Utama */}
      <div className="d-print-none">
        <SiteHeader />
      </div>

      <main className="flex-1 pb-12 pt-4 sm:pt-6">
        <div className="container mx-auto px-4 max-w-5xl">
          {/* Breadcrumb & Action Header */}
          <div className="d-print-none mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b">
            {/* Breadcrumbs Tabler Style */}
            <nav className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground overflow-x-auto py-1">
              <Link
                href="/dashboard"
                className="hover:text-foreground transition-colors shrink-0"
              >
                Dashboard
              </Link>
              <span>/</span>
              <Link
                href="/artikel-admin"
                className="hover:text-foreground transition-colors shrink-0"
              >
                Artikel Desain
              </Link>
              <span>/</span>
              <span className="text-foreground font-medium truncate max-w-[200px] sm:max-w-[320px]">
                {article.title}
              </span>
            </nav>

            {/* Aksi Header: Cetak & Kembali */}
            <div className="flex items-center gap-2 shrink-0">
              <PrintArticleButton />

              <Button
                asChild
                size="sm"
                className="shadow-xs text-xs h-9 bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
              >
                <Link href="/artikel-admin">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
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
                    <path d="M5 12l14 0"></path>
                    <path d="M5 12l6 6"></path>
                    <path d="M5 12l6 -6"></path>
                  </svg>
                  Daftar Artikel
                </Link>
              </Button>
            </div>
          </div>

          {/* Kotak Utama Artikel */}
          <div className="rounded-xl border bg-card shadow-xs overflow-hidden mb-8">
            <div className="p-5 sm:p-8 md:p-10">
              {/* Badge Kategori & Tanggal */}
              <div className="flex flex-wrap items-center gap-2.5 mb-3">
                <span
                  className={`inline-block px-3 py-1 rounded text-xs font-semibold shadow-xs ${getCategoryBadgeClass(
                    primaryTag
                  )}`}
                >
                  {primaryTag}
                </span>

                <span className="text-muted-foreground text-xs flex items-center gap-1.5 ml-1">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  {formatLongDate(article.published_at || article.created_at)}
                </span>
              </div>

              {/* Judul Artikel */}
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4 leading-tight">
                {article.title}
              </h1>

              {/* Info Penulis (Author Info) */}
              <div className="flex items-center gap-3 pb-4 mb-6 border-b">
                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-base shrink-0">
                  {authorInitial}
                </div>
                <div>
                  <div className="font-bold text-sm text-foreground capitalize">
                    {authorName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Helpdesk IT Knowledge Specialist
                  </div>
                </div>
              </div>

              {/* Cover Gambar Utama */}
              {cover ? (
                <div className="mb-6 text-center overflow-hidden rounded-xl border shadow-xs bg-slate-100 dark:bg-slate-800">
                  <div className="relative w-full h-[240px] sm:h-[360px] md:h-[420px]">
                    <Image
                      src={cover}
                      alt={article.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 896px"
                      priority
                    />
                  </div>
                </div>
              ) : contentHasOnlyImage ? (
                <div
                  className="mb-6 text-center overflow-hidden rounded-xl border shadow-xs [&_img]:w-full [&_img]:max-h-[420px] [&_img]:object-cover"
                  dangerouslySetInnerHTML={{ __html: article.content! }}
                />
              ) : null}

              {/* Isi Konten Teks Artikel Di Bawah Gambar */}
              <div className="artikel-article-body mb-8">
                {contentHasOnlyImage ? (
                  /* Jika content hanya berisi tag img, tampilkan teks artikel dari excerpt */
                  article.excerpt ? (
                    <div className="space-y-4">
                      {article.excerpt
                        .split(/\n\s*\n/)
                        .filter(Boolean)
                        .map((paragraph, idx) => (
                          <p key={idx}>{paragraph.trim()}</p>
                        ))}
                    </div>
                  ) : null
                ) : article.content ? (
                  <>
                    {article.excerpt &&
                      !article.content.includes(
                        article.excerpt.slice(0, 50)
                      ) && (
                        <p className="text-base sm:text-lg font-medium text-muted-foreground mb-6 leading-relaxed">
                          {article.excerpt}
                        </p>
                      )}
                    <div
                      dangerouslySetInnerHTML={{ __html: article.content }}
                    />
                  </>
                ) : article.excerpt ? (
                  <div className="space-y-4">
                    {article.excerpt
                      .split(/\n\s*\n/)
                      .filter(Boolean)
                      .map((paragraph, idx) => (
                        <p key={idx}>{paragraph.trim()}</p>
                      ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    Konten belum tersedia.
                  </p>
                )}
              </div>

              {/* Penilaian Bintang Artikel */}
              <ArticleRating articleSlug={article.slug} />
            </div>
          </div>

          {/* Bagian: Artikel Lainnya */}
          {related.length > 0 && (
            <div className="d-print-none mb-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-7 w-7 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <BookOpen className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-lg text-foreground">
                  Artikel Lainnya
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {related.map((item) => {
                  const itemCover = articleImageUrl(item.cover_image);
                  const itemTag = item.tags?.[0] || "Tips & Edukasi";

                  return (
                    <div
                      key={item.slug}
                      className="group rounded-xl border bg-card overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col h-full"
                    >
                      <Link
                        href={`/artikel/${item.slug}`}
                        className="block relative h-[120px] w-full overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0"
                      >
                        {itemCover ? (
                          <Image
                            src={itemCover}
                            alt={item.title}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                            sizes="(max-width: 768px) 100vw, 300px"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
                            <BookOpen className="h-6 w-6" />
                          </div>
                        )}
                      </Link>

                      <div className="p-3.5 flex flex-col flex-grow">
                        <span className="inline-block text-[10px] bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded w-fit mb-2">
                          {itemTag}
                        </span>

                        <h4 className="font-bold text-xs sm:text-sm leading-snug line-clamp-2 mb-2">
                          <Link
                            href={`/artikel/${item.slug}`}
                            className="text-foreground hover:text-primary transition-colors"
                          >
                            {item.title}
                          </Link>
                        </h4>

                        <div className="text-muted-foreground text-[11px] mt-auto pt-2 border-t flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {formatShortDate(
                              item.published_at || item.created_at
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      <div className="d-print-none">
        <SiteFooter />
      </div>
    </div>
  );
}
