import type { APIRoute } from 'astro';
import { createAdminClient } from '../../../lib/supabase';

const VALID_TYPES = ['adhesion', 'don', 'don_defiscalise', 'apport_associatif'] as const;
const VALID_PAIEMENTS = ['helloasso', 'cheque', 'virement'] as const;

function validateBody(body: any) {
  const { type, montant, paiement } = body;
  if (!type || montant === undefined)
    return 'Champs manquants : type, montant';
  if (!VALID_TYPES.includes(type))
    return `Type invalide. Valeurs acceptées : ${VALID_TYPES.join(', ')}`;
  if (typeof montant !== 'number' || montant <= 0)
    return 'Le montant doit être un nombre positif';
  if (paiement && !VALID_PAIEMENTS.includes(paiement))
    return `Paiement invalide. Valeurs acceptées : ${VALID_PAIEMENTS.join(', ')}`;
  return null;
}

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  if (!body) return new Response('Invalid JSON', { status: 400 });

  const { membre_id, type, montant, date, paiement, detail } = body;

  if (!membre_id) return new Response('Champ manquant : membre_id', { status: 400 });
  const err = validateBody(body);
  if (err) return new Response(err, { status: 400 });

  const supabase = createAdminClient();

  const { data: membre } = await supabase
    .from('membres').select('id').eq('id', membre_id).single();
  if (!membre) return new Response('Membre introuvable', { status: 404 });

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      membre_id, type, montant,
      date: date || null,
      paiement: paiement || null,
      detail: detail?.trim() || null,
      helloasso_order_id: `manual_${crypto.randomUUID()}`,
    })
    .select().single();

  if (error) return new Response(JSON.stringify({ error: error.message }), {
    status: 500, headers: { 'Content-Type': 'application/json' },
  });

  return new Response(JSON.stringify({ transaction: data }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const PUT: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  if (!body) return new Response('Invalid JSON', { status: 400 });

  const { id, type, montant, date, paiement, detail } = body;
  if (!id) return new Response('Champ manquant : id', { status: 400 });
  const err = validateBody(body);
  if (err) return new Response(err, { status: 400 });

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('transactions')
    .update({
      type, montant,
      date: date || null,
      paiement: paiement || null,
      detail: detail?.trim() || null,
    })
    .eq('id', id)
    .select().single();

  if (error) return new Response(JSON.stringify({ error: error.message }), {
    status: 500, headers: { 'Content-Type': 'application/json' },
  });
  if (!data) return new Response('Transaction introuvable', { status: 404 });

  return new Response(JSON.stringify({ transaction: data }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
