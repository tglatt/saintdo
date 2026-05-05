import type { APIRoute } from 'astro';
import { createAdminClient } from '../../../lib/supabase';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { buildPdf, pdfResponse } from '../../../lib/convention-pdf';

export const GET: APIRoute = async ({ url }) => {
  const membreId = url.searchParams.get('membre_id');
  if (!membreId) return new Response('Missing membre_id', { status: 400 });

  const supabase = createAdminClient();

  const { data: membre } = await supabase
    .from('membres')
    .select('id, nom, prenom')
    .eq('id', membreId)
    .single();
  if (!membre) return new Response('Not found', { status: 404 });

  const { data: row } = await supabase
    .from('conventions')
    .select('contenu_md, signature_adherent')
    .eq('membre_id', membreId)
    .order('signed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row) return new Response('Aucune convention signée', { status: 404 });

  const toCC = (s: string) => s.toLowerCase().replace(/(^|\s|-)(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());
  const prenom = membre.prenom ? toCC(membre.prenom) : '';
  const nomMaj = membre.nom ? membre.nom.toUpperCase() : '';
  const nom = [prenom, nomMaj].filter(Boolean).join(' ') || 'Adhérent';

  const sigBuffer = await readFile(join(process.cwd(), 'public', 'signature.png'));
  const pdfBytes = await buildPdf(nom, row.contenu_md, sigBuffer, row.signature_adherent);
  return pdfResponse(pdfBytes, nom);
};
