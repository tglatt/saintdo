import type { APIRoute } from 'astro';
import { createAdminClient } from '../../../lib/supabase';
import { verifyAgeToken } from '../../../lib/age-token';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  if (!body) return new Response('Corps invalide', { status: 400 });

  const { token, presence, pouvoir_a, signature } = body;

  const verified = verifyAgeToken(token);
  if (!verified) return new Response('Token invalide ou expiré', { status: 401 });

  if (typeof presence !== 'boolean') return new Response('Réponse invalide', { status: 400 });
  if (!presence && !pouvoir_a?.trim()) {
    return new Response('Le nom du mandataire est requis', { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: membre } = await supabase
    .from('membres')
    .select('id')
    .eq('email', verified.email)
    .single();

  if (!membre) return new Response('Membre introuvable', { status: 404 });

  const { error } = await supabase
    .from('age_reponses')
    .upsert(
      {
        membre_id: membre.id,
        email: verified.email,
        presence,
        pouvoir_a: presence ? null : (pouvoir_a?.trim() ?? null),
        signature: presence ? null : (signature ?? null),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'email' },
    );

  if (error) {
    console.error('[age/reponse]', error);
    return new Response('Erreur serveur', { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
