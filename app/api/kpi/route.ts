import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  getAttendanceSeedForPeriod,
} from "@/lib/attendance-seed";
import {
  getStbHseSeedForPeriod,
  calculatePersonStats,
  getDaysInMonth,
  isWeekend,
  type StbHseRosterRecord,
} from "@/lib/stb-hse-seed";

export const dynamic = "force-dynamic";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function formatPeriodMonth(period: string): string {
  if (!period || !period.includes("-")) return period || "-";
  const [year, month] = period.split("-");
  return `${MONTH_NAMES_ID[parseInt(month, 10) - 1] || month} ${year}`;
}

/** Hitung jumlah hari kerja (Senin–Jumat) dalam sebulan */
function countWorkingDays(year: number, month: number): number {
  const total = getDaysInMonth(year, month);
  let count = 0;
  for (let d = 1; d <= total; d++) {
    if (!isWeekend(year, month, d)) count++;
  }
  return count;
}

/** Definisi KPI rows (hardcoded sesuai lampiran tabel) */
export interface KpiRow {
  id: string;
  no: number;
  perspektif_bsc: string;
  strategy: string;
  tujuan_strategi: string;
  area_kinerja_utama: string;
  kpi: string;
  bobot: number;         // %
  polarity: "Max" | "Min";
  cap: number;           // %
  target: number;        // %
  keterangan: string;
  realisasi: number | null; // % — dihitung dari data aktual
  skor: number | null;      // = min(realisasi/target, cap) * bobot
  nilai_akhir: number | null;
  cara_pengukuran: string;
  data_source: string;
  note: string;
  // Raw context untuk debugging
  raw?: Record<string, any>;
}

const KPI_DEFINITIONS: Omit<KpiRow, "realisasi" | "skor" | "nilai_akhir" | "raw">[] = [
  {
    id: "kpi-1",
    no: 1,
    perspektif_bsc: "Learning & Growth",
    strategy: "Meningkatkan kompetensi dan keterlibatan tim melalui pelatihan dan pengembangan skill",
    tujuan_strategi: "Tingkat partisipasi karyawan dalam kegiatan pelatihan dan pengembangan",
    area_kinerja_utama: "Pelatihan",
    kpi: "Persentase hari kerja dengan aktivitas tercatat (Daily Activity Done)",
    bobot: 15,
    polarity: "Max",
    cap: 100,
    target: 100,
    keterangan: "Persentase",
    cara_pengukuran: "Jumlah hari kerja yang memiliki minimal 1 entri Daily Activity Done / Total hari kerja × 100%",
    data_source: "Daily Activity",
    note: "A1",
  },
  {
    id: "kpi-2",
    no: 2,
    perspektif_bsc: "Internal Process",
    strategy: "Meningkatkan efisiensi penyelesaian tiket desain dan kualitas output",
    tujuan_strategi: "Persentase tiket permintaan desain yang berhasil diselesaikan (Done)",
    area_kinerja_utama: "IT",
    kpi: "Persentase tiket Permintaan Desain berstatus Done",
    bobot: 15,
    polarity: "Max",
    cap: 100,
    target: 100,
    keterangan: "Persentase",
    cara_pengukuran: "Jumlah tiket DONE / Total tiket bulan × 100%",
    data_source: "Permintaan Desain",
    note: "A1",
  },
  {
    id: "kpi-3",
    no: 3,
    perspektif_bsc: "Internal Process",
    strategy: "Meningkatkan ketepatan waktu penyelesaian permintaan desain",
    tujuan_strategi: "Persentase tiket permintaan desain selesai tepat waktu (sebelum due date)",
    area_kinerja_utama: "Tiket Tepat Waktu",
    kpi: "Persentase tiket DONE diselesaikan sebelum atau tepat pada due date",
    bobot: 25,
    polarity: "Max",
    cap: 100,
    target: 100,
    keterangan: "Persentase",
    cara_pengukuran: "Jumlah tiket DONE & selesai ≤ due date / Total tiket DONE bulan × 100%",
    data_source: "Permintaan Desain",
    note: "A1",
  },
  {
    id: "kpi-4",
    no: 4,
    perspektif_bsc: "Internal Process",
    strategy: "Memastikan pencatatan aktivitas harian tim secara konsisten dan akurat",
    tujuan_strategi: "Persentase hari kerja dengan pelaporan Daily Activity lengkap",
    area_kinerja_utama: "Area Efisiensi, dll",
    kpi: "Total keseluruhan entri Daily Activity yang terlaporkan",
    bobot: 5,
    polarity: "Max",
    cap: 100,
    target: 50,
    keterangan: "Persentase",
    cara_pengukuran: "Total entri daily activity bulan ini / target minimum entri × 100%",
    data_source: "Daily Activity",
    note: "A1",
  },
  {
    id: "kpi-5",
    no: 5,
    perspektif_bsc: "Internal Process",
    strategy: "Menjaga tingkat kehadiran tim untuk memastikan operasional berjalan lancar",
    tujuan_strategi: "Persentase kehadiran karyawan (status hadir / total hari kerja)",
    area_kinerja_utama: "Data",
    kpi: "Tingkat kehadiran karyawan (Attendance Rate)",
    bobot: 25,
    polarity: "Max",
    cap: 100,
    target: 88,
    keterangan: "Persentase",
    cara_pengukuran: "Jumlah hari hadir (status PRS/EAI) / Total hari kerja bulan × 100%",
    data_source: "Attendance",
    note: "A1",
  },
  {
    id: "kpi-6",
    no: 6,
    perspektif_bsc: "Internal Process",
    strategy: "Memastikan jadwal STB HSE terpenuhi untuk keamanan dan kepatuhan K3",
    tujuan_strategi: "Persentase pemenuhan jadwal standby HSE sesuai roster yang telah ditetapkan",
    area_kinerja_utama: "Resource",
    kpi: "Tingkat pemenuhan roster standby HSE (STB HSE)",
    bobot: 10,
    polarity: "Max",
    cap: 100,
    target: 100,
    keterangan: "Persentase",
    cara_pengukuran: "Jumlah hari standby terpenuhi (ada entri H/h) / Total hari wajib standby roster × 100%",
    data_source: "STB HSE",
    note: "A1",
  },
  {
    id: "kpi-7",
    no: 7,
    perspektif_bsc: "Learning & Growth",
    strategy: "Mendokumentasikan seluruh kegiatan melalui program pembelajaran dan tinjauan rutin",
    tujuan_strategi: "Mencapai target pembelajaran dan pengembangan melalui kegiatan yang terdokumentasi",
    area_kinerja_utama: "Tingkat Kepuasan & Program",
    kpi: "Tingkat pemenuhan program kerja bulanan dan tinjauan kepuasan",
    bobot: 5,
    polarity: "Max",
    cap: 100,
    target: 50,
    keterangan: "Persentase",
    cara_pengukuran: "Jumlah program kerja terlaksana / Target program kerja bulan × 100%, dinilai dari data Daily Activity Done",
    data_source: "Daily Activity",
    note: "A1",
  },
];

export async function GET(request: NextRequest) {
  try {
    const supabase = getAdminClient();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") || "";

    // Tentukan range bulan
    let year = new Date().getFullYear();
    let monthNum = new Date().getMonth() + 1;

    if (month && month !== "all") {
      const [y, m] = month.split("-");
      year = parseInt(y, 10);
      monthNum = parseInt(m, 10);
    }

    const periodStr = `${year}-${String(monthNum).padStart(2, "0")}`;
    const lastDay = getDaysInMonth(year, monthNum);
    const startDate = `${periodStr}-01`;
    const endDate = `${periodStr}-${String(lastDay).padStart(2, "0")}`;
    const startISO = `${periodStr}-01T00:00:00.000Z`;
    const endISO = `${periodStr}-${String(lastDay).padStart(2, "0")}T23:59:59.999Z`;

    const workingDays = countWorkingDays(year, monthNum);

    // ================================================================
    // 1. PERMINTAAN DESAIN
    // ================================================================
    const { data: permintaanData } = await supabase
      .from("permintaan")
      .select("id, created_at, updated_at, due_date, status")
      .gte("created_at", startISO)
      .lte("created_at", endISO);

    const permintaanList = permintaanData || [];
    const totalPermintaan = permintaanList.length;
    const donePermintaan = permintaanList.filter(
      (t: any) => (t.status || "").toUpperCase() === "DONE"
    ).length;

    // Hitung on-time: tiket DONE yang diselesaikan ≤ due_date
    let onTimePermintaan = 0;
    for (const t of permintaanList) {
      const status = (t.status || "").toUpperCase();
      if (status !== "DONE") continue;
      if (!t.due_date) {
        onTimePermintaan++; // Jika tidak ada due date, anggap on-time
        continue;
      }
      const updatedAt = t.updated_at ? new Date(t.updated_at) : null;
      const dueDate = new Date(t.due_date);
      // Bandingkan tanggal saja (YYYY-MM-DD)
      const dueTs = dueDate.getTime() + 24 * 3600 * 1000; // end of due date
      if (updatedAt && updatedAt.getTime() <= dueTs) {
        onTimePermintaan++;
      } else if (!updatedAt) {
        onTimePermintaan++; // No updated_at, assume on-time
      }
    }

    // ================================================================
    // 2. DAILY ACTIVITY
    // ================================================================
    const { data: dailyData } = await supabase
      .from("daily_activities")
      .select("id, activity_date, status, task_description, name")
      .gte("activity_date", startDate)
      .lte("activity_date", endDate);

    const dailyList = dailyData || [];
    const totalDailyEntries = dailyList.length;

    // Hitung hari unik yang memiliki aktivitas Done
    const daysWithDoneActivity = new Set<string>();
    const daysWithAnyActivity = new Set<string>();
    for (const d of dailyList) {
      if (d.activity_date) {
        daysWithAnyActivity.add(d.activity_date);
        const s = (d.status || "").toLowerCase();
        if (s.includes("done") || s.includes("selesai") || s.includes("✅")) {
          daysWithDoneActivity.add(d.activity_date);
        }
      }
    }

    // ================================================================
    // 3. ATTENDANCE
    // ================================================================
    // Coba ambil dari Supabase dulu
    let attendanceList: any[] = [];
    try {
      const { data: attDb } = await supabase
        .from("attendance")
        .select("*")
        .eq("period_month", periodStr);
      if (attDb && attDb.length > 0) {
        attendanceList = attDb;
      }
    } catch {
      // ignore
    }

    // Fallback ke seed jika tidak ada data di DB
    if (attendanceList.length === 0) {
      const seedAtt = getAttendanceSeedForPeriod(periodStr);
      attendanceList = seedAtt;
    }

    // Hitung kehadiran: status yang mengandung "PRS" atau "EAI" dianggap hadir
    const presentDays = attendanceList.filter((a: any) => {
      const status = (a.status || "").toUpperCase();
      return status.includes("PRS") || status.includes("EAI");
    }).length;

    // Hitung unique employees untuk menentukan total hari kerja expected
    const uniqueEmployees = new Set(attendanceList.map((a: any) => a.name || a.employee_no));
    const employeeCount = uniqueEmployees.size || 2;
    const expectedAttendanceDays = workingDays * employeeCount;

    // ================================================================
    // 4. STB HSE ROSTER
    // ================================================================
    let stbList: StbHseRosterRecord[] = [];
    try {
      const { data: stbDb, error: stbError } = await supabase
        .from("stb_hse_roster")
        .select("*")
        .eq("period_month", periodStr);
      if (!stbError && stbDb && stbDb.length > 0) {
        stbList = stbDb as StbHseRosterRecord[];
      }
    } catch {
      // ignore
    }

    // Fallback ke seed
    if (stbList.length === 0) {
      stbList = getStbHseSeedForPeriod(periodStr);
    }

    // Hitung pemenuhan roster: total hari ada entry H atau h / total hari yg harusnya ada standby
    let totalStandbyDays = 0; // Total expected standby hari (entri H/h yg diisi di roster)
    let fulfilledStandbyDays = 0; // Entri H/h yang ada
    for (const person of stbList) {
      const stats = calculatePersonStats(person.schedule || {});
      totalStandbyDays += stats.totalStandby;
      fulfilledStandbyDays += stats.totalStandby; // Semua yang tercatat sudah terpenuhi
    }

    // Hitung expected standby days (Senin + Kamis dalam bulan)
    let expectedStandbyDays = 0;
    for (let d = 1; d <= lastDay; d++) {
      const dow = new Date(year, monthNum - 1, d).getDay();
      if (dow === 1 || dow === 4) expectedStandbyDays++; // Senin dan Kamis
    }
    // Per orang: expected = expectedStandbyDays, total 2 orang
    const totalExpectedStandby = expectedStandbyDays * (stbList.length || 2);

    // ================================================================
    // HITUNG REALISASI DAN SKOR
    // ================================================================
    const realisasiMap: Record<string, number | null> = {
      "kpi-1": workingDays > 0
        ? Math.min(100, Math.round((daysWithDoneActivity.size / workingDays) * 100 * 10) / 10)
        : null,
      "kpi-2": totalPermintaan > 0
        ? Math.min(100, Math.round((donePermintaan / totalPermintaan) * 100 * 10) / 10)
        : null,
      "kpi-3": donePermintaan > 0
        ? Math.min(100, Math.round((onTimePermintaan / donePermintaan) * 100 * 10) / 10)
        : null,
      "kpi-4": totalDailyEntries > 0
        ? Math.min(100, Math.round((totalDailyEntries / Math.max(workingDays, 1)) * 100 * 10) / 10)
        : null,
      "kpi-5": expectedAttendanceDays > 0
        ? Math.min(100, Math.round((presentDays / expectedAttendanceDays) * 100 * 10) / 10)
        : null,
      "kpi-6": totalExpectedStandby > 0
        ? Math.min(100, Math.round((fulfilledStandbyDays / totalExpectedStandby) * 100 * 10) / 10)
        : null,
      "kpi-7": workingDays > 0
        ? Math.min(100, Math.round((daysWithDoneActivity.size / workingDays) * 100 * 10) / 10)
        : null,
    };

    // Build final KPI rows
    let totalNilaiAkhir = 0;
    const rows: KpiRow[] = KPI_DEFINITIONS.map((def) => {
      const realisasi = realisasiMap[def.id] ?? null;
      let skor: number | null = null;

      if (realisasi !== null) {
        if (def.polarity === "Max") {
          // Skor = min(realisasi / target, cap) × bobot
          const ratio = def.target > 0 ? realisasi / def.target : 0;
          skor = Math.min(ratio * def.bobot, def.cap * def.bobot / 100);
          skor = Math.round(skor * 100) / 100;
        } else {
          // Min polarity: semakin kecil semakin baik
          const ratio = def.target > 0 ? def.target / Math.max(realisasi, 0.01) : 0;
          skor = Math.min(ratio * def.bobot, def.cap * def.bobot / 100);
          skor = Math.round(skor * 100) / 100;
        }
        totalNilaiAkhir += skor;
      }

      return {
        ...def,
        realisasi,
        skor,
        nilai_akhir: null, // filled below
        raw: {
          period: periodStr,
          workingDays,
          totalPermintaan,
          donePermintaan,
          onTimePermintaan,
          totalDailyEntries,
          daysWithDoneActivity: daysWithDoneActivity.size,
          presentDays,
          expectedAttendanceDays,
          fulfilledStandbyDays,
          totalExpectedStandby,
        },
      };
    });

    totalNilaiAkhir = Math.round(totalNilaiAkhir * 100) / 100;

    return NextResponse.json({
      period: periodStr,
      period_label: formatPeriodMonth(periodStr),
      rows,
      total_bobot: KPI_DEFINITIONS.reduce((sum, d) => sum + d.bobot, 0),
      total_nilai_akhir: totalNilaiAkhir,
      meta: {
        workingDays,
        totalPermintaan,
        donePermintaan,
        onTimePermintaan,
        totalDailyEntries,
        daysWithDoneActivity: daysWithDoneActivity.size,
        presentDays,
        expectedAttendanceDays,
        fulfilledStandbyDays,
        totalExpectedStandby,
      },
    });
  } catch (err: any) {
    console.error("KPI API error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
