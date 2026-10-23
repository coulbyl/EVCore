# EVCore — Fiche produit (lue depuis le code)

_Source : dépôt `coulbyl/EVCore`, branche `main`, commit `e74af2b` du 19/10/2026 (merge PR #270). Lecture seule, aucune modification. Rédigé le 23/10/2026._

## 1. Ce qu'est EVCore aujourd'hui

Une application web (Next.js, installable en PWA) adossée à un moteur d'analyse de football (NestJS + workers BullMQ + PostgreSQL). Chaque jour, le moteur :

- collecte matchs, résultats, statistiques, xG, blessures et cotes de 9 bookmakers (API-Football) sur 68 championnats ;
- estime une distribution de buts par match (Poisson, plus une famille « mi-temps » et une famille « implicite marché » pour le nul) et en dérive 19 canaux de prédiction, un par marché (1X2, buts, BTTS, double chance, mi-temps, score exact…) ;
- filtre les sélections par garde-fous lisibles (cote trop courte, écart modèle/marché invraisemblable, canal AVOID qui retire un match entier) et affiche la raison de chaque rejet ;
- publie des coupons quotidiens immuables : **« Pari sûr du jour »** (1 sélection, cote 1,20–1,35), **« Combiné du jour »** (2 sélections), **« Coupon long »** (cote 2,5–5), plus un « Combiné Analyse IA » généré par un LLM (`apps/vantage-worker`) et un coupon « prix » 5–15 toujours mesuré mais retiré de l'affichage ;
- règle tout au résultat réel, y compris ce qui a été écarté.

EVCore **analyse et propose, il ne place aucun pari** : pas de dépôt, pas de fonds, pas de lien de mise. La bankroll et les bet slips sont des outils de suivi déclaratif.

**Le point qui conditionne tout le marketing** (CLAUDE.md, audits 2026-08-22 et 2026-09-16, journal d'expériences) : l'équipe a mesuré elle-même que le moteur **ne bat pas le marché** (Brier 0,639 contre 0,599 pour les cotes, sur 3 633 matchs ; poids optimal du moteur dans un mélange avec la cote : 0 %), que l'« edge » affiché est anti-prédictif, et que tous les marchés ressortent négatifs sur l'espace complet (−4,4 % à −12,2 %). La valeur démontrable n'est donc pas un gain, c'est **la calibration** (ce qui est annoncé à 73 % arrive à 73 %) et la transparence.

## 2. Pour qui

Le code vise un **parieur francophone d'Afrique de l'Ouest** qui parie déjà : langue par défaut `fr` (EN disponible), devise par défaut **XOF**, cotes « jouables » rapportées à **1xBet** et à son minimum de 1,10 (docs/audits/2026-10-18/COTES-JOUABLES.md). Le ton (« investisseur », mise unitaire fixe, drawdown, formation) cible un parieur qui veut de la méthode plutôt que des tuyaux. Aucun ciblage par pays n'existe dans le code.

## 3. Fonctionnalités

**Implémentées et accessibles à tout compte (rôle `OPERATOR`) :**

- Accueil : coupons du jour et de la veille, sélections du jour, brief hebdomadaire.
- Coupons, Décisions (« Notre sélection » + vue « Écarté » avec raison), Matchs, Arbitrage.
- Suivi : bet slips, bankroll déclarative (unité fixe ou % — profil de risque), notifications, push web.
- Track record par canal et par compétition, par période.
- Formation (15 articles + vidéos, progression, badges), glossaire, aide.
- Support : chat 1:1 avec l'équipe (inbox), pièces jointes.
- Compte : MFA TOTP, sessions, onboarding 3 étapes (ligues, canaux, profil de risque), tour guidé.

**Réservé admin :** audit, utilisateurs, annonces, ML, rapports, moteur, documentation technique.

**En cours / prévu (TODO.md, branches, flags) :**

- Garde-fou de suspension de marché : rebranché sur `channel_selection_deduped` (ROI < −15 % établi sur 90 jours, `risk.repository.ts`) ; la ligne TODO.md l.62 qui le dit branché sur la table `bet` est périmée. En revanche, la courbe de calibration et le rapport hebdomadaire (`risk.service.ts`) lisent encore la table `bet`, plus alimentée depuis le 04/09.
- Fournisseur LLM instable : clé Together.ai invalide en prod, 7 passes du combiné IA échouées du 10 au 16/10 (PREMIERE-LECTURE.md §4).
- Plafond quotidien d'avis du LLM (il joue encore 79 % des matchs), comparaison par jambe LLM vs prix.
- Couche ML Python (`apps/ml-worker`, phase 3) en observation ; Kelly désactivé (`KELLY_ENABLED=false`) ; OpenClaw/Grafana en stand-by.
- ~50 branches ouvertes dont : simulation de paris, page admin, message de bienvenue automatique, MFA/identité, CLV de bout en bout.
- Bug ouvert : bouton d'ajout au coupon absent sur Matchs ; signalement « des personnes n'arrivent pas à… » (TODO.md, audit UX 2026-08-31).

## 4. Modèle économique visible dans le code

**Aucun.** Pas de modèle `Plan`/`Subscription`, pas de fournisseur de paiement, pas de gate d'accès, pas de page tarifs. L'inscription est **ouverte et gratuite** (pas de code d'invitation, pas de vérification d'e-mail obligatoire avant le tableau de bord). L'ancien mécanisme `Subscription` (mise virtuelle) a été supprimé le 03/09.

Ce qui existe, c'est un **cadrage stratégique** (`docs/business-model.md`, juillet 2026) : essai 30 jours → Gratuit → Premium → Business plafonné, prix dynamiques, repère 30–40 €/mois et 150–250 €/mois, Stripe envisagé, et une liste de manques (paiement, entitlements, CGU, confidentialité, jeu responsable, page tarifs). Ce document est **en partie périmé** : il vend le Coupon Composer sur un « +61,8 % test ROI » et VALUE comme « prouvé », deux affirmations retirées par les audits de septembre.

## 5. Chiffres de performance : ce que le produit affiche et d'où ils viennent

| Chiffre affiché                                                                                                   | Où                      | Origine réelle                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « 50 000+ matchs analysés », « 300 000+ prédictions confrontées au résultat », « 68 championnats », « 7 saisons » | Landing                 | Relevé figé du 22/08/2026 (commentaire dans `app/(public)/page.tsx`). Inclut rétro-analyses et historique depuis 2019. Le 300 000 correspond à 302 763 « sélections réglées » : vraisemblablement un comptage brut de `channel_selection`, que CLAUDE.md interdit car il gonfle d'environ 2,4× (plusieurs analyses par match + analyses après coup). |
| « Gagne environ 4 jours sur 5 / 7 sur 10 / 1 sur 3 »                                                              | Cartes coupons          | Mélange de **backtest** (731 jours, 84,8 %) et de prospectif court (80 jours, 80 %) ; affiché sans période ni effectif (`domains/coupon/helpers/coupon-class.ts`).                                                                                                                                                                                   |
| Paris réglés, taux de réussite, ROI par période                                                                   | Track record            | Table `bet` (source MODEL, mise fixe, prix d'analyse) : **résultats réels pris avant match**, mais rendement simulé et table non alimentée depuis le 04/09 — les périodes récentes risquent d'être vides ou figées.                                                                                                                                  |
| Calibration réalisé/annoncé par canal                                                                             | Track record, Décisions | Sélections réelles réglées, dédupliquées (`channel_selection_deduped`). C'est le chiffre le plus solide : 0,736 réalisé pour 0,730 annoncé sur 1 499 sélections réglées de la bande de cotes 1,20–1,65, du 11 au 16/10 (PREMIERE-LECTURE.md §3).                                                                                                     |
| Brier 0,592 / ROI +2,28 % (EPL)                                                                                   | README                  | Backtest historique, explicitement retiré comme preuve d'edge.                                                                                                                                                                                                                                                                                       |

**À retenir pour la suite :** la seule allégation défendable aujourd'hui est la calibration mesurée et datée. Tout taux de gain de coupon doit être daté et chiffré, et aucun ROI ne peut servir d'argument commercial.
