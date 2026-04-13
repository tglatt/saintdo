# Hôtel Saint Domingue — saindo.org

Site vitrine de la foncière citoyenne pour le rachat de l'Hôtel Saint Domingue à Die (26).

## Installation

```bash
npm install
```

## Développement

```bash
npm run dev
```

Ouvre [http://localhost:4321](http://localhost:4321)

## Production

```bash
npm run build
npm run preview
```

Les fichiers statiques générés se trouvent dans `dist/`.

## Structure

```
saindo/
├── public/
│   └── schema-scic.jpg       # Schéma de gouvernance SCIC
├── src/
│   └── pages/
│       └── index.astro       # Page principale (contenu + styles)
├── content.md                # Contenu source
├── astro.config.mjs
└── package.json
```

## Liens CTA à configurer

Dans `src/pages/index.astro`, mettre à jour les 3 URLs en haut du fichier :

```js
const ctaAdhesion = "#adhesion";  // URL formulaire d'adhésion
const ctaDon = "#don";            // URL HelloAsso / Graines de moutarde
const ctaApport = "#apport";      // URL apport associatif SCIC
```

## Déploiement

Compatible avec Vercel, Netlify ou Cloudflare Pages via un push Git. Aucune configuration supplémentaire requise.
