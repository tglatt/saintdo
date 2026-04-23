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

async function fetchAllPages(token: string, url: string): Promise<any[]> {
  const items: any[] = [];
  let pageIndex = 1;
  while (true) {
    const sep = url.includes('?') ? '&' : '?';
    const res = await fetch(`${url}${sep}pageSize=100&pageIndex=${pageIndex}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) break;
    const data = await res.json();
    items.push(...(data.data ?? []));
    if (pageIndex >= (data.pagination?.totalPages ?? 1)) break;
    pageIndex++;
  }
  return items;
}

async function sumPayments(token: string, org: string, formType: string, formSlug: string): Promise<number> {
  const orders = await fetchAllPages(token, `${API_BASE}/organizations/${org}/forms/${formType}/${formSlug}/orders`);
  let total = 0;
  for (const order of orders) {
    for (const payment of (order.payments ?? [])) {
      if (payment.state === 'Authorized') total += payment.amount ?? 0;
    }
  }
  return total / 100;
}

async function countParticipants(token: string, org: string): Promise<number> {
  const emails = new Set<string>();

  const forms: any[] = await fetchAllPages(token, `${API_BASE}/organizations/${org}/forms`);

  for (const form of forms.filter((f: any) => f.formType === 'Membership')) {
    const items = await fetchAllPages(token, `${API_BASE}/organizations/${org}/forms/Membership/${form.formSlug}/items`);
    for (const item of items) {
      const email = (item.payer ?? item.user)?.email;
      if (email) emails.add(email.toLowerCase());
    }
  }

  for (const form of forms.filter((f: any) => f.formType === 'Shop')) {
    const orders = await fetchAllPages(token, `${API_BASE}/organizations/${org}/forms/Shop/${form.formSlug}/orders`);
    for (const order of orders) {
      const email = order.payer?.email;
      if (email) emails.add(email.toLowerCase());
    }
  }

  return emails.size;
}

export async function getStats() {
  try {
    const token = await getToken();
    const [apport, adhesion, participants] = await Promise.all([
      sumPayments(token, 'le-saint-domingue', 'Shop', 'apports-associatifs'),
      sumPayments(token, 'le-saint-domingue', 'Membership', 'adhesion'),
      countParticipants(token, 'le-saint-domingue'),
    ]);
    return { don: adhesion, apport, participants };
  } catch (e) {
    console.error('[HelloAsso] getStats error:', e);
    return { don: 0, apport: 0, participants: 0 };
  }
}
