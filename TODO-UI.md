# TODO-UI — EVCore Web

use skills: shadcn-ui, next, nestjs, playwright

Référence : nettoyage post-livraison V1 UI.
Cinq canaux actifs : **EV**, **SV**, **CONF**, **NUL**, **BB**.

---

## Statut

La **V1 UI est globalement terminée**.

Ce fichier ne sert plus de backlog d'exécution détaillé. Il sert désormais de :

- résumé de ce qui a été livré
- pense-bête des derniers reliquats hors code critique
- support pour les prochaines perspectives produit

---

## Livré en V1

### Fondations UI

- `@evcore/ui` consolidé avec primitives et composants partagés
- base `shadcn/ui` posée et harmonisée
- `FilterBar`, `DataTable`, `ResponsiveGrid`, `ProgressBar`, `StatCard`
- dark mode et i18n `fr` / `en`
- conventions responsive validées sur les vues clés

### Expérience produit

- identité claire des 5 canaux dans l'interface
- page `Picks du jour`
- page `Performance`
- page `Fixtures` revue
- page `Compte` utilisable
- centre de notifications
- centre de formation avec progression

### Formation & progression

- structure articles / vidéos
- progression locale + backend
- badge `Diplômé`
- guides principaux rédigés, dont `guide-coupons.md`

### Gamification V1

- badges volume / streak / patience / calibré / diplômé
- affichage des badges sur le compte
- affichage des badges dans le leaderboard
- avatars déblocables

### Backend/UI support

- préférences `theme`, `locale`, `currency`, `unit staking`
- notifications alignées sur le backend
- rotation sûre des logs backend en conteneur

---

## Reliquats Mineurs

Ces points ne bloquent pas la clôture V1 :

- remplacer la vidéo intro placeholder par la vraie vidéo
- éventuellement ajouter un filtre par type sur `/dashboard/notifications`

---

## Perspectives Produit

La suite ne doit plus être pensée comme une checklist de pages, mais comme des axes produit capables d'augmenter la rétention, la lisibilité et la dimension communautaire d'EVCore.

### 1. Gamification sociale

- rendre les badges visibles au-delà du seul écran compte
- mettre en avant les badges rares ou récents
- afficher les nouveaux diplômés ou badges débloqués récemment

### 2. Réputation & statut utilisateur

- introduire un niveau ou une réputation EVCore
- faire progresser ce statut via formation, discipline, régularité
- afficher ce statut dans les surfaces cross-user utiles

### 3. Leaderboards multi-axes

- classement formation
- classement discipline / régularité
- classement performance si la donnée est robuste
- progressions semaine / mois

### 4. Vitrine communauté légère

- bloc dashboard "activité communauté"
- badges les plus rares
- utilisateurs les plus disciplinés
- progression moyenne de la communauté

### 5. Partage de coupon

- partage d'un coupon via lien interne ou public
- affichage lisible du contexte du coupon : sélections, canal, type, logique
- possibilité de repartager un coupon comme source d'inspiration
- découverte des coupons d'autres utilisateurs pertinents

### 6. Communication inter-utilisateurs

- réactions simples sur coupons ou contenus partagés
- commentaires courts et contextualisés
- suivi d'autres profils
- activité récente utile autour de la méthode, de la formation et des picks

### 7. Feedback produit & suggestions

- bouton "Suggérer une amélioration"
- bouton "Signaler un problème"
- catégories simples : bug, UX, données, idée produit
- remontée contextualisée depuis la page ou le contenu concerné

### 8. Exploration produit avancée

- override log sur les `NO_BET`
- annual recap type "Wrapped"
- comparaison bookmakers
- replay d'un `ModelRun`

---

## Priorités Recommandées

Si un nouveau cycle produit démarre après cette V1 :

1. badges visibles dans le profil et le leaderboard
2. niveau / réputation utilisateur
3. leaderboards multi-axes
4. vitrine communauté sur le dashboard
5. partage de coupon
6. feedback produit / signalement
7. communication inter-utilisateurs légère
8. exploration avancée (`override log`, `wrapped`, `replay`)
