'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Eye, Pencil, Trash2, Package } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { formatPrice, formatRelativeTime } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function DashboardListingsPage() {
  const [tab, setTab] = useState<'ACTIVE' | 'DRAFT' | 'SOLD'>('ACTIVE');
  const queryClient = useQueryClient();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: listings, isLoading } = useQuery({
    queryKey: ['seller-listings', tab],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: profile } = await supabase.from('profiles').select('id').eq('auth_user_id', user.id).single();
      if (!profile) return [];
      const { data } = await supabase
        .from('products')
        .select('*, product_images(storage_path, is_primary)')
        .eq('seller_id', profile.id)
        .eq('status', tab)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete listing');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-listings'] });
      toast.success('Listing removed');
    },
    onError: () => toast.error('Failed to remove listing'),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">My Listings</h2>
        <Link href="/sell"><Button size="sm"><Plus className="w-4 h-4" /> Add Item</Button></Link>
      </div>

      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {(['ACTIVE', 'DRAFT', 'SOLD'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === t ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>{t}</button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : listings?.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No {tab.toLowerCase()} listings</p>
        </div>
      ) : (
        <div className="space-y-3">
          {listings?.map((l: { id: string; title: string; price: number; status: string; views_count: number; created_at: string }) => (
            <div key={l.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
              <div className="w-16 h-16 bg-gray-100 rounded-xl flex-shrink-0 flex items-center justify-center text-2xl">📦</div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{l.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{formatRelativeTime(l.created_at)}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-sm font-bold text-green-600">{formatPrice(l.price)}</span>
                  <span className="text-xs text-gray-400 flex items-center gap-1"><Eye className="w-3 h-3" />{l.views_count || 0}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link href={`/product/${l.id}`}>
                  <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                    <Eye className="w-4 h-4" />
                  </button>
                </Link>
                <button
                  onClick={() => { if (confirm('Remove this listing?')) deleteMutation.mutate(l.id); }}
                  className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
