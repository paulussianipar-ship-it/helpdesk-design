"use client";

import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";

export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 shadow-2xs">
      <CalendarClock className="size-4 text-primary shrink-0" />
      <div className="leading-tight text-right">
        <span className="block text-xs font-semibold text-foreground whitespace-nowrap">
          {now
            ? now.toLocaleDateString("id-ID", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
              })
            : "Memuat..."}
        </span>
        <span className="block text-[11px] text-muted-foreground tabular-nums">
          {now ? now.toLocaleTimeString("id-ID") : ""}
        </span>
      </div>
    </div>
  );
}