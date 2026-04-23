import type { APIRoute } from 'astro';
import { createAdminClient } from '../../../lib/supabase';

export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id');
  if (!id) return new Response('Missing id', { status: 400 });

  const supabase = createAdminClient();

  const { data: membre } = await supabase
    .from('membres')
    .select('id, email, nom, prenom, role, created_at')
    .eq('id', id)
    .single();

  if (!membre) return new Response('Not found', { status: 404 });

  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, type, montant, date, paiement, detail, helloasso_form_slug')
    .eq('membre_id', id)
    .order('date', { ascending: false });

  return new Response(JSON.stringify({ membre, transactions }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
