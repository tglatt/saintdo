import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, cookies }) => {
  const { access_token, refresh_token, expires_in } = await request.json();

  if (!access_token || !refresh_token) {
    return new Response('Missing tokens', { status: 400 });
  }

  const maxAge = parseInt(expires_in ?? '3600', 10);

  cookies.set('sb-access-token', access_token, {
    path: '/',
    maxAge,
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
  });

  cookies.set('sb-refresh-token', refresh_token, {
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
  });

  return new Response('OK', { status: 200 });
};
