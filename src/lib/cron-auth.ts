// Contrôle d'accès des routes /api/cron/* : seul un appel portant « Authorization: Bearer <CRON_SECRET> »
// est accepté (Vercel Cron l'envoie automatiquement quand la variable est définie).
// Si CRON_SECRET n'est pas configurée, tout est refusé : une route cron ne doit jamais être ouverte par défaut.
export function refusCron(request: Request): Response | null {
  const secret = process.env.CRON_SECRET ?? import.meta.env.CRON_SECRET;
  if (!secret) {
    console.error('[cron] CRON_SECRET non configurée : appel refusé');
    return new Response('CRON_SECRET non configurée', { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  return null;
}
