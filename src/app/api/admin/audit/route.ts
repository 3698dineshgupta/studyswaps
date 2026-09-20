import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, cleanSearch, pageParam } from '@/lib/admin/guard';

// GET /api/admin/audit?search=&page= — who did what, when. Admins only.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, []);
    if (auth.error) return auth.error;
    const { admin } = auth.ctx;

    const sp = new URL(request.url).searchParams;
    const page = pageParam(sp.get('page'));
    const size = 30;
    const search = cleanSearch(sp.get('search'), 40);
    let q = admin.from('audit_logs').select('id, action, entity_type, entity_id, actor_email, actor_role, new_data, ip_address, created_at', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * size, page * size - 1);
    if (search) q = q.or(`action.ilike.%${search}%,actor_email.ilike.%${search}%,entity_type.ilike.%${search}%`);
    const { data, count, error } = await q;
    if (error) throw error;
    return NextResponse.json({ logs: data ?? [], total: count ?? 0 });
  } catch (err) {
    console.error('[API] admin audit', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
