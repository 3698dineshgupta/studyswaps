import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'green' | 'blue' | 'yellow' | 'red' | 'gray' | 'purple';
  size?: 'sm' | 'md';
  className?: string;
}

function Badge({ children, variant = 'green', size = 'md', className }: BadgeProps) {
  const variants = {
    green: 'bg-green-100 text-green-700 border-green-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    gray: 'bg-gray-100 text-gray-600 border-gray-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
  };
  const sizes = { sm: 'px-2 py-0.5 text-xs', md: 'px-2.5 py-1 text-xs' };
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full font-medium border', variants[variant], sizes[size], className)}>
      {children}
    </span>
  );
}

export { Badge }
export default Badge
