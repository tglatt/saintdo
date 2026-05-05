import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { buildPdf, pdfResponse, fmtDate } from '../../../lib/convention-pdf';

// ── Auth + data loader ────────────────────────────────────────────────────────

async function loadConventionData(cookies: { get: (name: string) => { value: string } | undefined }) {
  const accessToken = cookies.get('sb-access-token')?.value;
  const refreshToken = cookies.get('sb-refresh-token')?.value;
  if (!accessToken || !refreshToken) return null;

  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
  );
  const { data: { user }, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error || !user) return null;

  const admin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: membre } = await admin
    .from('membres')
    .select('id, nom, prenom, address, zip_code, city')
    .eq('email', user.email)
    .single();
  if (!membre) return null;

  const { data: txs } = await admin
    .from('transactions')
    .select('montant, date')
    .eq('membre_id', membre.id)
    .eq('type', 'apport_associatif');

  const totalApport = txs?.reduce((s: number, t: { montant: number }) => s + t.montant, 0) ?? 0;
  const toCC = (s: string) => s.toLowerCase().replace(/(^|\s|-)(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());
  const prenom = membre.prenom ? toCC(membre.prenom) : '';
  const nomMaj = membre.nom ? membre.nom.toUpperCase() : '';
  const nom = [prenom, nomMaj].filter(Boolean).join(' ') || (user.email ?? 'Adhérent');
  const montant = totalApport.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

  const lastTxDate = txs
    ?.map((t: { date: string | null }) => t.date)
    .filter(Boolean)
    .sort()
    .at(-1);
  const dateApport = lastTxDate ? fmtDate(new Date(lastTxDate)) : '';

  const [mdRaw, sigBuffer] = await Promise.all([
    readFile(join(process.cwd(), 'public', 'Saindo_convention_apport.md'), 'utf-8'),
    readFile(join(process.cwd(), 'public', 'signature.png')),
  ]);

  const adresse = [membre.address, membre.zip_code, membre.city].filter(Boolean).join(' ');
  const md = mdRaw
    .replace('[NOM_ADHERENT]', nom)
    .replace('[ADRESSE_ADHERENT]', adresse)
    .replace('[MONTANT_APPORT]', montant)
    .replace('[DATE_APPORT]', dateApport);

  return { nom, md, sigBuffer, membreId: membre.id, admin };
}

// ── Routes ────────────────────────────────────────────────────────────────────

export const GET: APIRoute = async ({ cookies, redirect }) => {
  const data = await loadConventionData(cookies);
  if (!data) return redirect('/login');

  const { data: row } = await data.admin
    .from('conventions')
    .select('contenu_md, signature_adherent')
    .eq('membre_id', data.membreId)
    .order('signed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const md  = row?.contenu_md         ?? data.md;
  const sig = row?.signature_adherent ?? undefined;
  const pdfBytes = await buildPdf(data.nom, md, data.sigBuffer, sig);
  return pdfResponse(pdfBytes, data.nom);
};

export const POST: APIRoute = async ({ cookies, request }) => {
  const data = await loadConventionData(cookies);
  if (!data) return new Response('Unauthorized', { status: 401 });

  let signature: string | undefined;
  try {
    const body = await request.json();
    signature = body.signature;
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }
  if (!signature) return new Response('Missing signature', { status: 400 });

  await data.admin.from('conventions').insert({
    membre_id:          data.membreId,
    signed_at:          new Date().toISOString(),
    contenu_md:         data.md,
    signature_adherent: signature,
  });

  const pdfBytes = await buildPdf(data.nom, data.md, data.sigBuffer, signature);
  return pdfResponse(pdfBytes, data.nom);
};
