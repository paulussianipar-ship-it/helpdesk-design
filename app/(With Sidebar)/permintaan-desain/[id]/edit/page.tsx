"use client";

import { Combobox, ComboboxData } from "@/components/combobox";
import { Content } from "@/components/content";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Loader2, Save, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

const dataDepartment: ComboboxData = [
  { label: "General Affair", value: "General Affair" },
  { label: "Marketing", value: "Marketing" },
  { label: "Manufacture", value: "Manufacture" },
  { label: "HR", value: "HR" },
  { label: "HSE", value: "HSE" },
  { label: "IT", value: "IT" },
  { label: "Finance", value: "Finance" },
  { label: "SCM", value: "SCM" },
  { label: "Warehouse", value: "Warehouse" },
  { label: "Service", value: "Service" },
  { label: "General Manager", value: "General Manager" },
  { label: "Executive Manager", value: "Executive Manager" },
  { label: "Boards of Director", value: "Boards of Director" },
];

const dataProject: ComboboxData = [
  { label: "Design Poster", value: "Design Poster" },
  { label: "Design Compro", value: "Design Compro" },
  { label: "Design Sertifikat", value: "Design Sertifikat" },
  { label: "Design Flyer", value: "Design Flyer" },
  { label: "Design Brosur", value: "Design Brosur" },
  { label: "Design Banner", value: "Design Banner" },
  { label: "Design Kemasan", value: "Design Kemasan" },
  { label: "Design Catalog", value: "Design Catalog" },
  { label: "Design Mini Catalog", value: "Design Mini Catalog" },
  { label: "Design File Presentasi", value: "Design File Presentasi" },
  { label: "Design Label", value: "Design Label" },
  { label: "Design Stiker", value: "Design Stiker" },
  { label: "Design Kartu Nama", value: "Design Kartu Nama" },
  { label: "Design Buku", value: "Design Buku" },
  { label: "Design Tagging", value: "Design Tagging" },
  { label: "Design Template", value: "Design Template" },
  { label: "Design Seragam", value: "Design Seragam" },
  { label: "Photo Event", value: "Photo Event" },
  { label: "Photo Editing", value: "Photo Editing" },
  { label: "Photo Product", value: "Photo Product" },
  { label: "Photo Instalasi", value: "Photo Instalasi" },
  { label: "Video Event", value: "Video Event" },
  { label: "Video Product", value: "Video Product" },
  { label: "Video Instlasi", value: "Video Instlasi" },
  { label: "Video Editing", value: "Video Editing" },
  { label: "Lainnya...", value: "Lainnya" },
];

const statusOptions = [
  { label: "TO DO", value: "TO DO" },
  { label: "PROGRESS", value: "PROGRESS" },
  { label: "REVIEW", value: "REVIEW" },
  { label: "REVISION", value: "REVISION" },
  { label: "DONE", value: "DONE" },
];

const dataDesigner: ComboboxData = [
  { label: "Paulus Sianipar", value: "bcfdf89c-d1e2-4602-80aa-005a1beb1d3c" },
  { label: "Farel Ramadhan", value: "54e6f310-813b-447b-aac0-9052423440da" },
];

interface PermintaanData {
  judul: string;
  deskripsi: string;
  project: string;
  status: string;
  due_date: string;
  departemen?: string;
  admin?: string;
}

export default function EditPermintaanDesainPage() {
  const params = useParams();
  const router = useRouter();
  const s = createClient();
  const id = params.id as string;

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [data, setData] = useState<PermintaanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [judul, setJudul] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [customProject, setCustomProject] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("TO DO");
  const [admin, setAdmin] = useState("none");

  useEffect(() => {
    async function init() {
      try {
        const {
          data: { user },
        } = await s.auth.getUser();

        let isUserAdmin = false;
        if (user) {
          const { data: profile } = await s
            .from("user_profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();

          isUserAdmin = profile?.role === "admin";
        }

        // Fetch detail permintaan via API (bypasses RLS & safely handles single record)
        const res = await fetch(`/api/permintaan?id=${id}`);
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || `HTTP ${res.status}`);
        }
        const json = await res.json();
        const item = json.data;
        if (!item) throw new Error("Data permintaan tidak ditemukan");

        // Izin edit: admin atau pemilik tiket
        const canEdit = isUserAdmin || (user && item.requester === user.id) || !item.requester;
        if (!canEdit) {
          setIsAdmin(false);
          return;
        }
        setIsAdmin(true);

        setJudul(item.judul || "");
        setDeskripsi(item.deskripsi || "");
        setStatus(item.status || "TO DO");
        setAdmin(item.admin || "none");
        setSelectedDepartment(item.departemen || "");
        setDueDate(
          item.due_date
            ? new Date(item.due_date).toISOString().split("T")[0]
            : "",
        );

        const projectValues = dataProject.map((p) => p.value);
        if (item.project && projectValues.includes(item.project)) {
          setSelectedProject(item.project);
        } else if (item.project) {
          setSelectedProject("Lainnya");
          setCustomProject(item.project);
        }

        setData(item);
      } catch (e: any) {
        toast.error("Gagal memuat data: " + e.message);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [id, s]);

  function handleProjectChange(value: string) {
    setSelectedProject(value);
    if (value !== "Lainnya") setCustomProject("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const projectValue =
      selectedProject === "Lainnya" ? customProject : selectedProject;

    if (!judul.trim() || !deskripsi.trim() || !dueDate) {
      toast.error("Semua kolom wajib diisi.");
      return;
    }
    if (!selectedDepartment || !projectValue) {
      toast.error("Project dan Departemen wajib dipilih.");
      return;
    }
    if (selectedProject === "Lainnya" && !customProject.trim()) {
      toast.error("Harap sebutkan jenis proyek lainnya.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/permintaan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          judul,
          deskripsi,
          project: projectValue,
          departemen: selectedDepartment,
          status,
          due_date: new Date(dueDate).toISOString(),
          admin: admin === "none" ? null : admin,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Gagal menyimpan perubahan");
      toast.success("Permintaan desain berhasil diperbarui.");
      router.push(`/permintaan-desain/${id}`);
    } catch (err: any) {
      toast.error("Terjadi kesalahan: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Content title="Memuat Data..." size="lg">
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Content>
    );
  }

  if (isAdmin === false) {
    return (
      <Content title="Akses Ditolak" size="md">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            Hanya user dengan role admin yang dapat mengedit permintaan desain.
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button variant="outline" asChild>
            <Link href="/permintaan-desain">
              <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
            </Link>
          </Button>
        </div>
      </Content>
    );
  }

  if (!data)
    return <Content title="404" description="Data tidak ditemukan." />;

  return (
    <Content
      title="Edit Permintaan Desain"
      size="lg"
      cardAction={
        <Button variant="outline" asChild>
          <Link href={`/permintaan-desain/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
          </Link>
        </Button>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="judul">Judul Permintaan</Label>
          <Input
            id="judul"
            name="judul"
            value={judul}
            onChange={(e) => setJudul(e.target.value)}
            required
            disabled={saving}
            placeholder="Contoh: Poster untuk Event 17 Agustus"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="project">Jenis Proyek</Label>
          <Combobox
            data={dataProject}
            onChange={handleProjectChange}
            defaultValue={selectedProject}
          />
        </div>

        {selectedProject === "Lainnya" && (
          <div className="flex flex-col gap-2 animate-in fade-in">
            <Label htmlFor="custom_project">Sebutkan Proyek Lainnya</Label>
            <Input
              id="custom_project"
              name="custom_project"
              value={customProject}
              onChange={(e) => setCustomProject(e.target.value)}
              placeholder="Contoh: Desain Kalender"
              required={selectedProject === "Lainnya"}
              disabled={saving}
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="deskripsi">Deskripsi</Label>
          <Textarea
            rows={4}
            id="deskripsi"
            name="deskripsi"
            value={deskripsi}
            onChange={(e) => setDeskripsi(e.target.value)}
            required
            disabled={saving}
            placeholder="Jelaskan detail desain yang Anda butuhkan..."
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="departemen">Departemen</Label>
          <Combobox
            data={dataDepartment}
            onChange={setSelectedDepartment}
            defaultValue={selectedDepartment}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="due_date">Due Date</Label>
          <Input
            type="date"
            id="due_date"
            name="due_date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
            disabled={saving}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={status}
            onValueChange={setStatus}
            disabled={saving}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Pilih Status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="admin">Desainer (PIC)</Label>
          <Combobox
            data={[{ label: "Kosong (belum ada)", value: "none" }, ...dataDesigner]}
            onChange={setAdmin}
            defaultValue={admin}
          />
        </div>

        <Button type="submit" disabled={saving} className="w-full">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" /> Simpan Perubahan
            </>
          )}
        </Button>
      </form>
    </Content>
  );
}