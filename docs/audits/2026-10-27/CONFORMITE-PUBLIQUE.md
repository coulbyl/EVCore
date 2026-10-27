# Conformité publique : landing, inscription, pages légales

_Étape 2 du plan produit, branche `feat/produit-ux`, du 27/10/2026. Corrige les P1 et P2 de l'audit du 23/10 (`docs/audits/2026-10-23/02-AUDIT-SITE.md`) qui bloquaient toute promotion. L'évaluation de design de référence est cet audit ; les détecteurs (impeccable dans la page, détecteur maison) mesurent avant et après. Captures dans `captures/avant` et `captures/apres`, sorties brutes dans `scripts/`._

## Ce qui bloquait, et ce qui est fait

| Constat de l'audit du 23/10                                                    | Correction                                                                                                                                                                                      | Commit                                         |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| P1-1 Aucune mention 18+, jeu responsable, CGU, confidentialité ; `/cgu` en 404 | Quatre pages légales ; pied de page de la landing avec liens et mention de risque ; deux cases obligatoires à l'inscription (âge légal, conditions) ; consentement daté et versionné en base    | `f4318eb7`, `811f4b67`, `accf7d2a`, `b5bd2b58` |
| P1-3 Discours « investissement » (titre, landing, inscription, connexion)      | Plus aucun « investir », « portefeuille », « allocation de capital » ; titre « EVCore — Avant de parier, lis le match » ; description qui dit football, gratuit, pertes comprises, 18+          | `395a1be4`, `1f60b868`, `01f1e1a8`             |
| P1-4 Image de partage : nom et photo du fondateur, solde de 500 M F, « +63 % » | Image générée 1200×630 (next/og) avec la promesse et la mention 18+ ; captures du manifeste supprimées                                                                                          | `395a1be4`                                     |
| P1-6 « 300 000+ prédictions », « 50 000+ matchs », « 7 saisons »               | Recomptés sur le dump du 24/10, avant coup d'envoi et dédupliqués : 6 440 matchs, 58 656 pronostics réglés, 62 championnats, données depuis 2019 ; affichés en planchers (6 000+, 50 000+, 60+) | `33a64109`                                     |
| P2-1 « Accès sur invitation » alors que l'inscription est ouverte              | Remplacé par « Gratuit · 18+ » et « Gratuit, réservé aux 18+ »                                                                                                                                  | `1f60b868`                                     |
| P2-2 Proposition de valeur absente du premier écran                            | « Analyses de football gratuites · 18+ » puis « Avant de parier, lis le match. »                                                                                                                | `811f4b67`                                     |
| P2-3 Code à 6 chiffres promis, jamais envoyé                                   | L'inscription mène à `/auth/verify` (code par e-mail ou application) et le texte le dit                                                                                                         | `b5bd2b58`                                     |
| P2-4 Bannière d'installation sur le second appel à l'action                    | Retirée de la landing (reste dans le tableau de bord)                                                                                                                                           | `811f4b67`                                     |
| P2-5 Pas de robots ni de sitemap, titres identiques, nom « Console EVCore »    | `robots.ts`, `sitemap.ts`, un titre par page d'authentification, canonicals                                                                                                                     | `58777a6e`, `01f1e1a8`                         |
| P2-6 404 pensée pour un utilisateur connecté                                   | « Retour à l'accueil » d'abord, « Mon tableau de bord » ensuite                                                                                                                                 | `58777a6e`                                     |
| P3-1 Ni HSTS ni X-Frame-Options, `x-powered-by` exposé                         | En-têtes de sécurité sur toutes les routes, `poweredByHeader: false` ; pas encore de CSP                                                                                                        | `133b3e9a`                                     |
| P3-4 Formulaire d'inscription à cinq champs, bio comprise                      | Bio retirée du premier accès (modifiable dans le profil)                                                                                                                                        | `b5bd2b58`                                     |

## Deux défauts trouvés en chemin, plus larges que les pages publiques

- **Les classes de couleur sur les liens étaient ignorées dans toute l'application.** Une règle `a { color: inherit }` hors couche CSS l'emportait sur la couche des utilitaires Tailwind. Le bouton « Créer mon compte » affichait du texte clair sur l'accent (2,0:1) ; les liens « Tous les coupons » de l'Accueil n'avaient jamais pris leur couleur. Règle déplacée dans `@layer base` (`ffcb2db3`).
- **Deux jetons du mode clair n'atteignaient pas AA sur le fond de page** : le gris secondaire (4,0:1) et l'accent (4,4:1). Nouveaux : `--muted #53637a`, `--accent #0d6c65`, au moins 4,6:1 sur tous les fonds clairs (`7f6271ef`).

## Mesures avant → après

| Page (impeccable, dans la page) | Mobile sombre | Mobile clair | Desktop sombre | Desktop clair |
| ------------------------------- | ------------: | -----------: | -------------: | ------------: |
| Landing                         |       47 → 10 |      75 → 10 |         47 → 5 |        75 → 5 |
| Inscription                     |         6 → 1 |       13 → 1 |          8 → 2 |         9 → 2 |
| Connexion                       |         2 → 0 |        5 → 0 |          8 → 3 |         9 → 3 |

| Mesure (détecteur maison)                   | Avant                                                | Après                              |
| ------------------------------------------- | ---------------------------------------------------- | ---------------------------------- |
| Textes sous 12 px sur la landing            | 30                                                   | 0                                  |
| Contrastes insuffisants (landing, clair)    | 31                                                   | 0                                  |
| Mots interdits sur la landing               | « investir » × 4, « sûr » × 1                        | 0                                  |
| Titre d'onglet                              | « Arrêtez de parier. Commencez à investir. » partout | un titre par page                  |
| `h1` sur téléphone (inscription, connexion) | aucun                                                | « Créer un compte », « Connexion » |

Ce qui reste dans les détecteurs : des signaux de goût (tuiles d'icônes, lignes orphelines, un dégradé), deux paragraphes trop larges sur desktop, et sur l'inscription les cases à cocher de 16 px, dont le libellé entier reste cliquable. Les « mots interdits » relevés sur `/cgu` sont des négations voulues.

## Bloquants avant de promouvoir le site

1. **Informations de l'éditeur** : `apps/web/app/(public)/(legal)/legal-entity.ts` contient neuf champs à `null` (raison sociale, forme, siège, immatriculation, directeur de publication, hébergeur, pays d'hébergement, déclaration ARTCI, droit applicable). Ils s'affichent « À compléter par l'éditeur ». Rien n'a été inventé.
2. **Migration à appliquer avant de déployer le backend** (sinon l'inscription échoue faute de colonnes) :

   ```bash
   pnpm --filter @evcore/db db:deploy
   ```

3. **Avis juridique** CI et SN avant toute publicité payante, et **déclaration ARTCI** avant tout e-mail marketing (plan marketing §2).

## Reste de la feuille de route

Mesures historiques (P1-5 : cartes sur la table `bet` morte), puis Coupons, Décisions (P1-8 « Données suspectes », P2-12 « Fiable »), Suivi de mise et Mes coupons (P1-9 projection, P2-9 classement par ROI), Avis IA, et la passe sur la coquille (icônes d'en-tête, avatar, cartes dans le panneau de page). Le moteur en ombre (cote 2, chasseurs, corners/cartons) avance en parallèle.
