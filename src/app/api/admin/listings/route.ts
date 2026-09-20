import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, audit, cleanSearch, pageParam } from '@/lib/admin/guard';
import { notify } from '@/lib/notify';
import { TelegramService } from '@/lib/telegram/service';

const STATUSES = ['PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'SUSPENDED', 'SOLD', 'ARCHIVED', 'DRAFT'];

// GET /api/admin/listings?status=PENDING_REVIEW&search=&page=  — the moderation queue
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, ['MODERATOR']);
    if (auth.error) return auth.error;
    const { admin } = auth.ctx;

    const sp = new URL(request.url).searchParams;
    const page = pageParam(sp.get('page'));
    const size = 12;
    const status = STATUSES.includes(sp.get('status') || '') ? sp.get('status')! : 'PENDING_REVIEW';
    const search = cleanSearch(sp.get('search'));

    let q = admin
      .from('products')
      .select(`id, listing_number, title, description, price, original_price, condition, location, status, quantity, created_at, seller_id,
        profiles!products_seller_id_fkey(id, full_name, phone, college_name, verification_status, total_sales),
        product_images(storage_path, is_primary, sort_order),
        categories(name)`, { count: 'exact' })
      .eq('status', status)
      .order('created_at', { ascending: status === 'PENDING_REVIEW' }) // oldest first in the queue
      .range((page - 1) * size, page * size - 1);
    if (search) q = q.or(`title.ilike.%${search}%,listing_number.ilike.%${search}%`);
    const { data, count, error } = await q;
    if (error) throw error;

    // Queue sizes for the tabs
    const counts: Record<string, number> = {};
    await Promise.all(STATUSES.slice(0, 5).map(async (s) => {
      const r = await admin.from('products').select('id', { count: 'exact', head: true }).eq('status', s);
      counts[s] = r.count ?? 0;
    }));
    return NextResponse.json({ listings: data ?? [], total: count ?? 0, counts });
  } catch (err) {
    console.error('[API] admin listings GET', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const actionSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(['approve', 'reject', 'suspend', 'restore', 'archive']),
  reason: z.string().trim().max(500).optional(),
}).strict();

const NEXT: Record<string, { status: string; from: string[] }> = {
  approve: { status: 'ACTIVE', from: ['PENDING_REVIEW', 'REJECTED', 'SUSPENDED'] },
  reject: { status: 'REJECTED', from: ['PENDING_REVIEW', 'ACTIVE'] },
  suspend: { status: 'SUSPENDED', from: ['ACTIVE'] },
  restore: { status: 'ACTIVE', from: ['SUSPENDED', 'ARCHIVED'] },
  archive: { status: 'ARCHIVED', from: ['ACTIVE', 'SUSPENDED', 'REJECTED', 'PENDING_REVIEW'] },
};

// POST /api/admin/listings — approve / reject / suspend / restore / archive
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, ['MODERATOR']);
    if (auth.error) return auth.error;
    const { ctx } = auth;
    const { admin } = ctx;

    const parsed = actionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    const { id, action, reason } = parsed.data;
    if ((action === 'reject' || action === 'suspend') && (!reason || reason.length < 5)) {
      return NextResponse.json({ error: 'Please give the seller a reason (at least 5 characters)' }, { status: 400 });
    }

    const { data: product } = await admin.from('products').select('id, title, status, seller_id, listing_number, price').eq('id', id).maybeSingle();
    if (!product) return NextResponse.json({ error: 'Listing not found' }, { status: 404 });

    const rule = NEXT[action];
    if (!rule.from.includes(product.status)) {
      return NextResponse.json({ error: `A ${product.status.toLowerCase().replace('_', ' ')} listing can't be ${action}d` }, { status: 409 });
    }
    // Compare-and-set: two moderators clicking at once can't both act
    const { data: updated, error } = await admin.from('products').update({ status: rule.status }).eq('id', id).eq('status', product.status).select('id');
    if (error) throw error;
    if (!updated?.length) return NextResponse.json({ error: 'Someone else already handled this listing' }, { status: 409 });

    await audit(ctx, request, `LISTING_${action.toUpperCase()}`, 'product', id, { reason: reason ?? null, to: rule.status }, { status: product.status });

    const link = `/product/${id}`;
    if (action === 'approve' || action === 'restore') {
      await notify(product.seller_id, { type: 'LISTING_STATUS', title: 'Your listing is live 🎉', body: `"${product.title}" was approved and is now visible to buyers.`, actionUrl: link, email: { subject: 'Your listing is live on StudentMarket 🎉', cta: 'View your listing' } });
    } else if (action === 'reject') {
      await notify(product.seller_id, { type: 'LISTING_STATUS', title: 'Listing not approved', body: `"${product.title}" wasn't approved: ${reason}. You can create a new listing with the fixes.`, actionUrl: '/dashboard/listings', email: { subject: 'Your listing was not approved', cta: 'Open my listings' } });
    } else if (action === 'suspend') {
      await notify(product.seller_id, { type: 'LISTING_STATUS', title: 'Listing taken down', body: `"${product.title}" was removed from the marketplace: ${reason}`, actionUrl: '/dashboard/listings', email: { subject: 'Your listing was taken down', cta: 'Open my listings' } });
    }
    TelegramService.sendAdminNotification(`LISTING ${action.toUpperCase()}\n${product.listing_number ?? ''} ${product.title}\nBy: ${ctx.profile.full_name ?? 'admin'}${reason ? `\nReason: ${reason}` : ''}`).catch(() => {});

    return NextResponse.json({ success: true, status: rule.status });
  } catch (err) {
    console.error('[API] admin listings POST', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
