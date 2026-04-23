# Hôtel Saint Domingue — saindo.org

Site de la foncière citoyenne pour le rachat de l'Hôtel Saint Domingue à Die (Drôme).

## Stack

- **Astro 5** (SSR) — framework web
- **Vercel** — hébergement et déploiement
- **Supabase** — base de données PostgreSQL + authentification
- **HelloAsso** — gestion des adhésions et apports associatifs

## Structure

```
src/
├── lib/
│   ├── supabase.ts          # Client Supabase (public + admin) et types
│   ├── helloasso.ts         # Récupération des stats HelloAsso (jauge)
│   └── sync-members.ts      # Synchronisation HelloAsso → Supabase
├── middleware.ts             # Protection des routes membres et admin
└── pages/
    ├── index.astro           # Page publique (jauge, présentation projet)
    ├── login.astro           # Connexion par magic link
    ├── auth/
    │   ├── callback.astro    # Réception du magic link (hash → cookies)
    │   ├── set-session.ts    # Pose les cookies de session httpOnly
    │   └── logout.ts         # Suppression des cookies
    ├── espace-membre/
    │   └── index.astro       # Récapitulatif membre + historique transactions
    ├── admin/
    │   ├── index.astro       # Liste des membres, stats globales
    │   └── sync.ts           # Déclenchement manuel du sync HelloAsso
    └── api/
        └── cron/
            └── sync-members.ts  # Endpoint cron (appelé par Vercel Cron)
```

## Base de données

Deux tables Supabase :

**`membres`** — un enregistrement par adhérent

| Colonne | Type | Description |
|---|---|---|
| id | uuid | Clé primaire |
| email | text | Identifiant unique |
| nom / prenom | text | Depuis HelloAsso |
| structure | text | Saisie manuelle |
| role | text | `membre` ou `admin` |

**`transactions`** — relation N vers 1 avec `membres`

| Colonne | Type | Description |
|---|---|---|
| id | uuid | Clé primaire |
| membre_id | uuid | FK → membres.id |
| type | text | `adhesion`, `don`, `apport_associatif` |
| montant | numeric | En euros |
| date | timestamptz | Date de la transaction |
| helloasso_order_id | text | Identifiant unique HelloAsso (anti-doublon) |

## Authentification

Connexion par **magic link** (email) via Supabase Auth.
Seuls les membres présents dans la table `membres` peuvent recevoir un lien.

Routes protégées :
- `/espace-membre/*` → membre connecté
- `/admin/*` → membre avec `role = 'admin'`

## Variables d'environnement

```env
# HelloAsso
HELLOASSO_CLIENT_ID=
HELLOASSO_CLIENT_SECRET=

# Cron
CRON_SECRET=                 # Bearer token pour sécuriser l'endpoint cron

# Supabase
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Développement local

```bash
npm install
npm run dev
# → http://localhost:4321
```

## Synchronisation des membres

Depuis l'interface admin (`/admin` → "Synchroniser HelloAsso") ou via curl :

```bash
curl http://localhost:4321/api/cron/sync-members \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Le sync fait un `upsert` : membres et transactions existants sont mis à jour, les nouveaux sont créés. Les champs saisis manuellement (`structure`, `role`) ne sont pas écrasés.

## Déploiement

Push sur `main` → déploiement automatique sur Vercel.

Ajouter les variables d'environnement dans **Vercel → Settings → Environment Variables**.

## Passer un compte en admin

Dans **Supabase → Table Editor → membres** : trouver la ligne, changer `role` de `membre` à `admin`.
