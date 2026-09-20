import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, audit, cleanSearch, pageParam } from '@/lib/admin/guard';
import { notify } from '@/lib/notify';

// GET /api/admin/users?search=&status=&verification=&page=
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, ['SUPPORT_AGENT', 'MODERATOR']);
    if (auth.error) return auth.error;
    const { admin } = auth.ctx;

    const sp = new URL(request.url).searchParams;
    const page = pageParam(sp.get('page'));
    const size = 20;
    const search = cleanSearch(sp.get('search'));
    const status = ['ACTIVE', 'SUSPENDED', 'BANNED', 'PENDING_VERIFICATION', 'DEACTIVATED'].includes(sp.get('status') || '') ? sp.get('status')! : '';
    const verification = ['UNVERIFIED', 'PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'EXPIRED', 'SUSPENDED'].includes(sp.get('verification') || '') ? sp.get('verification')! : '';

    let q = admin.from('profiles').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * size, page * size - 1);
    if (search) q = q.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,college_name.ilike.%${search}%`);
    if (status) q = q.eq('account_status', status);
    if (verification) q = q.eq('verification_status', verification);
    const { data, count, error } = await q;
    if (error) throw error;
    return NextResponse.json({ users: data ?? [], total: count ?? 0 });
  } catch (err) {
    console.error('[API] admin users GET', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const actionSchema = z.object({
  userId: z.string().uuid(),
  action: z.enum(['suspend', 'ban', 'activate']),
  note: z.string().trim().max(500).optional(),
}).strict();

// POST /api/admin/users — suspend / ban / re-activate an account (audited)
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, ['SUPPORT_AGENT']);
    if (auth.error) return auth.error;
    const { ctx } = auth;
    const { admin, profile } = ctx;

    const parsed = actionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    const { userId, action, note } = parsed.data;

    if (userId === profile.id) return NextResponse.json({ error: 'You cannot change your own account' }, { status: 400 });
    // Admins can't be moderated from here (prevents one admin locking out another)
    const { data: targetRole } = await admin.from('admin_roles').select('role').eq('profile_id', userId).eq('is_active', true).limit(1).maybeSingle();
    if (targetRole) return NextResponse.json({ error: 'Admin accounts cannot be changed here' }, { status: 403 });

    const { data: before } = await admin.from('profiles').select('account_status, full_name').eq('id', userId).maybeSingle();
    if (!before) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const next = action === 'suspend' ? 'SUSPENDED' : action === 'ban' ? 'BANNED' : 'ACTIVE';
    const { error } = await admin.from('profiles').update({ account_status: next }).eq('id', userId);
    if (error) throw error;

    // Suspending or banning also takes the seller's live listings off the marketplace
    if (next !== 'ACTIVE') await admin.from('products').update({ status: 'SUSPENDED' }).eq('seller_id', userId).eq('status', 'ACTIVE');

    await audit(ctx, request, `ADMIN_USER_${action.toUpperCase()}`, 'profile', userId, { note: note ?? null, result: next }, { account_status: before.account_status });
    await notify(userId, { type: 'SYSTEM', title: next === 'ACTIVE' ? 'Your account is active again' : 'Your account was restricted', body: next === 'ACTIVE' ? 'You can use StudentMarket normally again.' : `Your account was ${next.toLowerCase()}${note ? `: ${note}` : '.'} Contact support if you think this is a mistake.`, actionUrl: '/policies#community' });
    return NextResponse.json({ success: true, account_status: next });
  } catch (err) {
    console.error('[API] admin users POST', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
