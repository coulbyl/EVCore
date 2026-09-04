# Audit UX Writing — EVCore (2026-09-04)

Périmètre : `apps/web/messages/fr.json` (source de vérité de quasi tout le texte UI) + chaînes codées en dur (`fallbackErrorMessage` dans `apps/web/domains/**/use-cases/*.ts`, notifications backend). Audit uniquement — **aucun fichier de code modifié**, conformément à cw.txt §14.

## 1. Diagnostic du langage actuel

Le français est globalement correct et sobre, pas d'anglicisme choquant sauf un terme ("pick", 27 occurrences). Les CTA principaux sont déjà clairs et orientés action ("Lancer l'analyse", "Voir tout", "Placer ce pick"). Les meilleurs tooltips (signal d'attention, alerte calibration) sont pédagogiques et bien construits.

Mais le texte porte les traces d'avoir été écrit par des développeurs au fil de l'eau, jamais relu comme un ensemble :
- Fautes d'accents dans plusieurs messages d'erreur codés en dur ("depot", "declarer", "resultat").
- Un mélange tu/vous détecté sur deux échantillons ("Vous êtes à jour." vs "où que tu sois dans l'app").
- Un message de notification backend entièrement en anglais (échec ETL) au milieu d'un produit 100% français.
- Du jargon interne qui fuit tel quel dans des libellés visibles ("Ratio calibration" comme nom de KPI, "canal" utilisé indifféremment en langage technique et en label utilisateur).
- Deux termes concurrents pour la même notion à plusieurs endroits (voir §4/§7).

## 2. Principaux problèmes de communication

1. **Incohérence terminologique** — pick/sélection (27 vs 7 occurrences), coupon/slip/ticket (20/6/1), canal utilisé à la fois comme terme produit assumé et comme jargon technique brut.
2. **Fautes/négligence dans les messages codés en dur** — jamais relus par un humain non-dev, contrairement aux textes dans `messages/fr.json` qui sont plus soignés.
3. **Registre d'adresse incohérent** (tu/vous) — à trancher une fois pour toutes.
4. **Un texte 100% anglais** dans un produit francophone (notification échec ETL) — à vérifier s'il est vraiment interne-only.
5. **États vides et erreurs inégaux** — certains suivent déjà bien la règle "contexte + action" (`personalization.leaguesEmpty`), d'autres restent secs ou télégraphiques (`"Erreur calibration"`, `"Aucune donnée sur 30 jours."`).
6. **Erreurs génériques copiées-collées entre features différentes** (`"Impossible de charger les coupons."` réutilisé mot pour mot sur deux domaines distincts) — aucune ne dit "que faire ensuite".
7. **Tooltips denses** — certains dépassent 50 mots avec syntaxe ICU complexe (pluriels/conditions) directement dans la chaîne ; excellents sur le fond, lourds à l'oral/à l'écran mobile.

## 3. Ton de voix recommandé

**Simple + direct + confiant + honnête**, phrases courtes, jamais de sur-promesse (déjà globalement respecté — aucune formulation type "pari sûr"/"gain garanti" trouvée dans l'échantillon, bon signal à préserver explicitement dans les règles).

Français naturel pour un lectorat francophone (y compris Afrique francophone) : ni "France corporate" ("Nous vous invitons à..."), ni trop familier. Sérieux et moderne, jamais froid.

Registre d'adresse : **à trancher en premier** (voir §7) avant toute réécriture, sinon chaque nouveau texte réintroduira l'incohérence.

## 4. Lexique officiel EVCore (proposition)

| Terme | Signification utilisateur | Formulation recommandée | À éviter |
|---|---|---|---|
| Sélection / Pick | Un pari précis proposé par le moteur (marché + issue) | **Sélection** partout dans l'UI ; "pick" peut rester un nom de variable/clé technique, jamais un mot affiché | "Pick" affiché à l'utilisateur (27 occurrences actuelles à corriger) |
| Coupon | Un ensemble de sélections combinées | **Coupon** (déjà dominant, 20 occurrences) | "Slip", "Ticket" (6 + 1 occurrences, à normaliser) |
| Canal | La stratégie/l'angle qui a généré une sélection (ex. Victoire, Nul, BTTS) | Garder "canal" comme concept produit assumé (déjà une identité forte de l'app), mais toujours accompagné du libellé humain du canal (déjà fait via `channelLabel()`) — jamais un code brut | Un code brut (`DOMINANT`, `BTTS`) affiché sans traduction |
| Confiance | Estimation du moteur sur la fiabilité d'une sélection ou d'une période | **Confiance** — toujours formulée comme un signal ("confiance élevée/modérée/faible"), jamais comme une promesse de résultat | "Fiable à 100%", "sûr" |
| Calibration / Ratio calibration | Mesure interne (réel/annoncé) de la justesse du moteur | Ne **jamais** afficher "ratio de calibration" tel quel à un non-technicien — traduire en mot (Fiable/À surveiller/Peu fiable, déjà fait ailleurs dans l'app) | "Ratio calibration" en libellé de KPI grand public (actuellement le cas sur `dashboard.engineHealth.globalRatio` — acceptable si la page reste admin-only, à vérifier) |
| ROI | Retour sur investissement financier réel (bankroll) | Terme financier informatif uniquement, réservé aux pages bankroll/admin | Ne jamais l'utiliser comme argument de qualité d'une sélection (déjà une règle produit actée dans CLAUDE.md) |
| Cote | Le prix proposé par le bookmaker pour une issue | **Cote** (terme standard, déjà compris du public paris sportifs) | — |
| Arbitrage | Le nom de la fonctionnalité VANTAGE (avis LLM sur les matchs) | Clarifier une fois dans l'onboarding/tooltip que ce n'est pas l'arbitrage financier (paris sur écarts de cotes) — risque de confusion réel avec le vocabulaire betting classique | Employer "arbitrage" sans jamais l'expliquer |
| Probabilité | L'estimation chiffrée du moteur pour une issue | **Probabilité** (déjà bien vulgarisé dans les tooltips existants) | — |
| Analyse | Le traitement d'un match par le moteur | **Analyse** (terme dominant, 5 occurrences) | "Diagnostic" (2 occurrences trouvées, dont un état vide `analysisSheet.empty.title`: "Aucun diagnostic" — à corriger en "Aucune analyse") |
| Signal | Un indicateur ponctuel remonté par le moteur (ex. signal d'attention, signal consensus) | **Signal** (déjà bien utilisé et expliqué) | — |
| Opportunité | Reformulation marketing d'une sélection intéressante | À réserver aux moments d'accroche (dashboard, notifications), pas en usage systématique | — |

## 5. Les 20 textes les plus importants à améliorer

| Emplacement | Texte actuel | Proposition | Pourquoi |
|---|---|---|---|
| `domains/bankroll/use-cases/deposit-bankroll.ts` | "Impossible d'enregistrer le depot." | "Impossible d'enregistrer le dépôt." | Faute d'accent, message vu à chaque échec de dépôt (argent réel) |
| `domains/dashboard/use-cases/declare-fixture-result.ts` | "Impossible de declarer le resultat du match." | "Impossible d'enregistrer le résultat du match." | Deux fautes d'accent, texte admin mais visible quotidiennement |
| `analysisSheet.empty.title` | "Aucun diagnostic" | "Aucune analyse disponible" | Rompt la cohérence "analyse" établie partout ailleurs (voir §4) |
| `performancePage...calibrationError` | "Erreur calibration" | "La calibration n'a pas pu être calculée." | Style télégraphique, seul cas de ce genre dans l'échantillon |
| `dashboard.notifications.description` (tour onboarding) | "...où que tu sois dans l'app." | À harmoniser avec le reste (voir décision tu/vous §7) | Seul "tu" détecté dans un océan de "vous" |
| `notification.service.ts` `sendEtlFailureAlert` | `"ETL Failure — ${queue}"` / `"Job "${jobName}" permanently failed: ..."` | Si visible utilisateur : traduire en français ; sinon documenter clairement "canal technique interne, jamais affiché" | Seul texte 100% anglais du produit |
| `domains/coupon/use-cases/use-coupons.ts` + `domains/bet-slip/use-cases/get-bet-slips.ts` | "Impossible de charger les coupons." (identique sur 2 features) | Différencier selon le contexte : "Impossible de charger les coupons proposés." / "Impossible de charger vos coupons." | Deux échecs différents, même message — l'utilisateur ne sait pas lequel a échoué |
| `dashboard.leagueRanking.empty` | "Aucune donnée sur 30 jours." | "Pas encore assez de matchs analysés sur les 30 derniers jours." | Sec, ne donne aucun contexte (règle §2 du brief) |
| `common.error` (fallback générique) | "Une erreur est survenue" | "Une erreur est survenue. Réessayez dans quelques instants." | Ne répond qu'à "quoi", jamais à "que faire" (règle erreurs §6 du brief) |
| `analysisSheet.reasons.no_avoid_signal` | "Aucun signal d'évitement" | "Aucun signal de prudence détecté" | "Évitement" est un mot rare/administratif, "signal de prudence" est plus naturel |
| `dashboard.engineHealth.globalRatio` | "Ratio calibration" | Si la page reste admin-only : garder tel quel avec un tooltip d'explication. Si un jour exposée à l'opérateur non-admin : reformuler en "Fiabilité globale" | Jargon technique brut en label de KPI |
| `analysisSheet.actions.alreadyInSlip` / `alreadyInTickets` | Clés nommées différemment (Slip/Tickets) pour le même concept "coupon" | Renommer les clés en `alreadyInCoupon(s)` | Dette de nommage dev-facing, pas un bug utilisateur (le rendu FR est déjà cohérent : "coupon") — priorité P2 |
| `bankrollPage...calibrationError` doublon potentiel avec performancePage | (à vérifier lors de l'implémentation) | Vérifier s'il existe d'autres "Erreur X" télégraphiques du même type ailleurs dans `messages/fr.json` | Pattern à traiter en série, pas au cas par cas |
| `betSlips.emptyDescription` | "Aucun coupon ne correspond à cette période et à ce filtre." | "Aucun coupon ne correspond à cette période. Essayez d'élargir le filtre." | Constat sans action proposée |
| `dashboard.predictions.empty` | "Aucune prédiction pour aujourd'hui." | "Aucune sélection proposée pour aujourd'hui. Revenez un peu plus tard." | Idem — pas d'action, et "prédiction" vs "sélection" (encore une variante terminologique à vérifier/unifier) |
| `account.genericError` | "Une erreur est survenue." | Fusionner avec `common.error` si strictement identique — sinon différencier | Doublon potentiel de clé à vérifier lors de l'implémentation |
| `factorHints.volatiliteLigue` | Clé nommée en français ("volatiliteLigue") au milieu de clés anglaises | Renommer la clé en `leagueVolatility` | Incohérence de convention de nommage (dev-facing, P2) |
| `decisions.channels.readOnlyPreview.emptyTitle` | "Aucune lecture" | "Aucune analyse disponible" (aligner sur "analyse", pas "lecture") | Troisième variante détectée pour désigner le même concept d'analyse absente |
| `bets.showLessPicks` | "Voir moins" (dépend de `showMorePicks`/`showLessPicks`, avec "pick" dans le nom de clé) | Garder le texte affiché (déjà bon), renommer la clé en `showMoreSelections`/`showLessSelections` | Dette de nommage, cohérence avec §4 |
| `badgeTooltip` (calibration par compétition) | Tooltip ICU de ~50 mots avec plusieurs branches conditionnelles | Garder le fond (excellent), scinder visuellement en une phrase courte + détail secondaire si le composant le permet | Dense pour un tooltip mobile, contenu pédagogique à préserver absolument |

## 6. Règles éditoriales EVCore

1. **Toujours répondre à "et alors ?"** — un texte ne décrit jamais juste un état technique, il dit ce que ça signifie pour l'utilisateur.
2. **Une erreur répond toujours à 3 questions** : que s'est-il passé ? est-ce grave ? que puis-je faire ?
3. **Un état vide donne toujours un contexte + une action possible**, jamais juste "Aucune donnée."
4. **Jamais de sur-promesse** — "signal favorable", "indicateurs encourageants", jamais "pari sûr", "gain garanti", "100% fiable".
5. **"Sélection" en UI, jamais "pick"** — "pick" reste un terme de code, pas un mot affiché.
6. **"Coupon" partout, jamais "slip" ni "ticket"** dans le texte affiché à l'utilisateur.
7. **Un ratio, un score ou ratio technique (calibration, Brier, edge) ne s'affiche jamais brut à un non-admin** — toujours traduit en mot (Fiable/À surveiller/Peu fiable) ou en phrase.
8. **Un seul registre d'adresse dans toute l'app** (à trancher : tu ou vous — voir décision produit §7) — jamais les deux.
9. **Phrases courtes, un message = une idée.** Pas de sur-longueur pour paraître plus complet.
10. **Aucun anglicisme évitable** — vérifier systématiquement qu'un mot français naturel n'existe pas avant d'introduire un terme anglais.
11. **Le français reste lisible pour un lectorat francophone hors France** — éviter le style administratif ("Nous vous invitons à...", "Veuillez procéder à...").
12. **Toujours accentuer correctement**, y compris dans les chaînes codées en dur dans le code (pas seulement `messages/fr.json`).
13. **Un même concept = un seul mot, partout** — avant d'introduire un nouveau terme, vérifier le lexique officiel (§4).
14. **Les tooltips expliquent, ils ne définissent pas** — privilégier l'exemple concret à la définition académique.
15. **Ne jamais dupliquer un message d'erreur générique entre deux fonctionnalités différentes** sans le rendre spécifique au contexte.

## 7. Quick wins (impact fort, effort minime)

- Corriger les 3 fautes d'accent dans les `fallbackErrorMessage` codés en dur (dépot→dépôt, declarer→déclarer, resultat→résultat) — 3 lignes, zéro risque.
- Renommer "Aucun diagnostic" → "Aucune analyse disponible" (cohérence terminologique immédiate).
- Reformuler "Erreur calibration" en phrase complète.
- Ajouter une action à `dashboard.leagueRanking.empty` et `dashboard.predictions.empty` (contexte + suggestion).
- Vérifier si le message ETL 100% anglais est réellement invisible à tout utilisateur final ; si oui, documenter-le comme tel dans le code (commentaire), sinon le traduire.

## Décisions produit nécessaires avant implémentation

1. **Tu ou vous ?** — un seul échantillon de chaque dans le corpus observé, pas assez pour trancher seul. Bloquant pour toute réécriture cohérente.
2. **"Canal" reste-t-il un mot exposé au grand public**, ou doit-il disparaître totalement du langage non-admin au profit d'un synonyme (ex. "type de sélection") ? Affecte des dizaines de libellés.
3. **"Ratio calibration" sur `dashboard.engineHealth`** — cette page est admin-only aujourd'hui donc le jargon est acceptable, mais à documenter comme règle explicite pour éviter qu'il ne fuite un jour vers l'opérateur non-admin.
4. **Le message ETL en anglais** — canal interne confirmé ou à traduire ?

---

Conformément à cw.txt §14 : **aucun code n'a été modifié**. J'attends ta validation (en particulier sur les 4 décisions produit ci-dessus, surtout tu/vous) avant de passer à l'implémentation décrite dans la suite du fichier.
