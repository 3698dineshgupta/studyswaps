import { BadgeCheck } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import Rating from '@/components/ui/Rating';
import { cn } from '@/lib/utils';

interface SellerBadgeProps {
  name?: string | null;
  photo?: string | null;
  verified?: boolean;
  rating?: number | null;
  reviews?: number | null;
  size?: 'sm' | 'md';
  className?: string;
}

/** Seller avatar + name + verified tick (+ rating). Used on cards, the product page and orders. */
export default function SellerBadge({ name, photo, verified, rating, reviews, size = 'sm', className }: SellerBadgeProps) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2', className)}>
      <Avatar name={name} src={photo} size={size === 'md' ? 'md' : 'xs'} />
      <span className="min-w-0">
        <span className={cn('flex items-center gap-1 font-medium text-ink-soft', size === 'md' ? 'text-sm' : 'text-xs')}>
          <span className="truncate">{name || 'Student'}</span>
          {verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 fill-green-600 text-white" aria-label="Verified student" />}
        </span>
        {size === 'md' && (rating || rating === 0) ? <Rating value={rating} count={reviews} /> : null}
      </span>
    </span>
  );
}
