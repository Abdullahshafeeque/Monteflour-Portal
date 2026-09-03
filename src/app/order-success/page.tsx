import { supabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: { order?: string };
}) {
  const orderNumber = searchParams.order || '';
  let order: any = null;

  if (orderNumber) {
    const supabase = supabaseAdmin();
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('order_number', orderNumber)
      .eq('payment_status', 'paid')
      .maybeSingle();
    order = data;
  }

  return (
    <div className="success-wrap">
      <div className="success-box">
        {order ? (
          <>
            <div className="icon">✅</div>
            <h1>Order Confirmed!</h1>
            <p>Thank you, {order.customer_name}. Your order has been placed successfully.</p>
            <div className="order-num">Order #{order.order_number}</div>
            <p>
              A confirmation has been recorded for {order.email}. Your total was ₹
              {Number(order.total_amount).toFixed(2)}.
            </p>
          </>
        ) : (
          <>
            <div className="icon">⚠️</div>
            <h1>Order Not Found</h1>
            <p>
              We couldn&apos;t find a confirmed order with that reference. If you completed a
              payment, please contact help@monteflour.com with your details.
            </p>
          </>
        )}
        <a className="home-link" href="https://monteflour.com">Return to Monteflour.com</a>
        {order && (
          <p style={{ marginTop: '0.8rem' }}>
            <a className="home-link" href="/track-order">Track This Order</a>
          </p>
        )}
      </div>
    </div>
  );
}
