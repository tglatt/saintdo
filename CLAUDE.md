# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commandes

```bash
npm run dev      # Serveur de développement → http://localhost:4321
npm run build    # Build de production
npm run preview  # Prévisualiser le build
```

Il n'y a pas de tests automatisés ni de linter configurés.

Déclencher manuellement la synchronisation HelloAsso en local :

```bash
curl http://localhost:4321/api/cron/sync-members \
  -H "Authorization: Bearer <CRON_SECRET>"
```

## Stack

- **Astro 5** (SSR server-side) avec l'adaptateur **Vercel**
- **Supabase** — PostgreSQL + Auth (magic link)
- **HelloAsso** — source des données membres et transactions
- **Resend** — envoi d'emails (newsletter)

## Architecture

### Flux de données

HelloAsso est la source de vérité pour les membres et leurs transactions. `src/lib/sync-members.ts` contient toute la logique d'import : il récupère les formulaires d'adhésion (type `Membership`) et les boutiques (type `Shop`), puis fait un `upsert` vers Supabase sur les tables `membres` (clé de conflit : `email`) et `transactions` (clé de conflit : `helloasso_order_id`).

Le sync est déclenché automatiquement toutes les heures par Vercel Cron (`vercel.json`) via `POST /api/cron/sync-members` (sécurisé par Bearer token `CRON_SECRET`), ou manuellement depuis l'interface `/admin`.

Les transactions saisies manuellement depuis l'admin ont un `helloasso_order_id` préfixé `manual_` pour les distinguer des transactions HelloAsso — elles ne sont donc pas écrasées par les syncs.

### Authentification

Magic link via Supabase Auth. La session est stockée dans deux cookies httpOnly (`sb-access-token`, `sb-refresh-token`) posés par `src/pages/auth/set-session.ts` après réception du hash de callback.

Le middleware (`src/middleware.ts`) intercepte toutes les routes protégées, reconstitue la session Supabase depuis les cookies, et vérifie le `role` en base pour l'accès admin.

Routes protégées :
- `/espace-membre/*` → tout membre connecté
- `/admin/*` → membre avec `role = 'admin'`

### Clients Supabase

Deux clients dans `src/lib/supabase.ts` :
- `supabase` — client public (anon key), utilisé dans les pages SSR pour les données membres
- `createAdminClient()` — client service role (bypass RLS), réservé aux routes API et au middleware admin

### Pages et API

Les pages `.astro` font leurs requêtes Supabase directement dans le frontmatter (côté serveur). Les interactions dynamiques (modals, création de membres/transactions) passent par des API routes TypeScript dans `src/pages/api/admin/`.

### Base de données

**`membres`** — un enregistrement par adhérent ; les champs `structure` et `role` sont saisis manuellement et ne sont pas écrasés lors des syncs HelloAsso.

**`transactions`** — liée à `membres` via `membre_id` ; types : `adhesion`, `don`, `don_defiscalise`, `apport_associatif` ; moyens de paiement : `helloasso`, `cheque`, `virement`.

**`syncs`** — journal des synchronisations (démarrage, fin, statut, compteurs).

### Styles

Un seul fichier de tokens CSS partagé : `src/styles/theme.css`. Il définit toutes les variables CSS (couleurs, badges, statuts). À importer en tête de chaque page avec `import '../../styles/theme.css'`. Les styles de composants sont écrits inline dans chaque fichier `.astro`.

## Variables d'environnement

```env
HELLOASSO_CLIENT_ID=
HELLOASSO_CLIENT_SECRET=
CRON_SECRET=
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Déploiement

Push sur `main` → déploiement automatique Vercel. Les variables d'environnement sont à configurer dans **Vercel → Settings → Environment Variables**.

Pour passer un compte en admin : **Supabase → Table Editor → membres** → changer `role` de `membre` à `admin`.
