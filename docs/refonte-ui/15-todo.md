# Refonte UI — 15. Todo, un commit par ligne

_Branche `feat/refonte-ui`. Cocher au fur et à mesure ; chaque ligne est un commit, dans l'ordre. Les références renvoient aux fiches de contenu (04 → 12), au style (13) et aux maquettes (toile Design, sources dans `maquettes/toile/`)._

## Phase A — Fondations

- [ ] A1 `chore(web): self-host Barlow and Barlow Condensed, type scale tokens` — polices dans `apps/web/app/fonts`, `--font-score` / `--font-text`, échelle 11/13/15/17/22/28 (13 § 3).
- [ ] A2 `feat(web): scoreboard color tokens, light and dark` — encre, diode, sol, carte, rampe de gris à onze pas, gagné/perdu ; `globals.css` sans ombre ni dégradé (13 § 2).
- [ ] A3 `feat(web): app shell — ink band, four tabs, left rail on wide screens` — bandeau, barre basse (4 entrées, 5e réservée à l'admin, masquée), colonne gauche ≥ 1024 px, largeur bornée (10 § 4).
- [ ] A4 `feat(web): sheet component — bottom sheet on phone, right column on wide screens` — feuille avec poignée, fermeture par geste, colonne droite sur ordinateur (04 § 1, 10 § 4).
- [ ] A5 `feat(web): score line, LED chance dots, form squares, filleted rows, chips` — composants partagés avec `aria-label` (13 § 5).
- [ ] A6 `feat(web): common states — grey skeleton, offline line, error line, empty line, maintenance page, old-version line` (10 § 2).
- [ ] A7 `feat(web): legal footer line and page budget helpers` — ligne 18+ fixe, `formatOdds`, `formatFrequency` (« 8 sur 10 », « 1 fois sur N »), `formatMoney` sans centimes (10 § 5–6).
- [ ] A8 `docs(web): DESIGN.md and .impeccable/design.json from the built tokens` — écrit depuis le code, pas avant.
- [ ] A9 `feat(web): components showcase route (dev only)` — un écran qui montre chaque composant dans ses états, pour la revue.

## Phase B — Le serveur du joueur

- [ ] B1 `feat(backend): store a fact per coupon leg at generation` — colonne `coupon_proposal_leg.fact`, calcul déterministe par type de pari, 60 caractères, vide si rien de solide (04 § 1).
- [ ] B2 `feat(backend): hero relay and dated abstentions` — le serveur désigne le héros du jour (Favori → Combiné → Cote 2 → premier chasseur), conserve les abstentions par date avec leur raison (04 § 5, 08 § 6).
- [ ] B3 `feat(backend): refuse follow after first kickoff; followed-coupons summary` — `POST /coupons/:id/follow` refuse après le premier coup d'envoi ; `GET /coupons/followed/summary` (gagnés, perdus, remboursés, depuis) (04 § 3, 09 § 1).
- [ ] B4 `feat(backend): evening settlement notification for followed coupons` — type `FOLLOWED_SETTLED`, créneau 20 h–1 h, jamais pendant une pause, idempotent, texte « Ton Favori est passé ✓ » (10 § 3).
- [ ] B5 `feat(backend): fair market frequency (Shin) per priced pick` — service Shin sur le groupe d'issues 1xBet, exposé avec chaque cote ; au-dessus de 1,80 la chance affichée est celle du marché (06 § 2, 07 § 4, ACCUMULATEUR § 10).
- [ ] B6 `feat(backend): results per product endpoint` — `GET /results/products?period=` : jours joués/gagnés/perdus/remboursés, jours sans coupon et raison, pire série, annoncé moyen, rendu à 1 000 F, jour par jour ; produits retirés gardés pour l'admin ; Avis IA sur la cohorte figée (08 § 6).
- [ ] B7 `feat(backend): weekly statement data (Ta semaine)` — sept jours × produits + coupons suivis, même calcul que le relevé du lundi (08 § 3).
- [ ] B8 `feat(backend): public hero of the day and daily share image data` — point d'entrée sans session, héros et forme seulement ; données de l'image `og` (11 § 1).
- [ ] B9 `feat(backend): one support conversation per player` — fusion des fils existants par joueur, création implicite au premier message (09 § 2).
- [ ] B10 `feat(backend): registration with first name, email, password; optional username` — DTO, migration `username` nullable, connexion par e-mail (11 § 2–3).
- [ ] B11 `feat(backend): email verification can be skipped; MFA optional` — compte non vérifié peut suivre ; rappel dans le compte ; 2FA proposée, jamais imposée (11 § 4, § 6).
- [ ] B12 `feat(backend): anonymous verified-ticket counter` — nombre de paris, cote, chance, jour ; rien d'identifiant (07 § 7).
- [ ] B13 `feat(backend): notification preferences — morning, weekly, followed result, replies, email` — quatre interrupteurs + e-mail, activés par défaut (09 § 5).
- [ ] B14 `feat(backend): player notification feed without operator types` — la cloche ne reçoit que matinée, semaine, résultat, réponse, annonce (09 § 6).
- [ ] B15 `chore(backend): migration — drop declared slips, bankroll, deposits, personalization` — migration nommée, SQL de vérification avant, code retiré (09 § 1, § 8).
- [ ] B16 `feat(web): redirects from retired player and public routes` — Formation, Glossaire, Décisions, Avis IA, Mesures historiques, Coupons, Mes coupons, Suivi de mise, Inbox → nouvel écran (11 § 8).

## Phase C — Les écrans du joueur

- [ ] C1 `feat(web): Aujourd'hui — hero card, product rows, Hier line` (04 § 1, maquette Main).
- [ ] C2 `feat(web): Aujourd'hui — states: evening settled, no coupon, outage, pause, offline` (04 § 2, § 5 ; maquettes Soir, RienAJouer, Pause).
- [ ] C3 `feat(web): coupon sheet with fact per leg, form, follow button` (04 § 1–3 ; maquette Coupon).
- [ ] C4 `feat(web): Matchs — day chips, hourly groups, one reading per row, ≠ sign, folded no-reading` (06 § 1 ; maquette Matchs).
- [ ] C5 `feat(web): Matchs — Hier with scores, Demain with "Lecture ce soir", team search` (06 § 1 ; maquette MatchsHier).
- [ ] C6 `feat(web): match sheet — our reading, AI opinion, form, other bets, 1xBet margin` (06 § 2–4 ; maquette Fiche).
- [ ] C7 `feat(web): ticket — bottom bar, sheet, one bet per match, 15 max, device storage` (07 § 2–4 ; maquettes MatchsTicket, Ticket).
- [ ] C8 `feat(web): ticket — share image (canvas) and yesterday's settled ticket` (07 § 5–6 ; maquettes Partage, TicketHier).
- [ ] C9 `feat(web): Résultats — Hier line, period chips, one row per product, AI row` (08 § 1 ; maquette Resultats).
- [ ] C10 `feat(web): Résultats — product sheet: grid, worst streak, announced vs realised, En francs, day by day` (08 § 2 ; maquette Produit).
- [ ] C11 `feat(web): Résultats — Hier sheet and Ta semaine on Mondays` (08 § 3 ; maquette Semaine).
- [ ] C12 `feat(web): Moi — name, followed summary, En cours · Réglés, four rows, sign out` (09 § 1 ; maquette Moi).
- [ ] C13 `feat(web): Messages — single thread, photo and voice, read state` (09 § 2 ; maquette Messages).
- [ ] C14 `feat(web): Aide — nine sheets in code, contextual "?" opener` (09 § 3 ; maquette Aide).
- [ ] C15 `feat(web): Jeu responsable — pause, help numbers, account deletion` (09 § 4 ; maquette JeuResponsable).
- [ ] C16 `feat(web): Compte — single page in sections, four notification switches, display` (09 § 5 ; maquette Compte).
- [ ] C17 `feat(web): notifications list without tabs` (09 § 6 ; maquette Cloche).
- [ ] C18 `feat(web): first launch — welcome line once, push prompt at first follow` (10 § 1 ; maquette Premier).
- [ ] C19 `feat(web): switch navigation to the four tabs; old player routes redirect` — le commit de bascule.
- [ ] C20 `feat(web): wide screens — left rail and right column across the four tabs` (10 § 4).
- [ ] C21 `feat(web): signature motion — LEDs light up once on open, reduced-motion respected` (13 § 5).

## Phase D — Le public

- [ ] D1 `feat(web): landing — brand line, live hero card, sign-up, results, how it works, legal footer` (11 § 1 ; maquettes Landing, LandingMobile).
- [ ] D2 `feat(web): public /resultats page` (11 § 1).
- [ ] D3 `feat(web): daily share image (og) from the hero` (11 § 1).
- [ ] D4 `feat(web): sign-up with three fields and two checkboxes; inline errors` (11 § 2 ; maquette Inscription).
- [ ] D5 `feat(web): sign-in, email verification with "Plus tard", password reset in three screens` (11 § 3–5 ; maquettes Connexion, Verification).
- [ ] D6 `feat(web): legal pages in the app style; editor fields filled` (11 § 7).
- [ ] D7 `feat(web): 404 page` (11 § 8 ; maquette Introuvable).

## Phase E — Nettoyage et revue (fin de PR 1)

- [ ] E1 `chore(web): remove retired player screens and their code` — Décisions, Avis IA, Coupons, Mesures historiques, Formation, Glossaire, Suivi de mise, Mes coupons, Inbox, Notifications à onglets, personnalisation, guide.
- [ ] E2 `chore(web): english strings for every new screen` (10 § 6).
- [ ] E3 `test(web): Playwright — player journeys (today, follow, ticket, results, account)`.
- [ ] E4 `test(backend): settlement, follow refusal, evening notification, results endpoint`.
- [ ] E5 `docs: update PRODUCT.md operating context and screens` — l'ancien contexte liste encore les anciens écrans.
- [ ] E6 `/code-review high` sur la branche, corrections.
- [ ] E7 Revue de finition impeccable sur Aujourd'hui, Matchs, Résultats, Moi, landing ; DESIGN.md relu.
- [ ] E8 PR 1 vers `main`, étiquette `major`, description en anglais ; migrations à lancer listées ; champs légaux remplis.

## Phase F — Le lot config (début de PR 2)

- [ ] F1 `chore(backend): zod env schema; decisions moved to config with prod values` (ENV-PROD § 6).
- [ ] F2 `chore(vantage-worker): zod env schema; coupon cron shared constant at 17:45; retry removed` (ENV-PROD § 3).
- [ ] F3 `feat(backend): app_setting table, five keys, defaults in code, read on every pass` (12 § 4).
- [ ] F4 `chore(ml-worker): ML_CORRECTION constant false; no scheduled retraining` (ML-UTILITE).
- [ ] F5 `fix(backend): coupon_generation_attempt reports composed honestly` (ENV-PROD § 3).
- [ ] F6 `docs: prod .env cleanup list for the user` — variables à retirer, à garder, à déplacer.

## Phase G — L'admin

- [ ] G1 `feat(web): fifth tab "Admin" for admin accounts; admin left rail on wide screens` (12 § 1 ; maquettes AdminMobile, Admin).
- [ ] G2 `feat(backend): three traffic lights with written rules; "À faire" aggregated from existing alerts` (12 § 1).
- [ ] G3 `feat(backend): passes of the day with last run per pass; relaunch endpoint` (12 § 1, § 6).
- [ ] G4 `feat(backend): operations email on red, once per transition` (12 § 1).
- [ ] G5 `feat(web): admin home — lights, À faire, passes with Relancer, today in numbers, passes-off banner` (maquettes AdminMobile, Admin).
- [ ] G6 `feat(backend): products table for admin with CLV, margin, retired products; AI by config version` (12 § 2).
- [ ] G7 `feat(web): Moteur — products, channel × competition with alerts toggle, suspended markets with Réactiver` (maquettes MoteurMobile, Moteur).
- [ ] G8 `feat(web): diagnostic icon on the match sheet for admins (existing diagnostic sheet)` (12 § 2).
- [ ] G9 `feat(web): Joueurs — month figures, unanswered messages, accounts with pause, player sheet, announce action` (maquettes JoueursMobile, Joueurs).
- [ ] G10 `feat(web): Réglages — five settings, defaults, no secrets, single human-actions journal` (maquettes ReglagesMobile, Reglages).
- [ ] G11 `feat(backend): human-actions journal covers reactivation, roles, suspensions, deletions, announcements` (12 § 4).
- [ ] G12 `chore(web): remove the eleven retired admin pages and their code; redirects` (12 § 0).
- [ ] G13 `test: admin lights, À faire, relaunch, settings reload`.
- [ ] G14 `/code-review high`, revue de finition, PR 2 vers `main`.
