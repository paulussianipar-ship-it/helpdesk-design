export interface ProgramKerjaRecord {
  id: string;
  year: number; // e.g. 2026
  division: string; // e.g. "Design & Multimedia"
  quartal: string; // e.g. "Quartal 1", "Quartal 2", "Quartal 3", "Quartal 4"
  quartal_fokus?: string; // e.g. "Audit, Perencanaan, Pra-Produksi"
  program_kerja: string;
  tujuan: string;
  realisasi: string;
  realisasi_aktual: string;
  status: string; // "Planned", "In Progress", "Review", "Done", "Tertunda", etc.
  progress: number; // 0 to 100
  pic: string;
  deadline: string;
  risiko_kendala?: string;
  keterangan?: string;
  created_at?: string;
  updated_at?: string;
}

export const CANONICAL_QUARTALS = [
  "Quartal 1",
  "Quartal 2",
  "Quartal 3",
  "Quartal 4",
] as const;

export function normalizeQuartal(raw: string): string {
  if (!raw) return "Quartal 1";
  const str = String(raw).trim().toLowerCase();
  if (str.includes("1") || str.includes("q1")) return "Quartal 1";
  if (str.includes("2") || str.includes("q2")) return "Quartal 2";
  if (str.includes("3") || str.includes("q3")) return "Quartal 3";
  if (str.includes("4") || str.includes("q4")) return "Quartal 4";
  return "Quartal 1";
}

export function parseQuartalAndFocus(raw: string): { quartal: string; fokus: string } {
  if (!raw) return { quartal: "Quartal 1", fokus: "" };
  const text = String(raw).trim();
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  
  let quartal = normalizeQuartal(lines[0] || text);
  let fokus = "";

  for (const line of lines) {
    if (line.toLowerCase().includes("fokus:")) {
      fokus = line.replace(/fokus:\s*/i, "").trim();
      break;
    }
  }

  // Jika fokus belum ditemukan tapi ada baris kedua
  if (!fokus && lines.length > 1) {
    fokus = lines.slice(1).join(" ").replace(/fokus:\s*/i, "").trim();
  }

  return { quartal, fokus };
}

export function getStatusBadgeVariant(status: string): {
  bg: string;
  text: string;
  border: string;
} {
  const s = (status || "").toLowerCase().trim();
  if (s === "done" || s === "selesai") {
    return {
      bg: "bg-emerald-500/15 dark:bg-emerald-950/40",
      text: "text-emerald-700 dark:text-emerald-400 font-semibold",
      border: "border-emerald-500/30",
    };
  }
  if (s === "in progress" || s === "proses" || s === "on going") {
    return {
      bg: "bg-blue-500/15 dark:bg-blue-950/40",
      text: "text-blue-700 dark:text-blue-400 font-semibold",
      border: "border-blue-500/30",
    };
  }
  if (s === "review" || s === "revisi") {
    return {
      bg: "bg-purple-500/15 dark:bg-purple-950/40",
      text: "text-purple-700 dark:text-purple-300 font-semibold",
      border: "border-purple-500/30",
    };
  }
  if (s === "tertunda" || s === "delayed" || s === "pending") {
    return {
      bg: "bg-rose-500/15 dark:bg-rose-950/40",
      text: "text-rose-700 dark:text-rose-400 font-semibold",
      border: "border-rose-500/30",
    };
  }
  if (s === "belum dimulai" || s === "diisi belakangan") {
    return {
      bg: "bg-amber-500/15 dark:bg-amber-950/40",
      text: "text-amber-700 dark:text-amber-400 font-medium",
      border: "border-amber-500/30",
    };
  }
  return {
    bg: "bg-slate-500/15 dark:bg-slate-900/40",
    text: "text-slate-700 dark:text-slate-300 font-medium",
    border: "border-slate-500/30",
  };
}

export function getQuartalColor(quartal: string): {
  badge: string;
  accent: string;
  pill: string;
} {
  const q = normalizeQuartal(quartal);
  switch (q) {
    case "Quartal 1":
      return {
        badge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800",
        accent: "border-l-blue-500",
        pill: "bg-blue-500 text-white",
      };
    case "Quartal 2":
      return {
        badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800",
        accent: "border-l-amber-500",
        pill: "bg-amber-500 text-white",
      };
    case "Quartal 3":
      return {
        badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800",
        accent: "border-l-emerald-500",
        pill: "bg-emerald-500 text-white",
      };
    case "Quartal 4":
      return {
        badge: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-400 dark:border-purple-800",
        accent: "border-l-purple-500",
        pill: "bg-purple-500 text-white",
      };
    default:
      return {
        badge: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800",
        accent: "border-l-slate-500",
        pill: "bg-slate-500 text-white",
      };
  }
}

export const INITIAL_PROGRAM_KERJA_2026: ProgramKerjaRecord[] = [
  // ==================== QUARTAL 1 ====================
  {
    id: "proker-2026-01",
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 1",
    quartal_fokus: "Audit, Perencanaan, Pra-Produksi",
    program_kerja: "Evaluasi & Audit Aset Digital divisi Desain",
    tujuan: "Evaluasi desain tahun lalu & setup server / folder 2026",
    realisasi: "Audit ulang seluruh folder aset digital",
    realisasi_aktual: "Proses",
    status: "Planned",
    progress: 90,
    pic: "Designer",
    deadline: "Week 2 & 3 Januari",
    risiko_kendala: "",
    keterangan: "",
  },
  {
    id: "proker-2026-02",
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 1",
    quartal_fokus: "Audit, Perencanaan, Pra-Produksi",
    program_kerja: "Implementasi Dashboard tiketing Design",
    tujuan: "Sistem terpusat untuk permintaan desain dengan status jelas submit permintaan dan tracking status",
    realisasi: "Mapping kebutuhan user",
    realisasi_aktual: "Proses",
    status: "Planned",
    progress: 90,
    pic: "Designer",
    deadline: "Week 2 Januari",
    risiko_kendala: "",
    keterangan: "Sudah tahap revisi kolom penilaian",
  },
  {
    id: "proker-2026-03",
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 1",
    quartal_fokus: "Audit, Perencanaan, Pra-Produksi",
    program_kerja: "Photo dan Editing Product AC",
    tujuan: "Project PPA",
    realisasi: "",
    realisasi_aktual: "Proses",
    status: "Planned",
    progress: 90,
    pic: "Designer & Multimedia",
    deadline: "Q1",
    risiko_kendala: "",
    keterangan: "",
  },
  {
    id: "proker-2026-04",
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 1",
    quartal_fokus: "Audit, Perencanaan, Pra-Produksi",
    program_kerja: "Penyusunan Konsep Video Company Profile",
    tujuan: "Contoh dan inspirasi video company profile",
    realisasi: "Riset & Referensi",
    realisasi_aktual: "Tertunda",
    status: "Planned",
    progress: 0,
    pic: "Designer & Multimedia",
    deadline: "Week 3 Januari",
    risiko_kendala: "",
    keterangan: "-",
  },
  {
    id: "proker-2026-05",
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 1",
    quartal_fokus: "Audit, Perencanaan, Pra-Produksi",
    program_kerja: "Penyusunan storyline & Storyboard",
    tujuan: "Pembuatan Storyboard detail sesuai permintaan user",
    realisasi: "Riset & Referensi",
    realisasi_aktual: "Tertunda",
    status: "Planned",
    progress: 0,
    pic: "Designer & Multimedia",
    deadline: "Week 4 Januari",
    risiko_kendala: "",
    keterangan: "",
  },
  {
    id: "proker-2026-06",
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 1",
    quartal_fokus: "Audit, Perencanaan, Pra-Produksi",
    program_kerja: "Produksi Video Company Profile",
    tujuan: "Storyboard detail sesuai permintaan user",
    realisasi: "Mulai shooting hari 1–2\nShooting hari 3–4",
    realisasi_aktual: "Tertunda",
    status: "Planned",
    progress: 0,
    pic: "Multimedia",
    deadline: "Week 1 Februari",
    risiko_kendala: "",
    keterangan: "",
  },
  {
    id: "proker-2026-07",
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 1",
    quartal_fokus: "Audit, Perencanaan, Pra-Produksi",
    program_kerja: "Editing & Post-Production",
    tujuan: "Mengolah hasil shooting menjadi video final",
    realisasi: "pengumpulan foto dan video untuk editing kasar (rough cut)",
    realisasi_aktual: "Tertunda",
    status: "Planned",
    progress: 0,
    pic: "Designer & Multimedia",
    deadline: "Week 2 - 4 Februari",
    risiko_kendala: "",
    keterangan: "",
  },
  {
    id: "proker-2026-08",
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 1",
    quartal_fokus: "Audit, Perencanaan, Pra-Produksi",
    program_kerja: "Review & Approval",
    tujuan: "Review management sebelum go-live",
    realisasi: "Rendering Video untuk review",
    realisasi_aktual: "Tertunda",
    status: "Planned",
    progress: 0,
    pic: "Designer & Multimedia",
    deadline: "Week 3 Februari",
    risiko_kendala: "",
    keterangan: "",
  },
  {
    id: "proker-2026-09",
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 1",
    quartal_fokus: "Audit, Perencanaan, Pra-Produksi",
    program_kerja: "Finalisasi & File Artwork",
    tujuan: "Memastikan video siap dipublikasikan",
    realisasi: "Go-Live sosial media (Instagram, Linkedin, Youtube & Web perusahaan",
    realisasi_aktual: "Tertunda",
    status: "Planned",
    progress: 0,
    pic: "Designer & Multimedia",
    deadline: "Week 4 Februari",
    risiko_kendala: "",
    keterangan: "",
  },
  {
    id: "proker-2026-10",
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 1",
    quartal_fokus: "Audit, Perencanaan, Pra-Produksi",
    program_kerja: "Produksi Konten Bulan K3",
    tujuan: "Menyediakan materi visual K3 yang informatif dan sesuai standar perusahaan",
    realisasi: "Pembuatan Desain Poster K3 untuk Sosial Media",
    realisasi_aktual: "Selesai",
    status: "Planned",
    progress: 100,
    pic: "Designer & Multimedia",
    deadline: "Week 2 Februari - Maret",
    risiko_kendala: "",
    keterangan: "",
  },
  {
    id: "proker-2026-11",
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 1",
    quartal_fokus: "Audit, Perencanaan, Pra-Produksi",
    program_kerja: "Pembuatan Iklan Product Batch 1",
    tujuan: "Meningkatkan awareness dan engagement produk",
    realisasi: "Brief dari Marketing product yang di iklan kan Q2 - Q4\nPembuatan konsep visual & copy\nProduksi Iklan Batch 1",
    realisasi_aktual: "Selesai",
    status: "Planned",
    progress: 100,
    pic: "Designer & Multimedia",
    deadline: "Week 3 - 4 Maret",
    risiko_kendala: "",
    keterangan: "Tayang Week 1 April",
  },
  {
    id: "proker-2026-12",
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 1",
    quartal_fokus: "Audit, Perencanaan, Pra-Produksi",
    program_kerja: "Laporan Quartal 1",
    tujuan: "Review Performa Visual Q1 & Traffic Kerja",
    realisasi: "Evaluasi keseluruhan program kerja dan hasil kreatif",
    realisasi_aktual: "Diisi belakangan",
    status: "Planned",
    progress: 0,
    pic: "Designer",
    deadline: "Week 4 Maret",
    risiko_kendala: "",
    keterangan: "",
  },

  // ==================== QUARTAL 2 ====================
  {
    id: "proker-2026-13",
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 2",
    quartal_fokus: "Iklan & Konten",
    program_kerja: "Tayang Iklan Product Batch 1",
    tujuan: "Meningkatkan awareness dan engagement produk",
    realisasi: "Go-Live Batch 1",
    realisasi_aktual: "Diisi belakangan",
    status: "Planned",
    progress: 0,
    pic: "Multimedia",
    deadline: "Tayang Week ke 1",
    risiko_kendala: "",
    keterangan: "",
  },
  {
    id: "proker-2026-14",
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 2",
    quartal_fokus: "Iklan & Konten",
    program_kerja: "Photo dan Editing Product AC",
    tujuan: "Project PPA",
    realisasi: "",
    realisasi_aktual: "Diisi belakangan",
    status: "Planned",
    progress: 0,
    pic: "Designer & Multimedia",
    deadline: "Q2",
    risiko_kendala: "",
    keterangan: "",
  },
  {
    id: "proker-2026-15",
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 2",
    quartal_fokus: "Iklan & Konten",
    program_kerja: "Brief dengan Marketing untuk pembuatan Konten Marketing",
    tujuan: "Mendorong aktivitas engagement saat periode aktivitas bisnis meningkat",
    realisasi: "Pembuatan 6 konten promo (2 per bulan) Blasting by email & Whatsapp",
    realisasi_aktual: "Diisi belakangan",
    status: "Planned",
    progress: 0,
    pic: "Designer & Multimedia",
    deadline: "Week 1 & 3 April - Juni",
    risiko_kendala: "",
    keterangan: "Submit Per Senin Minggu ke 2 & Ke 4 Q2 (April-Juni)",
  },
  {
    id: "proker-2026-16",
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 2",
    quartal_fokus: "Iklan & Konten",
    program_kerja: "Pembuatan Iklan Product Batch 2",
    tujuan: "Menyediakan materi promo untuk pertengahan Q3",
    realisasi: "Revisi konsep visual & copy\nProduksi Iklan Batch 2",
    realisasi_aktual: "Diisi belakangan",
    status: "Planned",
    progress: 0,
    pic: "Designer & Multimedia",
    deadline: "Week 2 April - Juni",
    risiko_kendala: "",
    keterangan: "Submit Per Senin Minggu ke 2 Q2 (April-Juni)",
  },
  {
    id: "proker-2026-17",
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 2",
    quartal_fokus: "Iklan & Konten",
    program_kerja: "Produksi Konten Bulan K3",
    tujuan: "Menyediakan materi visual K3 yang informatif dan sesuai standar perusahaan",
    realisasi: "Pembuatan Desain Poster K3 untuk Sosial Media",
    realisasi_aktual: "Diisi belakangan",
    status: "Planned",
    progress: 100,
    pic: "Designer & Multimedia",
    deadline: "Week 2 April - Juni",
    risiko_kendala: "",
    keterangan: "",
  },
  {
    id: "proker-2026-18",
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 2",
    quartal_fokus: "Iklan & Konten",
    program_kerja: "Laporan Quartal 2",
    tujuan: "Review Performa Visual Q2 & Traffic Kerja",
    realisasi: "Evaluasi keseluruhan program kerja dan hasil kreatif",
    realisasi_aktual: "Diisi belakangan",
    status: "Planned",
    progress: 0,
    pic: "Designer",
    deadline: "Week 4 Juni",
    risiko_kendala: "",
    keterangan: "",
  },

  // ==================== QUARTAL 3 ====================
  {
    id: "proker-2026-19",
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 3",
    quartal_fokus: "Katalog, Kalender & Kampanye",
    program_kerja: "Photo dan Editing Product AC (Fitiing & Part AC)",
    tujuan: "Catalog AC Product",
    realisasi: "Foto produk & design Catalog",
    realisasi_aktual: "Proses",
    status: "In Progress",
    progress: 90,
    pic: "Designer & Multimedia",
    deadline: "Week 2 Juli - September",
    risiko_kendala: "",
    keterangan: "Pending Foto dari Side, & untuk Fitting AC proses foto & Editing",
  },
  {
    id: "proker-2026-20",
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 3",
    quartal_fokus: "Katalog, Kalender & Kampanye",
    program_kerja: "Deadstock GIS",
    tujuan: "Catalog Product DS",
    realisasi: "Foto produk & design Catalog",
    realisasi_aktual: "Selesai",
    status: "Review",
    progress: 100,
    pic: "Designer",
    deadline: "Q3",
    risiko_kendala: "",
    keterangan: "",
  },
  {
    id: "proker-2026-21",
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 3",
    quartal_fokus: "Katalog, Kalender & Kampanye",
    program_kerja: "Deadstock GMI",
    tujuan: "Catalog Product DS",
    realisasi: "Foto produk & design Catalog",
    realisasi_aktual: "Selesai",
    status: "Done",
    progress: 100,
    pic: "Designer",
    deadline: "Q3",
    risiko_kendala: "",
    keterangan: "",
  },
  {
    id: "proker-2026-22",
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 3",
    quartal_fokus: "Katalog, Kalender & Kampanye",
    program_kerja: "Deadstock GMI (Penghapusan Price)",
    tujuan: "Catalog Product DS",
    realisasi: "Foto produk & design Catalog",
    realisasi_aktual: "Proses",
    status: "Done",
    progress: 100,
    pic: "Designer",
    deadline: "Q3",
    risiko_kendala: "",
    keterangan: "Harga Dihapus",
  },
  {
    id: "proker-2026-23",
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 3",
    quartal_fokus: "Katalog, Kalender & Kampanye",
    program_kerja: "Deadstock Lourdes",
    tujuan: "Catalog Product DS",
    realisasi: "Foto produk & design Catalog",
    realisasi_aktual: "Belum dimulai",
    status: "Planned",
    progress: 0,
    pic: "Designer",
    deadline: "Q3",
    risiko_kendala: "",
    keterangan: "Menunggu Update Produk dari Purchasing",
  },
  {
    id: "proker-2026-24",
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 3",
    quartal_fokus: "Katalog, Kalender & Kampanye",
    program_kerja: "Brief dengan Marketing untuk pembuatan Konten Marketing",
    tujuan: "Mendukung kampanye semester 2 & menjaga konsistensi branding",
    realisasi: "Pembuatan 21 Poster Blasting by email & Whatsapp",
    realisasi_aktual: "Selesai",
    status: "Done",
    progress: 100,
    pic: "Designer & Multimedia",
    deadline: "Week 1 & 3 Juli - September",
    risiko_kendala: "",
    keterangan: "Masih menunggu feedback database klien dari Marketing",
  },
  {
    id: "proker-2026-25",
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 3",
    quartal_fokus: "Katalog, Kalender & Kampanye",
    program_kerja: "Pembuatan Kalender 2027 GIS & GMI",
    tujuan: "Kalender tahunan (Include Product)",
    realisasi: "Pengumpulan image product untuk di kalendar\nProgress ke Marketing",
    realisasi_aktual: "Proses",
    status: "In Progress",
    progress: 90,
    pic: "Designer & Multimedia",
    deadline: "Week 2 Juli - September",
    risiko_kendala: "",
    keterangan: "Review Product per month dari Marketing",
  },
  {
    id: "proker-2026-26",
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 3",
    quartal_fokus: "Katalog, Kalender & Kampanye",
    program_kerja: "Produksi Poster K3",
    tujuan: "Menyediakan materi visual K3 yang informatif dan sesuai standar perusahaan",
    realisasi: "Pembuatan Desain Poster K3 untuk Sosial Media & WA Group",
    realisasi_aktual: "Selesai",
    status: "Done",
    progress: 100,
    pic: "Designer & Multimedia",
    deadline: "Week 2 Juli - September",
    risiko_kendala: "",
    keterangan: "",
  },
  {
    id: "proker-2026-27",
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 3",
    quartal_fokus: "Katalog, Kalender & Kampanye",
    program_kerja: "Produksi Konten K3",
    tujuan: "Menyediakan Video visual K3 yang informatif dan sesuai standar perusahaan",
    realisasi: "Pembuatan Video Konten K3 untuk Sosial Media",
    realisasi_aktual: "Selesai",
    status: "Done",
    progress: 100,
    pic: "Designer & Multimedia",
    deadline: "Week 2 Juli - September",
    risiko_kendala: "",
    keterangan: "",
  },
  {
    id: "proker-2026-28",
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 3",
    quartal_fokus: "Katalog, Kalender & Kampanye",
    program_kerja: "Laporan Quartal 3",
    tujuan: "Review Performa Visual Q3 & Traffic Kerja",
    realisasi: "Evaluasi keseluruhan program kerja dan hasil kreatif",
    realisasi_aktual: "Diisi belakangan",
    status: "Planned",
    progress: 100,
    pic: "Designer",
    deadline: "Week 4 September",
    risiko_kendala: "",
    keterangan: "",
  },

  // ==================== QUARTAL 4 ====================
  {
    id: "proker-2026-29",
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 4",
    quartal_fokus: "Penutupan, Mini Catalog & Proker Baru",
    program_kerja: "Deadstock GIS Lanjutan",
    tujuan: "Catalog Product DS",
    realisasi: "Foto produk & design Catalog",
    realisasi_aktual: "Proses",
    status: "In Progress",
    progress: 70,
    pic: "Designer & Multimedia",
    deadline: "Week 2 Oktober - Desember",
    risiko_kendala: "Menunggu Warehouse GIS Idle",
    keterangan: "Menunggu Warehouse GIS Idle",
  },
  {
    id: "proker-2026-30",
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 4",
    quartal_fokus: "Penutupan, Mini Catalog & Proker Baru",
    program_kerja: "Deadstock Lourdes",
    tujuan: "Catalog Product DS",
    realisasi: "Foto produk & design Catalog",
    realisasi_aktual: "Belum dimulai",
    status: "Planned",
    progress: 0,
    pic: "Designer",
    deadline: "Q3",
    risiko_kendala: "Menunggu Update Produk dari Purchasing",
    keterangan: "Menunggu Update Produk dari Purchasing",
  },
  {
    id: "proker-2026-31",
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 4",
    quartal_fokus: "Penutupan, Mini Catalog & Proker Baru",
    program_kerja: "Pembuatan Mini Catalog per Commodity untuk Marketing",
    tujuan: "Promosi Produk",
    realisasi: "Revisi konsep visual & Produk",
    realisasi_aktual: "Proses",
    status: "In Progress",
    progress: 70,
    pic: "Designer & Multimedia",
    deadline: "Week 4 Oktober - Desember",
    risiko_kendala: "",
    keterangan: "Submit Per Senin Minggu ke 4 (Oktober-Desember)",
  },
  {
    id: "proker-2026-32",
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 4",
    quartal_fokus: "Penutupan, Mini Catalog & Proker Baru",
    program_kerja: "Produksi Konten Bulan K3",
    tujuan: "Menyediakan materi visual K3 yang informatif dan sesuai standar perusahaan",
    realisasi: "Pembuatan Desain Poster K3 untuk Sosial Media",
    realisasi_aktual: "Diisi belakangan",
    status: "Planned",
    progress: 0,
    pic: "Designer & Multimedia",
    deadline: "Week 2 Oktober - Desember",
    risiko_kendala: "",
    keterangan: "",
  },
  {
    id: "proker-2026-33",
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 4",
    quartal_fokus: "Penutupan, Mini Catalog & Proker Baru",
    program_kerja: "Program Kerja Tahunan",
    tujuan: "Untuk program kerja yang teratur",
    realisasi: "Pembuatan konsep Proker dengan tim",
    realisasi_aktual: "Diisi belakangan",
    status: "Planned",
    progress: 0,
    pic: "Designer",
    deadline: "Week 3 November - Week 4 Desember",
    risiko_kendala: "",
    keterangan: "",
  },
  {
    id: "proker-2026-34",
    year: 2026,
    division: "Design & Multimedia",
    quartal: "Quartal 4",
    quartal_fokus: "Penutupan, Mini Catalog & Proker Baru",
    program_kerja: "Laporan Quartal 4",
    tujuan: "Review Performa Visual Q4 & Traffic Kerja",
    realisasi: "Evaluasi keseluruhan program kerja dan hasil kreatif",
    realisasi_aktual: "Diisi belakangan",
    status: "Planned",
    progress: 0,
    pic: "Designer",
    deadline: "Week 4 Desember",
    risiko_kendala: "",
    keterangan: "",
  },
];
