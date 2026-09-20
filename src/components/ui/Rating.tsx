import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Star rating with optional review count. Renders nothing meaningful for unrated sellers. */
export default function Rating({ value, count, size = 'sm', className }: { value?: number | null; count?: number | null; size?: 'sm' | 'md'; className?: string }) {
  if (!value || value <= 0) return <span className={cn('text-xs text-ink-muted', className)}>New seller</span>;
  const px = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium text-ink-soft', className)} aria-label={`Rated ${value.toFixed(1)} out of 5`}>
      <Star className={cn(px, 'fill-amber-400 text-amber-400')} aria-hidden />
      {value.toFixed(1)}
      {count ? <span className="text-ink-muted">({count})</span> : null}
    </span>
  );
}
