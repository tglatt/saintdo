import type { APIRoute } from 'astro';
import { createHmac } from 'crypto';
import { createAdminClient } from '../../lib/supabase';

export const GET: APIRoute = async ({ request, redirect }) => {
  const token = new URL(request.url).searchParams.get('t');
  if (!token) return redirect('/login');

  try {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return redirect('/login');

    const secret = import.meta.env.CONVENTION_SECRET;
    const expected = createHmac('sha256', secret).update(payload).digest('base64url');
    if (sig !== expected) return redirect('/login');

    const { email, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (Date.now() > exp) return redirect('/login?expired=convention');

    const supabase = createAdminClient();
    const siteUrl = import.meta.env.PUBLIC_SITE_URL ?? new URL(request.url).origin;
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${siteUrl}/auth/callback?next=/espace-membre/convention` },
    });

    if (error || !data?.properties?.action_link) return redirect('/login');
    return redirect(data.properties.action_link);
  } catch {
    return redirect('/login');
  }
};
