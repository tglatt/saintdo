import type { APIRoute } from 'astro';
import { createAdminClient } from '../../lib/supabase';
import { sendProjetConfirmationEmail } from '../../lib/send-projet-confirmation-email';

export const POST: APIRoute = async ({ request, url }) => {
  const body = await request.json().catch(() => null);
  if (!body) return new Response('Requête invalide', { status: 400 });

  // Honeypot anti-spam : un bot remplit ce champ caché, un humain ne le voit jamais.
  if (body.website) {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const email = String(body.email ?? '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response('Email invalide', { status: 400 });
  }

  const nom = String(body.nom ?? '').trim();
  const prenom = String(body.prenom ?? '').trim();
  const telephone = String(body.telephone ?? '').trim();
  const intitule_projet = String(body.intitule_projet ?? '').trim();

  const reponses = {
    vous_et_votre_projet: body.vous_et_votre_projet ?? {},
    besoins_espaces: body.besoins_espaces ?? {},
    mutualisation: body.mutualisation ?? {},
    projection: body.projection ?? {},
    envies: body.envies ?? {},
  };

  const supabase = createAdminClient();
  const { error } = await supabase.from('porteurs_projet').insert({
    email,
    nom: nom || null,
    prenom: prenom || null,
    telephone: telephone || null,
    intitule_projet: intitule_projet || null,
    reponses,
  });

  if (error) {
    console.error('[candidature-projet]', error);
    return new Response("Erreur lors de l'enregistrement", { status: 500 });
  }

  const siteUrl = import.meta.env.PUBLIC_SITE_URL ?? url.origin;
  const emailResult = await sendProjetConfirmationEmail(
    { email, nom, prenom, telephone, intitule_projet, ...reponses },
    siteUrl,
  );
  if (!emailResult.ok) {
    console.error('[candidature-projet] email de confirmation:', emailResult.detail);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
