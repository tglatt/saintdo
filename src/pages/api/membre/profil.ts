import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const PUT: APIRoute = async ({ cookies, request }) => {
  const accessToken  = cookies.get('sb-access-token')?.value;
  const refreshToken = cookies.get('sb-refresh-token')?.value;
  if (!accessToken || !refreshToken) return new Response('Unauthorized', { status: 401 });

  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
  );
  const { data: { user }, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error || !user) return new Response('Unauthorized', { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return new Response('Invalid JSON', { status: 400 });

  const { address, zip_code, city, date_naissance, ville_naissance, departement_naissance } = body;

  const admin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { error: updateError } = await admin
    .from('membres')
    .update({
      address:               address               || null,
      zip_code:              zip_code              || null,
      city:                  city                  || null,
      date_naissance:        date_naissance        || null,
      ville_naissance:       ville_naissance       || null,
      departement_naissance: departement_naissance || null,
      updated_at: new Date().toISOString(),
    })
    .eq('email', user.email);

  if (updateError) return new Response(updateError.message, { status: 500 });
  return new Response(null, { status: 204 });
};
