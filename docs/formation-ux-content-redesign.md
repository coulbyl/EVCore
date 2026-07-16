# Formation — refonte UX/UI + ton du contenu

> Audit réalisé le 2026-07-16 en naviguant réellement l'app (compte de test, captures
> desktop 1440px et mobile 390px, backend + DB réels). Ce n'est pas une intuition —
> chaque constat ci-dessous est observé sur une vraie capture d'écran ou une ligne de
> code précise. Périmètre : `apps/web/app/dashboard/formation/**`,
> `apps/web/domains/formation/**`, `apps/web/content/formation/**`.

---

## 1. Résumé exécutif

Trois problèmes distincts, de gravité très différente :

1. **Le hub Formation est cassé, pas juste perfectible.** La page d'accueil de la
   Formation ne montre qu'une seule vidéo — qui n'existe pas encore ("en cours de
   production"). Les 12 leçons écrites (10 canaux/bases + 2 bankroll) sont
   **invisibles depuis le hub**, parce que le hub filtre exclusivement sur
   `type === "video"`. Un utilisateur qui arrive sur `/dashboard/formation` voit une
   carte vide et rien d'autre à faire que cliquer sur une vidéo qui n'a pas de contenu.
2. **L'expérience mobile est inutilisable pour lire une leçon.** La liste des leçons
   (sidebar desktop) n'est pas repliée sur mobile — elle s'affiche en pleine largeur,
   **avant** le contenu de l'article, sans limite de hauteur. Ouvrir une leçon et
   ouvrir la liste de la catégorie affichent la même chose à l'écran : il faut
   scroller au-delà de 7 cartes de leçons avant de voir le titre de l'article qu'on
   vient de cliquer. Formation n'est en plus pas dans la barre de navigation mobile
   (5 raccourcis fixes, codés en dur, qui ne l'incluent pas) — accessible seulement
   via le tiroir latéral.
3. **Le ton est effectivement mécanique.** Confirmé en relisant mes propres textes :
   formule de titre identique partout, "À retenir" en fin de chaque leçon avec la
   même structure à 3 puces, annotation `CODE (Français)` collée en général au tout
   début du premier paragraphe (ex. *"VALUE (Valeur) identifie des cotes..."*), phrases
   qui démarrent presque toujours par "C'est..." ou "Voici...", usage systématique du
   tiret cadratin pour toutes les nuances. Ça lit comme une fiche technique relue par
   personne, pas comme quelqu'un qui explique.

Le point 1 est un bug produit (contenu invisible), le point 2 est un bug UX bloquant
sur mobile, le point 3 est un vrai défaut éditorial mais le moins urgent des trois —
le contenu est juste, seulement mal *dit*.

---

## 2. Constats UX/UI détaillés

### 2.1 Hub (`/dashboard/formation`)

Fichier : `apps/web/app/dashboard/formation/components/formation-page-client.tsx`

- Ligne ~78-90 : `videos = items.filter((item) => item.type === "video")` — le hub ne
  retient QUE le contenu vidéo. Sur 13 contenus au total (12 articles + 1 vidéo), 12
  sont exclus de la page d'accueil.
- La carte "featured" (la plus grande, en haut) affiche la vidéo d'intro, dont le
  résumé dit littéralement *"en cours de production — le script est prêt, le tournage
  reste à faire"*. C'est la première chose que voit un nouvel utilisateur.
- Les 3 métriques ("Disponibles: 1", "Vues: 0/1", "Prochaine: 2 min") ne décrivent que
  cette unique vidéo — inutiles et un peu tristes en l'état.
- Résultat visuel : une page quasi vide, avec un seul CTA vers un contenu qui ne
  fonctionne pas encore.

### 2.2 Catégorie (`/dashboard/formation/[category]`)

Fichier : `apps/web/app/dashboard/formation/components/formation-category-shell.tsx`

- Double breadcrumb : le `PageHeader` du dashboard affiche déjà "Formation › Les
  canaux EVCore" en haut de la page, et le contenu de la leçon elle-même réaffiche
  "Formation / Les canaux / [titre]" un peu plus bas. Deux fils d'Ariane différents
  pour la même information, dans deux styles visuels différents (`>` vs `/`).
- Layout desktop correct (grille sidebar + contenu), mais bascule en **empilement
  vertical simple** en dessous du breakpoint `lg` (`flex flex-col gap-5 lg:grid ...`)
  — la sidebar n'a de limite de hauteur (`lg:max-h-[calc(100vh-11rem)]`) qu'à partir
  de `lg`. En dessous, elle grandit librement et pousse tout le reste vers le bas.
- Titres de leçons tronqués à l'affichage dans la sidebar ("Le canal VALUE (Valeur) :
  ce q...") — symptôme direct du problème de longueur de titre couvert en §3.

### 2.3 Détail d'une leçon (`/dashboard/formation/[category]/[slug]`)

Fichier : `apps/web/app/dashboard/formation/[category]/[slug]/page.tsx`

- Même souci de double breadcrumb.
- Le H1 ("Le canal VALUE (Valeur) : ce qui tient vraiment hors échantillon") prend
  **4 lignes** en desktop 1440px avant même d'atteindre le résumé. Sur mobile ce
  serait pire.
- Sur mobile (390px, confirmé par capture), le contenu de l'article n'apparaît **pas
  du tout dans le premier écran** — il faut faire défiler au-delà de toute la liste
  des 7 leçons de la catégorie (`aside` empilé avant `main`, cf §2.2). Ouvrir une
  leçon précise et ouvrir la liste de la catégorie produisent un rendu visuellement
  identique au chargement.

### 2.4 Navigation mobile

Fichier : `apps/web/components/app-shell.tsx` (`MOBILE_NAV_ORDER`, ligne ~247)

```ts
const MOBILE_NAV_ORDER = [
  "/dashboard",
  "/dashboard/decisions",
  "/dashboard/investment",
  "/dashboard/coupons",
  "/dashboard/inbox",
];
```

Cette liste fixe pilote la barre de navigation du bas sur mobile. `Formation` n'y
figure pas — accessible uniquement via le tiroir latéral (icône hamburger en haut à
gauche). Sur un outil qui doit "aider à mieux exploiter les analyses" (positionnement
produit acté), la formation étant à deux taps de plus que Décisions/Investir envoie
un signal de priorité involontaire.

### 2.5 Détail mineur mais réel

- Un bouton flottant (assistant IA, icône sparkle) est positionné en bas à gauche sur
  mobile et **chevauche visuellement** les cartes de la sidebar/liste de leçons
  (confirmé sur les captures hub et catégorie mobile) — pas spécifique à Formation,
  mais aggrave la lisibilité déjà compromise de cette page en particulier.

---

## 3. Les catégories (bases, canaux, bankroll, ligues, app) — servent-elles à quelque chose ?

Réponse courte : **l'idée est bonne, l'exécution actuelle la sabote.**

Ce qui plaide pour les garder :
- La taxonomie elle-même est cohérente et progressive (bases → canaux → bankroll →
  app), et matche exactement comment ce document et les leçons ont été pensés.
- Une fois qu'on est *dans* une catégorie, la sidebar + progression (`0/7`, barre de
  progression) donne un vrai sentiment de parcours structuré — ça, ça fonctionne.

Ce qui plaide contre, en l'état :
- **Le hub les ignore complètement** (§2.1) — les catégories existent dans le code
  mais ne sont jamais présentées comme point d'entrée principal. Un nouvel
  utilisateur ne les découvre pas.
- **Deux catégories sur cinq sont vides ou quasi vides** : `leagues` n'a aucun
  contenu, `app` n'a que le tuto vidéo non tourné. Une catégorie vide dans un menu de
  navigation est un signal de produit inachevé, pas neutre.
- **Le découpage en 3 niveaux (hub → catégorie → leçon) coûte cher en clics** pour un
  contenu qui, en tout, ne fait que 12 leçons courtes (2-3 min chacune). C'est
  l'architecture d'un cours à 50 leçons, pas d'un guide de 12 pages.

**Recommandation** : garder la taxonomie comme *système de tags/filtres*, pas comme
hiérarchie de navigation obligatoire à 3 clics. Concrètement : une seule liste
Formation, scannable en un écran (desktop et mobile), avec les catégories comme
chips de filtre au-dessus — pas comme des sous-pages séparées. Réintroduire une vraie
hiérarchie de catégories plus tard, si le catalogue grossit vraiment (30+ leçons), pas
avant.

---

## 4. Le ton — diagnostic concret, avec extraits réels

### 4.1 Les patterns mécaniques identifiés

**a) La formule de titre est toujours la même** : `"[Le canal] CODE (Français) : proposition qui résume tout"`.

> "Le canal VALUE (Valeur) : ce qui tient vraiment hors échantillon"
> "Le canal DOMINANT (Victoire) : la preuve que le classement sauve un signal faible"
> "Le canal DRAW (Nul) : une amélioration réelle, mesurée dans le temps"

Correct individuellement, mais mis bout à bout (comme dans la sidebar), ça lit comme
une nomenclature générée automatiquement, pas comme des titres choisis un par un.

**b) L'annotation `CODE (Français)` est plaquée dans la prose, pas seulement dans les titres.**

> "VALUE (Valeur) identifie des cotes à valeur attendue positive..."
> "DRAW (Nul) cible le match nul, via la probabilité implicite du marché..."
> "BTTS, en français BB, et GOALS, en français Buts, ne sont rentables sur aucun classement..."

C'est une info utile une fois, dans le titre ou en sous-titre — pas au milieu d'une
phrase censée sonner naturelle. "VALUE (Valeur) identifie..." n'est pas une phrase
qu'un humain prononce à voix haute.

**c) La structure "À retenir" est identique, mot pour mot, dans les 12 leçons** — 3
puces, même longueur, même ton de synthèse. Utile pour la clarté, mais complètement
prévisible : dès la 3ᵉ leçon, l'utilisateur sait qu'il peut sauter directement à la
fin sans rien perdre. Ce n'est pas un défaut de fond, c'est un défaut de variété.

**d) Sur-usage du tiret cadratin pour toute nuance ou reformulation** :

> "Une cote n'est pas une prédiction, c'est un prix" — utilisé une fois, très bien.
> Mais ce type de construction ("X, pas Y — Z") revient 3 à 5 fois par leçon,
> systématiquement.

**e) Ouvertures de phrases répétitives** : "C'est..." / "Voici..." / "Ce n'est pas...
c'est..." reviennent en tête de phrase de façon disproportionnée sur l'ensemble du
corpus — signature stylistique reconnaissable, donc lassante sur 12 leçons lues à la
suite.

### 4.2 Exemple concret — avant / après

**Avant** (`value-channel.md`, texte actuel) :

> VALUE identifie des cotes à valeur attendue positive : des matchs où la probabilité
> calibrée du moteur dépasse suffisamment la probabilité implicite de la cote (edge et
> EV définis dans la leçon "L'edge et l'EV"). C'est le canal de mise réelle principal
> d'EVCore — celui sur lequel l'essentiel de la discipline du produit est construit.

**Après** (proposition, même information, ton oral) :

> VALUE, c'est le canal sur lequel EVCore mise vraiment. Il cherche des matchs où le
> modèle voit une meilleure chance de gagner que ce que la cote laisse penser — on a
> vu comment calculer cet écart dans la leçon précédente. Concrètement : c'est le
> canal qui porte le plus de responsabilité dans la discipline du produit.

Différences appliquées : phrase d'ouverture courte et directe (pas de sujet+verbe
technique en première position), suppression de l'annotation `(Valeur)` en plein
milieu de phrase (déjà donnée dans le titre), référence à la leçon précédente
formulée comme un rappel ("on a vu") plutôt qu'un lien entre parenthèses,
suppression d'un tiret cadratin sur deux.

### 4.3 Règles à appliquer pour la suite

1. `CODE (Français)` seulement dans le **titre** et le **premier badge affiché à
   l'écran** (déjà le cas pour l'UI) — jamais répété dans une phrase de prose au-delà
   de la première mention de la leçon.
2. Varier l'ouverture de chaque section — interdiction informelle de commencer deux
   paragraphes consécutifs par "C'est" ou "Voici" dans une même leçon.
3. "À retenir" : garder le principe (utile), mais varier le nombre de puces (2 à 4
   selon la leçon) et éviter la reformulation pure du corps du texte — chaque puce
   doit ajouter une nuance, pas résumer.
4. Cible : phrases de 15-20 mots en moyenne, pas 30+. Couper au tiret cadratin plutôt
   que d'enchaîner deux idées dans la même phrase.
5. Relire à voix haute avant de considérer une leçon terminée — c'est le test le plus
   rapide pour détecter le ton "robotique".

---

## 5. Proposition de refonte

### 5.1 Architecture de l'information (priorité haute)

- **Un seul niveau de liste** au lieu de hub → catégorie → leçon. Page unique
  `/dashboard/formation` qui liste les 12 leçons directement, avec :
  - Des chips de filtre par catégorie en haut (Bases / Canaux / Bankroll — retirer
    `leagues` du menu tant qu'elle est vide, retirer `app` tant qu'elle n'a qu'un
    contenu non produit).
  - Un tri par défaut cohérent avec la progression pédagogique (`order`), pas
    alphabétique.
  - La vidéo d'intro, une fois tournée, comme item "épinglé" en haut plutôt que comme
    seul contenu de la page.
- **Une seule page de détail**, sans sous-route catégorie intermédiaire
  (`/dashboard/formation/[slug]` au lieu de `/dashboard/formation/[category]/[slug]`)
  — simplifie le routing et supprime un niveau de breadcrumb.
- Ajouter `Formation` (ou au minimum un accès en un tap) à `MOBILE_NAV_ORDER`, ou à
  défaut un raccourci visible depuis le hub principal du dashboard.

### 5.2 Layout responsive (priorité haute — bloquant aujourd'hui)

- Sur mobile : la liste des leçons de la catégorie devient une **feuille/liste
  repliable** (accordéon ou drawer "Voir toutes les leçons") plutôt qu'un bloc
  toujours affiché en premier. L'article doit être visible dès le premier écran.
- Réserver le layout sidebar-toujours-visible au desktop (`lg:` et au-delà) —
  c'est déjà presque le cas, il manque juste l'équivalent mobile fonctionnel au lieu
  d'un simple empilement.
- Fusionner les deux breadcrumbs (garder celui du `PageHeader`, supprimer celui
  dupliqué dans le contenu de la leçon).
- Raccourcir les titres affichés dans la sidebar (titre complet dans le H1 de la
  leçon, version courte de 3-4 mots dans la liste — ex. "VALUE" au lieu de "Le canal
  VALUE (Valeur) : ce qui tient vraiment hors échantillon").

### 5.3 Contenu (priorité moyenne — pas cassé, à améliorer par vagues)

- Réécrire les 12 leçons existantes en appliquant les règles du §4.3 — peut se faire
  par petits lots (ex. catégorie par catégorie) sans bloquer le reste.
- Ne pas toucher aux chiffres/faits déjà vérifiés (edge calibré, ROI, tailles
  d'échantillon) — uniquement la formulation autour.
- Appliquer la même relecture aux scripts vidéo compagnons une fois qu'ils seront
  tournés, pour cohérence de voix entre l'écrit et l'oral.

### 5.4 Ce qu'on ne touche pas

- Le tracking de progression (`UserContentProgress`, badge Diplômé) — fonctionne,
  indépendant de la restructuration de navigation proposée ici.
- Les chiffres et la méthodologie de sourcing (`docs/formation-content-maintenance.md`)
  — toujours valables quel que soit le layout.

---

## 6. Ordre de traitement suggéré

1. Fix hub (afficher tous les contenus, pas seulement les vidéos) — petit changement,
   gros impact, débloque la découvrabilité immédiatement.
2. Fix layout mobile (liste repliable, breadcrumb unique) — le bug le plus visible
   pour n'importe quel utilisateur sur téléphone.
3. Simplifier la navigation à 2 niveaux (liste unique + filtres) au lieu de 3.
4. Ajouter Formation à la nav mobile.
5. Réécriture progressive du ton, leçon par leçon — pas de rush, pas de deadline
   produit dessus.
