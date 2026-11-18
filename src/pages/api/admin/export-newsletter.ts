import type { APIRoute } from 'astro';
import { isAdmin } from '../../../lib/admin-auth';
import { exportNewsletterToBrevo } from '../../../lib/export-newsletter-brevo';

// Export manuel des inscriptions newsletter vers Brevo, déclenché depuis /admin/newsletter.
// Même traitement que la tâche quotidienne (/api/cron/export-newsletter).
export const POST: APIRoute = async ({ cookies }) => {
  if (!await isAdmin(cookies)) return new Response('Unauthorized', { status: 401 });

  try {
    const result = await exportNewsletterToBrevo();
    if (!result.ok) console.error('[admin/export-newsletter]', result.message, result.echecs);
    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[admin/export-newsletter]', err);
    return new Response(JSON.stringify({ ok: false, message: err.message, a_exporter: 0, exportes: 0, echecs: [] }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
