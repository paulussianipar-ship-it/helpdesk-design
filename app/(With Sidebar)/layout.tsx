"use client";

import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { createClient } from "@/lib/supabase/client";
import { redirect, usePathname } from "next/navigation";
import { Fragment, ReactNode, useEffect } from "react";
import { toast } from "sonner";
import { ThemeSwitcher } from "@/components/theme-switcher";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  function urlToBreadcrumb(pathname: string) {
    const parts = pathname.split("/").filter(Boolean);

    return parts.map((part, index) => {
      const isLast = index === parts.length - 1;
      const href = `/${parts.slice(0, index + 1).join("/")}`;

      let readablePart = decodeURIComponent(
        part.replace(/-/g, " ").replace(/\b\w/g, (s) => s.toUpperCase())
      );

      // Pemetaan nama menu yang ramah pembaca
      if (part === "artikel-admin") {
        readablePart = "Artikel";
      } else if (part === "buat") {
        readablePart = "Buat Artikel";
      } else if (part === "edit") {
        readablePart = "Edit";
      }

      // 👉 kalau part adalah UUID
      if (/^[0-9a-fA-F-]{36}$/.test(part)) {
        if (isLast) {
          readablePart = "Edit Artikel";
        } else {
          return null;
        }
      }

      return (
        <Fragment key={index}>
          <BreadcrumbItem>
            {isLast ? (
              <BreadcrumbPage>{readablePart}</BreadcrumbPage>
            ) : (
              <BreadcrumbLink href={href}>{readablePart}</BreadcrumbLink>
            )}
          </BreadcrumbItem>
          {!isLast && <BreadcrumbSeparator />}
        </Fragment>
      );
    });
  }

  useEffect(() => {
    async function fetch() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        redirect("/auth/login");
      }
      const profileRes = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();
      if (!profileRes.data.name) {
        toast.warning("Anda belum melengkapi informasi akun.", {
          action: {
            label: "Lengkapi Profil",
            onClick: () => {
              redirect("/profile");
            },
          },
        });
      }
    }

    fetch();
  }, []);

  return (
    <>
      <SidebarProvider>
        {/* Pastikan AppSidebar menerima prop user dengan tipe yang sesuai */}
        <AppSidebar className="shadow-lg" />
        <SidebarInset className="min-w-0">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-3 sm:px-4 w-full">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-1 sm:mr-2 data-[orientation=vertical]:h-4 hidden sm:block"
              />
              <Breadcrumb className="flex-1 min-w-0">
                <BreadcrumbList className="flex flex-nowrap items-center gap-1 overflow-x-auto text-xs sm:text-sm py-1">
                  <BreadcrumbItem className="hidden sm:inline-flex">
                    <BreadcrumbLink href="/dashboard" className="whitespace-nowrap">
                      Design Desk
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden sm:inline-flex" />
                  {urlToBreadcrumb(usePathname())}
                </BreadcrumbList>
              </Breadcrumb>
              <div className="ml-auto flex items-center gap-2 shrink-0">
                <ThemeSwitcher />
              </div>
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-3 sm:p-4 lg:p-6 pt-3 sm:pt-4 min-w-0">
            <div className="grid grid-cols-12 items-start gap-4 sm:gap-5 lg:gap-6 auto-rows-auto min-w-0">
              {children}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
