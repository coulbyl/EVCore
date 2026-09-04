# Refonte dashboard opérateur + admin (2026-09-04)

## Contexte

Audit du dashboard existant (`apps/web/app/dashboard/*`) : 13 pages fragmentées, aucune vue de synthèse. Deux publics distincts partagent aujourd'hui le même espace sans distinction :

- **Opérateur** (utilisateur authentifié non-admin) : consulte les sélections du jour, décide s'il les suit, suit son bankroll. N'a pas besoin de comprendre calibration, Brier score ou statuts internes.
- **Admin** (rôle `ADMIN`) : surveille la santé du moteur (calibration par canal, marchés suspendus, garde-fous risque). Déjà techniquement câblé en backend (`risk.service.ts`, `dashboard.service.ts`, `adjustment/calibration.service.ts`) mais sans vue de synthèse — il faut aujourd'hui croiser `track-record`, `performance`, `audit` manuellement.

Décision produit : **deux dashboards distincts**, pas un seul dashboard avec toggle de complexité. Chaque métrique interne existante (ratio de calibration, statuts RED/ORANGE/GREEN, Brier score) est calculée une seule fois côté backend et **traduite différemment selon le public** — jamais un chiffre technique brut affiché à l'opérateur.

| | Opérateur (V2) | Admin (V1) |
|---|---|---|
| Pages sources | `decisions`, `arbitrage`, `coupons`, `track-record`, `bankroll`, `bet-slips` | `engine`, `performance`, `audit`, `ml` (déjà `ADMIN` only) |
| Langage | Badges texte (Fiable/À surveiller/Peu fiable), libellés via `channelLabel()` | Ratios, scores, statuts techniques |
| Question répondue | "Que dois-je suivre aujourd'hui ?" | "Le moteur va-t-il bien ?" |

## Progression

### Étape 1 — Opérateur (V2) — livré 2026-09-04 (frontend uniquement)

Livrable : carte "Confiance du moteur" en tête de `/dashboard` pour l'utilisateur non-admin.

En creusant l'implémentation, tout ce qu'il fallait existait déjà côté backend : `GET /dashboard/channel-health` calcule déjà le statut GREEN/ORANGE/RED par canal (même formule calibration réel/annoncé, seuils `0.85`/`0.70`), et `GET /channel-decisions/by-channel?date=...&status=SELECTED` donne déjà les sélections du jour par canal. **Aucun endpoint backend n'a été ajouté** — le travail était de croiser ces deux sources côté frontend et de traduire le résultat en langage opérateur, jamais en chiffre brut.

1. Nouveau composant `apps/web/app/dashboard/components/today-confidence-card.tsx` :
   - Croise `useChannelHealth(from, to)` (statut par canal) et `useChannelDecisionChannels(today, {status: "SELECTED"})` (picks du jour).
   - Badge de confiance dérivé (jamais le ratio affiché) : `LOW` si un canal `RED` est actif aujourd'hui, sinon `HIGH` si un canal `GREEN` est actif, sinon `MODERATE`, sinon `UNKNOWN` si aucune donnée exploitable.
   - "À suivre aujourd'hui" : picks des canaux `GREEN`, un par fixture, plafonné à 5.
   - "À éviter aujourd'hui" : canaux `RED` actifs aujourd'hui, libellés via `channelLabel()` — jamais le code brut.
2. Branché en tête du bento grid de `DashboardPageClientOperator` (avant la carte de performance existante).
3. Clés de traduction ajoutées (`dashboard.todayConfidence.*`) dans `messages/fr.json` et `messages/en.json`.
4. Vérification : `pnpm --filter web typecheck` et `pnpm --filter web lint` passent (0 erreur, mêmes 2 warnings pré-existants sur `page-shell.tsx`). **Pas de vérification visuelle dans le navigateur** — aucun conteneur Docker (Postgres/backend) n'était démarré dans l'environnement, et démarrer toute la stack sans données de seed n'aurait rien montré de significatif dans les listes "à suivre/à éviter". À vérifier manuellement au retour, avec la stack complète.
5. Pas de tests Vitest ajoutés : aucune nouvelle logique de calcul côté backend (l'agrégation confiance/listes est un pur `useMemo` frontend sans test existant pour ce type de composant dans le repo — pas de framework de test frontend, cf. CLAUDE.md).

Reste ouvert pour une itération suivante si besoin : résultat récent 7 jours en phrase, solde bankroll (déjà visible en permanence dans le header via `BankrollWidget` — décision de ne pas le dupliquer sur cette carte).

### Étape 2 — Admin (V1) — après validation de l'étape 1

Livrable : nouvelle page de synthèse santé moteur pour `ADMIN`, en plus des pages existantes (`engine`, `performance`, `audit` restent pour le drill-down).

1. Backend — service d'agrégat admin (`operator-health` ou nom équivalent), réutilise `calibrationRatioOf`, `isMarketSuspended`, `getCalibrationCurve()` déjà existants dans `risk.service.ts` / `dashboard.service.ts` — aucune nouvelle formule de calcul.
2. Nouvel endpoint `GET /dashboard/health-overview` (protégé `AdminGuard`, comme les autres endpoints admin).
3. Frontend — page `/dashboard/overview` (ou équivalent) :
   - Statut global (agrégat calibration + suspensions actives).
   - 4 KPI : ratio calibration global, canaux en RED, marchés suspendus actifs, tendance 7j vs 30j.
   - Courbe de calibration (réutilise `getCalibrationCurve()`, jamais affichée actuellement malgré le calcul déjà fait).
   - Tableau canaux triés par écart à 1.0 décroissant.
   - Alertes risque (7 derniers jours) — filtrées sur risk uniquement, pas les notifications générales.
4. Paralléliser les appels du service d'agrégat (`Promise.all`) pour éviter une latence cumulée sur 4 requêtes DB séquentielles.
5. Tests Vitest + vérification manuelle dans le navigateur.

### Étape 3 — Gamification (discipline, pas variance) — après validation de l'étape 1

Constat : un leaderboard existe déjà (`dashboard.service.ts:518-572`, `GET /dashboard/leaderboard`), classé sur le ROI de coupons (fenêtre 90j, minimum 5 coupons réglés), déjà affiché dans la sidebar (`app-shell.tsx`) et sur le dashboard via `user-leaderboard.tsx`. Une infra `Badge`/`UserBadge` existe aussi (`schema.prisma:908-932`) mais n'est peuplée d'aucun contenu (pas de streak, XP ou niveau).

⚠️ **Risque produit** : le ROI de coupon sur un échantillon de 5+ coupons a un écart-type de 13-18 points (audit 2026-08-22, mémoire projet — coupon-level ROI sans puissance statistique). Gamifier cette métrique récompense la variance/la chance (combos à fort risque) et pousse dans le sens inverse de ce que le badge "Confiance du jour" (étape 1) doit enseigner. Le leaderboard ROI existant est conservé tel quel comme "jeu social" léger, mais **découplé** de tout signal de crédibilité — il ne doit jamais apparaître à côté du badge confiance de l'étape 1.

La vraie gamification porte sur la **discipline de suivi**, pas sur le résultat financier brut :

1. Backend — nouveaux codes `Badge` (aucune nouvelle formule statistique, réutilise le mapping `RELIABLE/WATCH/UNRELIABLE` de l'étape 1) :
   - "Suit les sélections fiables" — streak de jours consécutifs où les paris placés par l'utilisateur ne portent que sur des canaux en badge `RELIABLE` au moment du pari.
   - "Diversifié" — mises réparties sur plusieurs canaux/ligues sur une fenêtre donnée, pas concentrées sur un seul.
2. Nouveau champ de suivi de streak sur `User` ou table dédiée (à trancher à l'implémentation — dépend si le streak doit survivre à un recalcul rétroactif du badge canal).
3. Job (ou calcul à la volée) qui évalue l'attribution de `UserBadge` après règlement d'un pari — pas de nouveau calcul de calibration, seulement une lecture du badge canal déjà produit par l'étape 1.
4. Frontend — classement secondaire "Discipline" sur `user-leaderboard.tsx` (taux de suivi des canaux fiables), distinct visuellement du classement ROI existant.
5. Tests Vitest sur l'attribution de badge (mock du badge canal, pas de nouvelle stat).
6. Vérification manuelle dans le navigateur.

## Ce qui ne change pas

- Aucune nouvelle formule statistique introduite — les deux étapes ne font que réutiliser et re-présenter des calculs déjà existants en backend.
- Les pages actuelles (`track-record`, `performance`, `audit`, `decisions`, `arbitrage`, `coupons`) restent en place pour le drill-down détaillé — ces nouvelles pages sont des points d'entrée, pas des remplacements.
- Aucun changement de logique de calibration, de seuils de garde-fou risque, ou d'API existante.
