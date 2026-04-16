import { defineMiddleware } from 'astro:middleware';
import { createClient } from '@supabase/supabase-js';

const PROTECTED_MEMBER = ['/espace-membre'];
const PROTECTED_ADMIN = ['/admin'];

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, redirect } = context;
  const pathname = new URL(url).pathname;

  const needsMember = PROTECTED_MEMBER.some(p => pathname.startsWith(p));
  const needsAdmin = PROTECTED_ADMIN.some(p => pathname.startsWith(p));

  if (!needsMember && !needsAdmin) return next();

  // Récupérer la session depuis le cookie
  const accessToken = cookies.get('sb-access-token')?.value;
  const refreshToken = cookies.get('sb-refresh-token')?.value;

  if (!accessToken || !refreshToken) {
    return redirect('/login');
  }

  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
  );

  const { data: { user }, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error || !user) {
    return redirect('/login');
  }

  if (needsAdmin) {
    // Vérifier le rôle admin dans la table membres
    const { data: membre } = await supabase
      .from('membres')
      .select('role')
      .eq('email', user.email)
      .single();

    if (membre?.role !== 'admin') {
      return redirect('/espace-membre');
    }
  }

  // Injecter l'utilisateur dans locals pour les pages
  context.locals.user = user;

  return next();
});
