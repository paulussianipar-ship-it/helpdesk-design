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

const cleanJudul = (title: string) => {
  if (!title) return title;
  return title
    .replace(/\s*[-–—]\s*IT[0-9]+/gi, "")
    .replace(/\s*\(\s*IT[0-9]+\s*\)/gi, "")
    .replace(/\bIT[0-9]{6,}\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
};

const cleanDeskripsi = (desc: string) => {
  if (!desc) return desc;
  return desc
    .replace(/\[\s*Tiket:\s*IT[0-9]+\s*\|\s*Prioritas:/gi, "[Prioritas:")
    .replace(/Referensi Tiket IT Helpdesk:\s*IT[0-9]+/gi, "")
    .replace(/\[\s*Tiket:\s*IT[0-9]+\s*\]/gi, "")
    .replace(/\bIT[0-9]{6,}\b/gi, "")
    .replace(/\n\s*\n/g, "\n")
    .trim();
};

export type DesignCategory = "Design Cetak" | "Design Digital" | "Editing Foto" | "Editing Video";

export function getDesignCategory(project: string): DesignCategory {
  const p = (project || "").toLowerCase();

  // 1. Editing Video
  if (
    p.includes("video") ||
    p.includes("vidio") ||
    p.includes("animasi") ||
    p.includes("motion") ||
    p.includes("reels") ||
    p.includes("tiktok")
  ) {
    return "Editing Video";
  }

  // 2. Editing Foto
  if (
    p.includes("photo") ||
    p.includes("foto") ||
    p.includes("retouch") ||
    p.includes("dokumentasi")
  ) {
    return "Editing Foto";
  }

  // 3. Design Cetak
  if (
    p.includes("cetak") ||
    p.includes("print") ||
    p.includes("brosur") ||
    p.includes("sertifikat") ||
    p.includes("kemasan") ||
    p.includes("catalog") ||
    p.includes("katalog") ||
    p.includes("label") ||
    p.includes("stiker") ||
    p.includes("sticker") ||
    p.includes("kartu nama") ||
    p.includes("buku") ||
    p.includes("tagging") ||
    p.includes("merchandise") ||
    p.includes("banner") ||
    p.includes("spanduk") ||
    p.includes("backdrop")
  ) {
    return "Design Cetak";
  }

  // 4. Design Digital (Poster, Flyer, File Presentasi, Template, Medsos, dll)
  return "Design Digital";
}

export function checkIsTicketTercapai(ticket: {
  status: string;
  created_at: string;
  due_date: string;
  updated_at?: string;
  deskripsi?: string;
}): boolean {
  const status = (ticket.status || "").toUpperCase();

  // Jika tiket belum selesai (bukan DONE), belum tercapai
  if (status !== "DONE") {
    return false;
  }

  if (!ticket.due_date) return true;

  const dueStr = (ticket.due_date || "").slice(0, 10);
  const createdStr = (ticket.created_at || "").slice(0, 10);
  const updatedStr = (ticket.updated_at || "").slice(0, 10);

  // 1. Jika updated_at <= dueStr, pasti tepat waktu / tercapai
  if (updatedStr && updatedStr <= dueStr) {
    return true;
  }

  // 2. Jika dibuat sebelum/pada due date dan ada info durasi pengerjaan di deskripsi
  const desc = ticket.deskripsi || "";
  if (createdStr <= dueStr && desc.toLowerCase().includes("durasi pengerjaan")) {
    return true;
  }

  // 3. Toleransi timezone: Supabase menyimpan UTC, sehingga jam 23:00 UTC = jam 06:00 WIB hari berikutnya (+1 hari)
  if (createdStr <= dueStr && updatedStr) {
    const dueDate = new Date(dueStr).getTime();
    const updateDate = new Date(updatedStr).getTime();
    const diffDays = (updateDate - dueDate) / (1000 * 60 * 60 * 24);
    if (diffDays <= 1) {
      return true;
    }
  }

  // 4. Default: jika dibuat pada tanggal deadline atau sebelumnya dan status sudah DONE
  return createdStr <= dueStr;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getAdminClient();
    const { searchParams } = new URL(request.url);

    // 1. Single Ticket by ID
    const id = searchParams.get("id");
    if (id) {
      const { data: item, error } = await supabase
        .from("permintaan")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (!item) {
        return NextResponse.json({ error: "Data permintaan tidak ditemukan" }, { status: 404 });
      }

      let adminInfo: any = null;
      let requesterInfo: any = null;

      if (item.admin) {
        const { data: a } = await supabase
          .from("user_profiles")
          .select("id, name, email, role")
          .eq("id", item.admin)
          .maybeSingle();
        if (a) adminInfo = a;
        else if (item.admin === FAREL_ID) {
          adminInfo = { id: FAREL_ID, name: "Farel Ramadhan", role: "admin" };
        } else if (item.admin === PAULUS_ID) {
          adminInfo = { id: PAULUS_ID, name: "Paulus Sianipar", role: "admin" };
        }
      }

      if (item.requester) {
        const { data: r } = await supabase
          .from("user_profiles")
          .select("id, name, email, role")
          .eq("id", item.requester)
          .maybeSingle();
        if (r) requesterInfo = r;
      }

      const formatted = {
        ...item,
        judul: cleanJudul(item.judul),
        deskripsi: cleanDeskripsi(item.deskripsi),
        admin_data: adminInfo,
        requester_data: requesterInfo,
        admin_name: adminInfo?.name || (item.admin === FAREL_ID ? "Farel Ramadhan" : item.admin === PAULUS_ID ? "Paulus Sianipar" : "-"),
        requester_name: requesterInfo?.name || "Pelapor",
        files: Array.isArray(item.files) ? item.files : [],
      };

      return NextResponse.json({ data: formatted });
    }

    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const limit = Math.max(1, Number(searchParams.get("limit") || "10"));
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const designer = searchParams.get("designer") || "";
    const requester = searchParams.get("requester") || "";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";
    const month = searchParams.get("month") || "";
    const all = searchParams.get("all") === "true"; // For Excel export

    const category = searchParams.get("category") || "";
    const hasil = searchParams.get("hasil") || "";

    let query = supabase.from("permintaan").select("*", { count: "exact" });

    // Apply Search
    if (search) {
      query = query.or(`judul.ilike.%${search}%,project.ilike.%${search}%,departemen.ilike.%${search}%`);
    }

    // Apply Status Filter
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    // Apply Designer Filter
    if (designer && designer !== "all") {
      query = query.eq("admin", designer);
    }

    // Apply Requester Filter (Only if explicitly requested)
    if (requester && requester !== "all") {
      query = query.eq("requester", requester);
    }

    // Apply Month or Date Range
    if (month && month !== "all") {
      const [yStr, mStr] = month.split("-");
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      if (!isNaN(y) && !isNaN(m)) {
        const lastDay = new Date(y, m, 0).getDate();
        const start = `${month}-01T00:00:00.000Z`;
        const end = `${month}-${String(lastDay).padStart(2, "0")}T23:59:59.999Z`;
        query = query.gte("created_at", start).lte("created_at", end);
      }
    } else {
      if (startDate) {
        query = query.gte("created_at", startDate);
      }
      if (endDate) {
        query = query.lte("created_at", `${endDate} 23:59:59.999Z`);
      }
    }

    // Calculate Monthly Stats (without pagination)
    let statsQuery = supabase
      .from("permintaan")
      .select("id, status, project, created_at, due_date, updated_at, deskripsi");

    if (month && month !== "all") {
      const [yStr, mStr] = month.split("-");
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      if (!isNaN(y) && !isNaN(m)) {
        const lastDay = new Date(y, m, 0).getDate();
        const start = `${month}-01T00:00:00.000Z`;
        const end = `${month}-${String(lastDay).padStart(2, "0")}T23:59:59.999Z`;
        statsQuery = statsQuery.gte("created_at", start).lte("created_at", end);
      }
    } else {
      if (startDate) statsQuery = statsQuery.gte("created_at", startDate);
      if (endDate) statsQuery = statsQuery.lte("created_at", `${endDate} 23:59:59.999Z`);
    }
    if (designer && designer !== "all") statsQuery = statsQuery.eq("admin", designer);
    if (requester && requester !== "all") statsQuery = statsQuery.eq("requester", requester);
    if (search) statsQuery = statsQuery.or(`judul.ilike.%${search}%,project.ilike.%${search}%,departemen.ilike.%${search}%`);

    const { data: statsData } = await statsQuery;
    const stats = {
      total: statsData?.length || 0,
      todo: 0,
      progress: 0,
      review: 0,
      revision: 0,
      done: 0,
      hasil: {
        tercapai: 0,
        tercapaiPct: 0,
        tidakTercapai: 0,
        tidakTercapaiPct: 0,
      },
      kategori: {
        designCetak: 0,
        designDigital: 0,
        editingFoto: 0,
        editingVideo: 0,
        totalTiket: 0,
      },
    };

    statsData?.forEach((row: any) => {
      const s = (row.status || "").toUpperCase();
      if (s === "DONE") stats.done++;
      else if (s === "PROGRESS") stats.progress++;
      else if (s === "REVIEW") stats.review++;
      else if (s === "REVISION") stats.revision++;
      else if (s === "TO DO" || s === "TODO") stats.todo++;

      // Kategori Desain
      const cat = getDesignCategory(row.project || "");
      if (cat === "Design Cetak") stats.kategori.designCetak++;
      else if (cat === "Design Digital") stats.kategori.designDigital++;
      else if (cat === "Editing Foto") stats.kategori.editingFoto++;
      else if (cat === "Editing Video") stats.kategori.editingVideo++;

      // Hasil (Tercapai vs Tidak Tercapai)
      const isTercapai = checkIsTicketTercapai(row);
      if (isTercapai) stats.hasil.tercapai++;
      else stats.hasil.tidakTercapai++;
    });

    const totalCalculated = stats.total || (stats.hasil.tercapai + stats.hasil.tidakTercapai) || 0;
    stats.kategori.totalTiket = totalCalculated;

    if (totalCalculated > 0) {
      stats.hasil.tercapaiPct = Math.round((stats.hasil.tercapai / totalCalculated) * 100);
      stats.hasil.tidakTercapaiPct = 100 - stats.hasil.tercapaiPct;
    }

    // Order
    query = query.order("created_at", { ascending: false });

    // Jika filter spesifik category atau hasil aktif, ambil seluruhnya lalu filter dan paginasi
    const requiresMemoryFilter = Boolean((category && category !== "all") || (hasil && hasil !== "all"));

    if (!all && !requiresMemoryFilter) {
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Map Names for requester and admin
    let items = data || [];
    const userIds = new Set<string>();
    items.forEach((item) => {
      if (item.requester) userIds.add(item.requester);
      if (item.admin) userIds.add(item.admin);
    });

    const nameMap: Record<string, string> = {};
    if (userIds.size > 0) {
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, name")
        .in("id", Array.from(userIds));

      profiles?.forEach((p) => {
        if (p.id && p.name) nameMap[p.id] = p.name;
      });
    }

    let formattedData = items.map((item) => {
      let adminName = item.admin ? nameMap[item.admin] : "-";
      if (!adminName || adminName === "-") {
        if (item.admin === FAREL_ID) adminName = "Farel Ramadhan";
        else if (item.admin === PAULUS_ID) adminName = "Paulus Sianipar";
      }

      const cat = getDesignCategory(item.project || "");
      const isTercapai = checkIsTicketTercapai(item);

      return {
        ...item,
        judul: cleanJudul(item.judul),
        deskripsi: cleanDeskripsi(item.deskripsi),
        requester_name: item.requester ? nameMap[item.requester] || "Pelapor" : "Pelapor",
        admin_name: adminName || "-",
        category: cat,
        is_tercapai: isTercapai,
        hasil_label: isTercapai ? "Tercapai" : "Tidak Tercapai",
      };
    });

    // Terapkan filter category atau hasil jika dipilih
    if (category && category !== "all") {
      formattedData = formattedData.filter((item) => item.category === category);
    }
    if (hasil && hasil !== "all") {
      const wantTercapai = hasil.toLowerCase().includes("tercapai") && !hasil.toLowerCase().includes("tidak");
      formattedData = formattedData.filter((item) => item.is_tercapai === wantTercapai);
    }

    const filteredTotal = requiresMemoryFilter ? formattedData.length : (count || 0);

    // Lakukan pagination jika memory filter aktif
    let finalPageData = formattedData;
    if (!all && requiresMemoryFilter) {
      const from = (page - 1) * limit;
      const to = from + limit;
      finalPageData = formattedData.slice(from, to);
    }

    return NextResponse.json({
      data: finalPageData,
      total: filteredTotal,
      stats,
      page,
      limit,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = getAdminClient();
    const body = await request.json();
    const { id, judul, project, departemen, status, due_date, deskripsi, admin } = body;

    if (!id) {
      return NextResponse.json({ error: "ID tiket diperlukan" }, { status: 400 });
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (judul !== undefined) updates.judul = judul.trim();
    if (project !== undefined) updates.project = project;
    if (departemen !== undefined) updates.departemen = departemen;
    if (status !== undefined) updates.status = status;
    if (due_date !== undefined) updates.due_date = due_date;
    if (deskripsi !== undefined) updates.deskripsi = deskripsi;
    if (admin !== undefined) updates.admin = admin;

    const { data, error } = await supabase
      .from("permintaan")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID tiket diperlukan" }, { status: 400 });
    }

    // Admin Guard: hanya role admin yang boleh menghapus
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");

    const supabase = getAdminClient();

    const {
      data: { user },
      error: authError,
    } = token
      ? await supabase.auth.getUser(token)
      : { data: { user: null }, error: null };

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await supabase.from("permintaan").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
