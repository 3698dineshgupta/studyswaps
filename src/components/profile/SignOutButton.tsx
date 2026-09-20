'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { getSupabase } from '@/lib/supabase/lazy';

/** Signs out via Supabase and refreshes server components (the old form posted to a route that doesn't exist). */
export default function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await (await getSupabase()).auth.signOut();
        router.push('/');
        router.refresh();
      }}
      className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
    >
      <LogOut className="h-4 w-4" /> {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
