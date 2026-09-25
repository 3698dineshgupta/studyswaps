'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useRouter, usePathname } from 'next/navigation';

async function fetchCart() {
  const res = await fetch('/api/cart');
  if (!res.ok) throw new Error('Failed to fetch cart');
  return res.json();
}

async function addToCart(productId: string, quantity = 1) {
  const res = await fetch('/api/cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId, quantity }),
  });
  if (res.status === 401) throw new Error('LOGIN_REQUIRED');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to add to cart');
  }
  return res.json();
}

async function removeFromCart(itemId: string) {
  const res = await fetch('/api/cart', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cartItemId: itemId }),
  });
  if (!res.ok) throw new Error('Failed to remove item');
  return res.json();
}

export function useCart() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();

  const { data: cart, isLoading } = useQuery({
    queryKey: ['cart'],
    queryFn: fetchCart,
  });

  const addMutation = useMutation({
    mutationFn: ({ productId, quantity }: { productId: string; quantity?: number }) =>
      addToCart(productId, quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      toast.success('Added to cart');
    },
    onError: (err: Error) => {
      if (err.message === 'LOGIN_REQUIRED') { toast('Log in to continue'); router.push(`/login?redirectTo=${encodeURIComponent(pathname || '/')}`); return; }
      toast.error(err.message);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (itemId: string) => removeFromCart(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      toast.success('Removed from cart');
    },
    onError: () => toast.error('Failed to remove item'),
  });

  const itemCount = cart?.items?.length ?? 0;
  const total = cart?.items?.reduce((sum: number, item: { product: { price: number }; quantity: number }) =>
    sum + item.product.price * item.quantity, 0) ?? 0;

  return {
    cart,
    items: cart?.items ?? [],
    itemCount,
    total,
    isLoading,
    addToCart: addMutation.mutate,
    removeFromCart: removeMutation.mutate,
    isAdding: addMutation.isPending,
    isRemoving: removeMutation.isPending,
  };
}
