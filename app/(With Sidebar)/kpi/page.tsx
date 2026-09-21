import { Suspense } from "react";
import KpiClientComponent from "./ClientComponent";
import { Content } from "@/components/content";
import { Skeleton } from "@/components/ui/skeleton";

function KpiSkeleton() {
  return (
    <Content title="Key Performance Indicator (KPI)" size="lg">
      <div className="flex flex-col gap-4">
        {/* Month selector skeleton */}
        <Skeleton className="h-14 w-full rounded-xl" />

        {/* Summary cards skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>

        {/* Table skeleton */}
        <div className="rounded-xl border overflow-hidden">
          <Skeleton className="h-12 w-full rounded-none" />
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-none mt-px" />
          ))}
        </div>
      </div>
    </Content>
  );
}

export default function KpiPage() {
  return (
    <Suspense fallback={<KpiSkeleton />}>
      <KpiClientComponent />
    </Suspense>
  );
}
