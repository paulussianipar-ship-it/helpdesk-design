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
    const all = searchParams.get("all") === "true"; // For Excel export

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

    // Apply Date Range
    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", `${endDate} 23:59:59.999Z`);
    }

    // Order
    query = query.order("created_at", { ascending: false });

    // Pagination
    if (!all) {
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Map Names for requester and admin
    const items = data || [];
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

    const formattedData = items.map((item) => {
      let adminName = item.admin ? nameMap[item.admin] : "-";
      if (!adminName || adminName === "-") {
        if (item.admin === FAREL_ID) adminName = "Farel Ramadhan";
        else if (item.admin === PAULUS_ID) adminName = "Paulus Sianipar";
      }

      return {
        ...item,
        judul: cleanJudul(item.judul),
        deskripsi: cleanDeskripsi(item.deskripsi),
        requester_name: item.requester ? nameMap[item.requester] || "Pelapor" : "Pelapor",
        admin_name: adminName || "-",
      };
    });

    return NextResponse.json({
      data: formattedData,
      total: count || 0,
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
