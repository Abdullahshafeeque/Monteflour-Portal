import Link from 'next/link';
import StatusSelect from '@/components/StatusSelect';
import PrintLabelButton from '@/components/PrintLabelButton';
import { supabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const supabase = supabaseAdmin();
  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!order) {
    return (
      <main className="admin-main">
        <div className="empty">Order not found.</div>
        <Link href="/admin/dashboard" className="back-link">&larr; Back to orders</Link>
      </main>
    );
  }

  return (
    <main className="admin-main">
      <Link href="/admin/dashboard" className="back-link">&larr; Back to orders</Link>

      <div className="order-detail-head">
        <h1>Order {order.order_number}</h1>
                <div className="order-detail-actions">
          <PrintLabelButton orderId={order.id} currentStatus={order.fulfillment_status || 'new'} />
        </div>
      </div>

      <div className="order-detail-grid">
        <div className="admin-card">
          <h3>Customer</h3>
          <p><strong>{order.customer_name}</strong></p>
          <p>{order.phone}</p>
          <p>{order.email}</p>
        </div>

        <div className="admin-card">
          <h3>Shipping Address</h3>
          <p>{order.address_line1}</p>
          {order.address_line2 && <p>{order.address_line2}</p>}
          <p>{order.city}, {order.state} - {order.pincode}</p>
        </div>

        <div className="admin-card">
          <h3>Order Summary</h3>
          <p>Quantity: {order.quantity}</p>
          <p>Coupon: {order.coupon_code || '—'}</p>
          <p>Subtotal: ₹{Number(order.subtotal).toFixed(2)}</p>
          <p>Discount: ₹{Number(order.discount_amount).toFixed(2)}</p>
          <p>Shipping: ₹{Number(order.shipping_fee).toFixed(2)}</p>
          <p><strong>Total: ₹{Number(order.total_amount).toFixed(2)}</strong></p>
        </div>

        <div className="admin-card">
          <h3>Status</h3>
          <p>Payment: <span className={`badge ${order.payment_status}`}>{order.payment_status}</span></p>
          <p>Fulfillment: <StatusSelect orderId={order.id} currentStatus={order.fulfillment_status || 'new'} /></p>
          <p>Placed: {new Date(order.created_at).toLocaleString('en-IN')}</p>
        </div>
      </div>
    </main>
  );
}