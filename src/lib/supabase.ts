import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

// Client public — utilisé côté navigateur et pages Astro
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Client admin — uniquement côté serveur (API routes, cron)
export function createAdminClient() {
  const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// PostgREST plafonne chaque réponse à 1000 lignes. Pour les lectures de table
// entière (transactions, membres…), il faut donc paginer explicitement, sinon les
// enregistrements au-delà du millier disparaissent silencieusement des totaux.
// La requête passée doit se terminer par un tri stable (`.order('id')` en dernier
// critère) : sans lui, l'ordre des pages n'est pas garanti et des lignes peuvent
// être dupliquées ou omises.
const PAGE_SIZE = 1000;

export async function fetchAll<T = any>(
  buildQuery: () => any,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

export type Membre = {
  id: string;
  email: string;
  nom: string | null;
  prenom: string | null;
  address: string | null;
  zip_code: string | null;
  city: string | null;
  country: string | null;
  structure: string | null;
  date_naissance: string | null;
  ville_naissance: string | null;
  departement_naissance: string | null;
  role: 'membre' | 'admin';
  created_at: string;
  updated_at: string;
};

export type Convention = {
  id: string;
  membre_id: string;
  signed_at: string;
  contenu_md: string;
  signature_adherent: string;
  created_at: string;
};

export type Transaction = {
  id: string;
  membre_id: string;
  type: 'adhesion' | 'don' | 'don_defiscalise' | 'apport_associatif';
  montant: number;
  date: string | null;
  paiement: 'helloasso' | 'cheque' | 'virement' | null;
  detail: string | null;
  helloasso_order_id: string | null;
  helloasso_form_slug: string | null;
  created_at: string;
};
