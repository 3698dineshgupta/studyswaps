import { cn } from '@/lib/utils';

const SIZES = { xs: 'h-5 w-5 text-[10px]', sm: 'h-7 w-7 text-xs', md: 'h-9 w-9 text-sm', lg: 'h-12 w-12 text-base', xl: 'h-24 w-24 text-3xl' } as const;

// Stable, pleasant tint per name so the same person always gets the same colour
const TINTS = ['bg-emerald-100 text-emerald-700', 'bg-sky-100 text-sky-700', 'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700', 'bg-violet-100 text-violet-700', 'bg-teal-100 text-teal-700'];
const tintFor = (name: string) => TINTS[name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length];

interface AvatarProps {
  name?: string | null;
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}

export default function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const label = name?.trim() || 'Student';
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold', SIZES[size], !src && tintFor(label), className)}
      aria-hidden={!src}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={label} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        label.charAt(0).toUpperCase()
      )}
    </span>
  );
}
