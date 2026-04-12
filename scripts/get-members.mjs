/**
 * Récupère les adhérents et les acheteurs de la boutique HelloAsso.
 * Exporte le résultat dans YYYYMMdd_helloasso.xlsx.
 *
 * Usage : node scripts/get-members.mjs
 *    ou : export $(cat .env | xargs) && node scripts/get-members.mjs
 */

import * as XLSX from 'xlsx';
import fs from 'fs';

const API_BASE = 'https://api.helloasso.com/v5';
const ORG = 'le-saint-domingue';

const CLIENT_ID = process.env.HELLOASSO_CLIENT_ID;
const CLIENT_SECRET = process.env.HELLOASSO_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌  Variables manquantes. Lance :');
  console.error('   export $(cat .env | xargs) && node scripts/get-members.mjs');
  process.exit(1);
}

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
  if (!data.access_token) {
    console.error('❌  Erreur token :', data);
    process.exit(1);
  }
  return data.access_token;
}

/**
 * Récupère toutes les pages d'un endpoint paginé HelloAsso.
 * Retourne un tableau plat de tous les items.
 */
async function fetchAllPages(token, url) {
  const items = [];
  let pageIndex = 1;

  while (true) {
    const sep = url.includes('?') ? '&' : '?';
    const res = await fetch(`${url}${sep}pageSize=100&pageIndex=${pageIndex}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`❌  ${res.status} sur ${url} (page ${pageIndex}) :`, text);
      break;
    }

    const data = await res.json();
    items.push(...(data.data ?? []));

    if (pageIndex >= (data.pagination?.totalPages ?? 1)) break;
    pageIndex++;
  }

  return items;
}

/**
 * Récupère tous les formulaires de l'organisation.
 */
async function getForms(token) {
  return fetchAllPages(token, `${API_BASE}/organizations/${ORG}/forms`);
}

/**
 * Retourne une Map email → { nom, prenom, email, date_adhesion, date_achat, adhesion_cents, apport_cents }
 * en agrégeant adhésions et achats boutique dans la même structure.
 */
async function buildPeopleMap(token, forms) {
  const people = new Map();

  function upsert(email, user, patch) {
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
    Object.assign(people.get(email), patch);
  }

  // ── Adhésions ──
  const membershipForms = forms.filter(f => f.formType === 'Membership');
  for (const form of membershipForms) {
    console.log(`  → Adhésion : "${form.title}" (${form.formSlug})`);
    const items = await fetchAllPages(
      token,
      `${API_BASE}/organizations/${ORG}/forms/Membership/${form.formSlug}/items`
    );
    for (const item of items) {
      const user = item.payer ?? item.user;
      if (!user?.email) continue;
      upsert(user.email, user, { date_adhesion: item.order?.date ?? '' });
      people.get(user.email).adhesion_cents += item.amount ?? 0;
    }
  }

  // ── Boutique ──
  const shopForms = forms.filter(f => f.formType === 'Shop');
  for (const form of shopForms) {
    console.log(`  → Boutique : "${form.title}" (${form.formSlug})`);
    const orders = await fetchAllPages(
      token,
      `${API_BASE}/organizations/${ORG}/forms/Shop/${form.formSlug}/orders`
    );
    for (const order of orders) {
      const user = order.payer;
      if (!user?.email) continue;
      const existing = people.get(user.email);
      const prevDate = existing?.date_achat ?? '';
      const newDate = order.date ?? '';
      upsert(user.email, user, { date_achat: newDate > prevDate ? newDate : prevDate });
      const orderTotal = (order.items ?? []).reduce((sum, item) => sum + (item.amount ?? 0), 0);
      people.get(user.email).apport_cents += orderTotal;
    }
  }

  return people;
}

function printTable(label, rows, columns) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${label} (${rows.length})`);
  console.log('─'.repeat(60));
  if (rows.length === 0) {
    console.log('  (aucun résultat)');
    return;
  }
  console.table(rows.map(r => Object.fromEntries(columns.map(c => [c, r[c]]))));
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('🔑  Obtention du token...');
const token = await getToken();
console.log('✅  Token obtenu.\n');

console.log('📋  Récupération des formulaires...');
const forms = await getForms(token);
console.log(`   ${forms.length} formulaire(s) trouvé(s) : ${forms.map(f => f.formType + '/' + f.formSlug).join(', ')}\n`);

console.log('👥  Adhérents & boutique...');
const people = await buildPeopleMap(token, forms);

const fmt = cents => (cents / 100).toFixed(2) + ' €';
const num = cents => parseFloat((cents / 100).toFixed(2));
const fmtDate = iso => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
};

const rows = [...people.values()]
  .sort((a, b) => a.nom.localeCompare(b.nom))
  .map(p => ({
    nom: p.nom,
    prenom: p.prenom,
    email: p.email,
    'date_adhésion': fmtDate(p.date_adhesion),
    'date_achat': fmtDate(p.date_achat),
    adhésion: fmt(p.adhesion_cents),
    apport: fmt(p.apport_cents),
  }));

printTable('ADHÉRENTS & BOUTIQUE', rows, ['nom', 'prenom', 'email', 'date_adhésion', 'date_achat', 'adhésion', 'apport']);

// ── Export XLSX ───────────────────────────────────────────────────────────────
const xlsxRows = [...people.values()]
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

const totalAdhesion = xlsxRows.reduce((s, r) => s + r.adhésion, 0);
const totalApport = xlsxRows.reduce((s, r) => s + r.apport, 0);
xlsxRows.push({
  nom: 'TOTAL',
  prenom: '',
  email: '',
  'date_adhésion': '',
  'date_achat': '',
  adhésion: parseFloat(totalAdhesion.toFixed(2)),
  apport: parseFloat(totalApport.toFixed(2)),
});

const ws = XLSX.utils.json_to_sheet(xlsxRows);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Membres');
const today = new Date();
const stamp = today.getFullYear().toString()
  + String(today.getMonth() + 1).padStart(2, '0')
  + String(today.getDate()).padStart(2, '0');
const outPath = `${stamp}_helloasso.xlsx`;
XLSX.writeFile(wb, outPath);
console.log(`\n📄  Fichier exporté : ${outPath}`);

// ── Upload WebDAV (Framaspace / Nextcloud) ────────────────────────────────────
const framaspaceUrl = process.env.FRAMASPACE_URL;
const framaspaceUser = process.env.FRAMASPACE_USER;
const framaspacePassword = process.env.FRAMASPACE_PASSWORD;

if (framaspaceUrl && framaspaceUser && framaspacePassword) {
  const remotePath = `Dossier partag\u00e9/07_CRM/${outPath}`;
  const webdavUrl = `${framaspaceUrl}/remote.php/dav/files/${encodeURIComponent(framaspaceUser)}/${remotePath.split('/').map(encodeURIComponent).join('/')}`;
  const auth = Buffer.from(`${framaspaceUser}:${framaspacePassword}`).toString('base64');
  const fileBuffer = fs.readFileSync(outPath);

  console.log('☁️   Upload vers Framaspace...');
  const res = await fetch(webdavUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
    body: fileBuffer,
  });

  if (res.ok) {
    console.log(`✅  Fichier disponible sur Framaspace : ${framaspaceUrl}/apps/files`);
    fs.unlinkSync(outPath);
  } else {
    console.error(`❌  Échec de l'upload (${res.status}) :`, await res.text());
  }
}

console.log('\n✅  Terminé.');
