import { ReactNode } from 'react';
import MarketplaceChrome from '@/components/layout/MarketplaceChrome';
import MobileNav from '@/components/layout/MobileNav';

export default function MarketplaceLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MarketplaceChrome />
      <main className="min-h-screen bg-gray-50 pb-20 md:pb-8">
        {children}
      </main>
      <MobileNav />
    </>
  );
}
