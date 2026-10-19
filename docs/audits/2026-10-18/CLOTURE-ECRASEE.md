# Clôture écrasée après le coup d'envoi (2026-10-18)

Relecture de la couverture CLV promise à J+7 (`docs/audits` du 10-08, PR #238),
sur le dump de production du 2026-10-16.

## 1. Le symptôme

Part des sélections réglées qui portent une ligne de clôture : 72–77 % du 9
au 11 octobre, **57–65 % du 12 au 16**. Jambes de coupon : 33–67 %.

Deux causes structurelles, connues et acceptées, expliquent une partie des
manques : CORRECT_SCORE (groupe d'issues jamais complet chez un book) et
TO_WIN_EITHER_HALF (pas de partition exclusive, `outcomeGroup` renvoie null).
Le reste — 522 sélections sur cinq jours dont le relevé le plus proche du
coup d'envoi date de 12 à 18 heures — est un bug.

## 2. Le mécanisme

Taux de réussite du balayage de clôture par heure de coup d'envoi, du 9 au
16 octobre (observation entre T−16 et T−3 min) : **1,00 presque partout,
0,00 sur les 62 rencontres de 19:00 UTC**, 0,17–0,24 à 17:30, 18:30, 18:45.

Le balayage tourne pourtant : la ligne Pinnacle 1X2 d'une rencontre UECL de
19:00 a été **créée à 18:50:10** par la passe T−10. Puis :

- la synchro d'horizon du soir démarre à 19:00:00 UTC en prod et couvre
  « aujourd'hui » depuis le 2026-10-05 (`resolveTargetDates`) ;
- `findScheduledForDate` ne filtre que `status = SCHEDULED`, et une
  rencontre qui vient de commencer l'est encore ;
- elle est donc re-relevée **8 minutes après son coup d'envoi** ; le book
  n'a pas bougé, la clé (`snapshotAt` = heure de mise à jour du book) est la
  même, l'upsert met `observedAt` à 19:00:30 ;
- la vue `odds_closing_line` exclut tout relevé observé après le coup
  d'envoi : la preuve d'avant-match a disparu.

Sur la semaine : **102 des 644 rencontres analysées (16 %) ont un relevé
créé avant le coup d'envoi et observé après** ; 80 n'ont plus aucune
clôture. Les écrasements tombent à 19 h (99 rencontres) et 6 h (3), les
deux passes d'horizon. Les coups d'envoi de 18:00 sont épargnés parce que
l'API ne sert plus de cotes pré-match une heure après le début.

## 3. Le correctif

Le worker de cotes ne relève **jamais** une rencontre déjà commencée, en
mode horizon comme en mode clôture (`odds-prematch-sync.worker.ts`). En
mode clôture cela reste un « coup d'envoi raté » (indicateur du balayage) ;
en mode horizon c'est compté à part (`alreadyStarted`). Test de régression
ajouté. Au passage, une vingtaine d'appels API par jour en moins.

## 4. Réparer l'historique (côté utilisateur, après déploiement)

Les lignes écrasées gardent leur `createdAt`, qui est une observation
d'avant-match certaine (borne basse de la dernière observation réelle).
Restaurer :

```sql
UPDATE odds_snapshot o
SET "observedAt" = o."createdAt"
FROM fixture f
WHERE f.id = o."fixtureId"
  AND o.source <> 'HISTORICAL'
  AND o."createdAt" < f."scheduledAt"
  AND o."observedAt" >= f."scheduledAt";
```

Sur le dump : 112 013 lignes, 112 rencontres, dont 111 retrouvent une
observation à moins de 90 minutes du coup d'envoi. Puis re-régler, ce qui
ne touche que les lignes de clôture manquantes (idempotent) :

```bash
curl -X POST "$API/channel-decisions/settle-range?from=2026-10-01&to=2026-10-18" -H "Cookie: $SESSION"
```

```bash
curl -X POST "$API/coupons/settle-range?from=2026-10-01&to=2026-10-18" -H "Cookie: $SESSION"
```

1 100 sélections réglées depuis le 1er octobre retrouveraient leur clôture.

## 5. Ce qui n'est pas un bug

- Les relevés T−60 sont « écrasés » par le relevé T−10 (même clé, prix
  inchangé) : c'est le comportement voulu, la dernière observation
  d'avant-match est la bonne.
- La passe du soir tourne à 19:00 UTC en prod, pas 18:00 comme dans
  `.env.example` : sans conséquence une fois les rencontres commencées
  exclues.
