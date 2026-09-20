import { createAdminClient } from '@/lib/supabase/admin';

export type WalletTransactionType =
  | 'SALE_PENDING'
  | 'SALE_RELEASED'
  | 'REFUND'
  | 'WITHDRAWAL_REQUESTED'
  | 'WITHDRAWAL_COMPLETED'
  | 'WITHDRAWAL_FAILED'
  | 'ADJUSTMENT';

export interface CreditSellerResult { success: boolean; error?: string }
export interface ReleaseResult { success: boolean; error?: string }
export interface WithdrawResult { success: boolean; error?: string }

export class WalletService {
  private supabase = createAdminClient();

  async getWallet(profileId: string) {
    const { data, error } = await this.supabase
      .from('wallets')
      .select('*')
      .eq('profile_id', profileId)
      .single();
    if (error) throw error;
    return data;
  }

  async creditSellerPending(
    profileId: string,
    orderId: string,
    amount: number
  ): Promise<CreditSellerResult> {
    try {
      const { error } = await this.supabase.rpc('credit_seller_pending', {
        p_profile_id: profileId,
        p_order_id: orderId,
        p_amount: amount,
      });
      if (error) throw error;
      return { success: true };
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message };
    }
  }

  async releasePendingToAvailable(
    profileId: string,
    orderId: string,
    amount: number
  ): Promise<ReleaseResult> {
    try {
      const { error } = await this.supabase.rpc('release_pending_to_available', {
        p_profile_id: profileId,
        p_order_id: orderId,
        p_amount: amount,
      });
      if (error) throw error;
      return { success: true };
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message };
    }
  }

  async requestWithdrawal(
    profileId: string,
    amount: number,
    paymentMethod: string,
    paymentDetails: Record<string, string>
  ): Promise<WithdrawResult> {
    try {
      const wallet = await this.getWallet(profileId);
      if (wallet.available_balance < amount) {
        return { success: false, error: 'Insufficient balance' };
      }

      const { error: deductErr } = await this.supabase.rpc('deduct_wallet_balance', {
        p_profile_id: profileId,
        p_amount: amount,
        p_type: 'WITHDRAWAL_REQUESTED',
      });
      if (deductErr) throw deductErr;

      const { error: wdErr } = await this.supabase.from('withdrawals').insert({
        profile_id: profileId,
        amount,
        currency: 'NPR',
        payment_method: paymentMethod,
        payment_details: paymentDetails,
        status: 'REQUESTED',
      });
      if (wdErr) throw wdErr;

      return { success: true };
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message };
    }
  }

  async getLedger(profileId: string, limit = 20, offset = 0) {
    const { data, error } = await this.supabase
      .from('wallet_ledger')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return data;
  }
}

export const walletService = new WalletService();
