import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

export async function GET(request: NextRequest) {
  try {
    const supabase = getAdminClient();
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const limit = Math.max(1, Number(searchParams.get("limit") || "10"));
    const search = (searchParams.get("search") || "").trim().toLowerCase();
    const role = searchParams.get("role") || "";
    const department = searchParams.get("department") || "";

    // 1. Fetch all users from Auth & Profiles
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
      perPage: 1000,
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    const { data: profiles } = await supabase.from("user_profiles").select("*");
    const profileMap = new Map<string, any>();
    profiles?.forEach((p) => {
      profileMap.set(p.id, p);
    });

    // 2. Map & Normalize user list
    let allUsers = authData.users.map((u) => {
      const prof = profileMap.get(u.id);
      const name = prof?.name || u.user_metadata?.name || u.email?.split("@")[0] || "User";
      const userRole = prof?.role || u.user_metadata?.role || "user";
      const dept = u.user_metadata?.department || "-";

      return {
        id: u.id,
        email: u.email || "",
        name,
        role: userRole,
        department: dept,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      };
    });

    // Extract all unique departments for filter dropdown
    const departmentSet = new Set<string>();
    allUsers.forEach((u) => {
      if (u.department && u.department !== "-") {
        departmentSet.add(u.department);
      }
    });
    const departments = Array.from(departmentSet).sort();

    // 3. Apply Filters
    if (search) {
      allUsers = allUsers.filter(
        (u) =>
          u.name.toLowerCase().includes(search) ||
          u.email.toLowerCase().includes(search) ||
          u.department.toLowerCase().includes(search)
      );
    }

    if (role && role !== "all") {
      allUsers = allUsers.filter((u) => u.role === role);
    }

    if (department && department !== "all") {
      allUsers = allUsers.filter((u) => u.department === department);
    }

    // Sort: Admins first, then by name
    allUsers.sort((a, b) => {
      if (a.role === "admin" && b.role !== "admin") return -1;
      if (a.role !== "admin" && b.role === "admin") return 1;
      return a.name.localeCompare(b.name);
    });

    const total = allUsers.length;
    const from = (page - 1) * limit;
    const paginatedUsers = allUsers.slice(from, from + limit);

    return NextResponse.json({
      data: paginatedUsers,
      total,
      page,
      limit,
      departments,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
