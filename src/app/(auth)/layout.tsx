import { ReactNode } from 'react';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import AuthShowcase from '@/components/auth/AuthShowcase';
import { APP_NAME } from '@/lib/constants';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-canvas lg:grid-cols-[1.05fr_1fr]">
      <AuthShowcase />

      <div className="relative flex flex-col">
        <header className="flex items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 lg:invisible" aria-label={`${APP_NAME} home`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-600 shadow-[0_6px_16px_-6px_rgba(22,163,74,0.7)]"><BookOpen className="h-5 w-5 text-white" /></span>
            <span className="font-display text-lg font-bold tracking-tight text-ink">Student<span className="text-green-600">Market</span></span>
          </Link>
          <Link href="/" className="text-sm font-medium text-ink-muted transition-colors hover:text-ink">← Back to marketplace</Link>
        </header>

        <main className="flex flex-1 items-center justify-center px-5 pb-10 sm:px-8">{children}</main>

        <footer className="px-5 pb-6 text-center text-xs text-ink-muted sm:px-8">
          <Link href="/policies#terms" className="hover:text-ink">Terms</Link> · <Link href="/policies#privacy" className="hover:text-ink">Privacy</Link> · <Link href="/policies" className="hover:text-ink">Policies</Link>
          <p className="mt-1">© {new Date().getFullYear()} {APP_NAME}. Made for students, by students.</p>
        </footer>
      </div>
    </div>
  );
}
