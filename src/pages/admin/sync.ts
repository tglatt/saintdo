import type { APIRoute } from 'astro';
import { syncMembers } from '../../lib/sync-members';

export const POST: APIRoute = async ({ redirect }) => {
  try {
    await syncMembers();
  } catch (err) {
    console.error('[admin/sync]', err);
  }
  return redirect('/admin');
};
