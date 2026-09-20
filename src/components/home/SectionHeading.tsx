import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Reveal } from '@/components/ui/Reveal';

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  text?: string;
  action?: { label: string; href: string };
  align?: 'left' | 'center';
}

/** Consistent section header used across the homepage. */
export default function SectionHeading({ eyebrow, title, text, action, align = 'left' }: SectionHeadingProps) {
  return (
    <Reveal className={`mb-8 flex flex-wrap items-end justify-between gap-4 ${align === 'center' ? 'flex-col items-center text-center' : ''}`}>
      <div className={align === 'center' ? 'mx-auto max-w-2xl' : 'max-w-2xl'}>
        {eyebrow && <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-green-700">{eyebrow}</p>}
        <h2 className="section-title">{title}</h2>
        {text && <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{text}</p>}
      </div>
      {action && (
        <Link href={action.href} className="group inline-flex items-center gap-1.5 text-sm font-semibold text-green-700 hover:text-green-800">
          {action.label}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      )}
    </Reveal>
  );
}
