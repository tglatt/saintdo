import type { APIRoute } from 'astro';
import { getCollecte } from '../../../lib/collecte';
import { corsHeaders, corsPreflight } from '../../../lib/cors';

// État de la collecte (montants, paliers, participants) pour la jauge
// affichée sur le site vitrine WordPress. Lecture seule, sans authentification.
export const GET: APIRoute = async ({ request }) => {
  try {
    const collecte = await getCollecte();
    return new Response(JSON.stringify(collecte), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        // Cache CDN 5 min ; WordPress met aussi en cache de son côté.
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        ...corsHeaders(request),
      },
    });
  } catch (err) {
    console.error('[public/collecte]', err);
    return new Response(JSON.stringify({ error: 'Collecte indisponible' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request) },
    });
  }
};

export const OPTIONS: APIRoute = corsPreflight;
