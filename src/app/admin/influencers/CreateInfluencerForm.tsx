'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateInfluencerForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [commission, setCommission] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/create-influencer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          commission_per_order: commission,
          coupon_code: couponCode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.message || 'Failed to create influencer.' });
        return;
      }

      if (res.status === 207) {
        setMessage({ type: 'error', text: data.message || 'Influencer created, but the coupon could not be linked.' });
      } else {
        setMessage({ type: 'success', text: 'Influencer account created.' });
      }
      setName('');
      setEmail('');
      setPassword('');
      setCommission('');
      setCouponCode('');
      router.refresh();
    } catch (err) {
      setMessage({ type: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  
  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
      <div>
        <label htmlFor="name">Full Name</label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="admin-input"
        />
      </div>

      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="admin-input"
        />
      </div>

      <div>
        <label htmlFor="password">Login Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="admin-input"
        />
      </div>

      <div>
        <label htmlFor="commission">Commission per Order (₹)</label>
        <input
          id="commission"
          type="number"
          step="0.01"
          min="0"
          value={commission}
          onChange={(e) => setCommission(e.target.value)}
          required
          className="admin-input"
        />
      </div>

      <div>
        <label htmlFor="coupon">Assign Coupon Code (optional)</label>
        <input
          id="coupon"
          type="text"
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
          placeholder="e.g. INFLU10"
          className="admin-input"
        />
      </div>

      {message && (
        <p style={{ color: message.type === 'error' ? '#c0392b' : '#2e7d32', fontSize: '0.9rem' }}>
          {message.text}
        </p>
      )}

      <button type="submit" disabled={loading} className="btn-submit">
        {loading ? 'Creating...' : 'Create Influencer Account'}
      </button>
    </form>
  );
}