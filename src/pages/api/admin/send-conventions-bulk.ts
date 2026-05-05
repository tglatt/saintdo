import type { APIRoute } from 'astro';
import { createAdminClient } from '../../../lib/supabase';
import { sendConventionEmail } from '../../../lib/send-convention-email';

export const POST: APIRoute = async ({ request }) => {
  const supabase = createAdminClient();

  const { data: apportTxs } = await supabase
    .from('transactions')
    .select('membre_id')
    .eq('type', 'apport_associatif');

  const apportIds = [...new Set(apportTxs?.map(t => t.membre_id) ?? [])];
  if (apportIds.length === 0) {
    return new Response(JSON.stringify({ sent: 0, errors: [] }), { headers: { 'Content-Type': 'application/json' } });
  }

  const { data: signed } = await supabase
    .from('conventions')
    .select('membre_id');
  const signedIds = new Set(signed?.map(c => c.membre_id) ?? []);

  const pendingIds = apportIds.filter(id => !signedIds.has(id));
  if (pendingIds.length === 0) {
    return new Response(JSON.stringify({ sent: 0, errors: [] }), { headers: { 'Content-Type': 'application/json' } });
  }

  const { data: membres } = await supabase
    .from('membres')
    .select('id, email, nom, prenom')
    .in('id', pendingIds)
    .eq('convention_enabled', true);

  const siteUrl = import.meta.env.PUBLIC_SITE_URL ?? new URL(request.url).origin;

  let sent = 0;
  const errors: { email: string; step: string; detail: string }[] = [];

  for (const membre of membres ?? []) {
    const result = await sendConventionEmail(membre, siteUrl);
    if (result.ok) {
      sent++;
    } else {
      errors.push({ email: membre.email, step: result.step, detail: result.detail });
    }
  }

  return new Response(JSON.stringify({ sent, errors }), {
    headers: { 'Content-Type': 'application/json' },
  });
};