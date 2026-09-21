import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Camera, Coins, Rocket } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import ListingForm from '@/components/seller/ListingForm';
import Header from '@/components/layout/Header';
import MobileNav from '@/components/layout/MobileNav';
import SellerVerificationGate from '@/components/verification/SellerVerificationGate';

export const metadata: Metadata = { title: 'Sell — StudySwaps' };

export default async function SellPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirectTo=/sell');

  const { data: profile } = await supabase
    .from('profiles')
    .select('verification_status, full_name, college_name')
    .eq('auth_user_id', user.id)
    .single();

  if (!profile) redirect('/login?redirectTo=/sell');
  // Buyers can sign up and shop freely; identity verification is asked for only here, when they want to sell.
  const needsVerification = profile.verification_status !== 'VERIFIED';

  return (
    <>
      <Header />
      {needsVerification && <SellerVerificationGate status={profile.verification_status} defaults={{ full_name: profile.full_name, college_name: profile.college_name ?? undefined }} />}
      <main className="pb-24 lg:pb-0" aria-hidden={needsVerification} inert={needsVerification ? ('' as unknown as boolean) : undefined}>
        <section className="relative overflow-hidden bg-canvas">
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-green-200/40 blur-3xl" />
          <div className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-emerald-200/30 blur-3xl" />
          <div className="page-container relative max-w-3xl pb-6 pt-12 text-center sm:pt-16">
            <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">Sell to students who need it.</h1>
            <p className="mx-auto mt-3 max-w-xl text-base text-ink-muted sm:text-lg">List your unused books, gadgets and hostel items in a few minutes.</p>
            <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-ink-soft">
              <li className="flex items-center gap-2"><Camera className="h-4 w-4 text-green-600" /> Snap photos</li>
              <li className="flex items-center gap-2"><Coins className="h-4 w-4 text-green-600" /> Set your price</li>
              <li className="flex items-center gap-2"><Rocket className="h-4 w-4 text-green-600" /> We handle the handover</li>
            </ul>
          </div>
        </section>

        <div className="page-container max-w-3xl pb-14 pt-4">
          <ListingForm />
        </div>
      </main>
      <MobileNav />
    </>
  );
}
