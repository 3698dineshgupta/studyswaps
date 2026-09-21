import { fetchOwnProfile } from '@/lib/profile';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Metadata } from 'next';
import { BadgeCheck, CalendarDays, GraduationCap, MapPin, Plus, ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import Header from '@/components/layout/Header';
import MobileNav from '@/components/layout/MobileNav';
import Avatar from '@/components/ui/Avatar';
import Rating from '@/components/ui/Rating';
import ProfileTabs from '@/components/profile/ProfileTabs';
import SignOutButton from '@/components/profile/SignOutButton';
import type { CardProduct } from '@/components/marketplace/ProductCard';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Profile — StudySwaps' };
export const dynamic = 'force-dynamic';

/* eslint-disable @typescript-eslint/no-explicit-any */
const PRODUCT_FIELDS = 'id, title, price, original_price, condition, location, created_at, status, product_images(storage_path, is_primary), category:categories(name, slug)';

export default async function ProfilePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirectTo=/profile');

  const profile = await fetchOwnProfile(supabase, user.id);
  if (!profile) redirect('/login');

  const [listingsRes, ordersRes, reviewsRes, savedRes] = await Promise.all([
    supabase.from('products').select(PRODUCT_FIELDS).eq('seller_id', profile.id).order('created_at', { ascending: false }),
    supabase.from('orders').select('id, order_number, status, total, created_at, order_items(title)').eq('buyer_id', profile.id).order('created_at', { ascending: false }).limit(20),
    supabase.from('reviews').select('id, rating, title, content, created_at').eq('seller_id', profile.id).order('created_at', { ascending: false }).limit(20),
    supabase.from('wishlists').select(`product:products(${PRODUCT_FIELDS})`).eq('profile_id', profile.id).order('created_at', { ascending: false }),
  ]);

  const asCard = (p: any): CardProduct => ({ ...p, images: p.product_images, seller: { full_name: profile.full_name, verification_status: profile.verification_status, profile_photo: profile.profile_photo } });
  const listings = ((listingsRes.data ?? []) as any[]).map(asCard);
  const saved = ((savedRes.data ?? []) as any[]).map((r) => r.product).filter(Boolean).map(asCard);
  const orders = ((ordersRes.data ?? []) as any[]).map((o) => ({ id: o.id, order_number: o.order_number, status: o.status, total: Number(o.total), created_at: o.created_at, title: o.order_items?.[0]?.title ?? 'Order' }));
  const reviews = (reviewsRes.data ?? []) as any[];

  const verified = profile.verification_status === 'VERIFIED';
  const stats = [
    { label: 'Listings', value: listings.length },
    { label: 'Sales', value: profile.total_sales ?? 0 },
    { label: 'Purchases', value: orders.length },
    { label: 'Wishlist', value: saved.length },
  ];

  return (
    <>
      <Header />
      <main className="pb-24 lg:pb-0">
        <div className="page-container max-w-5xl py-8 sm:py-10">
          {/* Identity card */}
          <section className="relative overflow-hidden rounded-3xl border border-gray-200/70 bg-white shadow-soft">
            <div className="h-28 bg-[radial-gradient(80%_120%_at_20%_0%,#bbf7d0,transparent),radial-gradient(60%_100%_at_90%_0%,#a7f3d0,transparent)] bg-emerald-50 sm:h-36" />
            <div className="px-5 pb-6 sm:px-8">
              <div className="-mt-12 flex flex-wrap items-end justify-between gap-4 sm:-mt-14">
                <Avatar name={profile.full_name} src={profile.profile_photo} size="xl" className="ring-4 ring-white" />
                <div className="flex flex-wrap gap-2 pb-1">
                  <Link href="/sell" className="btn-primary px-5 py-2.5 text-sm"><Plus className="h-4 w-4" /> Sell an item</Link>
                  <SignOutButton />
                </div>
              </div>

              <div className="mt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{profile.full_name}</h1>
                  {verified ? (
                    <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800"><BadgeCheck className="h-3.5 w-3.5" /> Verified Student</span>
                  ) : (
                    <Link href="/verify" className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 hover:bg-amber-200"><ShieldAlert className="h-3.5 w-3.5" /> Get verified</Link>
                  )}
                </div>
                <p className="mt-1 text-sm text-ink-muted">{user.email}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-ink-soft">
                  {profile.college_name && <span className="flex items-center gap-1.5"><GraduationCap className="h-4 w-4 text-green-600" /> {profile.college_name}</span>}
                  {profile.location && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-green-600" /> {profile.location}</span>}
                  <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-green-600" /> Joined {formatDate(profile.created_at)}</span>
                  <Rating value={profile.seller_rating} count={profile.seller_review_count} size="md" />
                </div>
              </div>

              <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {stats.map((s) => (
                  <div key={s.label} className="rounded-2xl bg-gray-50 p-4 text-center">
                    <dd className="font-display text-2xl font-extrabold text-ink">{s.value}</dd>
                    <dt className="text-xs font-medium text-ink-muted">{s.label}</dt>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          <div className="mt-8">
            <ProfileTabs listings={listings} orders={orders} reviews={reviews} saved={saved} />
          </div>
        </div>
      </main>
      <MobileNav />
    </>
  );
}
