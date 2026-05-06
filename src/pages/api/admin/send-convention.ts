import type { APIRoute } from 'astro';
import { createAdminClient } from '../../../lib/supabase';
import { sendConventionEmail } from '../../../lib/send-convention-email';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  if (!body?.membre_id) return new Response('membre_id requis', { status: 400 });

  const supabase = createAdminClient();

  const { data: membre } = await supabase
    .from('membres')
    .select('id, email, nom, prenom, convention_email_sent_at')
    .eq('id', body.membre_id)
    .single();

  if (!membre) return new Response('Membre introuvable', { status: 404 });

  if (membre.convention_email_sent_at) {
    const sentAt = new Date(membre.convention_email_sent_at).getTime();
    if (Date.now() - sentAt < 24 * 60 * 60 * 1000) {
      return new Response('Un email a déjà été envoyé dans les dernières 24h', { status: 429 });
    }
  }

  await supabase
    .from('membres')
    .update({ convention_enabled: true, updated_at: new Date().toISOString() })
    .eq('id', body.membre_id);

  const siteUrl = import.meta.env.PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const result = await sendConventionEmail(membre, siteUrl);

  if (!result.ok) {
    console.error(`[send-convention] ${result.step}:`, result.detail);
    return new Response(result.detail, { status: 500 });
  }

  await supabase
    .from('membres')
    .update({ convention_email_sent_at: new Date().toISOString() })
    .eq('id', body.membre_id);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
