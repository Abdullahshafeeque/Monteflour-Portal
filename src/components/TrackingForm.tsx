'use client';
import { useState, useTransition } from 'react';
import { updateTracking } from '@/app/admin/orders/actions';

const COURIERS = [
  { key: 'delhivery', label: 'Delhivery', trackUrl: (awb: string) => `https://www.delhivery.com/track-v2/package/${awb}` },
  { key: 'india_post', label: 'India Post', trackUrl: (awb: string) => `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?id=${awb}` },
  { key: 'other', label: 'Other', trackUrl: null },
];

export default function TrackingForm({
  orderId,
  currentCourier,
  currentTrackingNumber,
}: {
  orderId: number;
  currentCourier: string | null;
  currentTrackingNumber: string | null;
}) {
  const [courier, setCourier] = useState(currentCourier || 'delhivery');
  const [trackingNumber, setTrackingNumber] = useState(currentTrackingNumber || '');
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSave() {
    startTransition(async () => {
      const result = await updateTracking(orderId, courier, trackingNumber.trim());
      setSaved(!result.error);
    });
  }

  const activeCourier = COURIERS.find((c) => c.key === courier);
  const trackUrl = activeCourier?.trackUrl && trackingNumber.trim() ? activeCourier.trackUrl(trackingNumber.trim()) : null;

  return (
    <div className="tracking-form">
      <div className="tracking-form-row">
        <select value={courier} onChange={(e) => { setCourier(e.target.value); setSaved(false); }}>
          {COURIERS.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Tracking / AWB number"
          value={trackingNumber}
          onChange={(e) => { setTrackingNumber(e.target.value); setSaved(false); }}
        />
        <button className="btn-submit" onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
      {saved && <p className="tracking-saved">Saved.</p>}
      {trackUrl && (
        <a href={trackUrl} target="_blank" rel="noopener noreferrer" className="btn-submit tracking-track-link">
          Track Shipment
        </a>
      )}
    </div>
  );
}