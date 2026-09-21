import Image from 'next/image'
import { cn } from '@/lib/utils'

/** The StudySwaps mark (cap + books + swap arrows) with the two-tone wordmark, as in the brand logo. */
export function BrandMark({ className, priority }: { className?: string; priority?: boolean }) {
  return <Image src="/brand/logo-mark.png" alt="" width={548} height={417} priority={priority} className={cn('h-9 w-auto shrink-0', className)} />
}

/** Wordmark as live text (sharp at any size). `tone="dark"` swaps the dark half to white for dark backgrounds. */
export function Wordmark({ className, tone = 'light' }: { className?: string; tone?: 'light' | 'dark' }) {
  return (
    <span className={cn('font-display font-extrabold tracking-tight', className)}>
      <span className={tone === 'dark' ? 'text-white' : 'text-[#0b6b52]'}>Study</span>
      <span className={tone === 'dark' ? 'text-[#5fd068]' : 'text-[#3fb44a]'}>Swaps</span>
    </span>
  )
}
