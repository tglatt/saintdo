import { Resend } from 'resend';

type Reponses = {
  email: string;
  nom: string;
  prenom: string;
  telephone: string;
  intitule_projet: string;
  vous_et_votre_projet: Record<string, unknown>;
  besoins_espaces: Record<string, unknown>;
  mutualisation: Record<string, unknown>;
  projection: Record<string, unknown>;
  envies: Record<string, unknown>;
};

type Result = { ok: true } | { ok: false; detail: string };

function formatValue(v: unknown): string {
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

const SECTION_LABELS: Record<string, string> = {
  vous_et_votre_projet: 'Vous et votre projet',
  besoins_espaces: 'Besoins en espaces de travail et conditions économiques',
  mutualisation: 'Mutualisation et contribution à la vie du lieu',
  projection: 'Projection dans le projet',
  envies: 'Des envies, des attentes, des idées sur la vie du lieu ?',
};

const FIELD_LABELS: Record<string, string> = {
  autres_membres: 'Autres membres impliqué·es',
  porteurs_bio: 'Les porteur·se·s de projet',
  description: 'Description du projet',
  statut: 'Statut',
  objectif_economique: 'Objectif économique',
  stade_avancement: "Stade d'avancement",
  partenaires: 'Partenaires potentiels',
  aides: "Aides accordées ou dossiers en cours d'instruction",
  typologie: "Typologie d'espaces recherchés",
  typologie_autre: 'Autres typologies',
  besoins_techniques: 'Besoins techniques particuliers',
  surface: 'Surface du local nécessaire',
  surface_precisions: 'Précisions sur la surface',
  frequence: "Fréquence d'occupation",
  horaires: "Horaires principaux d'utilisation",
  budget: 'Budget mensuel maximum envisageable',
  contribution: 'Contribution à la vie du lieu',
  contribution_autre: 'Autre contribution',
  mutualisation_types: 'Types de mutualisation utiles',
  mutualisation_autre: 'Autre mutualisation',
  cooperation: 'Types de coopération envisagés',
  cooperation_autre: 'Autre coopération',
  integration_phase: "Intégration à l'ouverture (automne 2026)",
  duree: 'Durée de projection',
  freins: "Freins à l'intégration du lieu",
  freins_autre: 'Autre frein',
  inspirations: 'Exemples de projets qui inspirent',
  remarques: 'Remarques libres',
};

function sectionHtml(title: string, data: Record<string, unknown>): string {
  const rows = Object.entries(data)
    .map(([key, value]) => `
      <tr>
        <td style="padding: 6px 12px 6px 0; color: #888; font-size: 0.85rem; white-space: nowrap; vertical-align: top;">${FIELD_LABELS[key] ?? key}</td>
        <td style="padding: 6px 0; font-size: 0.9rem;">${formatValue(value)}</td>
      </tr>`)
    .join('');
  return `
    <h3 style="font-family: Georgia, serif; font-size: 1rem; color: #2D2A68; margin: 24px 0 8px;">${title}</h3>
    <table style="width: 100%; border-collapse: collapse;">${rows}</table>`;
}

export async function sendProjetConfirmationEmail(reponses: Reponses, siteUrl: string): Promise<Result> {
  const nomComplet = [reponses.prenom, reponses.nom].filter(Boolean).join(' ') || reponses.email;
  const from = import.meta.env.RESEND_FROM ?? 'Le Saindo <noreply@saindo.org>';

  const recapHtml = [
    sectionHtml(SECTION_LABELS.vous_et_votre_projet, reponses.vous_et_votre_projet),
    sectionHtml(SECTION_LABELS.besoins_espaces, reponses.besoins_espaces),
    sectionHtml(SECTION_LABELS.mutualisation, reponses.mutualisation),
    sectionHtml(SECTION_LABELS.projection, reponses.projection),
    sectionHtml(SECTION_LABELS.envies, reponses.envies),
  ].join('');

  const resend = new Resend(import.meta.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from,
    to: reponses.email,
    subject: 'Votre projet pour le Saindo — confirmation',
    html: `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family: system-ui, sans-serif; max-width: 640px; margin: 0 auto; padding: 32px 24px; color: #3a3a3a;">
  <p style="font-family: Georgia, serif; font-size: 1.3rem; font-weight: 700; color: #2D2A68; margin: 0 0 24px;">Le Saindo</p>
  <p>Bonjour ${nomComplet},</p>
  <p>Nous vous remercions de l'intérêt que vous portez à ce projet. Voici le récapitulatif des réponses que vous nous avez transmises pour <strong>${reponses.intitule_projet || 'votre projet'}</strong>.</p>
  <p>À ce jour, comme vous le savez peut-être, toute notre énergie est dédiée à la levée de fonds citoyenne pour acheter le bâtiment et rendre ce projet possible. C'est pourquoi nous reprendrons contact avec vous seulement après avoir sécurisé l'achat, mais rassurez-vous, nous ne vous oublions pas !</p>
  <p>D'ici là, la meilleure manière de nous soutenir c'est d'en parler autour de vous, on compte sur vous !</p>
  <p style="font-size: 0.9rem; color: #666;">
    PS : n'oubliez pas d'<a href="${siteUrl}/je-contribue" style="color: #6663A0;">adhérer à l'association</a> si ce n'est pas déjà fait, ou de vous <a href="${siteUrl}/#newsletter-form" style="color: #6663A0;">inscrire à la newsletter</a>.
  </p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
  <p style="font-size: 0.85rem; color: #888;">Récapitulatif de vos réponses</p>
  ${recapHtml}
  <p style="color: #888; font-size: 0.85rem; margin-top: 32px;">Cordialement,<br>L'équipe du Saindo</p>
</body>
</html>`,
  });

  if (error) {
    return { ok: false, detail: error.message };
  }

  return { ok: true };
}
