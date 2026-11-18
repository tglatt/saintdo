import type { APIRoute } from 'astro';
import { syncMembers } from '../../../lib/sync-members';
import { refusCron } from '../../../lib/cron-auth';

export const GET: APIRoute = async ({ request }) => {
  const refus = refusCron(request);
  if (refus) return refus;

  try {
    const result = await syncMembers();
    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[cron/sync-members]', err);
    return new Response(JSON.stringify({ ok: false, message: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
