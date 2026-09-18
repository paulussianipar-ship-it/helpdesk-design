"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

export interface EditPermintaanItem {
  id: string;
  judul: string;
  project?: string;
  departemen?: string;
  status: string;
  due_date: string;
  deskripsi?: string;
  admin?: string | null;
  admin_name?: string;
}

interface EditPermintaanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: EditPermintaanItem | null;
  onSuccess: () => void;
}

const PROJECT_OPTIONS = [
  "Design Poster",
  "Design Sertifikat",
  "Design Flyer",
  "Design Brosur",
  "Design Kemasan",
  "Design Catalog",
  "Design Mini Catalog",
  "Design File Presentasi",
  "Design Label",
  "Design Stiker",
  "Photo Event",
  "Photo Product",
  "Photo Instalasi",
  "Video Event",
  "Video Product",
  "Video Instlasi",
  "Lainnya",
];

const DEPARTMENT_OPTIONS = [
  "Manufacture",
  "HR",
  "HSE",
  "K3",
  "IT",
  "Finance",
  "Logistik",
  "Purchasing",
  "Warehouse",
  "Service",
  "General Manager",
  "Executive Manager",
  "Boards of Director",
  "Marketing",
  "Lainnya",
];

const DESIGNER_OPTIONS = [
  { id: "bcfdf89c-d1e2-4602-80aa-005a1beb1d3c", name: "Paulus Sianipar" },
  { id: "54e6f310-813b-447b-aac0-9052423440da", name: "Farel Ramadhan" },
];

const STATUS_OPTIONS = ["TO DO", "PROGRESS", "REVIEW", "REVISION", "DONE"];

export function EditPermintaanDialog({
  open,
  onOpenChange,
  item,
  onSuccess,
}: EditPermintaanDialogProps) {
  const [judul, setJudul] = useState("");
  const [project, setProject] = useState("");
  const [departemen, setDepartemen] = useState("");
  const [admin, setAdmin] = useState<string>("");
  const [status, setStatus] = useState("TO DO");
  const [dueDate, setDueDate] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [customProject, setCustomProject] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setJudul(item.judul || "");

      // Setup Project
      if (item.project) {
        if (PROJECT_OPTIONS.includes(item.project)) {
          setProject(item.project);
          setCustomProject("");
        } else {
          setProject("Lainnya");
          setCustomProject(item.project);
        }
      } else {
        setProject("Design Poster");
        setCustomProject("");
      }

      // Setup Department
      setDepartemen(item.departemen || "Manufacture");

      // Setup Admin/Designer
      setAdmin(item.admin || "unassigned");

      // Setup Status
      setStatus(item.status || "TO DO");

      // Setup Due Date (format: YYYY-MM-DD)
      if (item.due_date) {
        try {
          const d = new Date(item.due_date);
          if (!isNaN(d.getTime())) {
            setDueDate(d.toISOString().split("T")[0]);
          } else {
            setDueDate(item.due_date.slice(0, 10));
          }
        } catch {
          setDueDate("");
        }
      } else {
        setDueDate("");
      }

      // Setup Deskripsi
      setDeskripsi(item.deskripsi || "");
    }
  }, [item, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;

    if (!judul.trim()) {
      toast.error("Judul permintaan tidak boleh kosong");
      return;
    }

    const finalProject = project === "Lainnya" && customProject.trim() ? customProject.trim() : project;

    setIsSaving(true);
    try {
      const res = await fetch("/api/permintaan", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: item.id,
          judul: judul.trim(),
          project: finalProject,
          departemen: departemen,
          admin: admin === "unassigned" ? null : admin,
          status: status,
          due_date: dueDate ? new Date(dueDate).toISOString() : null,
          deskripsi: deskripsi.trim(),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }

      toast.success("Permintaan desain berhasil diperbarui!");
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      console.error("Update permintaan error:", err);
      toast.error("Gagal menyimpan perubahan: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Edit Permintaan Desain</DialogTitle>
          <DialogDescription>
            Perbarui detail tiket permintaan desain. Perubahan akan disinkronkan secara langsung.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Judul */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-judul" className="text-sm font-semibold">
              Judul Permintaan <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-judul"
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
              placeholder="Contoh: Design Poster HUT RI ke-81"
              required
            />
          </div>

          {/* Grid: Jenis Proyek & Departemen */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Jenis Proyek */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-project" className="text-sm font-semibold">
                Jenis Proyek
              </Label>
              <Select value={project} onValueChange={setProject}>
                <SelectTrigger id="edit-project" className="w-full">
                  <SelectValue placeholder="Pilih Jenis Proyek" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {PROJECT_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {project === "Lainnya" && (
                <Input
                  className="mt-2"
                  placeholder="Ketikkan jenis proyek lain..."
                  value={customProject}
                  onChange={(e) => setCustomProject(e.target.value)}
                />
              )}
            </div>

            {/* Departemen */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-departemen" className="text-sm font-semibold">
                Departemen
              </Label>
              <Select value={departemen} onValueChange={setDepartemen}>
                <SelectTrigger id="edit-departemen" className="w-full">
                  <SelectValue placeholder="Pilih Departemen" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {DEPARTMENT_OPTIONS.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Grid: Desainer & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Desainer */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-designer" className="text-sm font-semibold">
                Desainer Ditugaskan
              </Label>
              <Select value={admin} onValueChange={setAdmin}>
                <SelectTrigger id="edit-designer" className="w-full">
                  <SelectValue placeholder="Pilih Desainer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">-- Belum Ditugaskan --</SelectItem>
                  {DESIGNER_OPTIONS.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-status" className="text-sm font-semibold">
                Status Pengerjaan
              </Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="edit-status" className="w-full">
                  <SelectValue placeholder="Pilih Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((st) => (
                    <SelectItem key={st} value={st}>
                      {st}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Target Selesai (Due Date) */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-due-date" className="text-sm font-semibold">
              Target Selesai (Due Date)
            </Label>
            <Input
              id="edit-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {/* Deskripsi */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-deskripsi" className="text-sm font-semibold">
              Deskripsi & Catatan Permintaan
            </Label>
            <Textarea
              id="edit-deskripsi"
              rows={4}
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              placeholder="Rincian informasi, ukuran, materi, atau catatan tambahan..."
            />
          </div>

          <DialogFooter className="pt-3 flex items-center justify-end gap-2 border-t mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-primary text-primary-foreground flex items-center gap-1.5"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Simpan Perubahan
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
