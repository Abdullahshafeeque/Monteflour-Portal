'use client';
import { useState } from 'react';
import Script from 'next/script';

const UNIT_PRICE = Number(process.env.NEXT_PUBLIC_PRODUCT_PRICE || 0);
const PRODUCT_NAME = process.env.NEXT_PUBLIC_PRODUCT_NAME || 'Monteflour';
const SHIPPING_FEE = Number(process.env.NEXT_PUBLIC_SHIPPING_FEE || 0);
const FREE_SHIPPING_ABOVE = Number(process.env.NEXT_PUBLIC_FREE_SHIPPING_ABOVE || 0);

declare global {
  interface Window {
    Razorpay: any;
  }
}

type CouponState = { code: string; discount_amount: number } | null;

export default function CheckoutPage() {
  const [qty, setQty] = useState(1);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponState>(null);
  const [couponMsg, setCouponMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', address1: '', address2: '', city: '', state: '', pincode: '',
  });
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);
  const [razorpayReady, setRazorpayReady] = useState(false);

  const subtotal = UNIT_PRICE * qty;
  const discount = appliedCoupon ? Math.min(appliedCoupon.discount_amount, subtotal) : 0;
  const afterDiscount = subtotal - discount;
  const shipping = FREE_SHIPPING_ABOVE > 0 && afterDiscount >= FREE_SHIPPING_ABOVE ? 0 : SHIPPING_FEE;
  const total = afterDiscount + shipping;
  const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  async function applyCoupon(code: string) {
    if (!code) return;
    try {
      const res = await fetch('/api/apply-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal }),
      });
      const data = await res.json();
      if (data.valid) {
        setAppliedCoupon({ code: data.code, discount_amount: data.discount_amount });
        setCouponMsg({ text: data.message, ok: true });
      } else {
        setAppliedCoupon(null);
        setCouponMsg({ text: data.message, ok: false });
      }
    } catch {
      setCouponMsg({ text: 'Could not validate coupon. Try again.', ok: false });
    }
  }

  function changeQty(delta: number) {
    setQty((q) => Math.max(1, q + delta));
    if (appliedCoupon) {
      setAppliedCoupon(null);
      setCouponMsg({ text: 'Quantity changed — please reapply your coupon.', ok: false });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!razorpayReady || typeof window.Razorpay === 'undefined') {
      setError('Payment is still loading — please wait a couple of seconds and try again.');
      return;
    }

    setPaying(true);

    try {
      const res = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, quantity: qty, coupon_code: appliedCoupon?.code || '' }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please check your details.');
        setPaying(false);
        return;
      }

      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: 'Monteflour',
        description: 'Order payment',
        order_id: data.razorpay_order_id,
        prefill: { name: data.name, email: data.email, contact: data.phone },
        theme: { color: '#1B3A5C' },
        handler: async function (response: any) {
          const verifyRes = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(response),
          });
          const verifyData = await verifyRes.json();
          if (verifyData.success) {
            window.location.href = '/order-success?order=' + encodeURIComponent(verifyData.order_number);
          } else {
            setError('Payment could not be verified. If money was deducted, contact help@monteflour.com.');
          }
        },
        modal: {
          ondismiss: function () {
            setPaying(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
      setPaying(false);
    } catch {
      setError('Network error. Please try again.');
      setPaying(false);
    }
  }

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setRazorpayReady(true)}
      />
      <div className="topbar">
        <a href="https://monteflour.com"><img src="/logo.svg" alt="Monteflour" className="topbar-logo" /></a>
        <a href="/track-order" className="topbar-track-link">Track Order</a>
      </div>
      <div className="wrap">
        <div>
          <h1>Order Summary</h1>
          <div className="card">
            <div className="product-row">
              <div className="product-thumb">
                <img src="/product.jpg" alt={PRODUCT_NAME} />
              </div>
              <div>
                <div className="product-name">{PRODUCT_NAME}</div>
                <div className="product-sub">{fmt(UNIT_PRICE)} per box</div>
                <div className="qty-control">
                  <button type="button" className="qty-btn" onClick={() => changeQty(-1)}>−</button>
                  <span className="qty-val">{qty}</span>
                  <button type="button" className="qty-btn" onClick={() => changeQty(1)}>+</button>
                </div>
              </div>
            </div>

            <div className="coupon-row">
              <input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                placeholder="Coupon code"
              />
              <button type="button" onClick={() => applyCoupon(couponInput)}>Apply</button>
            </div>
            {couponMsg && <div className={`coupon-msg ${couponMsg.ok ? 'ok' : 'err'}`}>{couponMsg.text}</div>}

            <div className="totals-row"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
            {discount > 0 && (
              <div className="totals-row discount"><span>Discount</span><span>−{fmt(discount)}</span></div>
            )}
            <div className="totals-row"><span>Shipping</span><span>{shipping === 0 ? 'FREE' : fmt(shipping)}</span></div>
            <div className="totals-row grand"><span>Total</span><span>{fmt(total)}</span></div>
          </div>
        </div>

        <div>
          <h1>Delivery Details</h1>
          <div className="card">
            {error && <div className="form-error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Full Name</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Phone Number</label>
                  <input required maxLength={10} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Address Line 1</label>
                <input required value={form.address1} onChange={(e) => setForm({ ...form, address1: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Address Line 2 (optional)</label>
                <input value={form.address2} onChange={(e) => setForm({ ...form, address2: e.target.value })} />
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label>City</label>
                  <input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>State</label>
                  <input required value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Pincode</label>
                <input required maxLength={6} value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
              </div>

              <button type="submit" className="pay-btn" disabled={paying || !razorpayReady}>
                {paying ? 'Processing...' : razorpayReady ? 'Pay & Place Order' : 'Loading payment gateway...'}
              </button>
              <div className="secure-note">🔒 Secure payment powered by Razorpay</div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
