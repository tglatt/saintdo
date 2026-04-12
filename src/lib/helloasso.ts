const API_BASE = 'https://api.helloasso.com/v5';

async function getToken(): Promise<string> {
  const res = await fetch('https://api.helloasso.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: import.meta.env.HELLOASSO_CLIENT_ID,
      client_secret: import.meta.env.HELLOASSO_CLIENT_SECRET,
    }),
  });
  const data = await res.json();
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
    if (!res.ok) break;

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
    const token = await getToken();

    // Apports via API le-saint-domingue
    const apport = await sumPayments(token, 'le-saint-domingue', 'Shop', 'apports-associatifs');

    // Dons : montant saisi manuellement (pas d'accès API à graine-de-moutarde)
    const don = parseInt(import.meta.env.HELLOASSO_DON_MANUEL ?? '0', 10);

    return { don, apport };
  } catch (e) {
    console.error('[HelloAsso] getStats error:', e);
    return { don: 0, apport: 0 };
  }
}
