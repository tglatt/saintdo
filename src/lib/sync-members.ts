import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const API_BASE = 'https://api.helloasso.com/v5';
const ORG = 'le-saint-domingue';

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

async function buildPeopleMap(token: string) {
  const forms: any[] = await fetchAllPages(token, `${API_BASE}/organizations/${ORG}/forms`);

  const people = new Map<string, {
    nom: string; prenom: string; email: string;
    date_adhesion: string; date_achat: string;
    adhesion_cents: number; apport_cents: number;
  }>();

  function upsert(email: string, user: any, patch: object) {
    if (!people.has(email)) {
      people.set(email, {
        nom: user?.lastName ?? '',
        prenom: user?.firstName ?? '',
        email,
        date_adhesion: '',
        date_achat: '',
        adhesion_cents: 0,
        apport_cents: 0,
      });
    }
    Object.assign(people.get(email)!, patch);
  }

  for (const form of forms.filter(f => f.formType === 'Membership')) {
    const items = await fetchAllPages(token, `${API_BASE}/organizations/${ORG}/forms/Membership/${form.formSlug}/items`);
    for (const item of items) {
      const user = item.payer ?? item.user;
      if (!user?.email) continue;
      upsert(user.email, user, { date_adhesion: item.order?.date ?? '' });
      people.get(user.email)!.adhesion_cents += item.amount ?? 0;
    }
  }

  for (const form of forms.filter(f => f.formType === 'Shop')) {
    const orders = await fetchAllPages(token, `${API_BASE}/organizations/${ORG}/forms/Shop/${form.formSlug}/orders`);
    for (const order of orders) {
      const user = order.payer;
      if (!user?.email) continue;
      const prevDate = people.get(user.email)?.date_achat ?? '';
      const newDate = order.date ?? '';
      upsert(user.email, user, { date_achat: newDate > prevDate ? newDate : prevDate });
      const orderTotal = (order.items ?? []).reduce((s: number, i: any) => s + (i.amount ?? 0), 0);
      people.get(user.email)!.apport_cents += orderTotal;
    }
  }

  return people;
}

function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

function num(cents: number): number {
  return parseFloat((cents / 100).toFixed(2));
}

export async function syncMembers(): Promise<{ ok: boolean; message: string }> {
  const token = await getToken();
  const people = await buildPeopleMap(token);

  const rows = [...people.values()]
    .sort((a, b) => a.nom.localeCompare(b.nom))
    .map(p => ({
      nom: p.nom,
      prenom: p.prenom,
      email: p.email,
      'date_adhésion': fmtDate(p.date_adhesion),
      'date_achat': fmtDate(p.date_achat),
      adhésion: num(p.adhesion_cents),
      apport: num(p.apport_cents),
    }));

  const totalAdhesion = parseFloat(rows.reduce((s, r) => s + r.adhésion, 0).toFixed(2));
  const totalApport = parseFloat(rows.reduce((s, r) => s + r.apport, 0).toFixed(2));
  rows.push({ nom: 'TOTAL', prenom: '', email: '', 'date_adhésion': '', 'date_achat': '', adhésion: totalAdhesion, apport: totalApport });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Membres');

  const today = new Date();
  const stamp = today.getFullYear().toString()
    + String(today.getMonth() + 1).padStart(2, '0')
    + String(today.getDate()).padStart(2, '0');
  const filename = `${stamp}_helloasso.xlsx`;
  const outPath = path.join('/tmp', filename);

  XLSX.writeFile(wb, outPath);

  const framaspaceUrl = process.env.FRAMASPACE_URL ?? '';
  const framaspaceUser = process.env.FRAMASPACE_USER ?? '';
  const framaspacePassword = process.env.FRAMASPACE_PASSWORD ?? '';

  if (!framaspaceUrl || !framaspaceUser || !framaspacePassword) {
    return { ok: false, message: 'Variables Framaspace manquantes' };
  }

  const remotePath = `Dossier partagé/07_CRM/${filename}`;
  const webdavUrl = `${framaspaceUrl}/remote.php/dav/files/${encodeURIComponent(framaspaceUser)}/${remotePath.split('/').map(encodeURIComponent).join('/')}`;
  const auth = Buffer.from(`${framaspaceUser}:${framaspacePassword}`).toString('base64');
  const fileBuffer = fs.readFileSync(outPath);

  const res = await fetch(webdavUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
    body: fileBuffer,
  });

  fs.unlinkSync(outPath);

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, message: `Upload échoué (${res.status}): ${text}` };
  }

  return { ok: true, message: `${filename} déposé dans Framaspace` };
}
