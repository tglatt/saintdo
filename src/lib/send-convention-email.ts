import { Resend } from 'resend';
import { createAdminClient } from './supabase';

type Membre = { id: string; email: string; nom: string | null; prenom: string | null };
type Result = { ok: true } | { ok: false; step: 'generateLink' | 'resend'; detail: string };

export async function sendConventionEmail(membre: Membre, siteUrl: string): Promise<Result> {
  const supabase = createAdminClient();

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: membre.email,
    options: { redirectTo: `${siteUrl}/auth/callback?next=/espace-membre/convention` },
  });

  if (linkError || !linkData?.properties?.action_link) {
    return { ok: false, step: 'generateLink', detail: linkError?.message ?? 'action_link manquant' };
  }

  const nomComplet = [membre.prenom, membre.nom].filter(Boolean).join(' ') || membre.email;
  const actionLink = linkData.properties.action_link;
  const from = import.meta.env.RESEND_FROM ?? 'Le Saint Domingue <noreply@saintdo.fr>';

  const resend = new Resend(import.meta.env.RESEND_API_KEY);
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
    return { ok: false, step: 'resend', detail: emailError.message };
  }

  return { ok: true };
}
