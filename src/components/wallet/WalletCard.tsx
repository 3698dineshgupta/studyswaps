import { Wallet, TrendingUp, Clock, ArrowUpRight } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import Button from '@/components/ui/Button';

interface WalletCardProps {
  availableBalance: number;
  pendingBalance: number;
  totalEarnings?: number;
  onWithdraw?: () => void;
  loading?: boolean;
}

export default function WalletCard({ availableBalance, pendingBalance, totalEarnings, onWithdraw, loading }: WalletCardProps) {
  return (
    <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-2xl p-5 text-white shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
          <span className="font-semibold">My Wallet</span>
        </div>
        {onWithdraw && (
          <Button variant="secondary" size="sm" onClick={onWithdraw} className="bg-white/20 hover:bg-white/30 text-white border-0">
            <ArrowUpRight className="w-4 h-4" /> Withdraw
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white/10 rounded-xl p-3">
          <p className="text-white/70 text-xs mb-1">Available</p>
          <p className="text-2xl font-bold">{formatPrice(availableBalance)}</p>
        </div>
        <div className="bg-white/10 rounded-xl p-3">
          <p className="text-white/70 text-xs mb-1 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Pending
          </p>
          <p className="text-2xl font-bold">{formatPrice(pendingBalance)}</p>
        </div>
      </div>

      {totalEarnings !== undefined && (
        <div className="flex items-center gap-2 text-white/80 text-sm">
          <TrendingUp className="w-4 h-4" />
          Total Earnings: {formatPrice(totalEarnings)}
        </div>
      )}
    </div>
  );
}
