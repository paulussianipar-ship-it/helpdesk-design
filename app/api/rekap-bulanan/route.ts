import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  getAttendanceSeedForPeriod,
} from "@/lib/attendance-seed";
import {
  getStbHseSeedForPeriod,
  calculatePersonStats,
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
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

const MONTH_NAMES_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

export async function GET(request: NextRequest) {
  try {
    const supabase = getAdminClient();
    const { searchParams } = new URL(request.url);
    const year = Number(searchParams.get("year") || "2026");

    // 1. Fetch Permintaan Desain (Real data from Supabase)
    const { data: dbPermintaan } = await supabase
      .from("permintaan")
      .select("id, created_at, updated_at, due_date, status, judul, project, departemen")
      .gte("created_at", `${year}-01-01T00:00:00.000Z`)
      .lt("created_at", `${year + 1}-01-01T00:00:00.000Z`)
      .order("created_at", { ascending: true });

    // 2. Fetch Daily Activity (Real data from Supabase)
    const { data: dbDaily } = await supabase
      .from("daily_activities")
      .select("id, activity_date, status, task_description, name")
      .gte("activity_date", `${year}-01-01`)
      .lte("activity_date", `${year}-12-31`)
      .order("activity_date", { ascending: true });

    // 3. Fetch Attendance (Real data from Supabase)
    const { data: dbAttendance } = await supabase
      .from("attendance")
      .select("*")
      .gte("period_month", `${year}-01`)
      .lte("period_month", `${year}-12`)
      .order("period_month", { ascending: true });

    // 4. Fetch STB HSE (Supabase or seed)
    let dbStb: StbHseRosterRecord[] = [];
    try {
      const { data: stbData, error: stbError } = await supabase
        .from("stb_hse_roster")
        .select("*")
        .gte("period_month", `${year}-01`)
        .lte("period_month", `${year}-12`);
      if (!stbError && stbData && stbData.length > 0) {
        dbStb = stbData as StbHseRosterRecord[];
      }
    } catch {
      // ignore STB HSE errors — fallback to seed
    }

    const permintaanList = dbPermintaan || [];
    const dailyList = dbDaily || [];
    const attendanceList = (dbAttendance as any[]) || [];

    // ============================================================
    // ATTENDANCE: Gabungkan data Supabase dengan seed per bulan
    // ============================================================
    const combinedAttendance: any[] = [...attendanceList];
    for (let m = 1; m <= 12; m++) {
      const p = `${year}-${String(m).padStart(2, "0")}`;
      const hasDbData = combinedAttendance.some((a) => a.period_month === p);
      if (!hasDbData) {
        const seedForMonth = getAttendanceSeedForPeriod(p);
        seedForMonth.forEach((seed) => {
          combinedAttendance.push({
            period_month: seed.period_month,
            name: seed.name,
            status: seed.status,
            overtime: seed.overtime,
          });
        });
      }
    }

    // ============================================================
    // STB HSE: Gabungkan data Supabase dengan seed per bulan
    // ============================================================
    const combinedStb: StbHseRosterRecord[] = [...dbStb];
    for (let m = 1; m <= 12; m++) {
      const p = `${year}-${String(m).padStart(2, "0")}`;
      const hasDbData = combinedStb.some((s) => s.period_month === p);
      if (!hasDbData) {
        const seedForMonth = getStbHseSeedForPeriod(p);
        combinedStb.push(...seedForMonth);
      }
    }

    // ============================================================
    // PERMINTAAN DESAIN: Kelompokkan tiket Supabase per bulan (WIB-aware)
    // ============================================================
    interface PermintaanMonthData {
      masuk: number;
      selesai: number;
      resRate: number | null;
      onTime: number;
      slaPct: number | null;
      avgDurationHours: number | null;
      eskalasi: number;
      statuses: Record<string, number>;
      priorityBreakdown: {
        p1: { pct: number | null; done: number; total: number };
        p2: { pct: number | null; done: number; total: number };
        p3: { pct: number | null; done: number; total: number };
        p4: { pct: number | null; done: number; total: number };
      };
    }

    const permintaanByMonth = new Map<string, PermintaanMonthData>();
    const permintaanDbByMonth = new Map<string, any[]>();

    for (const t of permintaanList) {
      if (!t.created_at) continue;
      const dateUTC = new Date(t.created_at);
      const wibMs = dateUTC.getTime() + 7 * 3600000;
      const wibDate = new Date(wibMs);
      const mm = String(wibDate.getUTCMonth() + 1).padStart(2, "0");
      const yyyy = wibDate.getUTCFullYear();
      const period = `${yyyy}-${mm}`;
      if (!permintaanDbByMonth.has(period)) permintaanDbByMonth.set(period, []);
      permintaanDbByMonth.get(period)!.push(t);
    }

    // Hitung statistik dari data Supabase per bulan
    for (const [period, tickets] of permintaanDbByMonth) {
      const masuk = tickets.length;
      let selesai = 0;
      let onTime = 0;
      let eskalasi = 0;
      let totalDurationHours = 0;
      let durationCount = 0;
      const statuses: Record<string, number> = {};

      let p1Total = 0, p1Done = 0;
      let p2Total = 0, p2Done = 0;
      let p3Total = 0, p3Done = 0;
      let p4Total = 0, p4Done = 0;

      for (const t of tickets) {
        const st = (t.status || "TO DO").toUpperCase();
        statuses[st] = (statuses[st] || 0) + 1;
        const isDone = st === "DONE";

        const created = new Date(t.created_at);
        const updated = t.updated_at ? new Date(t.updated_at) : null;
        const due = t.due_date ? new Date(t.due_date) : null;

        // Cek ketepatan waktu (On Time)
        let isDoneOnTime = true;
        if (due) {
          const dueEndTimestamp = due.getTime() + 24 * 3600 * 1000;
          const isUpdatedInActiveMonth =
            updated &&
            ((updated.getFullYear() === created.getFullYear() &&
              updated.getMonth() === created.getMonth()) ||
              updated.getTime() - created.getTime() <= 14 * 86400000);

          if (isUpdatedInActiveMonth && updated) {
            isDoneOnTime = updated.getTime() <= dueEndTimestamp;
          }
        }

        if (isDone) {
          selesai++;
          if (isDoneOnTime) onTime++;

          // Hitung durasi pengerjaan yang wajar (dalam jam)
          let diffHours = 5.0;
          if (
            updated &&
            updated.getFullYear() === created.getFullYear() &&
            updated.getMonth() === created.getMonth()
          ) {
            const actualDiff = (updated.getTime() - created.getTime()) / 3600000;
            if (actualDiff > 0.2 && actualDiff <= 48) diffHours = actualDiff;
          } else if (due) {
            const plannedHours = (due.getTime() - created.getTime()) / 3600000;
            if (plannedHours > 0.2 && plannedHours <= 24) diffHours = plannedHours;
          }
          if (diffHours < 0.5) diffHours = 1.0;
          if (diffHours > 24) diffHours = 6.0;
          totalDurationHours += diffHours;
          durationCount++;
        }

        if (st === "REVISION" || st === "REVIEW") eskalasi++;

        // Priority breakdown berdasarkan estimasi target due_date
        let diffDays = 14;
        if (t.created_at && t.due_date) {
          const dDays =
            (new Date(t.due_date).getTime() - new Date(t.created_at).getTime()) /
            (1000 * 3600 * 24);
          if (dDays > 0) diffDays = dDays;
        }

        if (diffDays <= 2) {
          p1Total++;
          if (isDone && isDoneOnTime) p1Done++;
        } else if (diffDays <= 5) {
          p2Total++;
          if (isDone && isDoneOnTime) p2Done++;
        } else if (diffDays <= 10) {
          p3Total++;
          if (isDone && isDoneOnTime) p3Done++;
        } else {
          p4Total++;
          if (isDone && isDoneOnTime) p4Done++;
        }
      }

      const resRate = masuk > 0 ? Math.round((selesai / masuk) * 1000) / 10 : null;
      const slaPct = selesai > 0 ? Math.round((onTime / selesai) * 1000) / 10 : null;
      const avgDurationHours =
        durationCount > 0 ? Math.round((totalDurationHours / durationCount) * 10) / 10 : null;

      const priorityBreakdown = {
        p1: { pct: p1Total > 0 ? Math.round((p1Done / p1Total) * 1000) / 10 : null, done: p1Done, total: p1Total },
        p2: { pct: p2Total > 0 ? Math.round((p2Done / p2Total) * 1000) / 10 : null, done: p2Done, total: p2Total },
        p3: { pct: p3Total > 0 ? Math.round((p3Done / p3Total) * 1000) / 10 : null, done: p3Done, total: p3Total },
        p4: { pct: p4Total > 0 ? Math.round((p4Done / p4Total) * 1000) / 10 : null, done: p4Done, total: p4Total },
      };

      permintaanByMonth.set(period, {
        masuk,
        selesai,
        resRate,
        onTime,
        slaPct,
        avgDurationHours,
        eskalasi,
        statuses,
        priorityBreakdown,
      });
    }

    // ============================================================
    // Build month-by-month results
    // ============================================================
    const months: any[] = [];

    for (let m = 1; m <= 12; m++) {
      const monthNum = String(m).padStart(2, "0");
      const period = `${year}-${monthNum}`;
      const monthName = MONTH_NAMES_ID[m - 1];

      // --- 1. PERMINTAAN DESAIN ---
      const pData = permintaanByMonth.get(period);
      const masuk = pData?.masuk ?? 0;
      const selesai = pData?.selesai ?? 0;
      const resRate =
        pData?.resRate ?? (masuk > 0 ? Math.round((selesai / masuk) * 1000) / 10 : null);
      const slaPct = pData?.slaPct ?? null;
      const avgDurationHours = pData?.avgDurationHours ?? null;
      const eskalasi = pData?.eskalasi ?? 0;
      const permintaanStatuses = pData?.statuses ?? {};
      const priorityBreakdown = pData?.priorityBreakdown || {
        p1: { pct: null, done: 0, total: 0 },
        p2: { pct: null, done: 0, total: 0 },
        p3: { pct: null, done: 0, total: 0 },
        p4: { pct: null, done: 0, total: 0 },
      };

      // --- 2. DAILY ACTIVITY ---
      const monthDaily = dailyList.filter((d) => d.activity_date?.startsWith(period));
      const dailyTotal = monthDaily.length;
      let dailyDone = 0;
      let dailyInProgress = 0;
      let dailyRevisi = 0;
      let dailyPending = 0;
      let dailyWaiting = 0;

      monthDaily.forEach((d) => {
        const s = (d.status || "").toLowerCase();
        if (s.includes("done") || s.includes("selesai")) dailyDone++;
        else if (s.includes("progress") || s.includes("proses")) dailyInProgress++;
        else if (s.includes("revisi")) dailyRevisi++;
        else if (s.includes("pending") || s.includes("tunda")) dailyPending++;
        else dailyWaiting++;
      });

      const dailyCompletionRate =
        dailyTotal > 0 ? Math.round((dailyDone / dailyTotal) * 1000) / 10 : null;

      // --- 3. ATTENDANCE ---
      const monthAtt = combinedAttendance.filter((a) => a.period_month === period);
      let attPrs = 0;
      let attOvt = 0;
      let attOff = 0;
      let attAbs = 0;
      let attOvtMin = 0;

      monthAtt.forEach((r) => {
        const s = (r.status || "").toUpperCase();
        if (s.includes("PRS") || s.includes("HADIR")) attPrs++;
        if (s.includes("OFF") || s.includes("LIBUR")) attOff++;
        if (
          s.includes("ABS") ||
          s.includes("ALPA") ||
          s.includes("IJIN") ||
          s.includes("SAKIT")
        )
          attAbs++;
        if (s.includes("OVT") || Number(r.overtime) > 0) attOvt++;
        attOvtMin += Number(r.overtime) || 0;
      });

      const attRate =
        attPrs + attAbs > 0
          ? Math.round((attPrs / (attPrs + attAbs)) * 1000) / 10
          : attPrs > 0
          ? 100
          : null;

      // --- 4. STB HSE ---
      const monthStb = combinedStb.filter((s) => s.period_month === period);
      const stbPersonil = monthStb.length;
      let stbH = 0;
      let stbHSmall = 0;
      let stbOther = 0;

      monthStb.forEach((r) => {
        const stats = calculatePersonStats(r.schedule || {});
        stbH += stats.countH;
        stbHSmall += stats.countHSmall;
        stbOther += stats.countOther;
      });

      const stbTotal = stbH + stbHSmall + stbOther;

      // Aktif jika ada data di setidaknya satu modul
      const isActive = masuk > 0 || dailyTotal > 0 || attPrs > 0 || stbTotal > 0;

      // KPI Grade berbobot
      let kpiGrade: string | null = null;
      if (isActive) {
        let weightedSum = 0;
        let totalWeight = 0;
        if (slaPct !== null) { weightedSum += slaPct * 0.40; totalWeight += 0.40; }
        if (dailyCompletionRate !== null) { weightedSum += dailyCompletionRate * 0.35; totalWeight += 0.35; }
        if (attRate !== null) { weightedSum += attRate * 0.25; totalWeight += 0.25; }

        if (totalWeight > 0) {
          const score = weightedSum / totalWeight;
          if (score >= 90) kpiGrade = "Sangat Baik";
          else if (score >= 80) kpiGrade = "Baik";
          else if (score >= 65) kpiGrade = "Cukup Baik";
          else kpiGrade = "Kurang Baik";
        }
      }

      months.push({
        monthName,
        monthNum,
        period,
        active: isActive,
        permintaan: {
          masuk,
          selesai,
          resRate,
          statuses: permintaanStatuses,
          onTime: pData?.onTime ?? selesai,
          slaPct,
          avgDurationHours,
          eskalasi,
          priorityBreakdown,
        },
        daily: {
          total: dailyTotal,
          done: dailyDone,
          inProgress: dailyInProgress,
          revisi: dailyRevisi,
          pending: dailyPending,
          waiting: dailyWaiting,
          completionRate: dailyCompletionRate,
        },
        attendance: {
          totalRecords: attPrs + attOff + attAbs,
          prs: attPrs,
          ovt: attOvt,
          off: attOff,
          abs: attAbs,
          overtimeMinutes: attOvtMin,
          overtimeHours: Math.round((attOvtMin / 60) * 10) / 10,
          attendanceRate: attRate,
        },
        stb: {
          personil: stbPersonil,
          countH: stbH,
          countHSmall: stbHSmall,
          countOther: stbOther,
          totalStandby: stbTotal,
        },
        kpiGrade,
      });
    }

    // ============================================================
    // Totals (hanya dari bulan aktif)
    // ============================================================
    const activeMonths = months.filter((m) => m.active);
    const totalMasuk = activeMonths.reduce((acc, m) => acc + m.permintaan.masuk, 0);
    const totalSelesai = activeMonths.reduce((acc, m) => acc + m.permintaan.selesai, 0);
    const totalEskalasi = activeMonths.reduce((acc, m) => acc + m.permintaan.eskalasi, 0);
    const totalOnTime = activeMonths.reduce((acc, m) => acc + m.permintaan.onTime, 0);

    const validDurations = activeMonths.filter((m) => m.permintaan.avgDurationHours !== null);
    const avgDuration =
      validDurations.length > 0
        ? Math.round(
            (validDurations.reduce(
              (acc, m) => acc + (m.permintaan.avgDurationHours || 0),
              0
            ) /
              validDurations.length) *
              10
          ) / 10
        : 0;

    const permintaanResRate =
      totalMasuk > 0 ? Math.round((totalSelesai / totalMasuk) * 1000) / 10 : 100;
    const permintaanSlaPct =
      totalSelesai > 0 ? Math.round((totalOnTime / totalSelesai) * 1000) / 10 : 100;

    const dailyTotal = activeMonths.reduce((acc, m) => acc + m.daily.total, 0);
    const dailyDone = activeMonths.reduce((acc, m) => acc + m.daily.done, 0);
    const dailyInProgress = activeMonths.reduce((acc, m) => acc + m.daily.inProgress, 0);
    const dailyRevisi = activeMonths.reduce((acc, m) => acc + m.daily.revisi, 0);
    const dailyPending = activeMonths.reduce((acc, m) => acc + m.daily.pending, 0);
    const dailyWaiting = activeMonths.reduce((acc, m) => acc + m.daily.waiting, 0);
    const dailyRate =
      dailyTotal > 0 ? Math.round((dailyDone / dailyTotal) * 1000) / 10 : 100;

    const attendancePrs = activeMonths.reduce((acc, m) => acc + m.attendance.prs, 0);
    const attendanceOvt = activeMonths.reduce((acc, m) => acc + m.attendance.ovt, 0);
    const attendanceOff = activeMonths.reduce((acc, m) => acc + m.attendance.off, 0);
    const attendanceAbs = activeMonths.reduce((acc, m) => acc + m.attendance.abs, 0);
    const attendanceTotalMinutes = activeMonths.reduce(
      (acc, m) => acc + m.attendance.overtimeMinutes,
      0
    );
    const attendanceRate =
      attendancePrs + attendanceAbs > 0
        ? Math.round((attendancePrs / (attendancePrs + attendanceAbs)) * 1000) / 10
        : 100;

    const stbPersonil = Math.max(...activeMonths.map((m) => m.stb.personil), 0);
    const stbTotalStandby = activeMonths.reduce((acc, m) => acc + m.stb.totalStandby, 0);
    const stbCountH = activeMonths.reduce((acc, m) => acc + m.stb.countH, 0);
    const stbCountHSmall = activeMonths.reduce((acc, m) => acc + m.stb.countHSmall, 0);

    let overallKpiGrade: "Sangat Baik" | "Baik" | "Cukup Baik" | "Kurang Baik" = "Baik";
    const overallScore = permintaanSlaPct * 0.4 + dailyRate * 0.35 + attendanceRate * 0.25;
    if (overallScore >= 90) overallKpiGrade = "Sangat Baik";
    else if (overallScore >= 80) overallKpiGrade = "Baik";
    else if (overallScore >= 65) overallKpiGrade = "Cukup Baik";
    else overallKpiGrade = "Kurang Baik";

    // Summary statuses
    const permintaanStatuses: Record<string, number> = {};
    activeMonths.forEach((m) => {
      Object.entries(m.permintaan.statuses || {}).forEach(([k, v]) => {
        permintaanStatuses[k] = (permintaanStatuses[k] || 0) + Number(v);
      });
    });

    // Priority breakdown aggregation across active months
    const p1TotalYtd = activeMonths.reduce((acc, m) => acc + (m.permintaan.priorityBreakdown?.p1.total || 0), 0);
    const p1DoneYtd = activeMonths.reduce((acc, m) => acc + (m.permintaan.priorityBreakdown?.p1.done || 0), 0);
    const p2TotalYtd = activeMonths.reduce((acc, m) => acc + (m.permintaan.priorityBreakdown?.p2.total || 0), 0);
    const p2DoneYtd = activeMonths.reduce((acc, m) => acc + (m.permintaan.priorityBreakdown?.p2.done || 0), 0);
    const p3TotalYtd = activeMonths.reduce((acc, m) => acc + (m.permintaan.priorityBreakdown?.p3.total || 0), 0);
    const p3DoneYtd = activeMonths.reduce((acc, m) => acc + (m.permintaan.priorityBreakdown?.p3.done || 0), 0);
    const p4TotalYtd = activeMonths.reduce((acc, m) => acc + (m.permintaan.priorityBreakdown?.p4.total || 0), 0);
    const p4DoneYtd = activeMonths.reduce((acc, m) => acc + (m.permintaan.priorityBreakdown?.p4.done || 0), 0);

    const priorityOverall = {
      p1: { pct: p1TotalYtd > 0 ? Math.round((p1DoneYtd / p1TotalYtd) * 1000) / 10 : 100, done: p1DoneYtd, total: p1TotalYtd },
      p2: { pct: p2TotalYtd > 0 ? Math.round((p2DoneYtd / p2TotalYtd) * 1000) / 10 : 100, done: p2DoneYtd, total: p2TotalYtd },
      p3: { pct: p3TotalYtd > 0 ? Math.round((p3DoneYtd / p3TotalYtd) * 1000) / 10 : 100, done: p3DoneYtd, total: p3TotalYtd },
      p4: { pct: p4TotalYtd > 0 ? Math.round((p4DoneYtd / p4TotalYtd) * 1000) / 10 : 100, done: p4DoneYtd, total: p4TotalYtd },
    };

    let slaGradeYtd = "Sangat Baik";
    if (permintaanSlaPct >= 90) slaGradeYtd = "Sangat Baik";
    else if (permintaanSlaPct >= 80) slaGradeYtd = "Baik";
    else if (permintaanSlaPct >= 65) slaGradeYtd = "Cukup Baik";
    else slaGradeYtd = "Kurang Baik";

    const result = {
      year,
      months,
      totals: {
        permintaanMasuk: totalMasuk,
        permintaanSelesai: totalSelesai,
        permintaanResRate,
        permintaanSlaPct,
        permintaanAvgHours: avgDuration,
        permintaanEskalasi: totalEskalasi,
        permintaanStatuses,

        slaAchievementYtd: permintaanSlaPct,
        slaGradeYtd,
        eligibleTickets: totalSelesai,
        vendorExcluded: 0,
        escalationCount: totalEskalasi,
        escalationPct: totalMasuk > 0 ? Math.round((totalEskalasi / totalMasuk) * 1000) / 10 : 0,
        priorityOverall,

        dailyTotal,
        dailyDone,
        dailyInProgress,
        dailyRevisi,
        dailyPending,
        dailyWaiting,
        dailyRate,

        attendancePrs,
        attendanceOvt,
        attendanceOff,
        attendanceAbs,
        attendanceTotalMinutes,
        attendanceRate,

        stbPersonil,
        stbTotalStandby,
        stbCountH,
        stbCountHSmall,

        overallKpiGrade,
      },
    };

    return NextResponse.json({ data: result });
  } catch (err: any) {
    console.error("Rekap bulanan error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
