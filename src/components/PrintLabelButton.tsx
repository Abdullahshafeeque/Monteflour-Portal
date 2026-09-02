'use client';
import { useTransition } from 'react';
import { updateFulfillmentStatus } from '@/app/admin/orders/actions';

export default function PrintLabelButton({ orderId, currentStatus }: { orderId: number; currentStatus: string }) {
  const [, startTransition] = useTransition();

  function handleClick() {
    window.open(`/admin/orders/${orderId}/print`, '_blank', 'noopener,noreferrer');
    if (currentStatus === 'new') {
      startTransition(() => {
        updateFulfillmentStatus(orderId, 'packed');
      });
    }
  }

  return (
    <button className="btn-submit" onClick={handleClick}>
      Print Shipping Label
    </button>
  );
}