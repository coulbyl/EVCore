# Plan d’action EVCore — coupon unique

Branche : `feat/unified-coupon-audit-remediation`.

Les [constats et preuves de l’audit](FINDINGS.md) sont conservés sans réinterpréter les anciens verdicts comme des validations. Aucun résultat historique ne doit être réécrit automatiquement.

## Contrat produit

Un seul coupon par journée UTC, cote totale de 5 à 15, ou abstention. Explorer les compétitions et marchés disponibles ; dédupliquer match/marché/pick ; ne jamais ajouter une jambe déficitaire pour atteindre la cote. Les tendances restent des éléments de contexte tant que leur apport prédictif supplémentaire n’est pas démontré. Les probabilités jointes calculées par produit reposent sur une hypothèse d’indépendance, pas une garantie.

## Travaux et critères de réception

- [x] P0 — Admission : probabilités et prix finis, EV recalculée strictement positive par jambe et coupon ; alertes AVOID excluantes. Tests de régression du cas −43,75 %.
- [x] P0 — Génération : une politique 5–15, nombre variable de jambes, même clé soir/intraday, abstention explicite.
- [x] P0 — Publication : immutabilité, concurrence idempotente, contrôle prématch à la persistance, provenance run/sélection/cote/calibration conservée.
- [x] P0 — Données : cutoff de connaissance des statistiques et cotes ; exclure les prix historiques/importés du pool live ; ne pas reprendre une ancienne meilleure cote.
- [x] P0 — Mesure : dernière décision prématch avant filtrage SELECTED ; résultats connus au cutoff ; déduplication ; attribution de version ; réconciliation dashboard/rapports/calibration.
- [x] P0 — ML : réparer les compléments de marché, contrat train/inférence, version réellement servie, séparation chronologique par match et test final intact.
- [x] P1 — Produit : coupon unique affiché, « Avis IA », calibration distincte de rentabilité, remboursements et attentes explicites.
- [x] P1 — Règlement : tests de corrections/annulations et diagnostic de divergences ; réparation historique uniquement sur preuves explicites.
- [x] P1 — Validation : typecheck, lint et tests pertinents ; aucune ancienne assertion PASS réutilisée.
- [ ] P2 — Observation prospective : figer la politique et comparer coupon/simples sur les mêmes jambes ; publier abstentions, intervalles et volume. Nécessite de nouvelles rencontres, ne peut pas être déclaré terminé par une modification de code.

## Journal de réalisation

Implémentation terminée le 14 septembre 2026 sur la branche
`feat/unified-coupon-audit-remediation` :

- politique `unified-5-15-v1`, 2 à 5 jambes, cote totale 5 à 15, une seule
  proposition immuable par date UTC ; les passages soir et intraday partagent
  la même clé et chaque abstention ou préservation est journalisée ;
- nouvelle table append-only `coupon_generation_attempt`, migration appliquée
  à la base locale Docker avec checksum identique au fichier versionné ; aucun
  résultat, coupon, pari ou sélection historique n'a été modifié ;
- provenance future : version déterministe, identifiants run/sélection,
  snapshot et bookmaker, dates de connaissance, modèle réellement servi et
  empreintes SHA-256 des prompts ;
- cohortes communes pour calibration, dashboard et rapports ; extraction ML
  point-in-time, séparation temporelle par match et test final non utilisé pour
  l'ajustement ;
- promesse de validation historique retirée du README et libellés produit
  corrigés ; les verdicts « fiable », « à surveiller », « peu fiable » et
  « recommandé » ont été remplacés dans les parcours concernés par les bandes
  d'écart de calibration, le volume observé ou une sélection proposée ; le
  chargement de l'historique et les sollicitations onboarding, tour et
  installation sont désormais ordonnés ;
- [`prospective-observation.sql`](prospective-observation.sql) publie le
  calendrier complet, les abstentions et la comparaison appariée coupon contre
  simples à mise totale égale, avec intervalle à 95 %. Au jour de
  l'implémentation, il retourne zéro journée réglée : aucune performance
  prospective n'est encore revendiquée.

Vérifications : 724 tests backend, 493 analysis-core, 122 vantage-worker, 18
backtest-core et 75 tests Python passent. Les typechecks backend, worker et web
passent. Le lint monorepo passe avec les deux avertissements `<img>` frontend
préexistants autorisés. Le schéma Prisma, la migration et le scorecard SQL ont
été validés contre PostgreSQL 18 local.

La case P2 restera ouverte jusqu'à l'accumulation de journées réellement
publiées ou explicitement abstentionnées et réglées. Les anomalies historiques
énumérées dans [FINDINGS.md](FINDINGS.md) restent des sujets d'enquête : sans
preuve fournisseur supplémentaire, leur correction automatique créerait une
nouvelle version de la vérité au lieu de réparer une erreur démontrée.
