'use client';

import { useId } from 'react';
import { LayoutGroup, motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { SPRING } from '@/lib/motion';

export interface TabItem<T extends string> { id: T; label: string; count?: number }

/** Underline tabs whose indicator glides between options. Fully keyboard/ARIA friendly. */
export default function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: TabItem<T>[]; value: T; onChange: (id: T) => void; className?: string }) {
  const group = useId();
  return (
    <LayoutGroup id={group}>
      <div role="tablist" className={cn('flex gap-1 overflow-x-auto border-b border-gray-200 no-scrollbar', className)}>
        {tabs.map((t) => {
          const active = t.id === value;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(t.id)}
              className={cn('relative shrink-0 px-4 py-3 text-sm font-semibold transition-colors', active ? 'text-ink' : 'text-ink-muted hover:text-ink-soft')}
            >
              <span className="flex items-center gap-1.5">
                {t.label}
                {typeof t.count === 'number' && (
                  <span className={cn('rounded-full px-1.5 py-0.5 text-[11px]', active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-ink-muted')}>{t.count}</span>
                )}
              </span>
              {active && <motion.span layoutId="tab-underline" transition={SPRING.snappy} className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-green-600" />}
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
