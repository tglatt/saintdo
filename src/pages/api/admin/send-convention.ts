import type { APIRoute } from 'astro';
import { createAdminClient } from '../../../lib/supabase';
import { Resend } from 'resend';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  if (!body?.membre_id) return new Response('membre_id requis', { status: 400 });

  const supabase = createAdminClient();

  const { data: membre } = await supabase
    .from('membres')
    .select('id, email, nom, prenom')
    .eq('id', body.membre_id)
    .single();

  if (!membre) return new Response('Membre introuvable', { status: 404 });

  await supabase
    .from('membres')
    .update({ convention_enabled: true, updated_at: new Date().toISOString() })
    .eq('id', body.membre_id);

  const siteUrl = new URL(request.url).origin;
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: membre.email,
    options: {
      redirectTo: `${siteUrl}/auth/callback?next=/espace-membre/convention`,
    },
  });

  if (linkError || !linkData?.properties?.action_link) {
    console.error('[send-convention] generateLink error:', linkError);
    return new Response('Erreur lors de la génération du lien', { status: 500 });
  }

  const resend = new Resend(import.meta.env.RESEND_API_KEY);
  const nomComplet = [membre.prenom, membre.nom].filter(Boolean).join(' ') || membre.email;
  const actionLink = linkData.properties.action_link;
  const from = import.meta.env.RESEND_FROM ?? 'Le Saint Domingue <noreply@saintdo.fr>';

  const { error: emailError } = await resend.emails.send({
    from,
    to: membre.email,
    subject: "Convention d'apport — Le Saindo",
    html: `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #3a3a3a;">
  <p style="font-family: Georgia, serif; font-size: 1.3rem; font-weight: 700; color: #2C4A3E; margin: 0 0 24px;">Le Saint Domingue</p>
  <p>Bonjour ${nomComplet},</p>
  <p>A la suite de votre apport associatif, L'association Le Saint Domingue vous invite à signer votre convention d'apport associatif.</p>
  <p>Cliquez sur le bouton ci-dessous pour accéder à votre convention et la signer en ligne :</p>
  <p style="text-align: center; margin: 32px 0;">
    <a href="${actionLink}" style="background: #2C7A6E; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.95rem; display: inline-block;">
      Signer ma convention d'apport
    </a>
  </p>
  <p style="color: #888; font-size: 0.85rem;">Ce lien est à usage unique et expirera après utilisation.</p>
  <p style="color: #888; font-size: 0.85rem;">Cordialement,<br>L'équipe du Saindo</p>
</body>
</html>`,
  });

  if (emailError) {
    console.error('[send-convention] Resend error:', emailError);
    return new Response("Erreur lors de l'envoi de l'email", { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
