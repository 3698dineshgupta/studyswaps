'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCity } from '@/components/city/CityProvider';

interface ProductFilters {
  search?: string;
  category?: string;
  condition?: string;
  min_price?: number;
  max_price?: number;
  negotiable?: boolean;
  sort?: string;
  page?: number;
  limit?: number;
  city?: string;
}

async function fetchProducts(filters: ProductFilters = {}, signal?: AbortSignal) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) params.set(k, String(v));
  });
  const res = await fetch(`/api/products?${params.toString()}`, { signal });
  if (!res.ok) throw new Error('Failed to fetch products');
  return res.json();
}

async function fetchProduct(id: string) {
  const res = await fetch(`/api/products/${id}`);
  if (!res.ok) throw new Error('Product not found');
  return (await res.json()).product;
}

export function useProducts(filters: ProductFilters = {}, initialData?: unknown, enabled = true) {
  // Listings are per launch city; switching city refetches
  const { city } = useCity();
  const withCity = { ...filters, city: filters.city ?? city ?? undefined };
  return useQuery({
    queryKey: ['products', withCity],
    // The signal lets the browser abandon a request the user has already typed past
    queryFn: ({ signal }) => fetchProducts(withCity, signal),
    staleTime: 30000,
    enabled,
    placeholderData: keepPreviousData, // no flash of skeletons between filter changes
    initialData: initialData ?? undefined,
  });
}

export function useProduct(id: string, initialData?: unknown) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => fetchProduct(id),
    enabled: !!id,
    initialData: initialData ?? undefined,
    staleTime: 60_000,
  });
}
