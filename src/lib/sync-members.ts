import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const API_BASE = 'https://api.helloasso.com/v5';
const ORG = 'le-saint-domingue';
const CONTACTS_REMOTE_PATH = 'Dossier partagé/07_CRM/Contacts.ods';
const CRM_DIR = 'Dossier partagé/07_CRM';
const HEADERS = ['EMAIL', 'NOM', 'PRENOM', 'STRUCTURE', 'DATE_ACHAT', 'DATE_ADHESION', 'MONTANT_ACHAT', 'MONTANT_ADHESION'];

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

async function fetchHelloAssoData(token: string) {
  const forms: any[] = await fetchAllPages(token, `${API_BASE}/organizations/${ORG}/forms`);

  const people = new Map<string, {
    nom: string; prenom: string;
    date_adhesion: string; date_achat: string;
    adhesion_cents: number; apport_cents: number;
  }>();

  function upsert(email: string, user: any, patch: object) {
    if (!people.has(email)) {
      people.set(email, { nom: user?.lastName ?? '', prenom: user?.firstName ?? '', date_adhesion: '', date_achat: '', adhesion_cents: 0, apport_cents: 0 });
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

function webdavUrl(framaspaceUrl: string, framaspaceUser: string, remotePath: string): string {
  return `${framaspaceUrl}/remote.php/dav/files/${encodeURIComponent(framaspaceUser)}/${remotePath.split('/').map(encodeURIComponent).join('/')}`;
}

function basicAuth(user: string, password: string): string {
  return `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
}

// ── Framaspace WebDAV ─────────────────────────────────────────────────────────

async function download(url: string, framaspaceUser: string, framaspacePassword: string): Promise<Buffer | null> {
  const res = await fetch(url, {
    headers: { Authorization: basicAuth(framaspaceUser, framaspacePassword) },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Téléchargement échoué (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

async function upload(localPath: string, url: string, framaspaceUser: string, framaspacePassword: string): Promise<void> {
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: basicAuth(framaspaceUser, framaspacePassword),
      'Content-Type': 'application/vnd.oasis.opendocument.spreadsheet',
    },
    body: fs.readFileSync(localPath),
  });
  if (!res.ok) throw new Error(`Upload échoué (${res.status}): ${await res.text()}`);
}

// ── Parse / Merge ─────────────────────────────────────────────────────────────

type SyntheseRow = {
  EMAIL: string; NOM: string; PRENOM: string; STRUCTURE: string;
  DATE_ACHAT: string; DATE_ADHESION: string;
  MONTANT_ACHAT: number; MONTANT_ADHESION: number;
};

function parseOds(buffer: Buffer): Map<string, SyntheseRow> {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const rows = rawRows.map((row: any) =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase().trim(), v]))
  );
  const map = new Map<string, SyntheseRow>();
  for (const row of rows) {
    const email = (row.email ?? '').trim().toLowerCase();
    if (!email) continue;
    map.set(email, {
      EMAIL: email,
      NOM: row.nom ?? '',
      PRENOM: row.prenom ?? '',
      STRUCTURE: row.structure ?? '',
      DATE_ACHAT: '',
      DATE_ADHESION: '',
      MONTANT_ACHAT: 0,
      MONTANT_ADHESION: 0,
    });
  }
  return map;
}

function merge(contacts: Map<string, SyntheseRow>, helloasso: Map<string, any>): SyntheseRow[] {
  const merged = new Map<string, SyntheseRow>(contacts);
  for (const [email, data] of helloasso) {
    const key = email.toLowerCase();
    const prev = merged.get(key);
    merged.set(key, {
      EMAIL: key,
      NOM: data.nom || prev?.NOM || '',
      PRENOM: data.prenom || prev?.PRENOM || '',
      STRUCTURE: prev?.STRUCTURE ?? '',
      DATE_ACHAT: fmtDate(data.date_achat) || prev?.DATE_ACHAT || '',
      DATE_ADHESION: fmtDate(data.date_adhesion) || prev?.DATE_ADHESION || '',
      MONTANT_ACHAT: parseFloat((data.apport_cents / 100).toFixed(2)),
      MONTANT_ADHESION: parseFloat((data.adhesion_cents / 100).toFixed(2)),
    });
  }
  return [...merged.values()].sort((a, b) => a.NOM.localeCompare(b.NOM));
}

// ── Entry point ───────────────────────────────────────────────────────────────

export async function syncMembers(): Promise<{ ok: boolean; message: string }> {
  const framaspaceUrl = process.env.FRAMASPACE_URL ?? '';
  const framaspaceUser = process.env.FRAMASPACE_USER ?? '';
  const framaspacePassword = process.env.FRAMASPACE_PASSWORD ?? '';

  if (!framaspaceUrl || !framaspaceUser || !framaspacePassword) {
    return { ok: false, message: 'Variables Framaspace manquantes' };
  }

  const token = await getToken();
  const helloassoData = await fetchHelloAssoData(token);

  const contactsUrl = webdavUrl(framaspaceUrl, framaspaceUser, CONTACTS_REMOTE_PATH);
  const contactsBuffer = await download(contactsUrl, framaspaceUser, framaspacePassword);
  const contactsRows = contactsBuffer ? parseOds(contactsBuffer) : new Map<string, SyntheseRow>();

  const rows = merge(contactsRows, helloassoData);

  const today = new Date();
  const stamp = today.getFullYear().toString()
    + String(today.getMonth() + 1).padStart(2, '0')
    + String(today.getDate()).padStart(2, '0');
  const filename = `${stamp}_synthese.ods`;
  const tmpPath = path.join('/tmp', filename);
  const remotePath = `${CRM_DIR}/${filename}`;

  const ws = XLSX.utils.json_to_sheet(rows, { header: HEADERS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Synthèse');
  XLSX.writeFile(wb, tmpPath, { bookType: 'ods' });

  const uploadUrl = webdavUrl(framaspaceUrl, framaspaceUser, remotePath);
  await upload(tmpPath, uploadUrl, framaspaceUser, framaspacePassword);
  fs.unlinkSync(tmpPath);

  return { ok: true, message: `${filename} déposé dans Framaspace (${rows.length} lignes)` };
}
