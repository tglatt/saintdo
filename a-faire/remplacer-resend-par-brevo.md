# Remplacer Resend par Brevo pour tous les emails

Noté le 18 novembre 2026. Statut : à faire.

## Objectif

N'utiliser plus qu'un seul service d'envoi, Brevo. La newsletter y est déjà (export quotidien
depuis la table `newsletter_inscriptions`). Il reste à y basculer les emails transactionnels,
puis à fermer le compte Resend.

## Ce qui passe encore par Resend

| Email | Fichier | Particularité |
|---|---|---|
| Convocation à l'AGE | `src/lib/send-age-email.ts` | avec pièce jointe |
| Convention d'apport à signer | `src/lib/send-convention-email.ts` | envoi unitaire et en masse depuis l'admin |
| Confirmation du questionnaire porteur de projet | `src/lib/send-projet-confirmation-email.ts` | envoyé à chaque candidature |

Brevo gère ces trois cas, pièces jointes comprises.

## À vérifier avant de commencer

- [ ] **Domaine d'envoi authentifié dans Brevo.** Le domaine de l'adresse d'expédition doit avoir
      ses enregistrements DKIM et DMARC dans le DNS (géré chez Privianet). Sans cela, les emails
      risquent d'arriver en spam ou d'être refusés. L'adresse actuelle est dans la variable
      `RESEND_FROM` de Vercel.
- [ ] **Emails de connexion (lien magique).** Ils sont envoyés par Supabase, pas par l'application.
      Regarder Supabase → Authentication → SMTP Settings : si le SMTP configuré est celui de
      Resend, il faudra y mettre les identifiants SMTP de Brevo, sinon plus personne ne pourra se
      connecter une fois le compte Resend fermé.
- [ ] **Quota.** L'offre gratuite de Brevo plafonne à 300 emails par jour, newsletters et emails
      transactionnels confondus. Un envoi de conventions en masse ou une convocation d'AGE à tous
      les membres (371 au 18 novembre 2026) le dépasse en une journée.
- [ ] **Droits de la clé API.** `BREVO_API_KEY` (déjà dans Vercel) doit pouvoir envoyer des emails
      transactionnels, pas seulement gérer les contacts.

## Étapes côté code

1. Écrire une fonction d'envoi unique vers l'API transactionnelle de Brevo (expéditeur, sujet,
   HTML, pièces jointes), en respectant la limite de débit comme le fait déjà
   `src/lib/export-newsletter-brevo.ts`.
2. Remplacer les trois appels `resend.emails.send` par cette fonction.
3. Faire un envoi de test de chaque type d'email vers une adresse de l'équipe.
4. Renommer `RESEND_FROM` (par exemple `EMAIL_FROM`) dans le code, `.env` et Vercel.
5. Retirer la dépendance `resend` de `package.json`, ainsi que `RESEND_API_KEY` et
   `RESEND_TOPIC_ID` de `src/env.d.ts`, de `.env` et de Vercel.
6. Mettre à jour `CLAUDE.md` (section Stack et variables d'environnement).

## Après la bascule

- [ ] Vérifier dans Brevo que les premiers emails réels sont bien délivrés.
- [ ] Basculer le SMTP de Supabase si nécessaire, puis tester un lien magique.
- [ ] Fermer le compte Resend.
