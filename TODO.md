# EVCore — TODO

## Branche courante : `feat/european-competitions-engine`

Référence : `EUROPEAN_COMPETITIONS_ENGINE.md` — lire avant toute implémentation.

---

## Prochaines étapes (post-branche)

- [ ] Générer la migration Prisma (`pnpm --filter @evcore/db db:migrate -- --name european-competitions-engine`)
- [ ] Lancer le seed sur les nouvelles compétitions
- [ ] Lancer `POST /sync/fixtures/:leagueId` pour UCL/UEL/UECL (saisons 2022/23 → 2024/25)
- [ ] Lancer `POST /sync/rolling-stats` pour ces saisons
- [ ] Lancer `POST /sync/odds-historical/UCL/backfill` (+ UEL, UECL) après achat The Odds API
- [ ] Backtest européen + audit Brier score / ROI
- [ ] Affiner `LEAGUE_MEAN_LAMBDA` / home advantage sur données réelles

---

## Nouveaux marchés — `feat/new-markets`

Audit API-Football du 2026-04-07 : les cotes Over/Under multiples lignes et HTFT sont
disponibles chez 14 bookmakers (dont Pinnacle id=4). Tout est calculable via le Poisson existant.

### En validation

- [ ] Étape A — Over/Under 1.5 et 3.5 : vérifier affichage web + emails sur de vrais coupons contenant ces nouveaux picks
- [ ] Étape B — HT/FT : définir un seuil directionnel (HOME_HOME et AWAY_AWAY semblent les plus liquides)
- [ ] Étape B — HT/FT : vérifier affichage web + emails sur de vrais coupons/picks HT/FT
- [ ] Étape B — HT/FT : confirmer en backtest si le marché mérite des seuils dédiés ou si les filtres génériques suffisent

### Done

- [x] Étape A — Over/Under 1.5 et 3.5 : ajout des probabilités `over15`, `under15`, `over35`, `under35`
- [x] Étape A — Over/Under 1.5 et 3.5 : exposition de `OVER_1_5`, `UNDER_1_5`, `OVER_3_5`, `UNDER_3_5` comme picks candidats
- [x] Étape A — Over/Under 1.5 et 3.5 : support ingestion / stockage / résolution / sélection backtest
- [x] Étape A — Over/Under 1.5 et 3.5 : tests unitaires ajoutés sur les nouvelles lignes
- [x] Étape A — Over/Under 1.5 et 3.5 : rendu audit / web / email branché
- [x] Étape A — Over/Under 1.5 et 3.5 : validation audit OK, les picks 1.5 et 3.5 remontent bien dans `audit-fixtures`
- [x] Étape B — HT/FT : marché standalone déjà branché côté moteur / backtest / résolution
- [x] Étape B — HT/FT : rendu audit / web / email branché
- [x] Étape B — HT/FT : reporting backtest `byMarket` ajouté pour suivre le marché proprement

### À faire plus tard

- [ ] Étape C — Goals Over/Under 1st Half (optionnel, après A+B) : calculer Poisson(λ/2) pour Under 1.5 HT / Over 0.5 HT
- [ ] Étape C — Goals Over/Under 1st Half (optionnel, après A+B) : fetcher les cotes `bet id=6` et les évaluer comme picks candidats
- [ ] Étape C — Goals Over/Under 1st Half (optionnel, après A+B) : confirmer que le volume et la qualité de données justifient l'effort

---

## Contexte technique

- Odds uniquement disponibles sur API-Football pour la saison 2025 (courante)
- Odds historiques 2022-2024 : import one-shot via The Odds API (~$30), Pinnacle inclus
- xG natif disponible sur UCL/Europa/Conference (pas besoin du proxy shots×0.35)
- Aller/retour : pas de champ `leg` dans l'API — inférence obligatoire par date + paires d'équipes
- "To Qualify" : absent sur Pinnacle, disponible sur Bet365/Marathonbet uniquement

---

## Historique précédent (branche main — R6 record)

Référence backtest R6 : **468 bets, +15.7% ROI, +73.46u**

Classement ligues actif sur `main` :

- Very Good : EL2, EL1, L1, PL
- Good : LL, J1, D2, F2, CH
- Medium : SP2
- Low : POR, MX1, SA, BL1
- Red : ERD, I2

Guide méthodologie : `docs/league-calibration-audit.md`
