import type { APIRoute } from 'astro';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createAdminClient } from '../../../lib/supabase';
import { sendAgeEmail } from '../../../lib/send-age-email';

export const POST: APIRoute = async ({ request }) => {
  const supabase = createAdminClient();

  const { data: membres } = await supabase
    .from('membres')
    .select('id, email, nom, prenom')
    .eq('age_email_activation', true)
    .order('nom', { ascending: true });

  if (!membres || membres.length === 0) {
    return new Response(JSON.stringify({ sent: 0, errors: [] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const siteUrl = import.meta.env.PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const pdfContent = await readFile(
    join(process.cwd(), 'public', 'AGE202605', 'Convocation_AGE_Saindo_Mai_2026.pdf'),
  );

  let sent = 0;
  const errors: { email: string; step: string; detail: string }[] = [];

  for (const membre of membres) {
    const result = await sendAgeEmail(membre, siteUrl, pdfContent);
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
