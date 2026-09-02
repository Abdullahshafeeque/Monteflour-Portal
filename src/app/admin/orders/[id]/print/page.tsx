import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabaseServer';
import PrintTrigger from '@/components/PrintTrigger';

export const dynamic = 'force-dynamic';

export default async function PrintShippingLabelPage({ params }: { params: { id: string } }) {
  const supabase = supabaseAdmin();
  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!order) notFound();

  if (!order.fulfillment_status || order.fulfillment_status === 'new') {
    await supabase
      .from('orders')
      .update({ fulfillment_status: 'packed', packed_at: new Date().toISOString() })
      .eq('id', order.id);
  }

  return (
    <div className="shipping-label">
      <PrintTrigger />
      <div className="label-header">
        <div className="label-brand">MONTEFLOUR</div>
        <div className="label-doc-title">Shipping Label</div>
      </div>

      <div className="label-section">
        <span className="label-caption">Ship To</span>
        <div className="label-name">{order.customer_name}</div>
        <div>{order.address_line1}</div>
        {order.address_line2 && <div>{order.address_line2}</div>}
        <div>{order.city}, {order.state} - {order.pincode}</div>
        <div>Phone: {order.phone}</div>
      </div>

      <div className="label-section label-meta">
        <div><span className="label-caption">Order #</span><div>{order.order_number}</div></div>
        <div><span className="label-caption">Date</span><div>{new Date(order.created_at).toLocaleDateString('en-IN')}</div></div>
        <div><span className="label-caption">Quantity</span><div>{order.quantity}</div></div>
        <div><span className="label-caption">Payment</span><div>{order.payment_status.toUpperCase()}</div></div>
      </div>

      <div className="label-section">
        <span className="label-caption">From</span>
        <div>Monteflour</div>
        <div>Kannur, Kerala, India</div>
      </div>
    </div>
  );
}