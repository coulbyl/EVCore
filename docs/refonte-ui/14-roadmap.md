# Refonte UI — 14. Feuille de route d'implémentation

_29/10/2026. Décision de l'utilisateur : **une seule branche** (`feat/refonte-ui`), rien ne se fusionne tant qu'un ensemble n'est pas complet, pour ne jamais livrer une application à moitié refaite. Deux PR seulement : la première = le public et le joueur, la seconde = l'admin. De petits commits, un par ligne de [15-todo.md](15-todo.md)._

## 0. Les règles de la branche

- **Base** : `main` au 29/10 (`8c5e54e8`). La branche se **rebase sur main chaque semaine** : la prod continue de recevoir ses correctifs par `main`, et la branche ne doit pas diverger de plusieurs semaines sans se réaligner.
- **Un commit par ligne de todo**, message en anglais, préfixe conventionnel (`feat(web): …`, `feat(backend): …`, `chore: …`, `docs: …`). Chaque commit laisse la branche qui compile (`pnpm lint`, `pnpm typecheck`) ; les tests cassés par un écran retiré sont retirés dans le même commit.
- **Pendant la branche, les anciens écrans restent en place** jusqu'au commit de nettoyage de leur phase : on construit à côté (nouvelles routes sous `app/(app)/…`), puis on bascule la navigation et on supprime. Un commit « bascule » par phase.
- **Les migrations** se rédigent dans la branche et se lancent par l'utilisateur au déploiement (règle du dépôt). Celles qui suppriment des données (coupons déclarés, suivi de mise) sont des migrations à part, nommées, avec leur SQL de vérification avant.
- **Performance et qualité** : budgets, règles d'architecture et cadence de revue dans [16-performance-et-qualite.md](16-performance-et-qualite.md) ; un écran = un point d'entrée d'API agrégé rendu côté serveur, une lecture de session par requête, bundle joueur sans bibliothèque lourde, revue à la fin de chaque phase.
- **Avant chaque PR** : `/code-review high` (argent, règlement, notifications, jobs datés), revue de finition impeccable sur les écrans livrés, DESIGN.md écrit depuis le code réel, `pnpm lint`, `pnpm typecheck`, `pnpm --filter backend test`, Playwright sur les parcours du joueur.
- **Hors branche, hors PR** (travail moteur, pas UI) : l'accumulateur de chasseurs (remplace le coupon long et le coupon prix, [ACCUMULATEUR.md](../audits/2026-10-29/ACCUMULATEUR.md)), les lots ML-1 → ML-4. Les écrans de la refonte affichent ces produits quand ils existent ; ils ne les attendent pas.

## 1. PR 1 — Le public et le joueur

### Phase A — Fondations (le style et la coquille)

Le monde « tableau d'affichage » ([13-style.md](13-style.md)) en code, avant tout écran : les jetons, les polices, la coquille (bandeau, barre d'onglets, colonne gauche sur ordinateur, feuilles), les composants de base (ligne de score, diodes, forme, lignes filetées, puces) et les états communs ([10](10-transverse.md) § 2). Sortie : `apps/web/DESIGN.md` et `.impeccable/design.json`, un écran de démonstration des composants, zéro page joueur encore.

### Phase B — Le serveur du joueur

Tout ce que les écrans attendent du backend, livré avant les écrans, testé : le fait par jambe stocké à la génération, le relais du héros et les abstentions datées, le refus de suivre après coup d'envoi, le bilan des coupons suivis, la notification du soir, la chance « marché sans marge » au-dessus de 1,80 et le prix juste par pari (Shin), le point d'entrée Résultats par produit (jours, gagnés, remboursés, abstentions, pire série, annoncé, En francs), le héros public et l'image du jour, la conversation unique, l'inscription à trois champs avec vérification passable et double authentification facultative, le compteur anonyme de tickets, les redirections, et les migrations de suppression (coupons déclarés, suivi de mise, dépôts, personnalisation).

### Phase C — Les écrans du joueur

Dans l'ordre du sommaire, chaque écran avec ses états : Aujourd'hui et le coupon ouvert, Matchs et la fiche, Vérifie ton ticket (barre, feuille, image, ticket d'hier), Résultats (liste, produit, Ta semaine, Hier), Moi et ses sous-écrans (Mes coupons suivis, Messages, Aide, Jeu responsable, Compte), la cloche, le premier lancement, l'ordinateur. Un commit « bascule » remplace l'ancienne navigation par les quatre onglets.

### Phase D — Le public

Landing (téléphone et ordinateur), `/resultats` public, inscription, connexion, vérification, mot de passe oublié, pages légales au style, 404, image de partage.

### Phase E — Nettoyage et revue

Suppression des écrans joueur retirés (Décisions, Avis IA, Coupons, Mesures historiques, Formation, Glossaire, Suivi de mise, Mes coupons, Inbox, Notifications à onglets) et de leur code ; anglais ; Playwright par parcours ; `/code-review high` ; revue de finition et DESIGN.md ; PR vers `main` avec étiquette `major`.

## 2. PR 2 — L'admin (sur la même branche, après la fusion de PR 1)

### Phase F — Le lot config

[ENV-PROD](../audits/2026-10-29/ENV-PROD.md) § 6 : schéma Zod de l'environnement par application, horaires et seuils en code avec les valeurs de prod, table `app_setting` (cinq réglages, défauts en code, rechargement à chaque passe), `ML_CORRECTION` constante fausse, combiné IA à 17 h 45 sur une constante partagée, retry retiré, `composed` honnête, variables mortes et redites retirées du `.env` de prod (liste à donner à l'utilisateur).

### Phase G — L'admin

Le cinquième onglet sur téléphone et la colonne sur ordinateur ; l'accueil (voyants à règles écrites, À faire agrégé, passes du jour avec Relancer, aujourd'hui en chiffres, e-mail au passage au rouge) ; Moteur (produits avec CLV et marge, canaux × compétition, suspensions avec Réactiver journalisé, icône de diagnostic sur la fiche) ; Joueurs (quatre chiffres du mois, messages, comptes avec pause, fiche, annonce) ; Réglages et le journal unique des actions humaines ; suppression des onze anciennes pages admin et redirections ; tests ; `/code-review high` ; PR vers `main`.

## 3. Ce qui se décide en route

- Le nom montré de l'accumulateur de chasseurs (quand le lot moteur l'apporte).
- Les logos d'équipe (licence) : pastille à trois lettres tant que ce n'est pas réglé.
- Les neuf champs légaux de l'éditeur : à remplir avant la fusion de PR 1.
