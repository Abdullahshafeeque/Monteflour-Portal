import type { User } from '@supabase/supabase-js';

// app_metadata can only be written by your server (or the Supabase dashboard),
// never by a user from their browser, so it is safe to use for roles.
export function isAdmin(user: User | null | undefined): boolean {
  return user?.app_metadata?.role === 'admin';
}

export function displayName(user: User | null | undefined): string {
  return (user?.app_metadata?.name as string) || user?.email || 'Admin';
}