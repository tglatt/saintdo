import type { APIRoute } from 'astro';
import { createAdminClient } from '../../lib/supabase';
import { corsHeaders, corsPreflight } from '../../lib/cors';

export const OPTIONS: APIRoute = corsPreflight;

export const POST: APIRoute = async ({ request }) => {
  const cors = corsHeaders(request);
  const body = await request.json().catch(() => null);
  const email = body?.email?.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response('Email invalide', { status: 400, headers: cors });
  }

  // La base est la source de vérité des inscriptions. Une adresse déjà inscrite est
  // ignorée (pas d'erreur côté visiteur, et son état d'export vers Brevo est conservé).
  // L'export vers Brevo est fait une fois par jour par /api/cron/export-newsletter.
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('newsletter_inscriptions')
    .upsert({ email }, { onConflict: 'email', ignoreDuplicates: true });

  if (error) {
    console.error('[newsletter]', error);
    return new Response("Erreur lors de l'inscription", { status: 500, headers: cors });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', ...cors },
  });
};
