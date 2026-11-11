import { redirect } from 'next/navigation';
import { supabaseServerClient } from '@/lib/supabaseServer';
import { isAdmin } from '@/lib/roles';

// Returns the logged-in admin, or null if the caller is not an admin.
// getUser() asks Supabase to confirm the login, so it can't be faked with a cookie.
export async function getAdminUser() {
  const supabase = supabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return isAdmin(user) ? user : null;
}

// Use at the top of an admin action. Non-admins are sent to the login page.
export async function requireAdmin() {
  const user = await getAdminUser();
  if (!user) redirect('/admin-login');
  return user;
}