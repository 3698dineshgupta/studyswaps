import { ReactNode } from 'react';
import Link from 'next/link';
import { BrandMark, Wordmark } from '@/components/brand/Logo';
import AuthShowcase from '@/components/auth/AuthShowcase';
import { APP_NAME } from '@/lib/constants';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-canvas lg:grid-cols-[1.05fr_1fr]">
      <AuthShowcase />

      <div className="relative flex flex-col">
        <header className="flex items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 lg:invisible" aria-label={`${APP_NAME} home`}>
            <BrandMark className="h-9" />
            <Wordmark className="text-xl" />
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
