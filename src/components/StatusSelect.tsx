'use client';
import { useState, useTransition } from 'react';
import { updateFulfillmentStatus } from '@/app/admin/orders/actions';

const STATUSES = ['new', 'packed', 'shipped', 'delivered', 'cancelled'];

export default function StatusSelect({ orderId, currentStatus }: { orderId: number; currentStatus: string }) {
  const [status, setStatus] = useState(currentStatus);
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value;
    const prev = status;
    setStatus(newStatus);
    startTransition(async () => {
      const result = await updateFulfillmentStatus(orderId, newStatus);
      if (result.error) setStatus(prev);
    });
  }

  return (
    <select
      className={`status-select fulfillment-${status}`}
      value={status}
      onChange={handleChange}
      disabled={isPending}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}