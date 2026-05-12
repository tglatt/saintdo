import type { APIRoute } from 'astro';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createAdminClient } from '../../../lib/supabase';
import { verifyAgeToken } from '../../../lib/age-token';
import { buildPouvoirPdf, pouvoirPdfResponse } from '../../../lib/convention-pdf';

async function generatePouvoir(email: string) {
  const supabase = createAdminClient();

  const { data: membre } = await supabase
    .from('membres')
    .select('id, nom, prenom, email')
    .eq('email', email)
    .single();
  if (!membre) return null;

  const { data: reponse } = await supabase
    .from('age_reponses')
    .select('pouvoir_a, signature')
    .eq('email', email)
    .eq('presence', false)
    .single();
  if (!reponse?.pouvoir_a || !reponse?.signature) return null;

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
  return { pdfBytes, nomComplet };
}

export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get('t') ?? '';
  const verified = verifyAgeToken(token);
  if (!verified) return new Response('Token invalide ou expiré', { status: 401 });

  const result = await generatePouvoir(verified.email);
  if (!result) return new Response('Pouvoir introuvable', { status: 404 });

  return pouvoirPdfResponse(result.pdfBytes, result.nomComplet);
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  if (!body) return new Response('Corps invalide', { status: 400 });

  const { token, pouvoir_a, signature } = body;
  if (!pouvoir_a?.trim()) return new Response('Mandataire requis', { status: 400 });
  if (!signature) return new Response('Signature requise', { status: 400 });

  const verified = verifyAgeToken(token);
  if (!verified) return new Response('Token invalide ou expiré', { status: 401 });

  const supabase = createAdminClient();

  const { data: membre } = await supabase
    .from('membres')
    .select('id, nom, prenom, email')
    .eq('email', verified.email)
    .single();
  if (!membre) return new Response('Membre introuvable', { status: 404 });

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

  const pdfBytes = await buildPouvoirPdf(nomComplet, pouvoir_a.trim(), signature, mdTemplate);

  await supabase
    .from('age_reponses')
    .upsert(
      {
        membre_id: membre.id,
        email: verified.email,
        presence: false,
        pouvoir_a: pouvoir_a.trim(),
        signature,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'email' },
    );

  return pouvoirPdfResponse(pdfBytes, nomComplet);
};
