import type { APIRoute } from 'astro';
import { createAdminClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  if (!body) return new Response('Invalid JSON', { status: 400 });

  const { email, nom, prenom, structure, role } = body;
  if (!email?.trim()) return new Response('Email requis', { status: 400 });
  if (role && !['membre', 'admin'].includes(role))
    return new Response('Rôle invalide', { status: 400 });

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('membres')
    .insert({
      email: email.trim().toLowerCase(),
      nom: nom || null,
      prenom: prenom || null,
      structure: structure || null,
      role: role ?? 'membre',
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    const msg = error.code === '23505'
      ? 'Un membre avec cet email existe déjà'
      : error.message;
    return new Response(msg, { status: error.code === '23505' ? 409 : 500 });
  }

  return new Response(JSON.stringify({ membre: data }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const PUT: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  if (!body) return new Response('Invalid JSON', { status: 400 });

  const { id, nom, prenom, email, address, zip_code, city, country } = body;
  if (!id) return new Response('Missing id', { status: 400 });
  if (email !== undefined && !email?.trim()) return new Response('Email invalide', { status: 400 });

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('membres')
    .update({
      ...(nom     !== undefined && { nom:      nom     || null }),
      ...(prenom  !== undefined && { prenom:   prenom  || null }),
      ...(email   !== undefined && { email:    email.trim().toLowerCase() }),
      ...(address !== undefined && { address:  address || null }),
      ...(zip_code !== undefined && { zip_code: zip_code || null }),
      ...(city    !== undefined && { city:     city    || null }),
      ...(country !== undefined && { country:  country || null }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return new Response(error.message, { status: 500 });
  return new Response(JSON.stringify({ membre: data }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id');
  if (!id) return new Response('Missing id', { status: 400 });

  const supabase = createAdminClient();

  const { data: membre } = await supabase
    .from('membres')
    .select('id, email, nom, prenom, address, zip_code, city, country, role, structure, created_at')
    .eq('id', id)
    .single();

  if (!membre) return new Response('Not found', { status: 404 });

  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, type, montant, date, paiement, detail, helloasso_order_id, helloasso_form_slug')
    .eq('membre_id', id)
    .order('date', { ascending: false });

  const { data: convention } = await supabase
    .from('conventions')
    .select('signed_at')
    .eq('membre_id', id)
    .order('signed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return new Response(JSON.stringify({ membre, transactions, convention }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
