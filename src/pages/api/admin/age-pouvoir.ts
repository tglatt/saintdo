import type { APIRoute } from 'astro';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createAdminClient } from '../../../lib/supabase';
import { buildPouvoirPdf, pouvoirPdfResponse } from '../../../lib/convention-pdf';

export const GET: APIRoute = async ({ url }) => {
  const email = url.searchParams.get('email');
  if (!email) return new Response('Email requis', { status: 400 });

  const supabase = createAdminClient();

  const { data: membre } = await supabase
    .from('membres')
    .select('id, nom, prenom, email')
    .eq('email', email)
    .single();
  if (!membre) return new Response('Membre introuvable', { status: 404 });

  const { data: reponse } = await supabase
    .from('age_reponses')
    .select('pouvoir_a, signature')
    .eq('email', email)
    .eq('presence', false)
    .single();

  if (!reponse?.pouvoir_a || !reponse?.signature) {
    return new Response('Pouvoir introuvable ou signature manquante', { status: 404 });
  }

  const toCC = (s: string) =>
    s.toLowerCase().replace(/(^|\s|-)(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());
  const nomComplet = [
    membre.prenom ? toCC(membre.prenom) : null,
    membre.nom ? membre.nom.toUpperCase() : null,
  ].filter(Boolean).join(' ') || membre.email;

  const mdTemplate = await readFile(
    join(process.cwd(), 'public', 'AGE202605', 'pouvoir.md'),
    'utf-8',
  );

  const pdfBytes = await buildPouvoirPdf(nomComplet, reponse.pouvoir_a, reponse.signature, mdTemplate);
  return pouvoirPdfResponse(pdfBytes, nomComplet);
};
