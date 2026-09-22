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

// GET /api/daily-activity?month=YYYY-MM
export async function GET(request: NextRequest) {
  try {
    const supabase = getAdminClient();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const staff = searchParams.get("staff");

    let query = supabase
      .from("daily_activities")
      .select("id, request_id, activity_date, name, task_description, status, remarks, created_at, user_id, departemen, project, due_date")
      .order("activity_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (month && month !== "all") {
      const [yStr, mStr] = month.split("-");
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      if (!isNaN(y) && !isNaN(m)) {
        const lastDay = new Date(y, m, 0).getDate();
        query = query
          .gte("activity_date", `${month}-01`)
          .lte("activity_date", `${month}-${String(lastDay).padStart(2, "0")}`);
      }
    }

    if (staff && staff !== "all") {
      query = query.ilike("name", `%${staff}%`);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

const DEFAULT_USER_ID = "bcfdf89c-d1e2-4602-80aa-005a1beb1d3c";

// POST /api/daily-activity (insert single or batch)
export async function POST(request: NextRequest) {
  try {
    const supabase = getAdminClient();
    const body = await request.json();

    if (Array.isArray(body)) {
      const sanitized = body.map((item) => ({
        ...item,
        user_id: item.user_id || DEFAULT_USER_ID,
      }));
      const { data, error } = await supabase
        .from("daily_activities")
        .insert(sanitized)
        .select();

      if (error) throw error;
      return NextResponse.json({ success: true, count: data?.length || 0, data });
    }

    if (body.items && Array.isArray(body.items)) {
      const sanitized = body.items.map((item: any) => ({
        ...item,
        user_id: item.user_id || DEFAULT_USER_ID,
      }));
      const { data, error } = await supabase
        .from("daily_activities")
        .insert(sanitized)
        .select();

      if (error) throw error;
      return NextResponse.json({ success: true, count: data?.length || 0, data });
    }

    const {
      user_id,
      activity_date,
      name,
      task_description,
      status,
      remarks,
    } = body;

    const { data, error } = await supabase
      .from("daily_activities")
      .insert({
        user_id: user_id || DEFAULT_USER_ID,
        activity_date,
        name,
        task_description,
        title: task_description,
        status: status || "✅ Done (Selesai)",
        remarks: remarks || null,
        description: remarks || null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Gagal menyimpan aktivitas" },
      { status: 500 }
    );
  }
}

// PUT / PATCH /api/daily-activity (update by id)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = getAdminClient();
    const body = await request.json();
    const { id, activity_date, name, task_description, status, remarks } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing activity ID" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("daily_activities")
      .update({
        activity_date,
        name,
        task_description,
        title: task_description,
        status,
        remarks: remarks || null,
        description: remarks || null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Gagal memperbarui aktivitas" },
      { status: 500 }
    );
  }
}

// DELETE /api/daily-activity?id=... OR ?month=YYYY-MM
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getAdminClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const month = searchParams.get("month");

    if (id) {
      const { error } = await supabase
        .from("daily_activities")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (month) {
      const { error } = await supabase
        .from("daily_activities")
        .delete()
        .gte("activity_date", `${month}-01`)
        .lte("activity_date", `${month}-31`);

      if (error) throw error;
      return NextResponse.json({ success: true, month });
    }

    return NextResponse.json({ error: "Missing id or month param" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Gagal menghapus aktivitas" },
      { status: 500 }
    );
  }
}
