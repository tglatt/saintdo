-- Inscriptions à la newsletter (formulaire du site vitrine → POST /api/newsletter).
-- À exécuter une fois dans Supabase → SQL Editor.
--
-- brevo_exported_at : vide tant que l'adresse n'a pas été envoyée à Brevo ; renseignée
-- par l'export quotidien (/api/cron/export-newsletter).

create table if not exists public.newsletter_inscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now(),
  brevo_exported_at timestamptz
);

create index if not exists newsletter_inscriptions_a_exporter
  on public.newsletter_inscriptions (created_at)
  where brevo_exported_at is null;

-- Aucune politique : la table n'est accessible qu'avec la clé service role (routes API).
alter table public.newsletter_inscriptions enable row level security;
