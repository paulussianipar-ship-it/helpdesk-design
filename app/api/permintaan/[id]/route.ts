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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID tiket diperlukan" }, { status: 400 });
    }

    const supabase = getAdminClient();
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
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getAdminClient();
    const body = await request.json();
    const { judul, project, departemen, status, due_date, deskripsi, admin } = body;

    const targetId = id || body.id;
    if (!targetId) {
      return NextResponse.json({ error: "ID tiket diperlukan" }, { status: 400 });
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (judul !== undefined) updates.judul = cleanJudul(judul);
    if (project !== undefined) updates.project = project;
    if (departemen !== undefined) updates.departemen = departemen;
    if (status !== undefined) updates.status = status;
    if (due_date !== undefined) updates.due_date = due_date;
    if (deskripsi !== undefined) updates.deskripsi = cleanDeskripsi(deskripsi);
    if (admin !== undefined) updates.admin = admin;

    const { data, error } = await supabase
      .from("permintaan")
      .update(updates)
      .eq("id", targetId)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
