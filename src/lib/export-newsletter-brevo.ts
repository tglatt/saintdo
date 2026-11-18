import { createAdminClient, fetchAll } from './supabase';

// Export quotidien des inscriptions newsletter vers Brevo.
//
// La table `newsletter_inscriptions` est la source de vérité : chaque inscription y est
// enregistrée par POST /api/newsletter. Une ligne dont `brevo_exported_at` est vide n'a
// pas encore été envoyée à Brevo. L'export crée (ou met à jour) le contact dans Brevo,
// l'ajoute à la liste BREVO_LIST_ID, puis date la ligne. En cas d'échec la ligne reste
// à exporter et sera retentée au passage suivant.

const BREVO_CONTACTS_URL = 'https://api.brevo.com/v3/contacts';

// Garde-fou : une exécution ne traite pas plus de contacts que ce que la fonction peut
// envoyer dans son temps imparti. Le reste part au passage suivant.
const MAX_PAR_EXECUTION = 500;
const ENVOIS_SIMULTANES = 5;

type Inscription = { id: string; email: string };

export type ExportNewsletterResult = {
  ok: boolean;
  message: string;
  a_exporter: number;
  exportes: number;
  echecs: { email: string; detail: string }[];
};

function env(name: string): string | undefined {
  return (import.meta.env as Record<string, string | undefined>)[name] ?? process.env[name];
}

async function envoyerContact(email: string, apiKey: string, listId: number): Promise<string | null> {
  const res = await fetch(BREVO_CONTACTS_URL, {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    // updateEnabled : si le contact existe déjà dans Brevo, il est simplement ajouté à la liste.
    // On ne transmet pas emailBlacklisted : une personne désinscrite dans Brevo le reste.
    body: JSON.stringify({ email, listIds: [listId], updateEnabled: true }),
  });
  if (res.ok) return null;
  const detail = await res.text().catch(() => '');
  return `HTTP ${res.status} ${detail.slice(0, 200)}`;
}

export async function exportNewsletterToBrevo(): Promise<ExportNewsletterResult> {
  const apiKey = env('BREVO_API_KEY');
  const listId = Number(env('BREVO_LIST_ID'));
  if (!apiKey || !Number.isInteger(listId) || listId <= 0) {
    return { ok: false, message: 'BREVO_API_KEY ou BREVO_LIST_ID manquant', a_exporter: 0, exportes: 0, echecs: [] };
  }

  const supabase = createAdminClient();
  const enAttente = await fetchAll<Inscription>(() =>
    supabase
      .from('newsletter_inscriptions')
      .select('id, email')
      .is('brevo_exported_at', null)
      .order('created_at')
      .order('id'),
  );

  const lot = enAttente.slice(0, MAX_PAR_EXECUTION);
  const echecs: ExportNewsletterResult['echecs'] = [];
  const exportes: string[] = [];

  // Envois par petits groupes en parallèle : assez rapide pour quelques centaines de contacts,
  // tout en restant sous la limite de débit de l'API Brevo.
  for (let i = 0; i < lot.length; i += ENVOIS_SIMULTANES) {
    await Promise.all(lot.slice(i, i + ENVOIS_SIMULTANES).map(async (inscription) => {
      try {
        const erreur = await envoyerContact(inscription.email, apiKey, listId);
        if (erreur) echecs.push({ email: inscription.email, detail: erreur });
        else exportes.push(inscription.id);
      } catch (err: any) {
        echecs.push({ email: inscription.email, detail: err?.message ?? String(err) });
      }
    }));
  }

  // Marquage par paquets : une liste de plusieurs centaines d'identifiants dépasserait la taille d'URL acceptée.
  const exporteLe = new Date().toISOString();
  for (let i = 0; i < exportes.length; i += 100) {
    const { error } = await supabase
      .from('newsletter_inscriptions')
      .update({ brevo_exported_at: exporteLe })
      .in('id', exportes.slice(i, i + 100));
    if (error) {
      // Les contacts sont bien dans Brevo ; ils seront renvoyés au prochain passage (sans effet, updateEnabled).
      return {
        ok: false,
        message: `Contacts envoyés à Brevo mais non marqués en base : ${error.message}`,
        a_exporter: enAttente.length,
        exportes: exportes.length,
        echecs,
      };
    }
  }

  const reste = enAttente.length - exportes.length;
  return {
    ok: echecs.length === 0,
    message: `${exportes.length} inscription(s) exportée(s) vers Brevo` + (reste ? `, ${reste} restante(s)` : ''),
    a_exporter: enAttente.length,
    exportes: exportes.length,
    echecs,
  };
}
