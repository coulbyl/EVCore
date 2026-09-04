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

### Étape 2 — Admin (V1) — livré 2026-09-04

Livrable : `EngineHealthCard` en tête du dashboard `ADMIN`, remplaçant `ChannelStatusStrip` (devenu un sous-ensemble strict de ce que la nouvelle carte montre). Pages existantes (`engine`, `performance`, `audit`) inchangées, toujours là pour le drill-down.

Écart avec le plan initial : pas de nouveau "service d'agrégat" dédié ni d'endpoint `/dashboard/health-overview` — l'agrégation (statut global, ratio pondéré, tendance) se fait côté frontend à partir d'endpoints existants ou ajoutés un par un dans leur module naturel (`risk`), plus simple que de faire remonter cette logique dans le module `dashboard`.

1. Backend (`apps/backend/src/modules/risk/`) — deux endpoints ajoutés, tous deux `AuthSessionGuard, AdminGuard` (les routes existantes du contrôleur `risk` restent sans garde — probablement des cibles cron internes, non touchées) :
   - `GET /risk/suspensions/active` (`RiskService.listActiveSuspensions`) — liste détaillée (marché, raison, déclencheur), pas juste le compte déjà exposé par `audit/overview`.
   - `GET /risk/alerts/recent?days=7` (`RiskService.getRecentAlerts`) — notifications `MARKET_SUSPENSION`/`ROI_ALERT`/`BRIER_ALERT`, sans la troncature à 3 ni le dédup par jour de `dashboard/summary`.
   - `getCalibrationCurve()` existait déjà (jamais branché en frontend) — aucun changement backend.
2. Frontend :
   - Statut global : `ALERT` si un canal `RED` ou une suspension active, `WATCH` si `ORANGE` sans `RED`, sinon `GOOD`.
   - 4 KPI (`StatCard`) : ratio de calibration global (moyenne pondérée par `sampleSize` des ratios par canal — `useChannelHealth` réutilisé, aucun nouveau calcul serveur), canaux `RED`, marchés suspendus actifs, tendance 7j vs 30j (différence entre deux appels `useChannelHealth` sur des fenêtres différentes).
   - Courbe de calibration : `EvBarChart` existant (composant chart déjà dans `components/charts/`, jamais utilisé pour cette courbe) sur `useCalibrationCurve()`.
   - Tableau canaux : réutilise tel quel `ChannelStatsTable` (déjà utilisé par track-record, TanStack Table), lignes pré-triées par `|calibrationRatio - 1|` décroissant.
   - Marchés suspendus + alertes récentes : listes simples sur les deux nouveaux endpoints.
3. Nettoyage : `ChannelStatusStrip` supprimé (remplacé). Le `FilterBar` de la page admin ne servait plus qu'à cette carte — comme rien d'autre sur la page ne consommait la plage de dates, il est retiré entièrement (état, définition de filtres, helpers de date) plutôt que laissé orphelin.
4. Vérification : `pnpm typecheck`/`lint` (web + backend) et la suite Vitest backend (69 fichiers, 608 tests) passent. **Pas de vérification visuelle** — toujours pas de stack Docker démarrée dans cet environnement.

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
