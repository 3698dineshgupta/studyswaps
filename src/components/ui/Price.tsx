import { cn, formatPrice } from '@/lib/utils';

const SIZES = { sm: 'text-base', md: 'text-lg', lg: 'text-2xl', xl: 'text-4xl' } as const;

interface PriceProps {
  value: number;
  original?: number | null;
  size?: keyof typeof SIZES;
  showDiscount?: boolean;
  className?: string;
}

/** Price with optional struck-through original and a "-N%" chip. */
export default function Price({ value, original, size = 'md', showDiscount = false, className }: PriceProps) {
  const hasDiscount = !!original && original > value;
  const pct = hasDiscount ? Math.round(((original! - value) / original!) * 100) : 0;
  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5', className)}>
      <span className={cn('font-display font-extrabold tracking-tight text-ink', SIZES[size])}>{formatPrice(value)}</span>
      {hasDiscount && <span className="text-xs text-ink-muted line-through sm:text-sm">{formatPrice(original!)}</span>}
      {hasDiscount && showDiscount && <span className="rounded-md bg-green-100 px-1.5 py-0.5 text-xs font-bold text-green-700">-{pct}%</span>}
    </span>
  );
}
