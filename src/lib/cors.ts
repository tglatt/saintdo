// En-têtes CORS pour les routes API appelées depuis le site vitrine WordPress
// (domaine différent de l'application). Les origines autorisées sont lues dans
// CORS_ORIGINS (liste séparée par des virgules) ; par défaut saindo.org.

const DEFAULT_ORIGINS = ['https://saindo.org', 'https://www.saindo.org'];

function allowedOrigins(): string[] {
  const raw = import.meta.env.CORS_ORIGINS ?? process.env.CORS_ORIGINS;
  if (!raw) return DEFAULT_ORIGINS;
  return raw.split(',').map((s: string) => s.trim()).filter(Boolean);
}

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin');
  if (!origin || !allowedOrigins().includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export function withCors(response: Response, request: Request): Response {
  for (const [k, v] of Object.entries(corsHeaders(request))) {
    response.headers.set(k, v);
  }
  return response;
}

// Réponse au preflight (OPTIONS) : à exporter tel quel dans les routes concernées.
export function corsPreflight({ request }: { request: Request }): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}
