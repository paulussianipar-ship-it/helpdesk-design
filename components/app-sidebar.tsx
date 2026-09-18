"use client";

import * as React from "react";
import { redirect, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "./nav-user";
import {
  GalleryVerticalEnd,
  Bot,
  LayoutDashboard,
  FileBox,
  BookOpen,
  Info,
  Clock,
  Newspaper,
  CalendarCheck2,
  UserCheck,
  FolderKanban,
  ShieldCheck,
} from "lucide-react";
import Image from "next/image";

const data = {
  teams: [
    {
      name: "Lourdes Autoparts",
      logo: GalleryVerticalEnd,
      plan: "Versi 1.0.0",
    },
  ],
  navAdmin: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "Attendance",
      url: "/attendance",
      icon: UserCheck,
    },
    {
      title: "Daily Activity",
      url: "/daily-activity",
      icon: CalendarCheck2,
    },
    {
      title: "STB HSE",
      url: "/stb-hse",
      icon: ShieldCheck,
    },
    {
      title: "Program Kerja",
      url: "/program-kerja",
      icon: FolderKanban,
    },
    {
      title: "Permintaan Desain",
      url: "/permintaan-desain",
      icon: FileBox,
    },
    {
      title: "Riwayat Pengerjaan",
      url: "/riwayat-pengerjaan",
      icon: Clock,
    },
    {
      title: "Artikel",
      url: "/artikel-admin",
      icon: Newspaper,
    },
    {
      title: "User Management",
      url: "/user-management",
      icon: Bot,
    },
  ],
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "STB HSE",
      url: "/stb-hse",
      icon: ShieldCheck,
    },
    {
      title: "Permintaan Desain",
      url: "/permintaan-desain",
      icon: FileBox,
    },
    {
      title: "Riwayat",
      url: "/riwayat",
      icon: Clock,
    },
  ],
  navSecondary: [
    {
      title: "Dokumentasi",
      url: "/dokumentasi",
      icon: BookOpen,
    },
    // {
    //   title: "Feedback",
    //   url: "/feedback",
    //   icon: MessageSquareShare,
    // },
    {
      title: "Tentang App",
      url: "/tentang-app",
      icon: Info,
    },
  ],
};

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const currentPath = usePathname();
  const supabase = createClient();

  const [user, setUser] = React.useState<any>(null);
  const [profile, setProfile] = React.useState<any>(null);

  React.useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!error) setUser(data.user);
      if (!data.user) redirect("auth/login");
      const profileRes = await supabase
        .from("users")
        .select("*")
        .eq("id", data.user.id)
        .single();
      if (profileRes.data) setProfile(profileRes.data);
    };
    getUser();
  }, [supabase]);

  const markActive = (items: typeof data.navMain) =>
    items.map((item) => ({
      ...item,
      isActive: currentPath.includes(item.url),
    }));

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div>
          <Image
            src={"/lourdes.png"}
            width={500}
            height={500}
            alt="Lourdes Autoparts"
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {profile?.role === "admin" ? (
          <NavMain label="Menu" items={markActive(data.navAdmin)} />
        ) : (
          <NavMain label="Menu" items={markActive(data.navMain)} />
        )}
        <NavMain label="About" items={markActive(data.navSecondary)} />
      </SidebarContent>

      <SidebarFooter>
        {user && (
          <NavUser
            user={{
              avatar: `https://ui-avatars.com/api/?name=${user.email}`,
              email: user.email || "",
              name: profile?.name || "-",
            }}
          />
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
