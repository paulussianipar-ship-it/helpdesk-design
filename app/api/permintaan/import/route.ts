import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

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

const FAREL_ID = "54e6f310-813b-447b-aac0-9052423440da";
const PAULUS_ID = "bcfdf89c-d1e2-4602-80aa-005a1beb1d3c";
const DEFAULT_USER_ID = "d34ab2a8-7ed8-459c-8350-fa9da1f375bc"; // Alin / user

// Helper untuk mengklasifikasikan jenis proyek desain
function classifyProject(title: string, desc: string): string {
  const text = `${title || ""} ${desc || ""}`.toLowerCase();
  if (text.includes("mini catalog") || text.includes("mini katalog")) return "Design Mini Catalog";
  if (text.includes("catalog") || text.includes("katalog")) return "Design Catalog";
  if (text.includes("flyer") || text.includes("flayer")) return "Design Flyer";
  if (text.includes("brosur") || text.includes("brochure")) return "Design Brosur";
  if (text.includes("kemasan") || text.includes("packaging") || text.includes("box")) return "Design Kemasan";
  if (text.includes("presentasi") || text.includes("ppt") || text.includes("slide")) return "Design File Presentasi";
  if (text.includes("stiker") || text.includes("sticker")) return "Design Stiker";
  if (text.includes("label") || text.includes("tag")) return "Design Label";
  if (text.includes("video product") || text.includes("video produk")) return "Video Product";
  if (text.includes("video instalasi") || text.includes("video pasang")) return "Video Instlasi";
  if (text.includes("video") || text.includes("vidio") || text.includes("reel") || text.includes("animasi") || text.includes("motion") || text.includes("shooting") || text.includes("tiktok")) return "Video Event";
  if (text.includes("photo product") || text.includes("foto produk")) return "Photo Product";
  if (text.includes("photo instalasi") || text.includes("foto instalasi")) return "Photo Instalasi";
  if (text.includes("photo") || text.includes("foto") || text.includes("dokumentasi") || text.includes("retouch")) return "Photo Event";
  if (text.includes("poster") || text.includes("banner") || text.includes("spanduk") || text.includes("backdrop") || text.includes("baliho")) return "Design Poster";
  if (text.includes("sertifikat") || text.includes("certificate")) return "Design Sertifikat";
  if (text.includes("card") || text.includes("kartu") || text.includes("name tag") || text.includes("id card")) return "Design Label";
  return "Design Poster";
}

// Normalisasi status ke format standar permintaan
function normalizeStatus(statusRaw: string): string {
  const s = (statusRaw || "").toLowerCase();
  if (s.includes("done") || s.includes("selesai") || s.includes("close")) return "DONE";
  if (s.includes("progress") || s.includes("proses") || s.includes("jalan")) return "PROGRESS";
  if (s.includes("revisi") || s.includes("revision")) return "REVISION";
  if (s.includes("review")) return "REVIEW";
  if (s.includes("todo") || s.includes("to do") || s.includes("wait") || s.includes("menunggu") || s.includes("pending")) return "TO DO";
  return "DONE";
}

// Map status permintaan ke status Daily Activity
function mapToDailyActivityStatus(status: string): string {
  const s = (status || "").toUpperCase();
  if (s === "DONE") return "✅ Done (Selesai)";
  if (s === "PROGRESS") return "⚡ In Progress (Dalam Proses)";
  if (s === "REVISION") return "🔄 Revisi (Revisi Pengerjaan)";
  if (s === "REVIEW") return "⏸️ Pending (Tertunda)";
  return "⏳ Waiting (Menunggu)";
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getAdminClient();
    const body = await request.json();

    const items: any[] = Array.isArray(body) ? body : body.items || [];
    const mode: "append" | "replace_month" = body.mode || "append";
    const targetMonth: string = body.targetMonth || "";

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Tidak ada data tiket yang dikirim untuk diimpor." }, { status: 400 });
    }

    // 1. Ambil seluruh user profiles untuk pemetaan nama pelapor & desainer
    const { data: userProfiles } = await supabase
      .from("user_profiles")
      .select("id, name, email");

    const profileMap = new Map<string, string>();
    userProfiles?.forEach((u) => {
      if (u.name) profileMap.set(u.name.toLowerCase().trim(), u.id);
      if (u.email) profileMap.set(u.email.toLowerCase().trim(), u.id);
    });

    // 2. Jika mode replace_month, hapus data lama pada bulan target
    if (mode === "replace_month" && targetMonth && targetMonth !== "all") {
      const [yStr, mStr] = targetMonth.split("-");
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      if (!isNaN(y) && !isNaN(m)) {
        const lastDay = new Date(y, m, 0).getDate();
        const startISO = `${targetMonth}-01T00:00:00.000Z`;
        const endISO = `${targetMonth}-${String(lastDay).padStart(2, "0")}T23:59:59.999Z`;

        // Ambil ID tiket yang akan dihapus untuk membersihkan daily_activities terkait
        const { data: oldTickets } = await supabase
          .from("permintaan")
          .select("id")
          .gte("created_at", startISO)
          .lte("created_at", endISO);

        if (oldTickets && oldTickets.length > 0) {
          const oldIds = oldTickets.map((t) => t.id);
          await supabase.from("daily_activities").delete().in("request_id", oldIds);
          await supabase.from("permintaan").delete().in("id", oldIds);
        }
      }
    }

    // 3. Sanitasi dan siapkan record permintaan & daily activity
    const permintaanRecords: any[] = [];
    const dailyRecords: any[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const id = item.id || crypto.randomUUID();

      const rawTitle = String(item.judul || item.title || item.task || item.task_description || item.unit || "Permintaan Desain").trim();
      const rawDesc = String(item.deskripsi || item.description || item.kendala || "").trim();
      const project = item.project || classifyProject(rawTitle, rawDesc);
      const departemen = item.departemen || item.divisi || "Umum";
      const status = normalizeStatus(item.status);

      // Tanggal dibuat
      let createdAt = item.created_at || item.activity_date || item.date;
      if (!createdAt) {
        createdAt = new Date().toISOString();
      } else if (!createdAt.includes("T")) {
        createdAt = `${createdAt}T08:00:00.000Z`;
      }

      // Target Selesai / Due Date
      let dueDate = item.due_date || item.target_selesai || item.tgl_selesai;
      if (!dueDate) {
        dueDate = createdAt;
      } else if (!dueDate.includes("T")) {
        dueDate = `${dueDate}T17:00:00.000Z`;
      }

      // Tentukan desainer (admin)
      const desainerRaw = String(item.admin_name || item.desainer || item.teknisi || item.admin || "").toLowerCase();
      let adminId = PAULUS_ID;
      let adminName = "Paulus Sianipar";
      if (desainerRaw.includes("farel")) {
        adminId = FAREL_ID;
        adminName = "Farel Ramadhan";
      } else if (desainerRaw.includes("paulus")) {
        adminId = PAULUS_ID;
        adminName = "Paulus Sianipar";
      }

      // Tentukan peminta (requester)
      const pelaporRaw = String(item.requester_name || item.pelapor || item.peminta || item.name || "").trim();
      let requesterId = DEFAULT_USER_ID;
      if (pelaporRaw && profileMap.has(pelaporRaw.toLowerCase())) {
        requesterId = profileMap.get(pelaporRaw.toLowerCase())!;
      }

      // Susun deskripsi lengkap jika ada kendala / pelapor
      let fullDesc = rawDesc;
      if (!fullDesc && (item.kendala || item.pelapor)) {
        const parts: string[] = [];
        if (item.pelapor) parts.push(`Pelapor: ${item.pelapor} (${departemen})`);
        if (item.kendala) parts.push(`Kendala/Permintaan: ${item.kendala}`);
        if (item.solusi) parts.push(`Solusi/Catatan: ${item.solusi}`);
        if (item.durasi_pengerjaan) parts.push(`Durasi Pengerjaan: ${item.durasi_pengerjaan}`);
        fullDesc = parts.join("\n");
      }

      permintaanRecords.push({
        id,
        judul: rawTitle,
        deskripsi: fullDesc || rawTitle,
        project,
        departemen,
        status,
        created_at: createdAt,
        due_date: dueDate,
        updated_at: status === "DONE" ? dueDate : createdAt,
        admin: adminId,
        requester: requesterId,
        files: [],
      });

      // Siapkan entri sinkronisasi untuk Daily Activity
      const activityDate = createdAt.slice(0, 10);
      const activityRemarks = [
        `Project: ${project}`,
        `Departemen: ${departemen}`,
        `Due date: ${dueDate.slice(0, 10)}`,
        fullDesc ? `Catatan: ${fullDesc.slice(0, 300)}` : "",
      ].filter(Boolean).join("\n");

      dailyRecords.push({
        request_id: id,
        user_id: requesterId,
        activity_date: activityDate,
        name: adminName.includes("Paulus") ? "Paulus" : "Farel",
        task_description: rawTitle,
        title: rawTitle,
        description: fullDesc || rawTitle,
        status: mapToDailyActivityStatus(status),
        remarks: activityRemarks,
        project,
        departemen,
        due_date: dueDate,
      });
    }

    // 4. Batch insert ke tabel permintaan (dalam chunk 50)
    const CHUNK_SIZE = 50;
    let insertedPermintaan = 0;

    for (let i = 0; i < permintaanRecords.length; i += CHUNK_SIZE) {
      const chunk = permintaanRecords.slice(i, i + CHUNK_SIZE);
      const { data, error } = await supabase
        .from("permintaan")
        .upsert(chunk, { onConflict: "id" })
        .select("id");

      if (error) {
        console.error("Error batch insert permintaan:", error);
        throw new Error(`Gagal menyimpan permintaan desain: ${error.message}`);
      }
      insertedPermintaan += data?.length || chunk.length;
    }

    // 5. Batch upsert ke tabel daily_activities (menjamin masuk ke hitungan Daily Activity & KPI)
    let syncedDaily = 0;
    for (let i = 0; i < dailyRecords.length; i += CHUNK_SIZE) {
      const chunk = dailyRecords.slice(i, i + CHUNK_SIZE);
      const { data, error } = await supabase
        .from("daily_activities")
        .upsert(chunk, { onConflict: "request_id" })
        .select("id");

      if (error) {
        console.warn("Peringatan sinkronisasi daily_activities:", error.message);
      } else {
        syncedDaily += data?.length || chunk.length;
      }
    }

    return NextResponse.json({
      success: true,
      count: insertedPermintaan,
      syncedDaily,
      message: `Berhasil mengimpor ${insertedPermintaan} tiket permintaan desain dan menyinkronkan ${syncedDaily} data ke Daily Activity & KPI.`,
    });
  } catch (err: any) {
    console.error("API Import Permintaan Error:", err);
    return NextResponse.json(
      { error: err.message || "Terjadi kesalahan internal server saat mengimpor data." },
      { status: 500 }
    );
  }
}
