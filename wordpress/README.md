# Site vitrine WordPress

Le site public (`saindo.org`) est hébergé sur WordPress. L'application (espace membre,
admin, API, cron HelloAsso) reste sur Astro/Vercel, sur le sous-domaine `app.saindo.org`.

Le dossier `saindo-site/` est un plugin WordPress à installer tel quel
(zip du dossier → Extensions → Ajouter → Téléverser), ou à déposer par FTP dans
`wp-content/plugins/saindo-site/`.

Hébergement : Privianet. Le FTP répond sur `mut7.privianet.com` (utilisateur `saindoo1`),
pas sur `ftp.saindo.org` qui coupe les connexions. WordPress est à la racine du compte FTP.

## Ce que fait le plugin

- **Réglages → Saindo** : URL de l'application (par défaut `https://app.saindo.org`).
  Peut aussi être figée dans `wp-config.php` : `define('SAINDO_APP_URL', 'https://app.saindo.org');`
- **Redirections** : `/login`, `/logout`, `/espace-membre…`, `/admin…`, `/age…`, `/auth…`, `/api…`
  sont redirigés (302, query string conservée) vers l'application. Indispensable : les emails
  déjà envoyés (convocations AGE, conventions) contiennent des liens `saindo.org/age/rsvp?t=…`.
- **Shortcodes** :
  - `[saindo_jauge]` — jauge de collecte. Les chiffres viennent de `GET {app}/api/public/collecte`,
    mis en cache 5 min (transient) ; en cas de panne la dernière valeur connue est affichée.
    Conçue pour un fond sombre (`#2D2A68`) : la placer dans un bloc Groupe avec cette couleur.
  - `[saindo_newsletter]` — formulaire d'inscription (POST `{app}/api/newsletter`).
  - `[saindo_questionnaire]` — questionnaire porteur·se de projet en 5 pages
    (POST `{app}/api/candidature-projet`). Le questionnaire reste enregistré dans Supabase
    et visible dans l'admin de l'application, l'email de confirmation est envoyé par l'application.

## Génération des pages

`tools/build-pages.py` a produit les gabarits nav/contact/footer du plugin et le contenu des six
pages (JSON pour l'API REST) à partir des anciennes pages Astro. Celles-ci ont été supprimées du
dépôt après la bascule : pour relancer le script, se placer sur le commit `1b5d9b1`.
Les pages vivent désormais dans WordPress et sont construites en blocs natifs (Groupe, Titre,
Paragraphe, Liste, Image, Boutons, Bannière, Tableau) : le contenu se modifie directement dans
l'éditeur. La mise en forme vient de `saindo-site/assets/blocs.css`, chargée sur le site et dans
l'éditeur, et se choisit avec « Avancé → Classe(s) CSS additionnelle(s) » sur chaque bloc ; la
liste des classes est en tête de ce fichier. Seule la vidéo de l'accueil reste un bloc HTML.

## Pages recréées

| Ancienne page Astro          | URL WordPress           | Contenu                                   |
|------------------------------|-------------------------|-------------------------------------------|
| `src/pages/index.astro`      | `/`                     | accueil + `[saindo_jauge]`                |
| `src/pages/je-contribue.astro` | `/je-contribue`       | statique (liens HelloAsso)                |
| `src/pages/j-ai-un-projet.astro` | `/j-ai-un-projet`   | statique, lien vers `/questionnaire-projet` |
| `src/pages/questionnaire-projet.astro` | `/questionnaire-projet` | `[saindo_questionnaire]` (noindex) |
| `src/pages/faq.astro`        | `/faq`                  | FAQ saisie directement dans WordPress     |
| `src/pages/qui-sommes-nous.astro` | `/qui-sommes-nous` | statique                                  |

Garder les mêmes slugs : les liens dans les emails de confirmation (`/je-contribue`) et les
liens externes continuent de fonctionner.

Le footer du thème doit contenir `[saindo_newsletter]` (le lien « Se connecter » du menu pointe
vers `{app}/login`, le lien « Contact » vers la section contact de l'accueil).

Images à importer dans la médiathèque : `public/hotel.jpg`, `public/schema-scic.jpg`,
`public/team/*`, `public/projet/*`. Les couleurs et polices du site sont dans
`src/styles/theme.css` et dans le `<style>` de chaque page Astro (Playfair Display + Inter).

## Bascule (ordre à respecter)

1. Monter WordPress sur une URL temporaire, installer le plugin, recréer les pages, tester
   les trois shortcodes contre `https://saindo.org` (l'application actuelle) en mettant cette
   URL dans Réglages → Saindo.
2. Côté Vercel : ajouter le domaine `app.saindo.org` au projet. Dans les variables
   d'environnement, mettre `PUBLIC_SITE_URL=https://app.saindo.org` et vérifier que
   `CORS_ORIGINS` contient le domaine WordPress (défaut : `https://saindo.org,https://www.saindo.org`).
3. Côté Supabase → Authentication → URL Configuration : Site URL `https://app.saindo.org`,
   ajouter `https://app.saindo.org/auth/callback` aux Redirect URLs. Tester un magic link.
4. Repasser Réglages → Saindo sur `https://app.saindo.org`.
5. DNS : pointer `saindo.org` (et `www`) vers l'hébergeur WordPress. Retirer `saindo.org` du
   projet Vercel une fois la propagation faite.
6. Nettoyage de l'application Astro : fait (pages publiques, composants, sitemap, robots et
   images supprimés ; `/` redirige vers `/login`).
