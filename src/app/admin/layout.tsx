import { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getFastUser } from '@/lib/auth/session';
import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
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
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-gray-900 text-sm">StudentMarket</span>
              <span className="text-xs text-gray-400 ml-2">Admin</span>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">{adminRole.role}</span>
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">← Site</Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          <AdminNav />
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
