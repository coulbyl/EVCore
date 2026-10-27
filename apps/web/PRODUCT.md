# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Application Next.js installable en PWA, utilisée d'abord sur téléphone. Les écrans d'administration (audit, moteur, ML, rapports, utilisateurs) sont utilisés sur ordinateur par l'équipe.

## Users

**Utilisateur principal (confirmé le 2026-10-24)** : le parieur régulier d'Afrique francophone, sur téléphone.

- 18–40 ans, Côte d'Ivoire d'abord, puis Sénégal et Cameroun (21 ans minimum au Cameroun).
- Mise plusieurs fois par semaine, petites sommes (2 000 à 5 000 F), surtout sur le football européen, par mobile money, chez un bookmaker local (1xBet le plus souvent).
- Joue volontiers des combinés de 6 à 10 matchs et perd presque tous les gros combinés sans savoir pourquoi.
- A déjà suivi ou payé des pronostiqueurs Telegram ou WhatsApp (« coupons sûrs », « VIP ») et s'est senti floué.
- **Son travail** : décider chaque jour quoi jouer, ou ne pas jouer, et comprendre pourquoi il gagne ou perd. Il ouvre l'app avant les matchs du jour et après les résultats.
- **Ce qui compte pour lui** : qu'on ne lui mente pas, et que ce soit concret.

Personas de travail (plan marketing, `docs/audits/2026-10-23/03-PLAN-MARKETING.md` §3) : Koffi (29 ans, Abidjan, combinés), Aminata (34 ans, Dakar, veut comprendre), Junior (24 ans, Douala, a payé un coupon VIP jamais livré).

**Audience secondaire** : l'équipe EVCore (rôle Admin), qui pilote le moteur, les annonces et le support.

**Exclus** : les mineurs (moins de 21 ans au Cameroun) et les personnes en difficulté avec le jeu.

## Product Purpose

EVCore analyse chaque match de football et propose, chaque jour, quelques sélections et coupons avec leur probabilité, leur raisonnement et leur historique réglé. **Il ne place aucun pari** : pas de dépôt, pas de fonds, pas de lien de mise. Le suivi de mise et les coupons joués sont déclaratifs.

**Promesse (confirmée le 2026-10-24) : méthode et transparence.** « On te montre la vraie probabilité, notre raisonnement et tous nos résultats, pertes comprises. » Aucun gain n'est promis.

**Succès** : le joueur revient chaque jour, lit une probabilité comme une fréquence (« 75 % = une fois sur quatre ça perd »), comprend qu'un taux de réussite élevé à cote courte peut être une perte, et choisit moins mais mieux. Objectifs de lancement (hypothèses) : 40 % d'activation (coupons vus sur 3 jours distincts dans les 14 premiers jours) et 30 % de rétention à J14, avant toute offre payante.

## Positioning

Ce qu'un pronostiqueur ne peut pas copier sans se trahir :

- **La calibration mesurée et datée** : ce qui est annoncé à 73 % arrive à 73 %, publié avec sa période et son effectif.
- **Tout est réglé en public, pertes comprises**, y compris les coupons perdus et le solde à mise fixe.
- **Les refus motivés** : chaque match écarté porte sa raison (vue « Écarté », canal AVOID). Ne pas parier fait partie de l'analyse.
- **Gratuit, sans prise de mise, sans commission sur les paris.**

Face aux pronostiqueurs Telegram (« 100 % », « sûr », captures de tickets gagnants) et aux applis de bookmakers (bonus, combinés géants), EVCore est le seul qui dit quand ne pas jouer et qui montre ses pertes.

## Operating Context

- **Rythme quotidien** : les coupons et sélections sont publiés la veille au soir et ajustés le jour même ; les résultats sont réglés après les matchs. Le volume varie fortement : 20 à 30 matchs analysés en semaine, 120 à 160 le samedi et le dimanche.
- **Produits du jour** : une sélection simple à cote 1,20–1,35, un combiné à deux sélections, un coupon long à cote 2,5–5, un combiné « Analyse IA » ; un coupon à cote 2 et des chasseurs spécialisés (BTTS, nul, plus de 3,5 buts, score exact) sont en préparation, en ombre avant toute publication.
- **Écrans principaux du joueur** : Accueil, Coupons, Décisions (« Notre sélection » et « Écarté »), Avis IA, Matchs, Mes coupons, Suivi de mise, Mesures historiques, Formation (15 contenus), Glossaire, Aide, Support (messagerie avec l'équipe), Notifications.
- **Conditions d'usage** : téléphone Android d'entrée et de milieu de gamme, réseau mobile 3G/4G variable, écran consulté en extérieur, souvent pressé (« avant quelle heure dois-je jouer ? »).
- **Où le joueur découvre EVCore** : Facebook, TikTok, groupes et chaînes WhatsApp et Telegram, bouche-à-oreille.

## Capabilities and Constraints

**Langue et devise** : français par défaut, anglais disponible ; devise par défaut XOF (franc CFA).

**Registre (confirmé le 2026-10-24) : tutoiement, ton proche.** « Tu », direct et complice, sans familiarité excessive. Les textes actuels mélangent tutoiement et vouvoiement et doivent être harmonisés vers le tutoiement.

**Vocabulaire du produit** :

- « Sélection », « coupon », « jambe » (une sélection dans un coupon), « cote », « chances », « Écarté », « Remboursé » (pas « Annulé » pour un pari rendu).
- Les codes de canal (`DRAW`, `SAFE`, `BTTS`, `DOMINANT`…) ne s'affichent jamais bruts : toujours le libellé traduit.
- Une probabilité se lit en fréquence quand c'est possible (« environ 1 jour sur 2 »).

**Règles de rédaction (contraintes durables, plan marketing §5)** :

- Interdit : toute promesse de gain directe ou implicite (« gagner », « rentable », « sûr », « garanti », « 100 % », « fixe », « VIP ») ; le vocabulaire de l'investissement appliqué aux paris (« investir », « portefeuille », « placement », « allocation de capital ») ; un taux, un ROI ou une fréquence sans période ni effectif ; un chiffre de backtest présenté comme un résultat ; nommer, lier ou promouvoir un bookmaker hors de la cote jouable.
- Obligatoire sur les surfaces publiques et les contenus de campagne : « 18+ » (« 21+ » au Cameroun) et « Parier comporte des risques de perte. Ne mise que ce que tu peux perdre. »
- Format d'un chiffre de performance : « [indicateur] du [date] au [date], sur [N] [sélections/jours] réglés : [valeur]. »

**Contraintes de mesure (non négociables)** :

- Le moteur est derrière le marché (Brier 0,639 contre 0,599) et aucun marché n'est rentable sur l'ensemble des sélections (−4,4 % à −12,2 %). Aucun écran ne peut laisser entendre un avantage sur le bookmaker.
- L'« edge » annoncé est anti-prédictif : ne jamais le mettre en avant comme un signal de qualité.
- Au-dessus d'une cote de 1,80, la probabilité annoncée surestime fortement la réalité : ne pas la présenter comme fiable.
- Un ROI de coupon n'a pas de puissance statistique à ces volumes : l'afficher seulement avec son effectif, jamais comme argument.

**Décisions ouvertes** (à ne pas trancher dans le design sans accord) :

- Nom de la sélection simple du jour : « Pari sûr du jour » est à retirer ; « Favori du jour » proposé, pas confirmé.
- Nom du bookmaker à l'écran : « 1xBet » affiché depuis le 2026-10-18 ; « cote jouable estimée » sans nom proposé pour raisons réglementaires.
- Modèle économique : aucun dans le code. Rien ne doit suggérer un tarif, un abonnement ou une offre « Premium » tant que l'activation et la rétention ne sont pas mesurées.

## Brand Commitments

- **Nom** : EVCore. Logo existant (monogramme « EV » + « Core »).
- **Ce que la marque refuse d'être** : un pronostiqueur, une appli de bookmaker, un produit d'investissement.
- **Personnalité** : honnête jusqu'à montrer ses pertes, pédagogue sans être scolaire, proche (tutoiement) sans complaisance, sobre sur les chiffres.

## Evidence on Hand

Chiffres réels, utilisables avec leur période et leur effectif :

- Calibration de « Notre sélection », du 9 au 22/10/2026, 1 133 sélections réglées : 76,9 % réalisées pour 78,6 % annoncées (`docs/audits/2026-10-23/04-DIAGNOSTIC-JOUEUR.md`).
- Bande de cotes 1,20–1,65, du 11 au 16/10/2026, 1 499 sélections réglées : 73,6 % réalisées pour 73,0 % annoncées (`docs/audits/2026-10-17/PREMIERE-LECTURE.md`).
- Avis IA du 13 au 24/10/2026, 300 sélections réglées : 64,7 % réalisées pour 63,9 % annoncées ; écart au marché sans marge +1,0 point ± 2,7 (pas mieux que la cote), à mise fixe −2,3 % ; l'IA jouait 80 % des matchs lus (`docs/audits/2026-10-27/AVIS-IA.md`).
- Coupon cote 2 sur 120 jours : composé par cellule, 55 % de jours gagnés pour 55 % annoncés ; composé par la probabilité du moteur, 50 % pour 72 % (`docs/audits/2026-10-24/COUPON-COTE-2-JOURS.md`).
- Contenus de formation : 15 articles et vidéos (`apps/web/app/dashboard/formation`).

**Absences à ne jamais fabriquer** : aucun témoignage, aucun utilisateur payant, aucun tarif, aucune presse, aucun partenariat, aucun rendement positif. Le chiffre « 300 000+ prédictions » de la landing est vraisemblablement un comptage gonflé et doit être recompté avant réutilisation.

## Product Principles

1. **La vérité avant la vente.** Un chiffre sans période, sans effectif ou sans pertes n'est pas montré. Une perte se montre aussi clairement qu'un gain.
2. **Fréquence, pas promesse.** Chaque probabilité doit pouvoir se lire comme « une fois sur N », et chaque produit dit à quelle fréquence il perd et quelle est sa pire série.
3. **Moins, mais compris.** Le joueur doit savoir en dix secondes quoi jouer aujourd'hui, si hier a gagné, et s'il est en gain ou en perte. Tout le reste est secondaire.
4. **S'abstenir est un résultat.** Un jour sans coupon, un match écarté, une cote trop courte sont expliqués, jamais cachés.
5. **Jamais de pression à jouer.** Pas de classement par gains, pas de séries récompensées, pas de compte à rebours ; « suivre » plutôt que « jouer ».

## Accessibility & Inclusion

- Téléphones d'entrée de gamme, réseau lent : poids de page et nombre de requêtes maîtrisés, lisibilité en plein soleil (contrastes WCAG AA minimum, 4,5:1 pour le texte).
- Lecture rapide sur petit écran : texte lu à 12 px minimum, cibles tactiles de 44 px.
- Littératie numérique et statistique variable : aucune notion (cote, probabilité, marge, calibration) affichée sans explication accessible au doigt, pas seulement au survol.
- Jeu responsable : vérification d'âge à l'inscription, mention de risque, ressources d'aide ; à terme, limites et auto-exclusion.
