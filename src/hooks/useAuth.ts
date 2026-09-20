'use client';

import { useAuthState } from '@/components/auth/AuthProvider';

/** Current user, from the app-wide AuthProvider (correct from the first paint). */
export function useAuth() {
  const { profile, isLoggedIn, isVerified, signOut } = useAuthState();
  const isSeller = profile?.account_status === 'ACTIVE' && isVerified;
  return { user: isLoggedIn ? { id: profile?.auth_user_id } : null, profile, loading: false, signOut, isVerified, isSeller };
}
