const API_BASE = 'https://api.helloasso.com/v5';

function env(key: string): string {
  return process.env[key] ?? import.meta.env[key] ?? '';
}

async function getToken(): Promise<string> {
  const res = await fetch('https://api.helloasso.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env('HELLOASSO_CLIENT_ID'),
      client_secret: env('HELLOASSO_CLIENT_SECRET'),
    }),
  });
  const data = await res.json();
  if (!data.access_token) console.error('[HelloAsso] token error:', data);
  return data.access_token;
}

async function sumPayments(token: string, org: string, formType: string, formSlug: string): Promise<number> {
  let total = 0;
  let pageIndex = 1;

  while (true) {
    const params = new URLSearchParams({
      formType,
      formSlug,
      pageSize: '100',
      pageIndex: String(pageIndex),
    });
    const url = `${API_BASE}/organizations/${org}/payments?${params}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      console.error(`[HelloAsso] payments ${org}/${formSlug} → ${res.status}`);
      break;
    }

    const data = await res.json();
    for (const p of (data.data ?? [])) {
      if (p.state === 'Authorized') total += p.amount ?? 0;
    }

    if (pageIndex >= (data.pagination?.totalPages ?? 1)) break;
    pageIndex++;
  }

  return total / 100;
}

export async function getStats() {
  try {
    console.log('[HelloAsso] CLIENT_ID present:', !!process.env.HELLOASSO_CLIENT_ID);
    console.log('[HelloAsso] CLIENT_SECRET present:', !!process.env.HELLOASSO_CLIENT_SECRET);
    console.log('[HelloAsso] DON_MANUEL:', process.env.HELLOASSO_DON_MANUEL);
    const token = await getToken();
    const apport = await sumPayments(token, 'le-saint-domingue', 'Shop', 'apports-associatifs');
    const don = parseInt(env('HELLOASSO_DON_MANUEL') || '0', 10);

    return { don, apport };
  } catch (e) {
    console.error('[HelloAsso] getStats error:', e);
    return { don: 0, apport: 0 };
  }
}
