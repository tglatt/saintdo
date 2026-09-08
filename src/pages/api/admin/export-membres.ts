import type { APIRoute } from 'astro';
import { createAdminClient, fetchAll } from '../../../lib/supabase';
import { isAdmin } from '../../../lib/admin-auth';

const TYPES = ['adhesion', 'don', 'don_defiscalise', 'apport_associatif'] as const;
type TxType = typeof TYPES[number];

const TOTAL_LABELS: Record<TxType, string> = {
  adhesion:          'total_adhesions',
  don:               'total_dons',
  don_defiscalise:   'total_dons_defiscalises',
  apport_associatif: 'total_apports_associatifs',
};

// Séparateur `;` et virgule décimale : c'est ce qu'attend Excel en locale FR.
const SEP = ';';

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[";\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function csvAmount(n: number): string {
  return n.toFixed(2).replace('.', ',');
}

export const GET: APIRoute = async ({ cookies }) => {
  if (!await isAdmin(cookies)) return new Response('Unauthorized', { status: 401 });

  const supabase = createAdminClient();

  let membres: Record<string, unknown>[];
  let transactions: { membre_id: string; type: TxType; montant: number }[];
  try {
    // `select('*')` pour que l'export suive automatiquement le schéma de la table.
    membres = await fetchAll(() => supabase
      .from('membres')
      .select('*')
      .order('nom', { ascending: true })
      .order('id', { ascending: true }));

    transactions = await fetchAll(() => supabase
      .from('transactions')
      .select('membre_id, type, montant')
      .order('id', { ascending: true }));
  } catch (error: any) {
    return new Response(`Erreur export: ${error?.message}`, { status: 500 });
  }

  // Totaux par membre et par type de transaction
  const totals = new Map<string, Record<TxType, number>>();
  for (const tx of transactions) {
    if (!tx.membre_id || !TYPES.includes(tx.type)) continue;
    let row = totals.get(tx.membre_id);
    if (!row) {
      row = { adhesion: 0, don: 0, don_defiscalise: 0, apport_associatif: 0 };
      totals.set(tx.membre_id, row);
    }
    row[tx.type] += tx.montant ?? 0;
  }

  const columns = membres.length > 0 ? Object.keys(membres[0]) : [];

  const header = [...columns, ...TYPES.map(t => TOTAL_LABELS[t])];
  const lines = [header.map(csvCell).join(SEP)];

  for (const m of membres) {
    const t = totals.get(m.id as string);
    lines.push([
      ...columns.map(col => csvCell(m[col])),
      ...TYPES.map(type => csvAmount(t?.[type] ?? 0)),
    ].join(SEP));
  }

  const today = new Date().toISOString().slice(0, 10);
  // BOM UTF-8 pour que les accents s'affichent correctement dans Excel.
  const csv = '﻿' + lines.join('\r\n') + '\r\n';

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="membres-${today}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
};
