import type { APIRoute } from 'astro';
import { createAdminClient } from '../../../lib/supabase';
import { isAdmin } from '../../../lib/admin-auth';

export const DELETE: APIRoute = async ({ url, cookies }) => {
  if (!await isAdmin(cookies)) return new Response('Unauthorized', { status: 401 });

  const id = url.searchParams.get('id');
  if (!id) return new Response('Missing id', { status: 400 });

  const { error } = await createAdminClient()
    .from('porteurs_projet')
    .delete()
    .eq('id', id);

  if (error) return new Response(error.message, { status: 500 });

  return new Response(null, { status: 204 });
};
