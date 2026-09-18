"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  CalendarRange,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  FileClock,
  Layers,
  Loader2,
  Printer,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { INDONESIAN_MONTHS, formatMonthYearIndo } from "@/lib/stb-hse-seed";
import {
  DAILY_COLORS,
  DAILY_SHORT,
  DAILY_STATUSES,
  EMPTY_REKAP,
  PERMINTaan_COLORS,
  PERMINTaan_STATUSES,
  exportRekapExcel,
  fetchRekapData,
  formatMinutes,
  type RekapData,
} from "@/lib/rekap-bulanan";

function KpiCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub: string;
  accent: string;
}) {
  return (
    <div className={`rounded-xl border p-3.5 flex flex-col gap-2 ${accent}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        {icon}
      </div>
      <div>
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <span className="text-[11px] text-muted-foreground leading-snug">{sub}</span>
    </div>
  );
}

export function RekapBulananPage() {
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (!supabaseRef.current) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  const [period, setPeriod] = useState<string>("2026-09");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RekapData>(EMPTY_REKAP);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      const result = await fetchRekapData(period);
      if (!cancelled) {
        setData(result);
        setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [period, supabase]);

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const fileName = await exportRekapExcel(period);
      toast.success(`Berhasil mengekspor ${fileName}`);
    } catch (error: any) {
      toast.error("Gagal mengekspor Excel: " + (error?.message || ""));
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = () => {
    window.print();
  };

  const permitChartData = PERMINTaan_STATUSES.map((s) => ({
    name: s,
    value: data.permintaan.statuses[s] || 0,
    color: PERMINTaan_COLORS[s],
  }));

  const dailyChartData = DAILY_STATUSES.map((s) => ({
    name: DAILY_SHORT[s],
    value: data.daily.statuses[s] || 0,
    color: DAILY_COLORS[s],
  }));

  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center p-16 text-muted-foreground">
      <Loader2 className="size-8 animate-spin mb-3 text-primary" />
      <span className="text-sm">Memuat rekap bulanan...</span>
    </div>
  );

  return (
    <div className="col-span-12 w-full flex flex-col gap-4">
      {/* ======== HEADER TOOLBAR ======== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card border rounded-xl p-4 shadow-2xs">
        <div>
          <h1 className="text-base font-bold flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-primary" />
            Rekap Bulanan Tiket Helpdesk Design 2026
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {loading
              ? "Memuat data..."
              : `Ringkasan ${formatMonthYearIndo(period)} — Permintaan Design, Attendance, Daily Activity & STB HSE.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[170px] h-9 text-xs">
              <CalendarRange className="size-3.5 text-muted-foreground shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INDONESIAN_MONTHS.map((m) => (
                <SelectItem key={m.value} value={`2026-${m.value}`}>
                  {m.label} 2026
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs"
            onClick={handleExportExcel}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="size-3.5 text-emerald-600" />
            )}
            Export Excel
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs"
            onClick={handleExportPdf}
          >
            <Printer className="size-3.5 text-rose-600" />
            Export PDF
          </Button>
        </div>
      </div>

      {loading ? (
        renderLoading()
      ) : (
        <>
          {/* ======== KPI RINGKASAN 4 MODUL ======== */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              icon={<ClipboardList className="size-4 text-blue-600 dark:text-blue-400" />}
              label="Permintaan Design"
              value={data.permintaan.total}
              sub={`DONE: ${data.permintaan.statuses["DONE"] || 0} · TO DO: ${data.permintaan.statuses["TO DO"] || 0}`}
              accent="bg-blue-500/10"
            />
            <KpiCard
              icon={<UserCheck className="size-4 text-emerald-600 dark:text-emerald-400" />}
              label="Kehadiran (PRS)"
              value={data.attendance.prs}
              sub={`Lembur: ${data.attendance.ovt} · Absen: ${data.attendance.abs}`}
              accent="bg-emerald-500/10"
            />
            <KpiCard
              icon={<Layers className="size-4 text-amber-600 dark:text-amber-400" />}
              label="Daily Activity"
              value={data.daily.total}
              sub={`Done: ${data.daily.statuses["✅ Done (Selesai)"] || 0} · In Progress: ${data.daily.statuses["⚡ In Progress (Dalam Proses)"] || 0}`}
              accent="bg-amber-500/10"
            />
            <KpiCard
              icon={<Users className="size-4 text-purple-600 dark:text-purple-400" />}
              label="Standby STB HSE"
              value={data.stb.totalStandby}
              sub={`${data.stb.personil} personil terdaftar`}
              accent="bg-purple-500/10"
            />
          </div>

          {/* ======== GRAFIK PER STATUS ======== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="size-4 text-blue-600 dark:text-blue-400" />
                  Permintaan Design per Status
                </h3>
                <Badge variant="outline">{data.permintaan.total}</Badge>
              </div>
              <div className="h-52">
                {data.permintaan.total === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                    Belum ada data bulan ini.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={permitChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip cursor={{ fill: "rgba(0,0,0,0.05)" }} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {permitChartData.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <FileClock className="size-4 text-amber-600 dark:text-amber-400" />
                  Daily Activity per Status
                </h3>
                <Badge variant="outline">{data.daily.total}</Badge>
              </div>
              <div className="h-52">
                {data.daily.total === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                    Belum ada data bulan ini.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip cursor={{ fill: "rgba(0,0,0,0.05)" }} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {dailyChartData.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* ======== TABEL DETAIL PER MODUL ======== */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Permintaan */}
            <div className="rounded-xl border overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/50">
                <ClipboardList className="size-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-semibold">Permintaan Design</h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PERMINTaan_STATUSES.map((s) => (
                    <TableRow key={s} className="hover:bg-transparent">
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-[11px] font-medium"
                          style={{
                            backgroundColor: `${PERMINTaan_COLORS[s]}1a`,
                            color: PERMINTaan_COLORS[s],
                            borderColor: `${PERMINTaan_COLORS[s]}40`,
                          }}
                        >
                          {s}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {data.permintaan.statuses[s] || 0}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/40">
                    <TableCell className="font-semibold text-xs">Total Tiket</TableCell>
                    <TableCell className="text-right font-bold">{data.permintaan.total}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Attendance */}
            <div className="rounded-xl border overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/50">
                <UserCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-semibold">Attendance</h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { label: "Hadir (PRS)", v: data.attendance.prs, color: "#10b981" },
                    { label: "Lembur (OVT)", v: data.attendance.ovt, color: "#8b5cf6" },
                    { label: "Libur (OFF)", v: data.attendance.off, color: "#f59e0b" },
                    { label: "Absen (ABS)", v: data.attendance.abs, color: "#f43f5e" },
                  ].map((row) => (
                    <TableRow key={row.label} className="hover:bg-transparent">
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-[11px] font-medium"
                          style={{
                            backgroundColor: `${row.color}1a`,
                            color: row.color,
                            borderColor: `${row.color}40`,
                          }}
                        >
                          {row.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold">{row.v}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/40">
                    <TableCell className="font-semibold text-xs flex items-center gap-1.5">
                      <Clock className="size-3.5 text-purple-500" />
                      Lembur Total
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatMinutes(data.attendance.overtimeMinutes)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Daily Activity */}
            <div className="rounded-xl border overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/50">
                <Layers className="size-4 text-amber-600 dark:text-amber-400" />
                <h3 className="text-sm font-semibold">Daily Activity</h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {DAILY_STATUSES.map((s) => (
                    <TableRow key={s} className="hover:bg-transparent">
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-[11px] font-medium"
                          style={{
                            backgroundColor: `${DAILY_COLORS[s]}1a`,
                            color: DAILY_COLORS[s],
                            borderColor: `${DAILY_COLORS[s]}40`,
                          }}
                        >
                          {DAILY_SHORT[s]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {data.daily.statuses[s] || 0}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/40">
                    <TableCell className="font-semibold text-xs">Total Aktivitas</TableCell>
                    <TableCell className="text-right font-bold">{data.daily.total}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* STB HSE */}
            <div className="rounded-xl border overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/50">
                <Users className="size-4 text-purple-600 dark:text-purple-400" />
                <h3 className="text-sm font-semibold">STB HSE</h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Keterangan</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { label: "Personil Terdaftar", v: data.stb.personil },
                    { label: "Standby (H/h/lainnya)", v: data.stb.totalStandby },
                    { label: "Shift Siang (H)", v: data.stb.countH },
                    { label: "Shift Malam (h)", v: data.stb.countHSmall },
                    { label: "Standby Lainnya", v: data.stb.countOther },
                  ].map((row) => (
                    <TableRow key={row.label} className="hover:bg-transparent">
                      <TableCell className="text-xs font-medium">{row.label}</TableCell>
                      <TableCell className="text-right font-bold">{row.v}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}