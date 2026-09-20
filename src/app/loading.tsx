import { Skeleton } from '@/components/ui/Skeleton';

/** Shown the instant a page starts loading, so a click always gets an immediate response. */
export default function Loading() {
  return (
    <div className="page-container py-8" role="status" aria-label="Loading">
      <Skeleton className="mb-6 h-9 w-56" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white">
            <Skeleton className="aspect-[4/3] rounded-none" />
            <div className="space-y-2 p-3.5"><Skeleton className="h-3 w-16" /><Skeleton className="h-4 w-full" /><Skeleton className="h-5 w-20" /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
