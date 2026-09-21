import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { TelegramService } from '@/lib/telegram/service';
import { releaseDueFunds } from '@/lib/wallet/release';
import { notify } from '@/lib/notify';
import { WITHDRAWAL } from '@/lib/pricing';
import { isValidNepalPhone } from '@/lib/utils';
import { rateLimit, LIMITS } from '@/lib/security/rateLimit';

const schema = z.object({
  amount: z.number().positive().min(WITHDRAWAL.minAmount).max(WITHDRAWAL.maxAmount),
  // eSewa is the only payout method: the seller's eSewa ID is their registered mobile number
  esewaId: z.string().trim().refine((v) => isValidNepalPhone(v), 'Enter the mobile number linked to your eSewa (98XXXXXXXX)'),
});

// POST /api/wallet/withdraw — request a payout of AVAILABLE earnings to eSewa
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    
    { const limited = await rateLimit(request, LIMITS.withdraw, user.id); if (limited) return limited; }const admin = createAdminClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('id, full_name, verification_status, account_status')
      .eq('auth_user_id', user.id)
      .single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    if (profile.verification_status !== 'VERIFIED') {
      return NextResponse.json({ error: 'Only verified students can withdraw funds' }, { status: 403 });
    }
    if (profile.account_status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Your account is not active' }, { status: 403 });
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const message = first?.path[0] === 'amount'
        ? `Enter an amount between Rs. ${WITHDRAWAL.minAmount} and Rs. ${WITHDRAWAL.maxAmount.toLocaleString()}`
        : first?.message ?? 'Invalid input';
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const { amount, esewaId } = parsed.data;

    // Unlock anything due first, so the balance is current
    await releaseDueFunds(admin, profile.id);

    const { data: wallet } = await admin
      .from('wallets')
      .select('id, available_balance')
      .eq('seller_id', profile.id)
      .maybeSingle();
    if (!wallet) return NextResponse.json({ error: 'You have no earnings yet' }, { status: 404 });

    if (Number(wallet.available_balance) < amount) {
      return NextResponse.json(
        { error: `You can withdraw up to Rs. ${Number(wallet.available_balance).toLocaleString()} right now. Earnings still being held aren't available yet.`, available: wallet.available_balance },
        { status: 409 }
      );
    }

    // One open request at a time
    const { data: open } = await admin
      .from('withdrawals')
      .select('id')
      .eq('seller_id', profile.id)
      .in('status', ['REQUESTED', 'PROCESSING'])
      .limit(1)
      .maybeSingle();
    if (open) {
      return NextResponse.json({ error: 'You already have a withdrawal in progress. Please wait for it to complete.' }, { status: 409 });
    }

    // Lock the funds (atomic, writes the ledger row, raises if the balance is too low)
    const { error: deductError } = await admin.rpc('deduct_wallet_balance', {
      p_seller_id: profile.id,
      p_amount: amount,
      p_order_id: null,
      p_transaction_type: 'WITHDRAWAL_REQUESTED',
    });
    if (deductError) {
      return NextResponse.json({ error: /insufficient/i.test(deductError.message) ? 'Insufficient available balance' : 'Could not reserve your funds. Please try again.' }, { status: 409 });
    }

    const { data: withdrawal, error: insertError } = await admin
      .from('withdrawals')
      .insert({
        seller_id: profile.id,
        wallet_id: wallet.id,
        amount,
        payout_method: WITHDRAWAL.method,
        payout_details: { esewa_id: esewaId, account_name: profile.full_name },
        status: 'REQUESTED',
      })
      .select('id')
      .single();

    if (insertError || !withdrawal) {
      // Give the money back if the request couldn't be recorded
      await admin.from('wallets').update({ available_balance: Number(wallet.available_balance) }).eq('id', wallet.id);
      throw insertError;
    }

    await admin.from('audit_logs').insert({
      actor_id: profile.id,
      actor_email: user.email,
      action: 'WITHDRAWAL_REQUESTED',
      entity_type: 'withdrawal',
      entity_id: withdrawal.id,
      new_data: { amount, method: WITHDRAWAL.method },
    });

    await notify(profile.id, {
      type: 'WITHDRAWAL_UPDATE',
      title: 'Withdrawal requested',
      body: `Rs. ${amount.toLocaleString()} will be sent to eSewa ${esewaId} ${WITHDRAWAL.processingText}.`,
      actionUrl: '/dashboard/wallet',
      email: { subject: 'We received your withdrawal request', cta: 'Open my wallet' },
    });

    TelegramService.sendAdminNotification(`💸 WITHDRAWAL REQUEST\n\nSeller: ${profile.full_name}\nAmount: Rs. ${amount}\neSewa: ${esewaId}`)
      .catch((e) => console.error('[Telegram] Withdrawal notification failed:', e));

    return NextResponse.json({ success: true, withdrawalId: withdrawal.id, amount, processing: WITHDRAWAL.processingText }, { status: 201 });
  } catch (error) {
    console.error('[API] Withdraw error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
