import { ShieldCheck, ShieldX, Clock, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { VerificationStatus } from '@/types'

interface VerifiedBadgeProps {
  status: VerificationStatus
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export function VerifiedBadge({ status, size = 'md', showLabel = true }: VerifiedBadgeProps) {
  const config = {
    VERIFIED: {
      icon: ShieldCheck,
      label: 'Verified Student',
      class: 'text-primary-700 bg-primary-50',
    },
    PENDING: {
      icon: Clock,
      label: 'Pending Verification',
      class: 'text-yellow-700 bg-yellow-50',
    },
    UNDER_REVIEW: {
      icon: Clock,
      label: 'Under Review',
      class: 'text-blue-700 bg-blue-50',
    },
    REJECTED: {
      icon: ShieldX,
      label: 'Rejected',
      class: 'text-red-700 bg-red-50',
    },
    UNVERIFIED: {
      icon: Shield,
      label: 'Not Verified',
      class: 'text-gray-600 bg-gray-100',
    },
    EXPIRED: {
      icon: ShieldX,
      label: 'Expired',
      class: 'text-orange-700 bg-orange-50',
    },
    SUSPENDED: {
      icon: ShieldX,
      label: 'Suspended',
      class: 'text-red-700 bg-red-50',
    },
  }

  const { icon: Icon, label, class: cls } = config[status] || config.UNVERIFIED

  const iconSize = size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'
  const textSize = size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-sm' : 'text-xs'
  const padding = size === 'sm' ? 'px-2 py-0.5' : size === 'lg' ? 'px-3 py-1.5' : 'px-2.5 py-1'

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full font-semibold', cls, padding, textSize)}>
      <Icon className={iconSize} />
      {showLabel && label}
    </span>
  )
}

export default VerifiedBadge
