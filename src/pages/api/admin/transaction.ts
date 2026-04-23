import type { APIRoute } from 'astro';
import { createAdminClient } from '../../../lib/supabase';

const VALID_TYPES = ['adhesion', 'don', 'don_defiscalise', 'apport_associatif'] as const;
const VALID_PAIEMENTS = ['helloasso', 'cheque', 'virement'] as const;

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  if (!body) return new Response('Invalid JSON', { status: 400 });

  const { membre_id, type, montant, date, paiement, detail } = body;

  if (!membre_id || !type || montant === undefined) {
    return new Response('Champs manquants : membre_id, type, montant', { status: 400 });
  }
  if (!VALID_TYPES.includes(type)) {
    return new Response(`Type invalide. Valeurs acceptées : ${VALID_TYPES.join(', ')}`, { status: 400 });
  }
  if (typeof montant !== 'number' || montant <= 0) {
    return new Response('Le montant doit être un nombre positif', { status: 400 });
  }
  if (paiement && !VALID_PAIEMENTS.includes(paiement)) {
    return new Response(`Paiement invalide. Valeurs acceptées : ${VALID_PAIEMENTS.join(', ')}`, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: membre } = await supabase
    .from('membres')
    .select('id')
    .eq('id', membre_id)
    .single();

  if (!membre) return new Response('Membre introuvable', { status: 404 });

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      membre_id,
      type,
      montant,
      date: date || null,
      paiement: paiement || null,
      detail: detail?.trim() || null,
      helloasso_order_id: `manual_${crypto.randomUUID()}`,
    })
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ transaction: data }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
