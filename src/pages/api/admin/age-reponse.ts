import type { APIRoute } from 'astro';
import { createAdminClient } from '../../../lib/supabase';

export const PATCH: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  if (!body) return new Response('Corps invalide', { status: 400 });

  const { email, pouvoir_a } = body;
  if (!email) return new Response('Email requis', { status: 400 });
  if (!pouvoir_a?.trim()) return new Response('Nom du mandataire requis', { status: 400 });

  const supabase = createAdminClient();

  const { error } = await supabase
    .from('age_reponses')
    .update({ pouvoir_a: pouvoir_a.trim(), updated_at: new Date().toISOString() })
    .eq('email', email)
    .eq('presence', false);

  if (error) {
    console.error('[admin/age-reponse]', error);
    return new Response('Erreur serveur', { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
