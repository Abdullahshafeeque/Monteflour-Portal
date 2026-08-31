import { supabaseAdmin } from '@/lib/supabaseServer';
import { revalidatePath } from 'next/cache';

export default async function InfluencerDashboard({ user }: { user: any }) {
  const supabase = supabaseAdmin();

  // Fetch influencer details and their coupons
  const { data: influencer } = await supabase.from('influencers').select('*').eq('id', user.id).single();
  const { data: coupons } = await supabase.from('coupons').select('code').eq('influencer_id', user.id);
  const couponCodes = coupons?.map(c => c.code) || [];

  // Calculate Total Earnings (Count of paid orders using their codes * commission rate)
  const { count: orderCount } = await supabase.from('orders')
    .select('*', { count: 'exact', head: true })
    .in('coupon_code', couponCodes)
    .eq('payment_status', 'paid');
    
  const totalEarned = (orderCount || 0) * (influencer?.commission_per_order || 0);

  // Calculate Total Payouts Requested
  const { data: payouts } = await supabase.from('payout_requests')
    .select('amount')
    .eq('influencer_id', user.id);
    
  const totalRequested = payouts?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const availableBalance = totalEarned - totalRequested;

  // Server Action for Requesting Payout
  async function requestPayout() {
    'use server';
    if (availableBalance <= 0) return;
    const adminClient = supabaseAdmin();
    
    await adminClient.from('payout_requests').insert({
      influencer_id: user.id,
      amount: availableBalance,
      status: 'pending'
    });
    
    // NOTE: You can trigger a Nodemailer or Resend email function here to alert help@monteflour.com
    revalidatePath('/influencer/dashboard');
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1>Welcome, {influencer?.name}</h1>
      <div className="grid grid-cols-2 gap-4 my-8">
        <div className="p-6 bg-white rounded shadow">
          <h3>Available Balance</h3>
          <p className="text-3xl font-bold text-navy">₹{availableBalance.toFixed(2)}</p>
        </div>
        <div className="p-6 bg-white rounded shadow">
          <h3>Total Orders Driven</h3>
          <p className="text-3xl font-bold text-navy">{orderCount}</p>
        </div>
      </div>
      
      <form action={requestPayout}>
        <button 
          disabled={availableBalance <= 0}
          className="bg-peach text-navy font-bold py-3 px-6 rounded disabled:opacity-50"
        >
          Request Payout
        </button>
      </form>
    </div>
  );
}