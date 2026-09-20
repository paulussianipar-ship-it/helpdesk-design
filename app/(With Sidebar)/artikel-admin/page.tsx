import { Suspense } from "react";
import { ArtikelAdminClientContent } from "./ClientComponent";
import { Skeleton } from "@/components/ui/skeleton";

function ArtikelAdminSkeleton() {
  return (
    <div className="col-span-12 flex flex-col gap-6">
      {/* Skeleton Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-9 w-9 rounded" />
            <Skeleton className="h-7 w-64 rounded" />
          </div>
          <Skeleton className="h-4 w-96 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>
      </div>

      {/* Skeleton 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Kolom Kiri: 8 Cols */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border bg-card overflow-hidden shadow-xs space-y-3"
              >
                <Skeleton className="h-[180px] w-full" />
                <div className="p-4 space-y-3">
                  <Skeleton className="h-5 w-4/5 rounded" />
                  <Skeleton className="h-3.5 w-full rounded" />
                  <Skeleton className="h-3.5 w-2/3 rounded" />
                  <div className="flex justify-between items-center pt-3 border-t">
                    <Skeleton className="h-4 w-20 rounded" />
                    <Skeleton className="h-4 w-12 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-2">
            <Skeleton className="h-4 w-36 rounded" />
            <Skeleton className="h-8 w-48 rounded" />
          </div>
        </div>

        {/* Kolom Kanan: 4 Cols */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <Skeleton className="h-5 w-28 rounded" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>

          <div className="rounded-xl border bg-card p-4 space-y-3">
            <Skeleton className="h-5 w-36 rounded" />
            <div className="space-y-2 pt-2 border-t">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full rounded" />
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5 space-y-3 text-center flex flex-col items-center">
            <Skeleton className="h-11 w-11 rounded-full" />
            <Skeleton className="h-5 w-44 rounded" />
            <Skeleton className="h-3.5 w-60 rounded" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ArtikelAdminPage() {
  return (
    <Suspense fallback={<ArtikelAdminSkeleton />}>
      <ArtikelAdminClientContent />
    </Suspense>
  );
}
