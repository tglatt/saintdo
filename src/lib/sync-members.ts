import { createAdminClient } from './supabase';

const API_BASE = 'https://api.helloasso.com/v5';
const ORG = 'le-saint-domingue';

// ── HelloAsso ─────────────────────────────────────────────────────────────────

async function getToken(): Promise<string> {
  const res = await fetch('https://api.helloasso.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.HELLOASSO_CLIENT_ID ?? '',
      client_secret: process.env.HELLOASSO_CLIENT_SECRET ?? '',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`HelloAsso token error: ${JSON.stringify(data)}`);
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
    if (!res.ok) {
      console.error(`[sync-members] ${res.status} on ${url} (page ${pageIndex})`);
      break;
    }
    const data = await res.json();
    items.push(...(data.data ?? []));
    if (pageIndex >= (data.pagination?.totalPages ?? 1)) break;
    pageIndex++;
  }
  return items;
}

type RawTransaction = {
  email: string;
  nom: string;
  prenom: string;
  type: 'adhesion' | 'apport_associatif';
  montant: number;
  date: string;
  helloasso_order_id: string;
  helloasso_form_slug: string;
};

async function fetchHelloAssoTransactions(token: string): Promise<RawTransaction[]> {
  const forms: any[] = await fetchAllPages(token, `${API_BASE}/organizations/${ORG}/forms`);
  const transactions: RawTransaction[] = [];

  // Adhésions
  for (const form of forms.filter(f => f.formType === 'Membership')) {
    const items = await fetchAllPages(
      token,
      `${API_BASE}/organizations/${ORG}/forms/Membership/${form.formSlug}/items`,
    );
    for (const item of items) {
      const user = item.payer ?? item.user;
      if (!user?.email) continue;
      transactions.push({
        email: user.email.toLowerCase().trim(),
        nom: user.lastName ?? '',
        prenom: user.firstName ?? '',
        type: 'adhesion',
        montant: (item.amount ?? 0) / 100,
        date: item.order?.date ?? '',
        helloasso_order_id: `membership-${form.formSlug}-${item.id}`,
        helloasso_form_slug: form.formSlug,
      });
    }
  }

  // Apports associatifs
  for (const form of forms.filter(f => f.formType === 'Shop')) {
    const orders = await fetchAllPages(
      token,
      `${API_BASE}/organizations/${ORG}/forms/Shop/${form.formSlug}/orders`,
    );
    for (const order of orders) {
      const user = order.payer;
      if (!user?.email) continue;
      const montant = (order.items ?? []).reduce(
        (s: number, i: any) => s + (i.amount ?? 0),
        0,
      ) / 100;
      transactions.push({
        email: user.email.toLowerCase().trim(),
        nom: user.lastName ?? '',
        prenom: user.firstName ?? '',
        type: 'apport_associatif',
        montant,
        date: order.date ?? '',
        helloasso_order_id: `shop-${form.formSlug}-${order.id}`,
        helloasso_form_slug: form.formSlug,
      });
    }
  }

  return transactions;
}

// ── Sync vers Supabase ────────────────────────────────────────────────────────

export async function syncMembers(): Promise<{ ok: boolean; message: string }> {
  const supabase = createAdminClient();
  const token = await getToken();
  const transactions = await fetchHelloAssoTransactions(token);

  // Regrouper les membres uniques
  const membresMap = new Map<string, { nom: string; prenom: string }>();
  for (const tx of transactions) {
    if (!membresMap.has(tx.email)) {
      membresMap.set(tx.email, { nom: tx.nom, prenom: tx.prenom });
    }
  }

  // Upsert des membres (sans écraser le rôle ou la structure existants)
  const membresRows = [...membresMap.entries()].map(([email, data]) => ({
    email,
    nom: data.nom || null,
    prenom: data.prenom || null,
    updated_at: new Date().toISOString(),
  }));

  const { error: membresError } = await supabase
    .from('membres')
    .upsert(membresRows, {
      onConflict: 'email',
      ignoreDuplicates: false,
    });

  if (membresError) {
    console.error('[sync-members] upsert membres:', membresError);
    return { ok: false, message: `Erreur membres: ${membresError.message}` };
  }

  // Récupérer les IDs des membres pour les FK
  const emails = [...membresMap.keys()];
  const { data: membresData, error: fetchError } = await supabase
    .from('membres')
    .select('id, email')
    .in('email', emails);

  if (fetchError || !membresData) {
    return { ok: false, message: `Erreur fetch membres: ${fetchError?.message}` };
  }

  const emailToId = new Map(membresData.map(m => [m.email, m.id]));

  // Upsert des transactions
  const txRows = transactions
    .map(tx => ({
      membre_id: emailToId.get(tx.email),
      type: tx.type,
      montant: tx.montant,
      date: tx.date ? new Date(tx.date).toISOString() : null,
      helloasso_order_id: tx.helloasso_order_id,
      helloasso_form_slug: tx.helloasso_form_slug,
    }))
    .filter(tx => tx.membre_id);

  const { error: txError } = await supabase
    .from('transactions')
    .upsert(txRows, {
      onConflict: 'helloasso_order_id',
      ignoreDuplicates: false,
    });

  if (txError) {
    console.error('[sync-members] upsert transactions:', txError);
    return { ok: false, message: `Erreur transactions: ${txError.message}` };
  }

  return {
    ok: true,
    message: `Sync OK — ${membresRows.length} membres, ${txRows.length} transactions`,
  };
}
