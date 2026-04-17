import { createAdminClient } from './supabase';

const API_BASE = 'https://api.helloasso.com/v5';
const ORG = 'le-saint-domingue';

function env(key: string): string {
  return process.env[key] ?? import.meta.env[key] ?? '';
}

// ── HelloAsso ─────────────────────────────────────────────────────────────────

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
  type: 'adhesion' | 'don' | 'apport_associatif';
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

      const montant = (item.amount ?? 0) / 100;
      if (montant <= 0) continue;

      const type = item.type === 'Donation' ? 'don'
                 : item.type === 'Membership' ? 'adhesion'
                 : 'don'; // fallback : on classe les items inconnus en don

      transactions.push({
        email: user.email.toLowerCase().trim(),
        nom: user.lastName ?? '',
        prenom: user.firstName ?? '',
        type,
        montant,
        date: item.order?.date ?? '',
        helloasso_order_id: `membership-${form.formSlug}-${item.id}`,
        helloasso_form_slug: form.formSlug,
      });
    }
  }

  // Apports associatifs (et potentielles adhésions incluses dans la commande)
  for (const form of forms.filter(f => f.formType === 'Shop')) {
    const orders = await fetchAllPages(
      token,
      `${API_BASE}/organizations/${ORG}/forms/Shop/${form.formSlug}/orders`,
    );
    for (const order of orders) {
      const user = order.payer;
      if (!user?.email) continue;

      const items: any[] = order.items ?? [];

      if (items.length === 0) continue;

      // Traiter chaque item individuellement
      for (const item of items) {
        const montant = (item.amount ?? 0) / 100;
        if (montant <= 0) continue;

        // Dans le Shop, un item "adhésion" est un don complémentaire,
        // pas une adhésion formelle (celle-ci est dans le formulaire Membership)
        const label = (item.name ?? '').toLowerCase();
        const isDon =
          label.includes('adhésion') ||
          label.includes('adhesion') ||
          label.includes('cotisation') ||
          label.includes('don');

        transactions.push({
          email: user.email.toLowerCase().trim(),
          nom: user.lastName ?? '',
          prenom: user.firstName ?? '',
          type: isDon ? 'don' : 'apport_associatif',
          montant,
          date: order.date ?? '',
          helloasso_order_id: `shop-${form.formSlug}-${order.id}-${item.id}`,
          helloasso_form_slug: form.formSlug,
        });
      }
    }
  }

  return transactions;
}

// ── Sync vers Supabase ────────────────────────────────────────────────────────

export async function syncMembers(): Promise<{ ok: boolean; message: string }> {
  const supabase = createAdminClient();
  const startedAt = new Date().toISOString();

  // Créer une entrée de sync en cours
  const { data: syncRow } = await supabase
    .from('syncs')
    .insert({ started_at: startedAt, status: 'success' })
    .select('id')
    .single();

  const syncId = syncRow?.id;

  async function finalize(ok: boolean, message: string, nb_membres = 0, nb_transactions = 0) {
    if (syncId) {
      await supabase.from('syncs').update({
        ended_at: new Date().toISOString(),
        status: ok ? 'success' : 'error',
        nb_membres,
        nb_transactions,
        message,
      }).eq('id', syncId);
    }
    return { ok, message };
  }

  try {
    const token = await getToken();
    const transactions = await fetchHelloAssoTransactions(token);

    // Regrouper les membres uniques
    const membresMap = new Map<string, { nom: string; prenom: string }>();
    for (const tx of transactions) {
      if (!membresMap.has(tx.email)) {
        membresMap.set(tx.email, { nom: tx.nom, prenom: tx.prenom });
      }
    }

    // Upsert des membres
    const membresRows = [...membresMap.entries()].map(([email, data]) => ({
      email,
      nom: data.nom || null,
      prenom: data.prenom || null,
      updated_at: new Date().toISOString(),
    }));

    const { error: membresError } = await supabase
      .from('membres')
      .upsert(membresRows, { onConflict: 'email', ignoreDuplicates: false });

    if (membresError) {
      console.error('[sync-members] upsert membres:', membresError);
      return finalize(false, `Erreur membres: ${membresError.message}`);
    }

    // Récupérer les IDs des membres pour les FK
    const emails = [...membresMap.keys()];
    const { data: membresData, error: fetchError } = await supabase
      .from('membres')
      .select('id, email')
      .in('email', emails);

    if (fetchError || !membresData) {
      return finalize(false, `Erreur fetch membres: ${fetchError?.message}`);
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
      .upsert(txRows, { onConflict: 'helloasso_order_id', ignoreDuplicates: false });

    if (txError) {
      console.error('[sync-members] upsert transactions:', txError);
      return finalize(false, `Erreur transactions: ${txError.message}`, membresRows.length);
    }

    const message = `${membresRows.length} membres, ${txRows.length} transactions`;
    return finalize(true, message, membresRows.length, txRows.length);

  } catch (err: any) {
    console.error('[sync-members]', err);
    return finalize(false, err.message ?? 'Erreur inconnue');
  }
}
