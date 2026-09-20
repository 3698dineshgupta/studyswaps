'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { ArrowRight, PackageCheck } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { ORDER_STATUS_LABELS } from '@/lib/constants';
import { commissionFor, SELLER_COMMISSION_RATE } from '@/lib/pricing';
import { fadeUp, stagger } from '@/lib/motion';
import { cn, formatPrice, formatRelativeTime } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

// What the seller can do next at each stage (StudentMarket collects the item and delivers it)
const NEXT: Record<string, { status: string; label: string }> = {
  PAYMENT_CONFIRMED: { status: 'SELLER_ACCEPTED', label: 'Accept order' },
  SELLER_NOTIFIED: { status: 'SELLER_ACCEPTED', label: 'Accept order' },
  SELLER_ACCEPTED: { status: 'PACKING', label: 'Start packing' },
  PACKING: { status: 'READY_FOR_PICKUP', label: 'Ready for collection' },
  READY_FOR_PICKUP: { status: 'PICKED_UP', label: 'Handed to StudentMarket' },
  PICKED_UP: { status: 'IN_TRANSIT', label: 'Mark in transit' },
  IN_TRANSIT: { status: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  OUT_FOR_DELIVERY: { status: 'DELIVERED', label: 'Mark delivered' },
};

const PILL: Record<string, string> = {
  PAYMENT_CONFIRMED: 'bg-sky-100 text-sky-800', DELIVERED: 'bg-green-100 text-green-800', BUYER_CONFIRMED: 'bg-green-100 text-green-800', COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-700', CREATED: 'bg-gray-100 text-gray-700', PAYMENT_PENDING: 'bg-amber-100 text-amber-800',
};

export default function DashboardOrdersPage() {
  const qc = useQueryClient();

  const { data: orders, isLoading } = useQuery({
    queryKey: ['seller-orders'],
    queryFn: async () => {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: profile } = await supabase.from('profiles').select('id').eq('auth_user_id', user.id).single();
      if (!profile) return [];
      const { data } = await supabase
        .from('orders')
        .select('id, order_number, status, subtotal, created_at, order_items(id, title, quantity, price)')
        .eq('seller_id', profile.id)
        // Unpaid orders aren't actionable for the seller yet
        .not('status', 'in', '(CREATED,PAYMENT_PENDING)')
        .order('created_at', { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const advance = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      // The status endpoint takes POST (this page used to send PUT, which never worked)
      const res = await fetch(`/api/orders/${orderId}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to update status');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['seller-orders'] }); toast.success('Order updated'); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">Orders</h1>
        <p className="mt-1 text-sm text-ink-muted">Hand items to StudentMarket — we deliver them. You never need to meet the buyer.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3" role="status" aria-label="Loading orders">{[0, 1].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : !orders?.length ? (
        <EmptyState illustration="backpack" title="No orders yet" text="When a student buys one of your items, it shows up here — ready for you to hand over." action={{ label: 'Create a listing', href: '/sell' }} />
      ) : (
        <motion.ul variants={stagger(0.06)} initial="hidden" animate="show" className="space-y-3">
          {orders.map((o) => {
            const next = NEXT[o.status];
            const gross = Number(o.subtotal);
            const net = Math.round((gross - commissionFor(gross)) * 100) / 100;
            return (
              <motion.li key={o.id} variants={fadeUp} className="card p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-semibold text-ink-muted">#{o.order_number} · {formatRelativeTime(o.created_at)}</p>
                    <p className="mt-0.5 font-display font-semibold text-ink">{o.order_items?.map((i: any) => i.title).join(', ')}</p>
                  </div>
                  <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', PILL[o.status] ?? 'bg-amber-100 text-amber-800')}>{ORDER_STATUS_LABELS[o.status] ?? o.status}</span>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                  <div className="text-sm">
                    <p className="text-ink-muted">You earn <b className="text-ink">{formatPrice(net)}</b> <span className="text-xs">({formatPrice(gross)} − {SELLER_COMMISSION_RATE * 100}% fee)</span></p>
                  </div>
                  {next ? (
                    <motion.button whileTap={{ scale: 0.97 }} disabled={advance.isPending} onClick={() => advance.mutate({ orderId: o.id, status: next.status })} className="btn-primary px-5 py-2.5 text-sm">
                      {next.label} <ArrowRight className="h-4 w-4" />
                    </motion.button>
                  ) : o.status === 'DELIVERED' ? (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-green-700"><PackageCheck className="h-4 w-4" /> Delivered — earnings unlock when the buyer confirms</p>
                  ) : null}
                </div>
              </motion.li>
            );
          })}
        </motion.ul>
      )}
    </div>
  );
}
