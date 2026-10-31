---
version: 1
slug: "app-dashboard-page-tsx"
primary_target: "app/dashboard/page.tsx"
related_targets: []
---

# Aujourd'hui (app/dashboard/page.tsx) — surface brief

Scope: l'onglet Aujourd'hui du joueur, premier écran de l'application, mode Operate. Contenu et hiérarchie décidés dans docs/refonte-ui/04-aujourdhui-en-detail.md (validé le 29/10/2026). Audience : le parieur régulier d'Abidjan sur Android, dehors, pressé. Job : savoir en dix secondes quoi jouer, si hier a gagné, et suivre. Action : « Suivre ». Preuve : la forme datée du produit, pertes comprises. Contraintes : budget de texte (aucun titre, aucun paragraphe, 3 chiffres par carte), jamais de gain ni de promesse, ligne 18+ fixe.

## Direction contract

THESIS: Chaque chiffre d'EVCore se lit comme un score sur le tableau du stade : trois lettres, un nombre tabulaire, une seule couleur allumée. Il refuse l'arrangement par défaut des applis de paris (fond vert sombre, néon, cartes dans les cartes, bonus) et son opposé (fintech blanche à accent bleu).

OWN-WORLD: Bandeau encre #0E1320 en tête, diodes ambre #FFB300 comme unique couleur allumée ; sol blanc froid #F6F7F9 pour le soleil ; gris pris sur une rampe fixe de onze pas ; vert #1F8A4C et rouge #C62828 réservés aux résultats. Barlow Condensed 600/700 pour codes et nombres (tabulaires), Barlow 400/500 pour le texte ; filets de 1 px, aucune ombre ; les chances en diodes rondes allumées ou éteintes ; les formes en petits carrés.

STORY: Le joueur voit la ligne de score d'hier, la carte du jour et ses dix diodes, croit parce que les pertes sont allumées comme les gains, et touche Suivre.

FIRST VIEWPORT: 390 de large. Bandeau 0–130 : EVCore, cloche, initiale ; ligne Hier en score (FAV ✓ 1,24 · COM ✓ 1,41 · C2 ✗). Carte du jour 146–560 : titre et heure, deux équipes empilées, pari nommé et cote 28 px, dix diodes et « 8 sur 10 », un fait, forme 30 j et son compte, bouton Suivre pleine largeur 48 px (action principale). Puis les produits en lignes filetées, la ligne 18+, la barre des 4 onglets. Interaction signature : les diodes s'allument de gauche à droite à l'ouverture (300 ms, une seule fois) ; le soir, la cote de la carte cède la place au ✓ ou ✗ allumé, et la ligne Hier du lendemain reprend le score.

FORM: le tableau d'affichage (bandeau de score télé, tableau du stade), candidat 3 sur 7 de la liste fondée ; seed:45205d7f4d78dbb0.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Unresolved

- Le nom montré de l'accumulateur de chasseurs (nom de famille seulement).
- Les logos d'équipe : licence à vérifier ; en attendant, pastille à trois lettres.
