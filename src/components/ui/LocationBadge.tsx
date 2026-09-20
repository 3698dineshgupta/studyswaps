import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LocationBadge({ location, distance, className }: { location?: string | null; distance?: string | null; className?: string }) {
  if (!location) return null;
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1 text-xs text-ink-muted', className)}>
      <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">{location}</span>
      {distance && <span className="shrink-0 font-medium text-ink-soft">· {distance}</span>}
    </span>
  );
}
