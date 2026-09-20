'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getSupabase } from '@/lib/supabase/lazy';
import { useAuthState } from '@/components/auth/AuthProvider';

interface WishlistState { profileId: string | null; ids: string[] }
const KEY = ['wishlist-ids'];

/**
 * Real, optimistic wishlist backed by the `wishlists` table (RLS: users only touch their own rows).
 * Every ProductCard shares one cached query, so N hearts cost one request.
 */
export function useWishlist() {
  // The signed-in profile id already arrived with the page (server-rendered), so no extra lookups are needed
  const { profile } = useAuthState();
  const qc = useQueryClient();
  const router = useRouter();
  const key = [...KEY, profile?.id ?? 'guest'];

  const { data } = useQuery<WishlistState>({
    queryKey: key,
    staleTime: 60_000,
    queryFn: async () => {
      if (!profile) return { profileId: null, ids: [] }; // guests: nothing to fetch, nothing to load
      const supabase = await getSupabase();
      const { data: rows } = await supabase.from('wishlists').select('product_id').eq('profile_id', profile.id);
      return { profileId: profile.id, ids: (rows ?? []).map((r) => r.product_id as string) };
    },
  });

  const mutation = useMutation({
    mutationFn: async ({ productId, add }: { productId: string; add: boolean }) => {
      const profileId = data?.profileId;
      if (!profileId) throw new Error('LOGIN');
      const supabase = await getSupabase();
      const { error } = add
        ? await supabase.from('wishlists').insert({ profile_id: profileId, product_id: productId })
        : await supabase.from('wishlists').delete().eq('profile_id', profileId).eq('product_id', productId);
      if (error && error.code !== '23505') throw error; // 23505 = already saved
    },
    // Optimistic: the heart flips instantly, and rolls back if the request fails
    onMutate: async ({ productId, add }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<WishlistState>(key);
      if (prev) qc.setQueryData<WishlistState>(key, { ...prev, ids: add ? [...prev.ids, productId] : prev.ids.filter((id) => id !== productId) });
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      toast.error(err instanceof Error && err.message === 'LOGIN' ? 'Log in to save items' : 'Could not update your wishlist');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['wishlist'] }),
  });

  const isWishlisted = useCallback((id: string) => !!data?.ids.includes(id), [data]);

  const toggle = useCallback(
    (productId: string) => {
      if (data && !data.profileId) {
        toast('Log in to save items', { icon: '💚' });
        router.push('/login?redirectTo=/wishlist');
        return;
      }
      mutation.mutate({ productId, add: !data?.ids.includes(productId) });
    },
    [data, mutation, router]
  );

  return { ready: data !== undefined, ids: data?.ids ?? [], count: data?.ids.length ?? 0, isWishlisted, toggle, loggedIn: !!data?.profileId };
}
