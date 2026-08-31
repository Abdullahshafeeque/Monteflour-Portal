'use client';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

export default function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = supabaseBrowser();
    await supabase.auth.signOut();
    router.push('/admin-login');
    router.refresh();
  }

  return (
    <button onClick={handleSignOut} className="nav-link-btn">
      Log Out
    </button>
  );
}
