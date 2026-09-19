"use client";

import { Content } from "@/components/content";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Loader2,
  Save,
  ShieldAlert,
  ShieldCheck,
  User,
  Building2,
  Mail,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

const ROLE_OPTIONS = [
  { label: "Admin", value: "admin" },
  { label: "User", value: "user" },
];

const DEPARTMENT_OPTIONS = [
  "General Affair",
  "Marketing",
  "Manufacture",
  "HR",
  "HR/GA",
  "HSE",
  "IT",
  "Finance",
  "SCM",
  "Warehouse",
  "Purchasing",
  "Service",
  "General Manager",
  "Executive Manager",
  "Boards of Director",
  "Design",
];

interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string;
}

export default function EditUserPage({
  params,
}: {
  params: Promise<{ userid: string }>;
}) {
  const { userid } = React.use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<UserData | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [role, setRole] = useState("user");
  const [department, setDepartment] = useState("General Affair");
  const [customDept, setCustomDept] = useState("");

  useEffect(() => {
    async function loadUser() {
      setLoading(true);
      try {
        const res = await fetch(`/api/user-management/${userid}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }

        const json = await res.json();
        const u = json.data;
        if (!u) throw new Error("Pengguna tidak ditemukan");

        setUser(u);
        setName(u.name || "");
        setRole(u.role || "user");

        if (u.department && DEPARTMENT_OPTIONS.includes(u.department)) {
          setDepartment(u.department);
          setCustomDept("");
        } else if (u.department && u.department !== "-") {
          setDepartment("Lainnya");
          setCustomDept(u.department);
        } else {
          setDepartment("General Affair");
          setCustomDept("");
        }
      } catch (err: any) {
        toast.error("Gagal memuat pengguna: " + err.message);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [userid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nama pengguna tidak boleh kosong");
      return;
    }

    const finalDept = department === "Lainnya" && customDept.trim() ? customDept.trim() : department;

    setSaving(true);
    try {
      const res = await fetch(`/api/user-management/${userid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          role,
          department: finalDept,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memperbarui profil");

      toast.success("Profil pengguna berhasil diperbarui!");
      router.push("/user-management");
    } catch (err: any) {
      toast.error("Gagal menyimpan: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Content size="md" title="Edit Profil Pengguna">
        <div className="flex h-48 flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm">Memuat informasi pengguna...</p>
        </div>
      </Content>
    );
  }

  if (!user) {
    return (
      <Content size="md" title="Pengguna Tidak Ditemukan">
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">
            Pengguna dengan ID tersebut tidak ditemukan dalam sistem.
          </p>
          <Button variant="outline" asChild>
            <Link href="/user-management">
              <ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke User Management
            </Link>
          </Button>
        </div>
      </Content>
    );
  }

  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : user.email.slice(0, 2).toUpperCase();

  return (
    <Content size="md">
      <div className="space-y-6">
        {/* TOP BAR */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground">
            <Link href="/user-management">
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Daftar
            </Link>
          </Button>

          <Badge variant={role === "admin" ? "default" : "outline"} className="gap-1">
            {role === "admin" ? <ShieldCheck className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
            {role === "admin" ? "Admin" : "User"}
          </Badge>
        </div>

        {/* PROFILE HEADER CARD */}
        <div className="flex items-center gap-4 p-4 rounded-lg border bg-muted/30">
          <Avatar className="h-14 w-14 border-2 border-background shadow-sm text-base font-bold">
            <AvatarFallback className={role === "admin" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold" : "bg-primary/10 text-primary"}>
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-1">
            <h2 className="text-lg font-bold text-foreground leading-none truncate">{name || user.email}</h2>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 truncate">{user.email}</span>
            </div>
            <p className="text-xs text-muted-foreground font-mono truncate">ID: {user.id}</p>
          </div>
        </div>

        {/* EDIT FORM */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nama Lengkap */}
          <div className="space-y-1.5">
            <Label htmlFor="user-name" className="text-sm font-semibold">
              Nama Lengkap <span className="text-destructive">*</span>
            </Label>
            <Input
              id="user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Paulus Sianipar"
              required
            />
          </div>

          {/* Email (Readonly info) */}
          <div className="space-y-1.5">
            <Label htmlFor="user-email" className="text-sm font-semibold text-muted-foreground">
              Email Akun (Sistem)
            </Label>
            <Input
              id="user-email"
              value={user.email}
              disabled
              className="bg-muted/50 cursor-not-allowed"
            />
          </div>

          {/* Role & Departemen Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Role */}
            <div className="space-y-1.5">
              <Label htmlFor="user-role" className="text-sm font-semibold">
                Hak Akses (Role)
              </Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="user-role" className="w-full">
                  <SelectValue placeholder="Pilih Role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Departemen */}
            <div className="space-y-1.5">
              <Label htmlFor="user-dept" className="text-sm font-semibold">
                Departemen
              </Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger id="user-dept" className="w-full">
                  <SelectValue placeholder="Pilih Departemen" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {DEPARTMENT_OPTIONS.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                  <SelectItem value="Lainnya">Lainnya...</SelectItem>
                </SelectContent>
              </Select>

              {department === "Lainnya" && (
                <Input
                  className="mt-2"
                  placeholder="Ketikkan nama departemen..."
                  value={customDept}
                  onChange={(e) => setCustomDept(e.target.value)}
                  required
                />
              )}
            </div>
          </div>

          {/* FOOTER BUTTONS */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/user-management")}
              disabled={saving}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="gap-1.5 bg-primary text-primary-foreground"
            >
              {saving ? (
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
          </div>
        </form>
      </div>
    </Content>
  );
}
