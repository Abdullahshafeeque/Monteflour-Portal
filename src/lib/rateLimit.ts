import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

// Returns true if this visitor has used up their tries for this window.
// If anything goes wrong checking, it returns false (lets them through),
// so a problem with the limiter can never block a real customer.
export async function isRateLimited(
  req: NextRequest,
  name: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  try {
    const key = `${name}:${getClientIp(req)}`;
    const { data, error } = await supabaseAdmin().rpc('check_rate_limit', {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error('Rate limit check failed (allowing request):', error.message);
      return false;
    }
    return data === false;
  } catch (err) {
    console.error('Rate limit check crashed (allowing request):', err);
    return false;
  }
}