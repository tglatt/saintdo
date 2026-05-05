import type { APIRoute } from 'astro';
import { createAdminClient } from '../../../lib/supabase';
import { Resend } from 'resend';

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

  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const host  = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? new URL(request.url).hostname;
  const siteUrl = `${proto}://${host}`;
  const resend = new Resend(import.meta.env.RESEND_API_KEY);
  const from = import.meta.env.RESEND_FROM ?? 'Le Saint Domingue <noreply@saintdo.fr>';

  let sent = 0;
  const errors: { email: string; step: string; detail: string }[] = [];

  for (const membre of membres ?? []) {
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: membre.email,
      options: { redirectTo: `${siteUrl}/auth/callback?next=/espace-membre/convention` },
    });

    if (linkError || !linkData?.properties?.action_link) {
      errors.push({ email: membre.email, step: 'generateLink', detail: linkError?.message ?? 'action_link manquant' });
      continue;
    }

    const nomComplet = [membre.prenom, membre.nom].filter(Boolean).join(' ') || membre.email;
    const actionLink = linkData.properties.action_link;

    const { error: emailError } = await resend.emails.send({
      from,
      to: membre.email,
      subject: "Convention d'apport — Le Saint Domingue",
      html: `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #3a3a3a;">
  <p style="font-family: Georgia, serif; font-size: 1.3rem; font-weight: 700; color: #2C4A3E; margin: 0 0 24px;">Le Saint Domingue</p>
  <p>Bonjour ${nomComplet},</p>
  <p>À la suite de votre apport associatif, l'association Le Saint Domingue vous invite à signer votre convention d'apport.</p>
  <p>Cliquez sur le bouton ci-dessous pour accéder à votre convention et la signer en ligne :</p>
  <p style="text-align: center; margin: 32px 0;">
    <a href="${actionLink}" style="background: #2C7A6E; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.95rem; display: inline-block;">
      Signer ma convention d'apport
    </a>
  </p>
  <p style="color: #888; font-size: 0.85rem;">Ce lien est à usage unique et expirera après utilisation.</p>
  <p style="color: #888; font-size: 0.85rem;">Cordialement,<br>L'équipe du Saint Domingue</p>
</body>
</html>`,
    });

    if (emailError) {
      errors.push({ email: membre.email, step: 'resend', detail: emailError.message });
      continue;
    }

    sent++;
  }

  return new Response(JSON.stringify({ sent, errors }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
