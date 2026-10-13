import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { TelegramService } from '@/lib/telegram/service';
import { verifyWebhookSecretToken } from '@/lib/telegram/link';
import { rateLimit, LIMITS } from '@/lib/security/rateLimit';

/**
 * POST /api/telegram/webhook — Telegram calls this for every update sent to the bot.
 * Register it once with `node scripts/telegram/set-webhook.mjs` (reads TELEGRAM_BOT_TOKEN + the site URL from .env.local).
 *
 * The only command handled is `/start <code>`, sent automatically when someone opens the deep link from
 * /api/telegram/link. Everything else (the bot has no other commands) gets a short, friendly reply.
 */
export async function POST(request: NextRequest) {
  try {
    // Defense in depth: even though a caller needs the secret token below to get anywhere, cap how often
    // this URL can be hit at all (no signed-in user here, so by IP — same as the login endpoint's IP limit).
    const limited = await rateLimit(request, LIMITS.telegramWebhook);
    if (limited) return limited;

    // Telegram echoes back the `secret_token` set at registration — reject anything that doesn't have it (in
    // constant time, so the secret itself can't be inferred one byte at a time from response timing), so a
    // stranger who finds this URL can't forge chat ids onto other people's accounts.
    if (!verifyWebhookSecretToken(request.headers.get('x-telegram-bot-api-secret-token'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const update = await request.json().catch(() => null);
    const message = update?.message;
    const chatId: number | undefined = message?.chat?.id;
    const text: string = String(message?.text ?? '');
    if (!chatId) return NextResponse.json({ ok: true }); // nothing we handle (edited message, other update type, …)

    const match = text.match(/^\/start\s+([A-Z0-9]{4,16})$/i);
    if (!match) {
      await TelegramService.sendDirectMessage(chatId, "Hi! Open the “Connect Telegram” link from your StudySwaps profile to link this chat.").catch(() => {});
      return NextResponse.json({ ok: true });
    }

    const admin = createAdminClient();
    const code = match[1].toUpperCase();
    const { data: profile } = await admin
      .from('profiles')
      .select('id, full_name')
      .eq('telegram_link_code', code)
      .gt('telegram_link_expires_at', new Date().toISOString())
      .maybeSingle();

    if (!profile) {
      await TelegramService.sendDirectMessage(chatId, 'That link has expired. Go back to your StudySwaps profile and tap “Connect Telegram” again.').catch(() => {});
      return NextResponse.json({ ok: true });
    }

    const username = message?.chat?.username ? String(message.chat.username) : null;
    const { error } = await admin
      .from('profiles')
      .update({ telegram_chat_id: chatId, telegram_username: username, telegram_link_code: null, telegram_link_expires_at: null })
      .eq('id', profile.id);

    if (error) {
      // Someone else's chat id already linked (the unique index) — extremely rare, but fail kindly
      await TelegramService.sendDirectMessage(chatId, 'This Telegram account is already connected to a different StudySwaps account.').catch(() => {});
      return NextResponse.json({ ok: true });
    }

    await TelegramService.sendDirectMessage(chatId, `You're connected, ${profile.full_name ?? 'there'}! You'll get a message here whenever something needs your attention — a new order, a bargain offer, or an update on one you've made.`).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[API] telegram webhook', err instanceof Error ? err.message : 'unknown');
    // Telegram retries on non-2xx; always answer 200 so a transient error doesn't cause a retry storm
    return NextResponse.json({ ok: true });
  }
}
