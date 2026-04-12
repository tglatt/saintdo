/**
 * Fusionne Contacts.ods (Framaspace) et les données HelloAsso,
 * et génère un fichier YYYYMMdd_synthese.ods uploadé sur Framaspace.
 *
 * Usage : export $(cat .env | xargs) && node scripts/get-members.mjs
 */

import * as XLSX from 'xlsx';
import fs from 'fs';

const API_BASE = 'https://api.helloasso.com/v5';
const ORG = 'le-saint-domingue';
const CONTACTS_REMOTE_PATH = 'Dossier partagé/07_CRM/Contacts.ods';
const CRM_DIR = 'Dossier partagé/07_CRM';

const CLIENT_ID = process.env.HELLOASSO_CLIENT_ID;
const CLIENT_SECRET = process.env.HELLOASSO_CLIENT_SECRET;
const FRAMASPACE_URL = process.env.FRAMASPACE_URL;
const FRAMASPACE_USER = process.env.FRAMASPACE_USER;
const FRAMASPACE_PASSWORD = process.env.FRAMASPACE_PASSWORD;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌  Variables HelloAsso manquantes.');
  process.exit(1);
}
if (!FRAMASPACE_URL || !FRAMASPACE_USER || !FRAMASPACE_PASSWORD) {
  console.error('❌  Variables Framaspace manquantes.');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function webdavUrl(remotePath) {
  return `${FRAMASPACE_URL}/remote.php/dav/files/${encodeURIComponent(FRAMASPACE_USER)}/${remotePath.split('/').map(encodeURIComponent).join('/')}`;
}

function basicAuth() {
  return `Basic ${Buffer.from(`${FRAMASPACE_USER}:${FRAMASPACE_PASSWORD}`).toString('base64')}`;
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

// ── HelloAsso ─────────────────────────────────────────────────────────────────

async function getToken() {
  const res = await fetch('https://api.helloasso.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });
  const data = await res.json();
  if (!data.access_token) { console.error('❌  Token error:', data); process.exit(1); }
  return data.access_token;
}

async function fetchAllPages(token, url) {
  const items = [];
  let pageIndex = 1;
  while (true) {
    const sep = url.includes('?') ? '&' : '?';
    const res = await fetch(`${url}${sep}pageSize=100&pageIndex=${pageIndex}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { console.error(`❌  ${res.status} on ${url}`); break; }
    const data = await res.json();
    items.push(...(data.data ?? []));
    if (pageIndex >= (data.pagination?.totalPages ?? 1)) break;
    pageIndex++;
  }
  return items;
}

async function fetchHelloAssoData(token) {
  const forms = await fetchAllPages(token, `${API_BASE}/organizations/${ORG}/forms`);
  const people = new Map();

  function upsert(email, user, patch) {
    if (!people.has(email)) {
      people.set(email, { nom: user?.lastName ?? '', prenom: user?.firstName ?? '', date_adhesion: '', date_achat: '', adhesion_cents: 0, apport_cents: 0 });
    }
    Object.assign(people.get(email), patch);
  }

  for (const form of forms.filter(f => f.formType === 'Membership')) {
    console.log(`  → Adhésion : "${form.title}"`);
    const items = await fetchAllPages(token, `${API_BASE}/organizations/${ORG}/forms/Membership/${form.formSlug}/items`);
    for (const item of items) {
      const user = item.payer ?? item.user;
      if (!user?.email) continue;
      upsert(user.email, user, { date_adhesion: item.order?.date ?? '' });
      people.get(user.email).adhesion_cents += item.amount ?? 0;
    }
  }

  for (const form of forms.filter(f => f.formType === 'Shop')) {
    console.log(`  → Boutique : "${form.title}"`);
    const orders = await fetchAllPages(token, `${API_BASE}/organizations/${ORG}/forms/Shop/${form.formSlug}/orders`);
    for (const order of orders) {
      const user = order.payer;
      if (!user?.email) continue;
      const prevDate = people.get(user.email)?.date_achat ?? '';
      const newDate = order.date ?? '';
      upsert(user.email, user, { date_achat: newDate > prevDate ? newDate : prevDate });
      const orderTotal = (order.items ?? []).reduce((s, i) => s + (i.amount ?? 0), 0);
      people.get(user.email).apport_cents += orderTotal;
    }
  }

  return people;
}

const HEADERS = ['EMAIL', 'NOM', 'PRENOM', 'STRUCTURE', 'DATE_ACHAT', 'DATE_ADHESION', 'MONTANT_ACHAT', 'MONTANT_ADHESION'];

// ── Framaspace WebDAV ─────────────────────────────────────────────────────────

async function download(remotePath) {
  const res = await fetch(webdavUrl(remotePath), {
    headers: { Authorization: basicAuth() },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Téléchargement ${remotePath} échoué (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

async function upload(localPath, remotePath) {
  const res = await fetch(webdavUrl(remotePath), {
    method: 'PUT',
    headers: {
      Authorization: basicAuth(),
      'Content-Type': 'application/vnd.oasis.opendocument.spreadsheet',
    },
    body: fs.readFileSync(localPath),
  });
  if (!res.ok) throw new Error(`Upload ${remotePath} échoué (${res.status}): ${await res.text()}`);
}

// ── Parse / Merge ─────────────────────────────────────────────────────────────

function parseOds(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const rows = rawRows.map(row =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase().trim(), v]))
  );
  const map = new Map();
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

function merge(contacts, helloasso) {
  const merged = new Map(contacts);
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

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('🔑  Obtention du token HelloAsso...');
const token = await getToken();

console.log('📋  Récupération des données HelloAsso...');
const helloassoData = await fetchHelloAssoData(token);
console.log(`   ${helloassoData.size} personne(s) trouvée(s).`);

console.log('\n☁️   Téléchargement de Contacts.ods depuis Framaspace...');
const contactsBuffer = await download(CONTACTS_REMOTE_PATH);
const contactsRows = contactsBuffer ? parseOds(contactsBuffer) : new Map();
if (!contactsBuffer) console.log('  ℹ️  Contacts.ods introuvable, synthèse générée depuis HelloAsso uniquement.');
else console.log(`   ${contactsRows.size} contact(s) existant(s).`);

const rows = merge(contactsRows, helloassoData);
console.log(`\n🔀  Fusion : ${rows.length} ligne(s) au total.`);

const today = new Date();
const stamp = today.getFullYear().toString()
  + String(today.getMonth() + 1).padStart(2, '0')
  + String(today.getDate()).padStart(2, '0');
const filename = `${stamp}_synthese.ods`;
const tmpPath = `/tmp/${filename}`;
const remoteSynthesePath = `${CRM_DIR}/${filename}`;

const ws = XLSX.utils.json_to_sheet(rows, { header: HEADERS });
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Synthèse');
XLSX.writeFile(wb, tmpPath, { bookType: 'ods' });

console.log(`☁️   Upload de ${filename} vers Framaspace...`);
await upload(tmpPath, remoteSynthesePath);
fs.unlinkSync(tmpPath);

console.log(`✅  ${filename} déposé dans Framaspace.`);
