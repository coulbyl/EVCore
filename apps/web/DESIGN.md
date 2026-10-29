---
name: EVCore
description: Le tableau d'affichage — chaque chiffre se lit comme un score, une seule couleur allumée.
colors:
  ink: "#0e1320"
  led-amber: "#ffb300"
  led-amber-edge: "#b07a00"
  ground: "#f6f7f9"
  card: "#ffffff"
  fill: "#e8ebf0"
  rule: "#d9dde3"
  ramp-mid: "#b4bac4"
  icon-subtle: "#7d8799"
  text-muted: "#5b6472"
  band-rule: "#2a3142"
  text: "#141821"
  ground-dark: "#0b0e16"
  win: "#1c8045"
  loss: "#c62828"
  win-dark: "#2ea866"
  loss-dark: "#e05252"
  warning: "#8a5a00"
typography:
  figure:
    fontFamily: "Barlow Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1
    fontFeature: '"tnum", "lnum"'
  title:
    fontFamily: "Barlow Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.15
  bet:
    fontFamily: "Barlow, system-ui, Arial, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 500
    lineHeight: 1.3
  body:
    fontFamily: "Barlow, system-ui, Arial, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.4
  meta:
    fontFamily: "Barlow, system-ui, Arial, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.35
  legal:
    fontFamily: "Barlow, system-ui, Arial, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 1.35
rounded:
  hover: "6px"
  rail: "8px"
  button: "10px"
  card: "14px"
  sheet: "20px"
  pill: "9999px"
spacing:
  gutter: "16px"
  gutter-wide: "24px"
  touch: "44px"
  row: "56px"
  content-max: "640px"
  rail: "224px"
  sheet-column: "416px"
components:
  band:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card}"
    padding: "16px 16px 14px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: "16px"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card}"
    typography: "{typography.bet}"
    rounded: "{rounded.button}"
    height: "48px"
  button-primary-dark:
    backgroundColor: "{colors.led-amber}"
    textColor: "{colors.ink}"
    typography: "{typography.bet}"
    rounded: "{rounded.button}"
    height: "48px"
  chip:
    textColor: "{colors.text-muted}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  chip-active:
    backgroundColor: "{colors.led-amber}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  row:
    textColor: "{colors.text}"
    typography: "{typography.body}"
    height: "56px"
  tab-bar:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text-muted}"
    typography: "{typography.legal}"
    height: "56px"
  sheet:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text}"
    rounded: "{rounded.sheet}"
---

# Design System: EVCore

## Overview

**Creative North Star: "Le tableau d'affichage"**

Chaque chiffre d'EVCore se lit comme un score sur le bandeau d'une retransmission ou le tableau d'un stade : trois lettres, un nombre aux chiffres alignés, une seule couleur allumée. Le monde vient de ce que le parieur d'Abidjan regarde chaque week-end, et il dit ce que le produit promet : un résultat, compté, sans commentaire. Il refuse l'écran d'application de paris (fond vert sombre, néon, cartes dans les cartes, bonus) et son opposé, la fintech blanche à accent bleu.

Le monde ne prête que quatre choses à l'interface : le type, la palette, la densité et un geste signature. La navigation et les contrôles sont ceux qu'un téléphone a déjà (barre d'onglets, feuille qui monte, liens, interrupteurs). Un écran tient en un bandeau encre, une carte au plus, des lignes filetées et une barre d'onglets. Clair par défaut, parce que le joueur lit dehors ; le sombre suit le réglage du téléphone.

Ce document décrit le monde de la refonte, construit sous la racine `.scoreboard` (`apps/web/app/styles/scoreboard.css`). Les anciens écrans gardent le thème de `@evcore/ui` jusqu'à leur suppression (docs/refonte-ui/15-todo.md, E1).

**Key Characteristics:**

- Un bandeau encre en tête de chaque onglet, qui porte la ligne de score.
- L'ambre des diodes, seule couleur allumée : chances, puce choisie, onglet actif.
- Deux voix : Barlow Condensed pour tout ce qui est score, Barlow pour les mots.
- Couleur plate, aucune ombre, un filet de 1 px pour séparer.
- L'issue d'un pari se lit à la forme autant qu'à la couleur.

## Colors

Une encre bleu nuit, un sol blanc froid, des gris tirés d'une seule rampe, et une diode ambre comme unique éclat.

### Primary

- **Encre du bandeau** (`ink`) : le bandeau en tête de chaque écran, la colonne gauche sur ordinateur, le bouton principal en clair, le texte posé sur l'ambre.
- **Diode ambre** (`led-amber`) : la seule couleur allumée. Diodes de chance, puce choisie, onglet actif, score gagné dans le bandeau, bouton principal en sombre.
- **Bord de diode** (`led-amber-edge`) : le contour d'une diode allumée sur fond clair, sans lequel l'ambre (1,8:1 sur blanc) disparaît au soleil.

### Tertiary

- **Vert gagné** (`win`, `win-dark` en sombre) : un résultat gagné, et rien d'autre.
- **Rouge perdu** (`loss`, `loss-dark` en sombre) : un résultat perdu, et rien d'autre.
- **Ambre d'avertissement** (`warning`) : un avertissement écrit sur fond clair ; en sombre, la diode ambre fait ce rôle.

### Neutral

La rampe, du plus clair au plus sombre : `card`, `ground`, `fill`, `rule`, `ramp-mid`, `icon-subtle`, `text-muted`, `band-rule`, `text`, `ink`, `ground-dark`.

- **Sol** (`ground`) : le fond de l'écran en clair. **Sol nuit** (`ground-dark`) en sombre, sous l'encre du bandeau.
- **Carte** (`card`) : la seule surface posée sur le sol (la carte du jour, la feuille, la barre d'onglets) ; en sombre elle prend `text`.
- **Fond discret** (`fill`) : les fonds secondaires, la forme grise du chargement, le survol d'une ligne.
- **Filet** (`rule`) : les séparations entre lignes, le bord des cartes, le contour des champs. **Filet du bandeau** (`band-rule`) sur l'encre, et partout en sombre.
- **Texte** (`text`) et **texte secondaire** (`text-muted`) : le premier pour lire, le second pour le championnat, l'heure, la période.
- **Gris discret** (`icon-subtle`) : les chevrons, l'anneau d'une diode éteinte, un score perdu dans le bandeau.
- **Gris moyen** (`ramp-mid`) : le texte secondaire du bandeau, et le texte secondaire en sombre.

### Named Rules

**The One Lit Color Rule.** Une seule couleur s'allume : l'ambre des diodes. Elle ne s'écrit jamais en texte sur fond clair, où elle tombe à 1,8:1 ; sur l'encre, elle fait 10,3:1.

**The Ramp Rule.** Tous les gris viennent des onze pas de la rampe. Aucun gris ad hoc, aucune opacité pour éclaircir un texte.

**The Results Only Rule.** Le vert et le rouge ne disent qu'une chose, gagné ou perdu. Jamais une couleur de marque, de catégorie ou de décor.

## Typography

**Display Font:** Barlow Condensed (repli Arial Narrow, system-ui)
**Body Font:** Barlow (repli system-ui, Arial)

**Character:** La voix condensée est celle du tableau : étroite, haute, des chiffres alignés en colonne d'une ligne à l'autre. Barlow, sa sœur large, porte les noms d'équipes et les phrases sans changer de famille.

### Hierarchy

- **Figure** (Barlow Condensed 700, 28 px, 1) : la cote et la chance du héros. Rien n'est plus grand sur téléphone.
- **Title** (Barlow Condensed 600, 22 px, 1,15) : le titre d'une carte ou d'une feuille, la ligne de score, la marque.
- **Bet** (Barlow 500, 17 px, 1,3) : le pari nommé avec l'équipe, les noms sur une carte, le libellé d'un bouton.
- **Body** (Barlow 400, 15 px, 1,4) : le texte courant, les lignes de liste, les puces.
- **Meta** (Barlow 400, 13 px, 1,35) : le secondaire, sous une ligne.
- **Legal** (Barlow 400, 11 px, 1,35) : la ligne 18+ ; à la même taille en 500, les libellés de la barre d'onglets.

### Named Rules

**The Two Voices Rule.** Deux graisses par voix, livrées en fichiers : 400 et 500 pour Barlow, 600 et 700 pour Barlow Condensed. Le gras simulé est coupé (`font-synthesis-weight: none`) ; demander 600 au texte rend 500.

**The Tabular Score Rule.** Tout nombre qui se compare d'une ligne à l'autre (cote, heure, « 8 sur 10 ») est en voix condensée et en chiffres tabulaires (`score`).

**The Written Number Rule.** Une chance est toujours écrite. Les diodes la redoublent, elles ne la remplacent jamais, et un lecteur d'écran l'entend en toutes lettres (« 8 chances sur 10 »).

## Layout

Téléphone d'abord, en une colonne : bandeau, contenu, ligne 18+, puis la barre d'onglets fixée en bas au-dessus de la zone de geste du système. Marge latérale de 16 px. Une ligne de liste fait au moins 56 px de haut, une cible de toucher au moins 44 px.

À partir de 768 px, la feuille reste par-dessus l'écran mais se centre, 34 rem au plus. À partir de 1024 px, la barre d'onglets cède la place à une colonne gauche encre de 224 px (marque, quatre onglets, cloche et initiale), le contenu se borne à 640 px de large avec une marge de 24 px, et une feuille ouverte devient une colonne de droite de 416 px, collée en haut pendant que la page défile.

C'est la fenêtre qui défile, jamais `body` : sous la coquille, `html` et `body` reprennent leur hauteur naturelle et coupent le débordement horizontal par `clip`, qui ne crée pas de conteneur de défilement.

### Named Rules

**The One Thing Per Line Rule.** Une chose par ligne, séparée par un filet. Un texte qui déborde se replie sur deux lignes, il n'est jamais tronqué ; il est raccourci à l'écriture.

## Elevation & Depth

Aucune ombre. La profondeur vient de trois plans plats : l'encre du bandeau, le sol, la carte posée dessus et bordée d'un filet de 1 px. En sombre, l'encre et le sol étant presque égaux, un filet `band-rule` sépare le bandeau du sol et la colonne gauche du contenu. Une feuille modale passe au-dessus sur un voile (la nuit `ground-dark` à 60 % en clair, le noir à 60 % en sombre). Les jetons d'ombre du thème partagé sont neutralisés sous `.scoreboard`.

### Named Rules

**The Flat Board Rule.** Couleur plate, sans dégradé, sans grain, sans ombre. L'élévation est un filet de 1 px ou rien.

## Shapes

Des angles doux, jamais ronds au point d'adoucir le propos : 6 px pour les zones de survol et la forme grise, 8 px pour une entrée de la colonne gauche, 10 px pour les boutons, 14 px pour une carte, 20 px pour le haut d'une feuille. Les pilules ne servent qu'aux puces. Les diodes sont des cercles, les jours de forme des carrés à peine arrondis (2 px).

## Components

### Buttons

- **Shape:** coins de bouton (10 px), 48 px de haut, pleine largeur dans une carte ou une feuille.
- **Primary:** encre, texte blanc en clair ; ambre, texte encre en sombre. Libellé en `bet` 500.
- **Hover / Focus:** anneau de focus de 2 px, encre en clair, ambre en sombre, décalé de 2 px.
- **State action:** l'issue d'une ligne d'état est un lien souligné en 500, au moins 44 px de haut.

### Chips

- **Style:** pilules de 44 px, texte secondaire, sans fond ni bordure.
- **State:** la puce choisie s'allume en ambre avec un texte encre. Ce sont des liens : le choix vit dans l'adresse et l'écran se rend côté serveur.

### Cards / Containers

- **Corner Style:** coins de carte (14 px).
- **Background:** `card`.
- **Shadow Strategy:** aucune (voir Elevation & Depth).
- **Border:** filet de 1 px `rule`.
- **Internal Padding:** 16 px, blocs espacés de 12 px.

### Navigation

- **Barre d'onglets (téléphone) :** fond `card`, filet en haut, quatre entrées égales de 56 px, icône de 22 px au-dessus d'un libellé `legal` en 500. L'onglet actif passe à l'encre (l'ambre en sombre) et porte une petite diode allumée au-dessus de l'icône.
- **Colonne gauche (≥ 1024 px) :** encre, entrées de 44 px en `body` 500, l'entrée active sur `band-rule` avec sa diode à droite.
- **Bandeau :** encre, marque en `title` 700, cloche et initiale en cercles de 44 px bordés de `band-rule`.

### Ligne de score (signature)

`FAV ✓ 1,24 · COM ✓ 1,41 · C2 ✗` en `title` condensé : codes à trois lettres, signe ✓ ✗ dessiné en SVG, cote payée en `body` après un gain. Sur le bandeau, gagné s'allume en ambre et perdu s'éteint en gris ; sur une surface claire, ils prennent `win` et `loss`. Un lecteur d'écran entend le nom complet et l'issue en mots.

### Diodes de chance

Cercles de 10, 14 ou 22 px. Allumée : ambre bordée de `led-amber-edge` en clair. Éteinte : anneau `icon-subtle` sur fond clair, disque `band-rule` sur l'encre et en sombre. Jusqu'à 20 diodes ; au-delà, le nombre seul.

### Forme

Un carré par jour ou par avis, dans un seul SVG. Gagné : plein vert. Perdu : plein rouge barré d'une croix. Remboursé : contour traversé d'un trait. En attente : contour seul. Aucun coupon : carré `rule`.

### Feuille

Sous 1024 px, modale : elle monte du bas (280 ms, `cubic-bezier(0.32, 0.72, 0, 1)`) avec sa poignée, sur un voile, et se referme d'un geste vers le bas. Au-dessus, colonne de droite non modale. L'en-tête peut prendre l'encre du bandeau ; le pied reste fixé pour le bouton principal.

### Named Rules

**The Shape Before Color Rule.** L'issue se lit à la forme : ✓ ou ✗, croix sur un carré perdu, trait sur un remboursé. Le vert et le rouge n'ont que 1,13:1 de différence de luminosité en clair ; la couleur ne fait que redoubler la forme.

## Do's and Don'ts

### Do:

- **Do** poser le bandeau encre en tête de chaque onglet, avec la ligne de score ou les puces de l'écran dans sa seconde ligne.
- **Do** écrire chaque cote, heure et chance en `score` (Barlow Condensed, chiffres tabulaires).
- **Do** passer par `chanceOf`, `formatOdds`, `formatTime` (`helpers/scoreboard-format.ts`) et `formatCurrency` pour écrire un nombre, dans le fuseau de l'appareil.
- **Do** vérifier une nouvelle couleur avec `pnpm --filter web check:contrast` : texte à 4,5:1, élément graphique et focus à 3:1, en clair et en sombre.
- **Do** dessiner ✓ ✗ ≠ et le remboursé en SVG (`ResultMark`) : ils ne sont pas dans le sous-ensemble latin de Barlow.

### Don't:

- **Don't** écrire de l'ambre en texte sur fond clair, ni allumer une seconde couleur.
- **Don't** poser une ombre, un dégradé ou une carte dans une carte.
- **Don't** utiliser le vert ou le rouge pour autre chose qu'un résultat, ni les laisser seuls porter une issue.
- **Don't** demander une graisse non livrée (600 sur Barlow, 400 sur Barlow Condensed) : elle rend une autre graisse sans le dire.
- **Don't** tronquer un texte avec des points de suspension : le raccourcir à l'écriture.
- **Don't** faire de `body` un conteneur de défilement sous la coquille.
