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
  convention_enabled: boolean;
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
