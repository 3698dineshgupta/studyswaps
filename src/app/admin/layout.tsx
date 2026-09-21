import { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getFastUser } from '@/lib/auth/session';
import Link from 'next/link';
import { BrandMark } from '@/components/brand/Logo';
import AdminNav from '@/components/admin/AdminNav';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = createClient();

  // Signature-verified locally (no auth-server round trip) + ONE query for the role. Data behind the pages is
  // fetched through /api/admin/*, which checks the role again on every request.
  const user = await getFastUser(supabase);
  if (!user) notFound();

  const { data: row } = await createAdminClient()
    .from('profiles')
    .select('id, admin_roles!admin_roles_profile_id_fkey(role, is_active, granted_at)')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  const adminRole = ((row?.admin_roles ?? []) as { role: string; is_active: boolean; granted_at: string }[])
    .filter((r) => r.is_active)
    .sort((x, y) => x.granted_at.localeCompare(y.granted_at))[0] ?? null;

  if (!adminRole) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-4">
          <Link href="/admin" className="flex min-w-0 items-center gap-2.5">
            <BrandMark className="h-8" />
            <div>
              <span className="font-bold text-gray-900 text-sm">StudySwaps</span>
              <span className="ml-2 text-xs text-gray-400">Admin</span>
            </div>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden max-w-[9rem] truncate rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 sm:inline">{adminRole.role}</span>
            <Link href="/" className="whitespace-nowrap text-sm font-medium text-gray-500 hover:text-gray-700">← Site</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pb-10 lg:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
          <AdminNav />
          <main className="min-w-0 flex-1 pt-2 lg:pt-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
