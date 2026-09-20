"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import {
  Article,
  ArticleStatus,
  ARTICLES_BUCKET,
  articleImageUrl,
  slugify,
} from "@/lib/articles";
import { Content } from "@/components/content";
import { ArticleEditor } from "@/components/article-editor";
import { TagInput } from "@/components/tag-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ImagePlus,
  Loader2,
  Trash2,
  Save,
  ExternalLink,
  X,
  ArrowLeft,
} from "lucide-react";

interface ArticleFormProps {
  articleId?: string;
}

export function ArticleForm({ articleId }: ArticleFormProps) {
  const s = createClient();
  const router = useRouter();
  const isEdit = Boolean(articleId);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState<ArticleStatus>("draft");
  const [featured, setFeatured] = useState(false);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);

  // Pastikan hanya admin yang bisa mengakses form edit/buat
  useEffect(() => {
    async function checkAdmin() {
      const { data } = await s.auth.getUser();
      if (!data?.user) {
        router.push("/auth/login");
        return;
      }
      const { data: profile } = await s
        .from("users")
        .select("role")
        .eq("id", data.user.id)
        .single();
      if (profile?.role !== "admin") {
        toast.error("Hanya admin yang dapat mengelola artikel.");
        router.push("/artikel-admin");
      }
    }
    checkAdmin();
  }, [s, router]);

  // Muat artikel saat mode edit
  useEffect(() => {
    if (!articleId) return;
    let active = true;
    (async () => {
      const { data, error } = await s
        .from("articles")
        .select("*")
        .eq("id", articleId)
        .single();
      if (!active) return;
      if (error || !data) {
        toast.error("Artikel tidak ditemukan.");
        router.push("/artikel-admin");
        return;
      }
      const a = data as Article;
      setTitle(a.title);
      setSlug(a.slug);
      setSlugTouched(true);
      setExcerpt(a.excerpt ?? "");
      setContent(a.content ?? "");
      setCoverImage(a.cover_image);
      setTags(a.tags ?? []);
      setStatus(a.status);
      setFeatured(a.featured);
      setPublishedAt(a.published_at);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [articleId, s, router]);

  // Auto-slug dari judul selama belum disentuh manual
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(title));
  }, [title, slugTouched]);

  const handleCoverUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar.");
      return;
    }

    setUploadingCover(true);
    const toastId = toast.loading("Mengunggah cover…");
    const path = `cover/${Date.now()}_${file.name.replace(/\s+/g, "-")}`;
    const { error } = await s.storage.from(ARTICLES_BUCKET).upload(path, file);
    setUploadingCover(false);

    if (error) {
      toast.error("Gagal mengunggah cover", {
        id: toastId,
        description: error.message,
      });
      return;
    }
    // Hapus cover lama bila ada
    if (coverImage) {
      await s.storage.from(ARTICLES_BUCKET).remove([coverImage]);
    }
    setCoverImage(path);
    toast.success("Cover berhasil diunggah.", { id: toastId });
  };

  const handleRemoveCover = async () => {
    if (!coverImage) return;
    await s.storage.from(ARTICLES_BUCKET).remove([coverImage]);
    setCoverImage(null);
  };

  const validate = (): string | null => {
    if (!title.trim()) return "Judul wajib diisi.";
    if (!slug.trim()) return "Slug wajib diisi.";
    if (status === "published" && !content.trim())
      return "Konten tidak boleh kosong untuk artikel yang diterbitkan.";
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await s.auth.getUser();
      if (!user) throw new Error("Sesi berakhir, silakan login ulang.");

      const payload: Record<string, unknown> = {
        title: title.trim(),
        slug: slug.trim(),
        excerpt: excerpt.trim() || null,
        content,
        cover_image: coverImage,
        tags,
        status,
        featured,
        // Set published_at saat pertama kali diterbitkan
        published_at:
          status === "published" ? publishedAt ?? new Date().toISOString() : publishedAt,
      };

      if (isEdit) {
        const { error } = await s
          .from("articles")
          .update(payload)
          .eq("id", articleId);
        if (error) throw error;
        toast.success("Artikel diperbarui.");
      } else {
        const { error } = await s
          .from("articles")
          .insert([{ ...payload, author: user.id }]);
        if (error) throw error;
        toast.success("Artikel dibuat.");
      }
      router.push("/artikel-admin");
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Terjadi kesalahan tak terduga.";
      if (message.includes("duplicate") || message.includes("unique")) {
        toast.error("Slug sudah dipakai artikel lain. Gunakan slug berbeda.");
      } else {
        toast.error("Gagal menyimpan: " + message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!articleId) return;
    setDeleting(true);
    try {
      if (coverImage) {
        await s.storage.from(ARTICLES_BUCKET).remove([coverImage]);
      }
      const { error } = await s.from("articles").delete().eq("id", articleId);
      if (error) throw error;
      toast.success("Artikel dihapus permanen.");
      router.push("/artikel-admin");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Gagal menghapus.";
      toast.error(message);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Content title="Memuat artikel…" size="lg">
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Content>
    );
  }

  return (
    <Content
      title={isEdit ? "Edit Artikel" : "Buat Artikel"}
      description="Isi konten, atur tag, lalu simpan sebagai draft atau terbitkan."
      size="lg"
      cardAction={
        <Button variant="outline" size="sm" asChild>
          <a href="/artikel-admin">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Kembali ke Daftar
          </a>
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Kolom utama */}
        <div className="space-y-5 lg:col-span-2">
          <div className="space-y-2">
            <Label htmlFor="title">Judul</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Judul artikel yang menarik…"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug (URL)</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">/artikel/</span>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
                placeholder="slug-artikel"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="excerpt">Ringkasan (excerpt)</Label>
            <Textarea
              id="excerpt"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Ringkasan singkat yang tampil di kartu & hasil pencarian…"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Konten</Label>
            <ArticleEditor value={content} onChange={setContent} />
          </div>
        </div>

        {/* Sidebar pengaturan */}
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Cover</Label>
            <div className="overflow-hidden rounded-lg border">
              {coverImage ? (
                <div className="relative aspect-video bg-muted">
                  <Image
                    src={articleImageUrl(coverImage)}
                    alt="Cover artikel"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 33vw"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveCover}
                    className="absolute right-2 top-2 rounded-md bg-background/80 p-1.5 text-destructive shadow hover:bg-background"
                    aria-label="Hapus cover"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-muted/40 text-muted-foreground transition-colors hover:bg-muted"
                >
                  {uploadingCover ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <ImagePlus className="h-6 w-6" />
                      <span className="text-sm">Unggah cover</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCoverUpload}
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as ArticleStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft (belum tampil)</SelectItem>
                <SelectItem value="published">Published (tampil)</SelectItem>
                <SelectItem value="archived">
                  Archived (nonaktif)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 rounded-md border p-3">
            <Checkbox
              id="featured"
              checked={featured}
              onCheckedChange={(c) => setFeatured(Boolean(c))}
            />
            <Label htmlFor="featured" className="cursor-pointer font-normal">
              Jadikan artikel unggulan (featured)
            </Label>
          </div>

          <div className="space-y-2">
            <Label>Tag</Label>
            <TagInput value={tags} onChange={setTags} />
          </div>
        </div>
      </div>

      {/* Aksi */}
      <div className="mt-8 flex flex-col-reverse items-stretch gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {isEdit && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={deleting}>
                  {deleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Hapus
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Hapus artikel permanen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tindakan ini tidak bisa dibatalkan. Artikel beserta cover-nya
                    akan dihapus permanen. Jika hanya ingin menyembunyikan, ubah
                    status ke <strong>Archived</strong>.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-white hover:bg-destructive/90"
                  >
                    Ya, hapus permanen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {isEdit && status === "published" && (
            <Button variant="outline" asChild>
              <a href={`/artikel/${slug}`} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Lihat
              </a>
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/artikel-admin")}
            disabled={saving}
          >
            Batal
          </Button>
          <Button onClick={handleSave} disabled={saving || uploadingCover}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Simpan
          </Button>
        </div>
      </div>
    </Content>
  );
}
