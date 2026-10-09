import type { APIRoute } from 'astro';
import { createAdminClient, fetchAll } from '../../../lib/supabase';
import { isAdmin } from '../../../lib/admin-auth';
import { sections, formatValue } from '../../../lib/porteurs-projet-questionnaire';

// Séparateur `;` : c'est ce qu'attend Excel en locale FR.
const SEP = ';';

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[";\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

type Candidature = {
  created_at: string;
  email: string;
  nom: string | null;
  prenom: string | null;
  telephone: string | null;
  intitule_projet: string | null;
  reponses: Record<string, Record<string, unknown>> | null;
};

export const GET: APIRoute = async ({ cookies }) => {
  if (!await isAdmin(cookies)) return new Response('Unauthorized', { status: 401 });

  const supabase = createAdminClient();

  let candidatures: Candidature[];
  try {
    candidatures = await fetchAll<Candidature>(() => supabase
      .from('porteurs_projet')
      .select('created_at, email, nom, prenom, telephone, intitule_projet, reponses')
      .order('created_at', { ascending: false })
      .order('id', { ascending: true }));
  } catch (error: any) {
    return new Response(`Erreur export: ${error?.message}`, { status: 500 });
  }

  const header = [
    'Date de réception',
    'Email',
    'Nom',
    'Prénom',
    'Téléphone',
    'Intitulé du projet',
    // Les libellés de questions sont préfixés par leur section : plusieurs
    // sections partagent des intitulés proches.
    ...sections.flatMap(s => s.fields.map(f => `${s.title} — ${f.label}`)),
  ];
  const lines = [header.map(csvCell).join(SEP)];

  for (const c of candidatures) {
    lines.push([
      new Date(c.created_at).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris',
      }),
      c.email,
      c.nom,
      c.prenom,
      c.telephone,
      c.intitule_projet,
      ...sections.flatMap(s => s.fields.map(f =>
        formatValue(c.reponses?.[s.key]?.[f.key], f.options))),
    ].map(csvCell).join(SEP));
  }

  const today = new Date().toISOString().slice(0, 10);
  // BOM UTF-8 pour que les accents s'affichent correctement dans Excel.
  const csv = '﻿' + lines.join('\r\n') + '\r\n';

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="porteurs-projet-${today}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
};
