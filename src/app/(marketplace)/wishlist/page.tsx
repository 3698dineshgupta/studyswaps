'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { Eye, ShoppingBag } from 'lucide-react';
import ProductCard, { type CardProduct } from '@/components/marketplace/ProductCard';
import EmptyState from '@/components/ui/EmptyState';
import { ProductGridSkeleton } from '@/components/ui/Skeleton';
import { useWishlist } from '@/hooks/useWishlist';
import { useCart } from '@/hooks/useCart';
import { getSupabase } from '@/lib/supabase/lazy';
import { useAuthState } from '@/components/auth/AuthProvider';
import { listItem, SPRING } from '@/lib/motion';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function WishlistPage() {
  const { ids, ready } = useWishlist();
  const { addToCart, isAdding } = useCart();
  const { profile } = useAuthState(); // the profile id arrived with the page: no extra lookups

  const { data, isLoading } = useQuery({
    queryKey: ['wishlist', profile?.id],
    queryFn: async () => {
      if (!profile) return [] as CardProduct[];
      const supabase = await getSupabase();
      const { data: rows } = await supabase
        .from('wishlists')
        .select('product:products(id, title, price, original_price, condition, location, created_at, status, product_images(storage_path, is_primary), seller:profiles!products_seller_id_fkey(full_name, verification_status, profile_photo), category:categories(name, slug))')
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: false });
      return ((rows ?? []) as any[]).map((r) => r.product).filter(Boolean).map((p) => ({ ...p, images: p.product_images })) as CardProduct[];
    },
  });

  // Derived from the live wishlist ids, so un-hearting a card removes it with an exit animation
  const products = useMemo(() => (data ?? []).filter((p) => ids.includes(p.id)), [data, ids]);

  return (
    <div className="page-container py-8 sm:py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">Your wishlist</h1>
          {products.length > 0 && <p className="mt-1 text-sm text-ink-muted">{products.length} saved {products.length === 1 ? 'item' : 'items'}</p>}
        </div>
      </div>

      {isLoading || !ready ? (
        <ProductGridSkeleton count={5} />
      ) : products.length === 0 ? (
        <EmptyState illustration="productCard" title="Your wishlist is waiting." text="Save products you want to keep an eye on." action={{ label: 'Explore Marketplace', href: '/browse' }} />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          <AnimatePresence initial={false} mode="popLayout">
            {products.map((p) => (
              <motion.li key={p.id} layout transition={SPRING.soft} {...listItem} className="flex flex-col gap-2">
                <ProductCard product={p} className="flex-1" />
                <div className="flex gap-2">
                  <motion.button whileTap={{ scale: 0.96 }} onClick={() => addToCart({ productId: p.id })} disabled={isAdding} className="btn-primary flex-1 px-3 py-2 text-sm"><ShoppingBag className="h-4 w-4" /> Add to cart</motion.button>
                  <Link href={`/product/${p.id}`} aria-label={`View ${p.title}`} className="btn-secondary px-3 py-2 text-sm"><Eye className="h-4 w-4" /></Link>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
