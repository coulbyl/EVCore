# Plan produit : UX/UI, coupon cote 2, chasseurs, nouveaux marchés, fidélisation

_Rédigé le 23/10/2026 à la suite de la PR #272 (audit produit, site, marketing et diagnostic joueur). Horizon : 12 semaines. Chaque chantier a une porte de sortie mesurable ; rien n'est affiché à un joueur avant d'être passé par l'ombre et jugé jambe par jambe._

## 0. Ce que les mesures imposent au plan

Quatre résultats du dépôt encadrent tout ce qui suit. Ils ne sont pas rediscutés ici.

| Mesure                                                                                              | Source                                       | Conséquence pour ce plan                                                                                            |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Le moteur est derrière le marché (Brier 0,639 contre 0,599 ; poids optimal 0 %)                     | `docs/journal-experiences.md`, 16/09         | Aucun produit n'est vendu sur un gain. La valeur démontrable est la calibration et la transparence.                 |
| L'edge annoncé est anti-prédictif ; « le plus probable » est un détecteur de surestimation          | audit 22/08, `05-COUPON-COTE-2-ET-CHASSE.md` | Classement par probabilité calibrée et par prix (marge), jamais par edge ni par probabilité annoncée.               |
| Chaque marché coûte sa marge et rien ne persiste par championnat × marché ; seule la marge persiste | `ESPACE-OPPORTUNITES.md`, 16/09              | Une règle trouvée dans l'échantillon (« marchés sous-annoncés ») n'est pas un produit. Marge la plus basse d'abord. |
| Le ROI de coupon n'a aucune puissance ; la calibration par jambe en a (SE ≈ 1,5 pt)                 | `feedback_coupon_roi_no_power`, CLAUDE.md    | Toute porte de validation ci-dessous est un ratio réalisé/annoncé par jambe, sur `channel_selection_deduped`.       |

Et les trois constats joueur du 23/10 qui motivent l'ordre des chantiers : personne ne joue les coupons (1 sur 91), 52 sélections « Fiable » sur 54 matchs, et un joueur qui gagne 6 jours sur 7 finit en négatif sans qu'on le lui explique.

## 1. Les quatre souhaits, confrontés aux données

| Souhait                                                          | Atteignable                                                                                                                                                                                                   | Pas atteignable (ou pas défendable)                                                                                                                              | Jugé sur                                                                                              |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Coupon à cote 2 qui rentre le plus souvent**                   | Un coupon quotidien à 1,80–2,30 avec le compositeur existant, qui gagne **environ 1 jour sur 2** et l'affiche. Sur 45 jours, les meilleures règles honnêtes font 46–48 %.                                     | Plus de 50 % durablement (ce serait battre le marché). La règle à 65 % est dans l'échantillon : 81 % en septembre, 50 % en octobre.                              | Ratio réalisé/annoncé des jambes dans la bande 1,20–1,65 ≥ 0,90 ; CLV moyen ; pire série.             |
| **Chasseurs spécialistes BTTS, DRAW, OVER 3,5/4,5, score exact** | Un produit par marché, une sélection par jour ou abstention, avec sa fiche (fréquence réelle, pire série, solde à mise fixe). BTTS et DRAW sont déjà bien calibrés (59,8 % pour 60,0 % ; 28,3 % pour 29,7 %). | Un chasseur qui rapporte : tous ces marchés perdent leur marge (−3 % à −8 %). Le score exact perd −20 à −26 % avec 57 pertes d'affilée.                          | Ratio ≥ 0,90 sur ≥ 200 sélections réglées ; CLV ; série max affichée. Suspension de marché inchangée. |
| **Cartons, corners, tirs**                                       | Les cotes sont déjà collectées chez Pinnacle depuis le 15/09, `fixture_statistics` et `team_stats` (corners, cartons, tirs cadrés) existent. Il manque le modèle, le règlement et la calibration.             | Un avantage : ces marchés coûtent 6,4–6,6 % (contre 4,1 % sur l'Asian Handicap). Le moteur devrait être 6,5 % meilleur que Pinnacle ; sur les buts il est à 0 %. | Résidu réalisé − implicite marché par bande de cote, 8 semaines d'ombre.                              |
| **Fidéliser puis gagner de l'argent**                            | Habitude quotidienne (coupon à heure fixe, « Suivre », relevé du lundi, jours sans coupon expliqués), mesure d'activation, puis test d'intention de payer.                                                    | Un abonnement avant d'avoir mesuré l'activation et la rétention : aujourd'hui il n'y a ni analytics, ni modèle économique dans le code.                          | Activation (3 jours distincts sur 14) ≥ 40 %, rétention J14 ≥ 30 %, sur ≥ 300 inscrits.               |

Ligne directrice : **ces produits sont des produits d'engagement et de pédagogie, pas de rendement**. C'est exactement ce qui distingue EVCore des pronostiqueurs, et c'est ce qui fidélise un joueur qui a déjà été floué.

## 2. Chantier A : UX/UI page par page

### Outils installés le 23/10

- `impeccable` (pbakaus, v4.7, 354 k installations) dans `.agents/skills/impeccable`. Commandes utiles : `critique` (revue heuristique avec score, deux sous-agents indépendants), `audit` (a11y, perf, responsive), `document` (génère `DESIGN.md` depuis le code), `init` (`PRODUCT.md`), `onboard`, `polish`, `harden`, `distill`. **Point d'attention** : le lanceur télécharge un binaire à la première exécution (somme de contrôle vérifiée) et tourne avec les droits de l'agent. À autoriser explicitement avant le premier `critique`.
- `web-design-guidelines` (Vercel, 775 k installations) dans `.agents/skills/web-design-guidelines` : revue de code contre les Web Interface Guidelines, résultats en `fichier:ligne`.
- Déjà dans le dépôt : Playwright avec faux backend (`apps/web/e2e`, projets 375 / 768 / 1280), `shadcn` et `nextjs-app-router-patterns`.

### Capture page par page

Un spec Playwright dédié, `apps/web/e2e/captures.spec.ts`, parcourt les 28 routes de `apps/web/app/dashboard` plus les 4 pages publiques, en 375, 768 et 1280, en clair et en sombre, avec le faux backend (données déterministes, aucune donnée personnelle, rejouable en CI). Sortie dans `docs/audits/<date>/captures/<route>__<largeur>__<thème>.png`. Les états qui n'existent pas dans le faux backend (samedi à 156 cartes, jour sans coupon, coupon en attente, 13 jours sans Avis IA) sont ajoutés au mock, pas capturés en production.

### Ordre des pages (par impact sur le joueur)

| #   | Page                                             | Pourquoi en premier                                                                                 | Entrées de l'audit                 |
| --- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 1   | Accueil connecté                                 | Première valeur : coupons du jour et de la veille, « Les sélections du jour » doit devenir l'entrée | P1-2, P2-7, P2-11, diag §6.5       |
| 2   | Coupons                                          | Deux `coupon-card.tsx` différents, deux « Combiné du jour », chances et solde à expliquer           | P1-2, P2-7, P2-8, P2-11, diag §6.1 |
| 3   | Décisions                                        | 156 cartes le samedi, badge « Fiable » partout, « Données suspectes » contredit                     | P1-8, P2-12, diag §4               |
| 4   | Landing, inscription, connexion                  | Promesse en 5 s, mentions 18+, consentement, code e-mail                                            | P1-1, P1-3, P2-1, P2-2, P2-3, P2-4 |
| 5   | Mesures historiques (track record)               | « 100 % · +64 % » sur 1 pari ; rebranchement sur les sélections dédupliquées                        | P1-5                               |
| 6   | Onboarding et première visite                    | Activation : ligues, profil de risque, premier coupon expliqué                                      | plan marketing §6                  |
| 7   | Avis IA                                          | Jargon, ton incitatif, 81 % des matchs joués, historique par jour absent                            | P2-10, diag §5                     |
| 8   | Bankroll, Mes coupons, classement                | Projection à supprimer, classement par ROI à retirer, « Jouer » → « Suivre »                        | P1-9, P2-9, diag §6.8              |
| 9   | Formation, glossaire, aide                       | Matière de campagne, déjà bonne : finitions                                                         | —                                  |
| 10  | Paramètres, notifications, support               | Finitions                                                                                           | —                                  |
| 11  | Pages admin (audit, moteur, ML, rapports, users) | Dernier : pas vues par un joueur                                                                    | —                                  |

### Méthode par page

1. `impeccable critique <route>` sur les captures et le code, puis `web-design-guidelines` sur les fichiers de la page.
2. Constats classés (bloquant / important / finition), chacun avec la capture avant.
3. Correction dans une PR par page (`fix/ux-<page>`), avec la capture après et les tests Playwright étendus (pas de scroll horizontal, cibles tactiles ≥ 44 px, un seul `h1`).
4. Les règles de rédaction du plan marketing §5 s'appliquent à chaque libellé touché : pas de « sûr », pas d'« investir », chiffre toujours daté et chiffré.

### Livrables transverses

- `PRODUCT.md` (qui est l'utilisateur, ce qu'il doit réussir en 10 secondes) et `DESIGN.md` (jetons extraits du code : couleurs, typographie, rayons, espacements) à la racine, générés puis relus.
- Une seule carte coupon partagée (`apps/web/components/coupon-card.tsx`), la copie de `dashboard/coupons/components/` supprimée.
- Un vocabulaire joueur unique : « chances » expliqué une fois (« 75 % = 1 fois sur 4 ça perd »), « cote jouable » avant « meilleure cote », solde cumulé à mise fixe sur chaque carte.

### Porte de sortie du chantier

- Trois tâches chronométrées sur un joueur qui ne connaît pas l'app, mobile : trouver le coupon du jour (< 10 s), dire si celui d'hier a gagné (< 10 s), expliquer ce que veut dire « 75 % » (sans aide).
- Zéro violation critique axe-core sur les pages 1 à 8, Lighthouse mobile ≥ 90 en accessibilité et bonnes pratiques.
- Tous les P1 et les P2-1, P2-3, P2-9, P2-12 de l'audit fermés.

## 3. Chantier B : coupon à cote 2

**Règle de composition** (compositeur existant, `composeByPrice` ou le combiné moteur) : cible 1,80–2,30 ; 2 jambes de 1,20 à 1,65, cote jouable ≥ 1,10 ; une par championnat ; hors AVOID et hors canal « peu fiable » sur la compétition ; classement par **probabilité calibrée** (courbe canal × compétition sur 90 jours) puis par **marge la plus basse**, jamais par probabilité annoncée.

**Affichage** : « Gagne environ 1 jour sur 2 », les chances affichées sont la probabilité calibrée des deux jambes multipliée, pas le produit des probabilités du moteur (écart mesuré : 70 % annoncé pour 47 % réalisé). Pire série observée et solde cumulé à mise fixe sur la carte.

**Validation** : 4 semaines en ombre (`coupon_proposal.source` dédié, non affiché), jugée par jambe : ratio ≥ 0,90 dans la bande, CLV moyen ≥ 0, et la série max est publiée telle quelle. Affichage ensuite, sous le combiné à 2 jambes, pas à sa place.

**Exclu** : la règle « marchés sous-annoncés + marge la plus basse ». Elle peut tourner en ombre à titre de contrôle, mais ne sera pas un produit tant que ses deux moitiés de période ne concordent pas.

## 4. Chantier C : chasseurs spécialistes

**Définition** : un chasseur est un produit mono-marché, une sélection par jour ou une abstention annoncée, avec sa propre fiche publique : fréquence réelle de réussite, pire série observée, solde cumulé à mise fixe, ratio réalisé/annoncé. Mise suggérée d'un quart d'unité. Bloc « Chasse » séparé et étiqueté, jamais combinés entre eux.

**Sélection dans chaque chasseur** : parmi les sélections du canal du jour, hors AVOID, dans la bande de cote propre au marché, classement par probabilité calibrée puis marge la plus basse. Pas d'edge : c'est le filtre le plus perdant mesuré (Plus de 3,5 à 26 % pour 37 % annoncés, Nul à 14 % pour 26 %).

| Chasseur      | État des données (46 jours)                                                              | Bande de cote | Prérequis technique                                                                                                             | Ordre |
| ------------- | ---------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----- |
| BTTS          | 59,8 % pour 60,0 % annoncés, −5,4 % ; canal existant, calibré                            | 1,45–1,90     | Aucun                                                                                                                           | 1     |
| DRAW          | 28,3 % pour 29,7 %, −4,8 % ; série max 18                                                | 2,90–3,60     | Aucun ; la série max doit être très visible                                                                                     | 2     |
| OVER 3,5      | Le moteur **sous-estime** (33,4 % réel pour 28,8 % annoncé) : GOALS ne le choisit jamais | 1,80–3,00     | Corriger la queue de la distribution (sur-dispersion : correction empirique de la queue ou binomiale négative), puis re-mesurer | 3     |
| OVER 4,5      | Non mesuré ; même défaut de queue, amplifié                                              | 2,80–5,00     | Après OVER 3,5                                                                                                                  | 4     |
| CORRECT_SCORE | 10,9 % pour 12,6 % (ratio 0,87), −20 à −26 %, série max 57                               | 5,00–12,00    | Ombre seulement jusqu'à ratio ≥ 0,90 ; décision d'affichage humaine (`project_correct_score_immature`)                          | 5     |

**Validation par chasseur** : 4 semaines d'ombre minimum, ≥ 200 sélections réglées, ratio ≥ 0,90, CLV publié. La suspension de marché (ROI < −15 % établi sur 90 jours) continue de s'appliquer : un chasseur dont le marché est suspendu affiche l'abstention et sa raison.

**Ce que vend un chasseur** : « gagne environ 1 fois sur 4 » (Nul), « 1 fois sur 10 » (score exact), la série max, et le tableau du 23/10 publié tel quel. C'est le contenu de la série « Le mythe du coupon sûr » du plan marketing.

## 5. Chantier D : nouveaux marchés (corners, cartons, tirs)

**État réel** : les cotes CORNERS, CORNERS_HT, CARDS (et ODD_EVEN, TEAM_TO_SCORE_FIRST, OVER_UNDER_2H…) sont collectées chez Pinnacle seul depuis le 15/09 (`REFERENCE_ONLY_MARKETS`), les statistiques par match sont ingérées (`fixture_statistics`) et `team_stats` porte déjà corners, cartons et tirs cadrés glissants. Il n'existe ni modèle, ni règlement (`bet-settlement.ts` ne traite pas les marchés « pas sur les buts »), ni canal. Les tirs ne sont pas un marché bookmaker standard chez API-Football : ils servent de variable, pas de produit.

**Étapes**

1. Règlement : total corners et cartons par match depuis `fixture_statistics`, avec test unitaire par marché et règle VOID si la statistique manque.
2. Modèle : λ corners et λ cartons par équipe (domicile/extérieur, arbitre si disponible), Poisson simple d'abord, calibration par bande de cote. Même famille que les buts, mêmes garde-fous.
3. Canaux CORNERS et CARDS en ombre 8 semaines, jugés sur le **résidu** (réalisé − implicite Pinnacle) par bande, jamais sur le Brier absolu.
4. Si le résidu n'est pas inférieur à celui des buts (le moteur n'étant pas devant le marché sur les buts, la barre est basse mais réelle), le marché sort de `REFERENCE_ONLY_MARKETS` et passe en collecte multi-books. Sinon il reste un produit « référence » dans la fiche d'analyse.

**Attente honnête** : plus de produits, même arithmétique. Un corner à 6,5 % de marge coûte plus cher qu'un but à 4,1 %. L'intérêt pour le joueur est la variété et la pédagogie ; l'intérêt pour la marque est de montrer la marge de chaque marché.

## 6. Chantier E : fidélisation, puis monétisation

**Ordre imposé** : honnêteté (P1 de l'audit) → habitude → mesure → intention de payer → offre.

| Étape              | Contenu                                                                                                                                                                                                                             | Mesure                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Honnêteté          | Chantier 0 : mentions 18+, jeu responsable, CGU, confidentialité ; renommage « Pari sûr » ; image de partage ; track record rebranché ; projection supprimée                                                                        | Audit P1 fermé                              |
| Habitude           | Coupon publié à heure fixe avec notification ; « Suivre ce coupon » à la place de « Jouer » ; solde cumulé sur chaque carte ; jours sans coupon expliqués ; relevé du lundi (gagnés, perdus, solde) in-app et sur WhatsApp/Telegram | Vues de coupon par jour distinct            |
| Mesure             | Analytics avec consentement (Plausible ou équivalent), UTM à l'inscription, événements : onboarding terminé, coupon vu, coupon suivi, relevé ouvert                                                                                 | Activation ≥ 40 %, rétention J14 ≥ 30 %     |
| Intention de payer | Sondage à J+21 pour les inscrits actifs, sans annoncer de prix ; liste d'attente « Membre fondateur » seulement si on est prêt à l'honorer                                                                                          | ≥ 15 % d'intention déclarée                 |
| Offre              | À décider sur les données : ce qui reste gratuit (favori du jour, calibration, formation) et ce qui devient Premium (chasseurs, coupon cote 2, historique complet, alertes). Prix en FCFA, pas les 30–40 € de `business-model.md`.  | Conversion essai → payant, churn à 30 jours |

**Porte** : aucun paywall avant activation ≥ 40 % et rétention J14 ≥ 30 % sur au moins 300 inscrits. Un abonnement vendu à des joueurs qui ne reviennent pas est perdu deux fois.

## 7. Calendrier sur 12 semaines

| Semaines | A : UX/UI                                                                                                  | B : cote 2                                       | C : chasseurs                                                         | D : marchés                                            | E : fidélisation                                             |
| -------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------ |
| 1–2      | Chantier 0 (P1 audit) ; `PRODUCT.md`, `DESIGN.md` ; spec de capture ; critique Accueil, Coupons, Décisions | Spec + lancement de l'ombre                      | Spec ; BTTS et DRAW en ombre                                          | Règlement corners/cartons + tests                      | Analytics avec consentement, UTM                             |
| 3–4      | Accueil, Coupons, Décisions livrés                                                                         | Ombre                                            | Ombre ; correction de la queue OVER 3,5                               | Modèle corners/cartons, calibration                    | « Suivre », notification à heure fixe, jours vides expliqués |
| 5–6      | Landing/inscription, Track record, Onboarding                                                              | Lecture à 4 semaines → affichage si porte passée | Lecture BTTS/DRAW → affichage si porte passée ; OVER 3,5/4,5 en ombre | Canaux en ombre (début des 8 semaines)                 | Relevé du lundi ; premiers inscrits de campagne              |
| 7–8      | Avis IA, Bankroll, Mes coupons                                                                             | Suivi                                            | Score exact en ombre                                                  | Ombre                                                  | Sondage d'intention de payer                                 |
| 9–12     | Formation, Paramètres, admin ; audit a11y/perf final                                                       | Suivi                                            | Lecture OVER ; score exact : décision humaine                         | Lecture à 8 semaines → sortie de REFERENCE_ONLY ou non | Lecture activation/rétention → décision Premium              |

Chaque lecture se fait sur `channel_selection_deduped` (ou la vue équivalente pour les coupons), par jambe, avec son intervalle. Une lecture favorable sur moins de 200 sélections prolonge l'ombre, elle ne l'achève pas.

## 8. Décisions attendues

1. **Binaire `impeccable`** : autoriser le téléchargement à la première exécution, ou travailler en mode dégradé (critique sans détecteur).
2. **Nature des chasseurs** : produits calibrés d'engagement (recommandé) ou promesse de gain (non défendable avec les données).
3. **Score exact** : ombre seulement jusqu'à ratio ≥ 0,90, affichage sur décision humaine.
4. **Nom du bookmaker à l'écran** : garder « 1xBet » (décision du 18/10) ou passer à « cote jouable estimée » sans nom (plan marketing §2, régulation CI/SN).
5. **Dépôt public** : les audits publient des faiblesses du site en production (en-têtes de sécurité, e-mail non vérifié). Passer le dépôt en privé, ou sortir ces constats des audits.
6. **Budget de temps** : les chantiers A et E sont séquentiels avec la campagne ; B, C, D peuvent tourner en ombre en parallèle sans coût joueur.
