// app/permintaan/detail/[id]/page.tsx

"use client";

import { Content } from "@/components/content";
import { FormEvent, use, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Calendar, Loader2, Trash2, User, Download } from "lucide-react";
import { format } from "date-fns";
import { id as indonesiaLocale } from "date-fns/locale";
import { PermintaanDesain } from "../buat/page";
import { Button } from "@/components/ui/button";
import { ComboboxData } from "@/components/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
}

const statusOptions: ComboboxData = [
  { label: "PROGRESS", value: "PROGRESS" },
  { label: "REVISION", value: "REVISION" },
  { label: "REVIEW", value: "REVIEW" },
  { label: "DONE", value: "DONE" },
];

export default function DetailPermintaanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  // State
  const [permin, setPermin] = useState<PermintaanDesain | null>(null);
  const [requester, setRequester] = useState<UserProfile | null>(null);
  const [admin, setAdmin] = useState<UserProfile | null>(null);
  const [userCred, setUserCred] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const s = createClient();

  useEffect(() => {
    async function fetchUserData() {
      const {
        data: { user },
      } = await s.auth.getUser();
      if (user) {
        const { data } = await s
          .from("user_profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        setUserCred(data);
      }
    }
    fetchUserData();
  }, [s]);

  useEffect(() => {
    if (!id) return;
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/permintaan?id=${id}`);
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || `HTTP ${res.status}`);
        }
        const json = await res.json();
        if (json.data) {
          setPermin(json.data as PermintaanDesain);
          if (json.data.requester_data) setRequester(json.data.requester_data);
          if (json.data.admin_data) setAdmin(json.data.admin_data);
        } else {
          setPermin(null);
        }
      } catch (error: any) {
        toast.error("Gagal mengambil data permintaan: " + error.message);
        setPermin(null);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  useEffect(() => {
    async function fetchDataUser(userId: string, setUser: Function) {
      const { data } = await s
        .from("user_profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (data) setUser(data);
    }
    if (permin?.requester && !requester) fetchDataUser(permin.requester, setRequester);
    if (permin?.admin && !admin) fetchDataUser(permin.admin, setAdmin);
  }, [s, permin, requester, admin]);

  const getStatusVariant = (
    status: PermintaanDesain["status"]
  ): "default" | "secondary" | "destructive" | "outline" => {
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

  async function handleAmbilPermintaan() {
    if (!permin) return;
    setLoading(true);

    try {
      const { data: user } = await s.auth.getUser();
      if (!user.user) {
        toast.error("Anda harus login untuk mengambil permintaan desain.");
        return;
      }

      if (permin.admin) {
        toast.error("Permintaan desain ini sudah diambil oleh admin lain.");
        return;
      }

      const { error } = await s
        .from("permintaan")
        .update({ admin: user.user.id, status: "PROGRESS" })
        .eq("id", permin.id);

      if (error) {
        throw error;
      }

      const { data: adminData } = await s
        .from("user_profiles")
        .select("*")
        .eq("id", user.user.id)
        .maybeSingle();
      if (adminData) setAdmin(adminData);

      setPermin({ ...permin, admin: user.user.id, status: "PROGRESS" });
      toast.success("Berhasil mengambil permintaan desain.");
    } catch (error: any) {
      toast.error("Gagal mengambil permintaan desain: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  function handleStatusChange(e: FormEvent) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const status = formData.get("status") as PermintaanDesain["status"];
    if (!status || !permin) return;

    async function updateStatus() {
      setLoading(true);
      try {
        const { error } = await s
          .from("permintaan")
          .update({ status })
          .eq("id", permin!.id);

        if (error) throw error;

        setPermin({ ...permin!, status });
        toast.success("Status permintaan berhasil diperbarui.");
      } catch (error: any) {
        toast.error("Gagal memperbarui status: " + error.message);
      } finally {
        setLoading(false);
      }
    }

    updateStatus();
  }

  async function handleAddFile(e: FormEvent) {
    e.preventDefault();
    if (!permin) return;
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const file = formData.get("file") as File;
    if (!file || file.size === 0) {
      toast.error("File harus dipilih.");
      return;
    }

    setLoading(true);
    try {
      const filePath = `${permin.id}/${file.name}`;
      const { error: uploadError } = await s.storage
        .from("hasil-desain")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = s.storage
        .from("hasil-desain")
        .getPublicUrl(filePath);

      const fileObject = { name: file.name, url: publicUrlData.publicUrl };
      const updatedFiles = permin.files
        ? [...permin.files.filter((f) => f.name !== file.name), fileObject]
        : [fileObject];

      const { error: updateError } = await s
        .from("permintaan")
        .update({ files: updatedFiles })
        .eq("id", permin.id);

      if (updateError) throw updateError;

      form.reset();
      setPermin({ ...permin, files: updatedFiles });
      toast.success("File berhasil diunggah.");
    } catch (error: any) {
      toast.error("Gagal mengunggah file: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  const handleDownloadFile = async (file: { name: string; url: string }) => {
    try {
      const response = await fetch(file.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Gagal mengunduh file.");
    }
  };

  const handleDeleteFile = async (fileToDelete: {
    name: string;
    url: string;
  }) => {
    if (!permin) return;
    if (
      !window.confirm(
        `Apakah Anda yakin ingin menghapus file "${fileToDelete.name}"?`
      )
    ) {
      return;
    }

    setIsDeleting(fileToDelete.name);
    try {
      const filePath = `${permin.id}/${fileToDelete.name}`;
      const { error: storageError } = await s.storage
        .from("hasil-desain")
        .remove([filePath]);

      if (
        storageError &&
        storageError.message !== "The resource was not found"
      ) {
        throw storageError;
      }

      const updatedFiles = permin.files.filter(
        (file) => file.name !== fileToDelete.name
      );

      const { error: dbError } = await s
        .from("permintaan")
        .update({ files: updatedFiles })
        .eq("id", permin.id);

      if (dbError) throw dbError;

      setPermin({ ...permin, files: updatedFiles });
      toast.success(`File "${fileToDelete.name}" berhasil dihapus.`);
    } catch (error: any) {
      toast.error("Gagal menghapus file: " + error.message);
    } finally {
      setIsDeleting(null);
    }
  };

  if (loading && !permin) {
    return (
      <Content
        title="Memuat Detail Permintaan..."
        description="Harap tunggu sebentar."
      >
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Content>
    );
  }

  if (!permin) {
    return (
      <Content
        title="Data Tidak Ditemukan"
        description={`Permintaan desain dengan ID: ${id} tidak dapat ditemukan.`}
      />
    );
  }

  return (
    <>
      <Content size="sm" title="Detail Permintaan Desain">
        <div className="space-y-6">
          <div className="flex flex-col items-start gap-2">
            <Label className="text-base">Judul Permintaan</Label>
            <p>{permin.judul}</p>
          </div>
          <div className="flex flex-col items-start gap-2">
            <Label className="text-base">Project</Label>
            <p>{permin.project}</p>
          </div>
          <div className="flex flex-col items-start gap-2">
            <Label className="text-base">Departemen</Label>
            <p>{permin.departemen}</p>
          </div>
          <div className="flex flex-col items-start gap-2">
            <Label className="text-base">Status Permintaan</Label>
            <Badge variant={getStatusVariant(permin.status)}>
              {permin.status}
            </Badge>
          </div>
          <div className="flex flex-col items-start gap-2">
            <Label className="text-base">Deskripsi</Label>
            <p className="max-h-52 overflow-auto whitespace-pre-wrap">
              {permin.deskripsi}
            </p>
          </div>
          {userCred?.role === "admin" && !permin.admin && (
            <div className="flex flex-col items-start gap-2">
              <Button
                className="w-full"
                onClick={handleAmbilPermintaan}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  "Ambil Permintaan"
                )}
              </Button>
            </div>
          )}
        </div>
      </Content>

      <Content size="sm" title="Informasi Tambahan">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <User className="h-5 w-5 mt-1 text-muted-foreground" />
            <div>
              <Label>Peminta</Label>
              <div className="text-sm font-medium">
                <span className="mr-2">
                  <Badge variant={"outline"}>
                    {requester?.role || "Guest"}
                  </Badge>
                </span>
                {requester?.name || "Memuat..."}
              </div>
              <p className="text-sm text-muted-foreground">
                {requester?.email}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <User className="h-5 w-5 mt-1 text-muted-foreground" />
            <div>
              <Label>Admin</Label>
              {admin ? (
                <>
                  <div className="text-sm font-medium">
                    <span className="mr-2">
                      <Badge variant={"outline"}>
                        {admin?.role || "Admin"}
                      </Badge>
                    </span>
                    {admin?.name || "Memuat..."}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {admin?.email}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Belum ada</p>
              )}
            </div>
          </div>
          <Separator />
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 mt-1 text-muted-foreground" />
            <div>
              <Label>Tanggal Dibuat</Label>
              <p className="text-sm font-medium">
                {format(new Date(permin.created_at), "dd MMMM yyyy", {
                  locale: indonesiaLocale,
                })}
              </p>
            </div>
          </div>
          <Separator />
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 mt-1 text-red-500" />
            <div>
              <Label>Batas Waktu</Label>
              <p className="text-sm font-medium">
                {format(new Date(permin.due_date), "dd MMMM yyyy", {
                  locale: indonesiaLocale,
                })}
              </p>
            </div>
          </div>
        </div>
      </Content>

      {permin.files && permin.files.length > 0 && (
        <Content size="sm" title="File Terlampir">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>Nama File</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permin.files.map((file, index) => {
                const isCurrentlyDeleting = isDeleting === file.name;
                return (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {file.name}
                      </a>
                    </TableCell>
                    <TableCell className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadFile(file)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Unduh
                      </Button>
                      {permin.admin === userCred?.id && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteFile(file)}
                          disabled={isCurrentlyDeleting}
                        >
                          {isCurrentlyDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Content>
      )}

      {permin.admin === userCred?.id && (
        <Content size="sm" title="Admin Panel">
          <div className="space-y-6">
            <form className="flex flex-col gap-4" onSubmit={handleStatusChange}>
              <div className="flex flex-col gap-2">
                <Label>Ubah Status Permintaan</Label>
                <Select name="status" defaultValue={permin.status}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  "Simpan Status"
                )}
              </Button>
            </form>

            <form className="flex flex-col gap-4" onSubmit={handleAddFile}>
              <div className="flex flex-col gap-2">
                <Label>Unggah File Hasil Desain</Label>
                <Input type="file" name="file" required />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : "Unggah File"}
              </Button>
            </form>
          </div>
        </Content>
      )}
    </>
  );
}
