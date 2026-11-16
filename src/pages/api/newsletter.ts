import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { corsHeaders, corsPreflight } from '../../lib/cors';

const resend = new Resend(import.meta.env.RESEND_API_KEY);

export const OPTIONS: APIRoute = corsPreflight;

export const POST: APIRoute = async ({ request }) => {
  const cors = corsHeaders(request);
  const body = await request.json().catch(() => null);
  const email = body?.email?.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response('Email invalide', { status: 400, headers: cors });
  }

  const topicId = import.meta.env.RESEND_TOPIC_ID;
  if (!topicId) {
    return new Response('Configuration manquante', { status: 500, headers: cors });
  }

  const { error } = await resend.contacts.create({
    email,
    unsubscribed: false,
    topics: [{ id: topicId, subscription: 'opt_in' as const }],
  });

  if (error) {
    console.error('[newsletter]', error);
    return new Response('Erreur lors de l\'inscription', { status: 500, headers: cors });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', ...cors },
  });
};
