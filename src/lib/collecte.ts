import { createAdminClient, fetchAll } from './supabase';

// Paliers successifs de la collecte, en montants cumulés.
export const PALIERS = [
  { montant: 300000, label: 'acquisition', annonce: "L'acquisition est financée !" },
  { montant: 360000, label: 'expérimentation', annonce: "L'expérimentation est financée !" },
  { montant: 500000, label: 'premiers travaux', annonce: 'Les premiers travaux sont financés !' },
];
export const OBJECTIF = PALIERS[PALIERS.length - 1].montant;
export const SUBVENTIONS = 30000 + 45000;

export type Palier = {
  montant: number;
  label: string;
  annonce: string;
  pct: number;
  atteint: boolean;
};

export type Collecte = {
  objectif: number;
  don: number;
  apport: number;
  subventions: number;
  total: number;            // don + apport (hors subventions)
  totalAvecSubventions: number;
  participants: number;
  pct: number;
  pctDon: number;
  pctApport: number;
  pctSubventions: number;
  paliers: Palier[];
  dernierAtteint: Palier | null;
  prochain: Palier | null;
};

// Agrège les montants collectés (Supabase) et calcule l'état des paliers.
// Utilisé par la page d'accueil Astro et par la route JSON /api/public/collecte
// consommée par le site WordPress.
export async function getCollecte(): Promise<Collecte> {
  const supabase = createAdminClient();
  const transactions = await fetchAll<{ type: string; montant: number }>(() => supabase
    .from('transactions')
    .select('type, montant')
    .order('id', { ascending: true }));

  const don = transactions
    .filter(t => t.type === 'adhesion' || t.type === 'don' || t.type === 'don_defiscalise')
    .reduce((s, t) => s + t.montant, 0);
  const apport = transactions
    .filter(t => t.type === 'apport_associatif')
    .reduce((s, t) => s + t.montant, 0);

  const { count } = await supabase
    .from('membres')
    .select('id', { count: 'exact', head: true });

  const total = don + apport;
  const totalAvecSubventions = total + SUBVENTIONS;
  const pctOf = (n: number) => Math.min(Math.round((n / OBJECTIF) * 100), 100);

  const paliers: Palier[] = PALIERS.map(p => ({
    ...p,
    pct: Math.round((p.montant / OBJECTIF) * 100),
    atteint: totalAvecSubventions >= p.montant,
  }));

  return {
    objectif: OBJECTIF,
    don,
    apport,
    subventions: SUBVENTIONS,
    total,
    totalAvecSubventions,
    participants: count ?? 0,
    pct: pctOf(totalAvecSubventions),
    pctDon: pctOf(don),
    pctApport: pctOf(apport),
    pctSubventions: pctOf(SUBVENTIONS),
    paliers,
    dernierAtteint: [...paliers].reverse().find(p => p.atteint) ?? null,
    prochain: paliers.find(p => !p.atteint) ?? null,
  };
}
