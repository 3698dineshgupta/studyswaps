import { ReactNode } from 'react';
import Header from '@/components/layout/Header';
import MobileNav from '@/components/layout/MobileNav';
import DashboardNav from '@/components/dashboard/DashboardNav';

// One header for the whole dashboard (pages inside must NOT render their own).
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main className="page-container max-w-5xl pb-24 pt-8 lg:pb-12">
        <DashboardNav />
        {children}
      </main>
      <MobileNav />
    </>
  );
}
