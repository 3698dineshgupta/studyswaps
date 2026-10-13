import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getFastUser } from '@/lib/auth/session';
import { rateLimit, LIMITS } from '@/lib/security/rateLimit';
import { generateLinkCode, getBotUsername, LINK_CODE_TTL_MS, telegramConfigured } from '@/lib/telegram/link';

// POST /api/telegram/link — issue a short-lived code + deep link to connect this account's own Telegram
export async function POST(request: NextRequest) {
  try {
    if (!telegramConfigured()) return NextResponse.json({ error: 'Telegram is not set up on this site yet' }, { status: 503 });

    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    { const limited = await rateLimit(request, LIMITS.telegramLink, user.id); if (limited) return limited; }

    const username = await getBotUsername();
    if (!username) return NextResponse.json({ error: 'Could not reach Telegram. Please try again.' }, { status: 502 });

    const admin = createAdminClient();
    const { data: profile } = await admin.from('profiles').select('id, telegram_chat_id').eq('auth_user_id', user.id).single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    if (profile.telegram_chat_id) return NextResponse.json({ error: 'Telegram is already connected' }, { status: 409 });

    const code = generateLinkCode();
    const { error: updateError } = await admin
      .from('profiles')
      .update({ telegram_link_code: code, telegram_link_expires_at: new Date(Date.now() + LINK_CODE_TTL_MS).toISOString() })
      .eq('id', profile.id);
    if (updateError) throw updateError;

    return NextResponse.json({ deepLink: `https://t.me/${username}?start=${code}`, code, expiresInMinutes: Math.round(LINK_CODE_TTL_MS / 60000) });
  } catch (err) {
    console.error('[API] telegram link', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

// GET /api/telegram/link — whether THIS account already has Telegram connected (polled every few seconds
// while the connect popup is open, so this uses the fast local token check like other read paths do)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const user = await getFastUser(supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    { const limited = await rateLimit(request, LIMITS.read, user.id); if (limited) return limited; }

    const admin = createAdminClient();
    const { data: profile } = await admin.from('profiles').select('telegram_chat_id, telegram_username').eq('auth_user_id', user.id).single();
    return NextResponse.json({ connected: !!profile?.telegram_chat_id, username: profile?.telegram_username ?? null, configured: telegramConfigured() });
  } catch (err) {
    console.error('[API] telegram link status', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/telegram/link — disconnect
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    { const limited = await rateLimit(request, LIMITS.telegramLink, user.id); if (limited) return limited; }

    const admin = createAdminClient();
    const { error: updateError } = await admin
      .from('profiles')
      .update({ telegram_chat_id: null, telegram_username: null, telegram_link_code: null, telegram_link_expires_at: null })
      .eq('auth_user_id', user.id);
    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[API] telegram unlink', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
