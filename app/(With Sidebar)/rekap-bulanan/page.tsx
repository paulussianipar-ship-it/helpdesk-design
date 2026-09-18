"use client";

import { useEffect } from "react";
import { RekapBulananPage } from "@/components/rekap-bulanan";

const PRINT_STYLES = `
  @media print {
    @page {
      size: A4 portrait;
      margin: 12mm;
    }
    body {
      background: #fff !important;
    }
    [data-sidebar="sidebar"],
    [data-slot="sidebar-wrapper"],
    [data-slot="sidebar"],
    [data-slot="sidebar-gap"],
    [data-slot="sidebar-trigger"],
    header {
      display: none !important;
    }
  }
`;

export default function RekapBulananRoute() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("print") === "1") {
      const timer = setTimeout(() => window.print(), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <>
      <style>{PRINT_STYLES}</style>

      {/* Judul khusus yang hanya muncul saat print/PDF */}
      <div className="hidden print:block print:mb-4">
        <h1 className="text-xl font-bold">Rekap Bulanan Tiket Helpdesk Design 2026</h1>
        <p className="text-xs text-foreground/70 mt-1">
          Permintaan Design, Attendance, Daily Activity &amp; STB HSE.
        </p>
        <div className="border-b border-foreground/30 mt-2" />
      </div>

      <RekapBulananPage />
    </>
  );
}