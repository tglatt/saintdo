/**
 * Sauvegarde complète des tables Supabase en JSON, archivée sur Framaspace.
 *
 * Chaque table est paginée (PostgREST plafonne à 1000 lignes par réponse) puis
 * écrite dans backups/<horodatage>/<table>.json, accompagnée d'un manifest.json
 * récapitulant les compteurs. Les fichiers sont réimportables tels quels via un
 * upsert Supabase.
 *
 * L'ensemble est aussi regroupé dans une archive <horodatage>_saindo-db.json.gz
 * déposée sur Framaspace (WebDAV), sauf si --no-upload est passé.
 *
 * Usage : npm run backup   (ou node --env-file=.env scripts/backup-db.mjs)
 *
 * Options :
 *   --out <dossier>         dossier racine des sauvegardes locales (défaut : ./backups)
 *   --keep <n>              ne conserve que les n sauvegardes les plus récentes (local + Framaspace)
 *   --tables a,b            limite la sauvegarde à certaines tables
 *   --remote-dir <chemin>   dossier Framaspace de destination
 *   --no-upload             sauvegarde locale uniquement
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Ordre de restauration : les tables référencées (membres) d'abord.
const TABLES = ['membres', 'transactions', 'conventions', 'age_reponses', 'porteurs_projet', 'syncs'];

const PAGE_SIZE = 1000;
const DEFAULT_REMOTE_DIR = 'Dossier partagé/09_SITE WEB/backups';
const ARCHIVE_SUFFIX = '_saindo-db.json.gz';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FRAMASPACE_URL = process.env.FRAMASPACE_URL;
const FRAMASPACE_USER = process.env.FRAMASPACE_USER;
const FRAMASPACE_PASSWORD = process.env.FRAMASPACE_PASSWORD;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌  PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant.');
  process.exit(1);
}

// ── Arguments ─────────────────────────────────────────────────────────────────

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const outRoot = path.resolve(arg('out', 'backups'));
const keep = parseInt(arg('keep', '0'), 10);
const remoteDir = arg('remote-dir', DEFAULT_REMOTE_DIR).replace(/\/+$/, '');
const tables = arg('tables', '').trim()
  ? arg('tables').split(',').map(t => t.trim()).filter(Boolean)
  : TABLES;

let upload = !process.argv.includes('--no-upload');
if (upload && !(FRAMASPACE_URL && FRAMASPACE_USER && FRAMASPACE_PASSWORD)) {
  console.warn('⚠️   Variables Framaspace manquantes — sauvegarde locale uniquement.\n');
  upload = false;
}

// ── Supabase ──────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Le tri sur `id` est indispensable : sans ordre stable, les pages peuvent se
// chevaucher et des lignes être dupliquées ou omises.
async function fetchTable(table) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table} : ${error.message}`);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

// ── Framaspace WebDAV ─────────────────────────────────────────────────────────

function webdavUrl(remotePath) {
  return `${FRAMASPACE_URL}/remote.php/dav/files/${encodeURIComponent(FRAMASPACE_USER)}/${remotePath.split('/').map(encodeURIComponent).join('/')}`;
}

function basicAuth() {
  return `Basic ${Buffer.from(`${FRAMASPACE_USER}:${FRAMASPACE_PASSWORD}`).toString('base64')}`;
}

// MKCOL ne crée qu'un niveau à la fois, et répond 405 si le dossier existe déjà.
async function ensureRemoteDir(remotePath) {
  const segments = remotePath.split('/').filter(Boolean);
  for (let i = 1; i <= segments.length; i++) {
    const res = await fetch(webdavUrl(segments.slice(0, i).join('/')), {
      method: 'MKCOL',
      headers: { Authorization: basicAuth() },
    });
    if (!res.ok && res.status !== 405) {
      throw new Error(`Création du dossier ${segments.slice(0, i).join('/')} échouée (${res.status})`);
    }
  }
}

async function uploadFile(localPath, remotePath) {
  const res = await fetch(webdavUrl(remotePath), {
    method: 'PUT',
    headers: { Authorization: basicAuth(), 'Content-Type': 'application/gzip' },
    body: fs.readFileSync(localPath),
  });
  if (!res.ok) throw new Error(`Upload ${remotePath} échoué (${res.status}): ${await res.text()}`);
}

async function listRemoteArchives() {
  const res = await fetch(webdavUrl(remoteDir), {
    method: 'PROPFIND',
    headers: { Authorization: basicAuth(), Depth: '1' },
  });
  if (!res.ok) throw new Error(`Listing ${remoteDir} échoué (${res.status})`);
  const xml = await res.text();
  return [...xml.matchAll(/<d:href>([^<]+)<\/d:href>/g)]
    .map(m => decodeURIComponent(m[1]).split('/').pop())
    .filter(name => name.endsWith(ARCHIVE_SUFFIX))
    .sort()
    .reverse();
}

async function deleteRemote(remotePath) {
  const res = await fetch(webdavUrl(remotePath), {
    method: 'DELETE',
    headers: { Authorization: basicAuth() },
  });
  if (!res.ok && res.status !== 404) throw new Error(`Suppression ${remotePath} échouée (${res.status})`);
}

// ── Rotation locale ───────────────────────────────────────────────────────────

function rotateLocal(limit) {
  const dirs = fs.readdirSync(outRoot)
    .filter(d => /^\d{8}_\d{6}$/.test(d) && fs.statSync(path.join(outRoot, d)).isDirectory())
    .sort()
    .reverse();
  for (const dir of dirs.slice(limit)) {
    fs.rmSync(path.join(outRoot, dir), { recursive: true, force: true });
    console.log(`🗑️   Sauvegarde locale supprimée : ${dir}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

const now = new Date();
const stamp = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, '0'),
  String(now.getDate()).padStart(2, '0'),
  '_',
  String(now.getHours()).padStart(2, '0'),
  String(now.getMinutes()).padStart(2, '0'),
  String(now.getSeconds()).padStart(2, '0'),
].join('');

const outDir = path.join(outRoot, stamp);
fs.mkdirSync(outDir, { recursive: true });

console.log(`💾  Sauvegarde vers ${outDir}\n`);

const manifest = { date: now.toISOString(), supabase_url: SUPABASE_URL, tables: {} };
const dump = {};
let failed = false;

for (const table of tables) {
  try {
    const rows = await fetchTable(table);
    const file = path.join(outDir, `${table}.json`);
    fs.writeFileSync(file, JSON.stringify(rows, null, 2));
    dump[table] = rows;
    manifest.tables[table] = { rows: rows.length, bytes: fs.statSync(file).size };
    console.log(`  ✅  ${table.padEnd(16)} ${String(rows.length).padStart(6)} ligne(s)`);
  } catch (err) {
    failed = true;
    manifest.tables[table] = { error: err.message };
    console.error(`  ❌  ${table.padEnd(16)} ${err.message}`);
  }
}

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

// Archive unique (manifest + tables), gzippée : un seul fichier à déposer et à
// relire pour une restauration.
const archiveName = `${stamp}${ARCHIVE_SUFFIX}`;
const archivePath = path.join(outDir, archiveName);
fs.writeFileSync(archivePath, zlib.gzipSync(JSON.stringify({ manifest, tables: dump })));
console.log(`\n📦  Archive ${archiveName} (${(fs.statSync(archivePath).size / 1024 / 1024).toFixed(2)} Mo)`);

// Une sauvegarde incomplète n'est pas déposée : elle écraserait la rotation
// distante avec une archive partielle.
if (upload && failed) {
  console.warn('⚠️   Sauvegarde incomplète — upload Framaspace annulé.');
} else if (upload) {
  try {
    await ensureRemoteDir(remoteDir);
    await uploadFile(archivePath, `${remoteDir}/${archiveName}`);
    console.log(`☁️   Déposée sur Framaspace : ${remoteDir}/${archiveName}`);

    if (keep > 0) {
      for (const name of (await listRemoteArchives()).slice(keep)) {
        await deleteRemote(`${remoteDir}/${name}`);
        console.log(`🗑️   Archive Framaspace supprimée : ${name}`);
      }
    }
  } catch (err) {
    failed = true;
    console.error(`❌  Framaspace : ${err.message}`);
  }
}

if (keep > 0) rotateLocal(keep);

const total = Object.values(manifest.tables).reduce((s, t) => s + (t.rows ?? 0), 0);
console.log(`\n${failed ? '⚠️ ' : '✅'}  ${total} ligne(s) sauvegardée(s) dans ${outDir}`);

// Une sauvegarde incomplète ne doit pas passer pour un succès (cron, CI).
process.exit(failed ? 1 : 0);
