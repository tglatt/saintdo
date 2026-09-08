import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from './supabase';

// Le middleware ne protège que /admin/* : les routes /api/admin/* doivent donc
// vérifier elles-mêmes que l'appelant est bien un membre avec le rôle admin.
export async function isAdmin(cookies: {
  get: (name: string) => { value: string } | undefined;
}): Promise<boolean> {
  const accessToken  = cookies.get('sb-access-token')?.value;
  const refreshToken = cookies.get('sb-refresh-token')?.value;
  if (!accessToken || !refreshToken) return false;

  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
  );
  const { data: { user }, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error || !user) return false;

  const { data: membre } = await createAdminClient()
    .from('membres')
    .select('role')
    .eq('email', user.email)
    .single();

  return membre?.role === 'admin';
}
