import { Resend } from 'resend';
import { createAgeToken } from './age-token';

type Membre = { id: string; email: string; nom: string | null; prenom: string | null };
type Result = { ok: true } | { ok: false; step: string; detail: string };

export async function sendAgeEmail(
  membre: Membre,
  siteUrl: string,
  pdfContent: Buffer,
): Promise<Result> {
  const nomComplet = [membre.prenom, membre.nom].filter(Boolean).join(' ') || membre.email;
  const token = createAgeToken(membre.email);
  const rsvpLink = `${siteUrl}/age/rsvp?t=${token}`;
  const from = import.meta.env.RESEND_FROM ?? 'Le Saint Domingue <noreply@saintdo.fr>';

  const resend = new Resend(import.meta.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from,
    to: membre.email,
    subject: 'Convocation — Assemblée Générale Extraordinaire · Le Saint Domingue',
    attachments: [
      {
        filename: 'Convocation_AGE_Saindo_Mai_2026.pdf',
        content: pdfContent,
      },
    ],
    html: `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #3a3a3a;">
  <p style="font-family: Georgia, serif; font-size: 1.3rem; font-weight: 700; color: #2C4A3E; margin: 0 0 24px;">Le Saint Domingue</p>
  <p>Bonjour ${nomComplet},</p>
  <p>L'association Le Saint Domingue vous convoque à une <strong>Assemblée Générale Extraordinaire (AGE)</strong> afin de procéder à la modification des statuts de l'association pour permettre l'achat de l'hôtel.</p>
  <p>Vous trouverez la convocation officielle en pièce jointe de cet email.</p>
  <p style="margin: 20px 0; line-height: 1.8;">
    <strong>Le Jeudi 28 Mai de 18H à 19H</strong><br>
    <strong>À La maison commune d'Habiterre</strong><br>
    <strong>1120 chemin des combes à Die</strong>
  </p>
  <p>Merci de nous indiquer si vous serez présent(e) ou, si vous ne pouvez pas assister, de désigner un(e) mandataire pour vous représenter :</p>
  <p style="text-align: center; margin: 32px 0;">
    <a href="${rsvpLink}" style="background: #2C7A6E; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.95rem; display: inline-block;">
      Indiquer ma présence / Donner pouvoir
    </a>
  </p>
  <p style="color: #888; font-size: 0.85rem;">Ce lien est personnel et valable 30 jours.</p>
  <p style="color: #888; font-size: 0.85rem;">Cordialement,<br>L'équipe du Saint Domingue</p>
</body>
</html>`,
  });

  if (error) {
    return { ok: false, step: 'resend', detail: error.message };
  }
  return { ok: true };
}
