import { CheckCircle, Circle, Clock } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface TimelineEvent {
  status: string;
  description: string;
  created_at: string;
  actor?: string;
}

interface OrderTimelineProps {
  events: TimelineEvent[];
  currentStatus?: string;
}

const STATUS_SEQUENCE = [
  'CREATED', 'PAYMENT_CONFIRMED', 'SELLER_NOTIFIED', 'SELLER_ACCEPTED',
  'PACKING', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY',
  'DELIVERED', 'BUYER_CONFIRMED', 'COMPLETED',
];

const STATUS_LABELS: Record<string, string> = {
  CREATED: 'Order Placed',
  PAYMENT_CONFIRMED: 'Payment Confirmed',
  SELLER_NOTIFIED: 'Seller Notified',
  SELLER_ACCEPTED: 'Seller Accepted',
  PACKING: 'Packing',
  READY_FOR_PICKUP: 'Ready for Pickup',
  PICKED_UP: 'Picked Up',
  IN_TRANSIT: 'In Transit',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  BUYER_CONFIRMED: 'Delivery Confirmed',
  COMPLETED: 'Completed',
};

export default function OrderTimeline({ events, currentStatus }: OrderTimelineProps) {
  const activeStatus = currentStatus ?? events[events.length - 1]?.status ?? '';
  const currentIdx = STATUS_SEQUENCE.indexOf(activeStatus);

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-100" />
      <div className="space-y-6">
        {STATUS_SEQUENCE.map((status, idx) => {
          const event = events.find(e => e.status === status);
          const isDone = idx <= currentIdx;
          const isCurrent = idx === currentIdx;

          return (
            <div key={status} className="relative flex gap-4 pl-9">
              <div className={`absolute left-2.5 w-4 h-4 rounded-full flex items-center justify-center border-2 ${
                isDone
                  ? 'bg-green-600 border-green-600'
                  : 'bg-white border-gray-200'
              }`}>
                {isDone ? (
                  <CheckCircle className="w-3 h-3 text-white" />
                ) : (
                  <Circle className="w-3 h-3 text-gray-200" />
                )}
              </div>
              <div className={`flex-1 pb-1 ${!isDone ? 'opacity-40' : ''}`}>
                <p className={`text-sm font-semibold ${isCurrent ? 'text-green-600' : isDone ? 'text-gray-900' : 'text-gray-400'}`}>
                  {STATUS_LABELS[status] || status}
                  {isCurrent && <span className="ml-2 text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">Current</span>}
                </p>
                {event && (
                  <>
                    {event.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{event.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(event.created_at)}
                    </p>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
