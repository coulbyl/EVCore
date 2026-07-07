# Documentation d’implémentation — Collecte et analyse des résultats Loto Bonheur CI

## 1. Objectif

Mettre en place un module capable de collecter, nettoyer, stocker et analyser l’historique des tirages **Loto Bonheur Côte d’Ivoire**.

Le module doit permettre de :

- récupérer automatiquement les résultats historiques ;
- stocker les tirages dans une base PostgreSQL ;
- détecter les doublons et les données manquantes ;
- analyser les fréquences, retards et cooccurrences ;
- générer des grilles candidates ;
- backtester des stratégies ;
- éviter toute promesse de prédiction certaine.

Le but n’est pas de “prédire” le loto, mais de construire un moteur d’analyse statistique propre.

---

## 2. Sources de données

### 2.1 Source primaire : site officiel Loto Bonheur

Source à privilégier : page officielle des résultats Loto Bonheur.

La page contient :

- les mois disponibles ;
- les types de tirages ;
- les résultats par semaine ;
- les numéros gagnants ;
- les numéros machine ;
- les tirages digitaux et physiques.

Les mois visibles vont de **juillet 2026** jusqu’à **octobre 2020**, ce qui donne une profondeur historique intéressante pour un dataset initial.

Types de tirages visibles sur la page officielle :

```txt
Reveil
Etoile
Akwaba
Monday Special
La Matinale
Emergence
Sika
Lucky Tuesday
Premiere Heure
Fortune
Baraka
Midweek
Kado
Privilege
Monni
Fortune Thursday
Cash
Solution
Wari
Friday Bonanza
Soutra
Diamant
Moaye
National
Benediction
Prestige
Awale
Espoir
Day Off
Digital 21h
Digital Reveil 7h
Digital 23h
Special Weekend 1h
Special Weekend 3h
Digital Reveil 8h
Digital 22h
Afterwork
```

### 2.2 Source secondaire : LotteryGuru

LotteryGuru propose un historique structuré et des statistiques comme les numéros les plus fréquents et les moins fréquents. La page indique que ses statistiques sont générées depuis **2022** jusqu’au dernier tirage disponible.

Cette source ne doit pas remplacer la source officielle, mais elle peut servir pour :

- comparer certains tirages ;
- détecter des écarts ;
- valider les numéros récents ;
- enrichir les statistiques.

### 2.3 Sources à éviter comme base principale

À ne pas utiliser comme source principale :

- Facebook ;
- YouTube ;
- PDF Scribd ;
- applications Android tierces ;
- captures d’écran ;
- groupes Telegram ou WhatsApp.

Ces sources peuvent aider en vérification manuelle, mais elles sont instables, non structurées, et difficiles à auditer.

---

## 3. Règles métier Loto Bonheur

### 3.1 Structure d’un tirage

Un tirage contient généralement :

```ts
type LotoDraw = {
  drawDate: string;
  drawName: string;
  winningNumbers: number[];
  machineNumbers?: number[];
};
```

Exemple logique :

```json
{
  "drawDate": "2026-06-07",
  "drawName": "Digital 21h",
  "winningNumbers": [45, 58, 69, 28, 82],
  "machineNumbers": [54, 72, 78, 29, 7]
}
```

### 3.2 Contraintes de validation

Chaque tirage doit respecter ces règles :

```txt
winningNumbers.length = 5
machineNumbers.length = 5, si présents
chaque numéro est entre 1 et 90
pas de doublon dans winningNumbers
pas de doublon dans machineNumbers
drawDate doit être une date valide
drawName ne doit pas être vide
```

### 3.3 Types de paris

Les principaux types de paris disponibles sont :

```txt
PN
1N
2N
3N
4N
5N
Turbo 2
Turbo 3
Turbo 4
Turbo 5
Chance 3+
Chance 4+
Chance 5+
```

Les cotes officielles doivent être stockées dans une table séparée, car elles peuvent évoluer dans le temps.

---

## 4. Architecture recommandée

### Option recommandée pour ton contexte

Vu ton stack actuel, je recommande :

```txt
NestJS API
PostgreSQL
Prisma
BullMQ / Redis
Playwright pour scraping
Cron ou job planifié
Module d’analyse séparé
```

Structure possible :

```txt
apps/
  api/
    src/
      modules/
        loto/
          loto.module.ts
          loto.service.ts
          loto.controller.ts

packages/
  loto-core/
    src/
      scraping/
      parsing/
      analysis/
      backtesting/
      validation/
```

Le package `loto-core` doit contenir la logique réutilisable :

```txt
collecte
parsing
validation
analyse
scoring
backtest
```

L’API NestJS ne doit faire que l’orchestration, l’exposition HTTP et la persistance.

---

## 5. Stratégie de scraping

### 5.1 Pourquoi Playwright plutôt que simple fetch ?

La page officielle semble être rendue côté client ou semi-dynamiquement. Un simple `fetch()` peut ne pas récupérer proprement tous les résultats.

Il faut donc partir sur :

```txt
Playwright
Chromium headless
attente de rendu DOM
sélection du mois
sélection du tirage
extraction des blocs de résultats
normalisation
sauvegarde
```

### 5.2 Flux de collecte

```txt
1. Ouvrir la page officielle des résultats
2. Lire la liste des mois disponibles
3. Lire la liste des types de tirage disponibles
4. Pour chaque mois :
   4.1 sélectionner le mois
   4.2 attendre le chargement des résultats
   4.3 pour chaque tirage ou tous les tirages :
       - extraire date
       - extraire nom du tirage
       - extraire numéros gagnants
       - extraire numéros machine
5. Valider les données
6. Upsert en base
7. Produire un rapport de collecte
```

### 5.3 Anti-doublon

La clé métier d’un tirage doit être :

```txt
drawDate + drawName + source
```

Exemple :

```txt
2026-06-07::Digital 21h::official
```

Il ne faut pas utiliser uniquement la date, car plusieurs tirages ont lieu le même jour.

---

## 6. Modèle de base de données Prisma

```prisma
model LotoDraw {
  id             String   @id @default(cuid())
  drawDate       DateTime
  drawName       String
  drawSlug       String
  source         String
  sourceUrl      String?

  winningNumbers Int[]
  machineNumbers Int[]

  rawPayload      Json?
  checksum        String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([drawDate, drawSlug, source])
  @@index([drawDate])
  @@index([drawSlug])
}

model LotoScrapeRun {
  id             String   @id @default(cuid())
  source         String
  status         String
  startedAt      DateTime @default(now())
  finishedAt     DateTime?

  totalFound      Int      @default(0)
  totalInserted   Int      @default(0)
  totalUpdated    Int      @default(0)
  totalRejected   Int      @default(0)

  errors          Json?
  metadata        Json?
}

model LotoOdd {
  id          String   @id @default(cuid())
  betType     String
  option      String?
  odd         Float
  activeFrom  DateTime?
  activeTo    DateTime?
  source      String
  createdAt   DateTime @default(now())

  @@index([betType])
}
```

---

## 7. Normalisation des tirages

### 7.1 Slug des tirages

Il faut convertir les noms en slug stable :

```ts
export function toDrawSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
```

Exemples :

```txt
Digital Reveil 7h -> digital-reveil-7h
Digital 21h       -> digital-21h
Special Weekend 1h -> special-weekend-1h
National          -> national
```

### 7.2 Validation des numéros

```ts
export function validateNumbers(numbers: number[]): boolean {
  if (numbers.length !== 5) return false;

  const unique = new Set(numbers);
  if (unique.size !== numbers.length) return false;

  return numbers.every((n) => Number.isInteger(n) && n >= 1 && n <= 90);
}
```

### 7.3 Checksum

Créer un checksum pour détecter les changements de données :

```ts
import crypto from "crypto";

export function createDrawChecksum(input: {
  drawDate: string;
  drawSlug: string;
  winningNumbers: number[];
  machineNumbers: number[];
}) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
}
```

---

## 8. Scraper Playwright — version de base

```ts
import { chromium } from "playwright";

type ScrapedDraw = {
  drawDate: string;
  drawName: string;
  winningNumbers: number[];
  machineNumbers: number[];
  source: "official";
  sourceUrl: string;
};

export async function scrapeOfficialLotoResults(): Promise<ScrapedDraw[]> {
  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
  });

  await page.goto("https://lotobonheur.ci/resultats", {
    waitUntil: "networkidle",
    timeout: 60_000,
  });

  await page.waitForTimeout(2_000);

  const text = await page.locator("body").innerText();

  await browser.close();

  return parseLotoResultsText(text);
}
```

---

## 9. Parser texte — première approche

La première version peut parser le texte rendu de la page.

L’idée :

```txt
Semaine du ...
Dimanche 07/06
Digital 21h
Gagnants :
45
58
69
28
82
Machine :
54
72
78
29
7
```

Parser possible :

```ts
const DRAW_NAMES = [
  "Reveil",
  "Etoile",
  "Akwaba",
  "Monday Special",
  "La Matinale",
  "Emergence",
  "Sika",
  "Lucky Tuesday",
  "Premiere Heure",
  "Fortune",
  "Baraka",
  "Midweek",
  "Kado",
  "Privilege",
  "Monni",
  "Fortune Thursday",
  "Cash",
  "Solution",
  "Wari",
  "Friday Bonanza",
  "Soutra",
  "Diamant",
  "Moaye",
  "National",
  "Benediction",
  "Prestige",
  "Awale",
  "Espoir",
  "Day Off",
  "Digital 21h",
  "Digital Reveil 7h",
  "Digital 23h",
  "Special Weekend 1h",
  "Special Weekend 3h",
  "Digital Reveil 8h",
  "Digital 22h",
  "Afterwork",
];

export function parseLotoResultsText(text: string): ScrapedDraw[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const draws: ScrapedDraw[] = [];

  let currentDate: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isDateLine(line)) {
      currentDate = normalizeDateLine(line);
      continue;
    }

    if (!DRAW_NAMES.includes(line)) {
      continue;
    }

    const drawName = line;
    const gagnantsIndex = lines.indexOf("Gagnants :", i);
    const machineIndex = lines.indexOf("Machine :", i);

    if (gagnantsIndex === -1) continue;

    const winningNumbers = lines
      .slice(gagnantsIndex + 1, gagnantsIndex + 6)
      .map(Number);

    const machineNumbers =
      machineIndex !== -1
        ? lines.slice(machineIndex + 1, machineIndex + 6).map(Number)
        : [];

    if (!currentDate) continue;
    if (!validateNumbers(winningNumbers)) continue;
    if (machineNumbers.length > 0 && !validateNumbers(machineNumbers)) continue;

    draws.push({
      drawDate: currentDate,
      drawName,
      winningNumbers,
      machineNumbers,
      source: "official",
      sourceUrl: "https://lotobonheur.ci/resultats",
    });
  }

  return draws;
}
```

À améliorer ensuite avec des sélecteurs DOM précis si la structure HTML est stable.

---

## 10. Job d’import

```ts
@Injectable()
export class LotoImportService {
  constructor(private readonly prisma: PrismaService) {}

  async importOfficialResults() {
    const run = await this.prisma.lotoScrapeRun.create({
      data: {
        source: "official",
        status: "running",
      },
    });

    try {
      const draws = await scrapeOfficialLotoResults();

      let inserted = 0;
      let updated = 0;
      let rejected = 0;

      for (const draw of draws) {
        const drawSlug = toDrawSlug(draw.drawName);

        if (!validateNumbers(draw.winningNumbers)) {
          rejected++;
          continue;
        }

        const checksum = createDrawChecksum({
          drawDate: draw.drawDate,
          drawSlug,
          winningNumbers: draw.winningNumbers,
          machineNumbers: draw.machineNumbers,
        });

        const result = await this.prisma.lotoDraw.upsert({
          where: {
            drawDate_drawSlug_source: {
              drawDate: new Date(draw.drawDate),
              drawSlug,
              source: draw.source,
            },
          },
          create: {
            drawDate: new Date(draw.drawDate),
            drawName: draw.drawName,
            drawSlug,
            source: draw.source,
            sourceUrl: draw.sourceUrl,
            winningNumbers: draw.winningNumbers,
            machineNumbers: draw.machineNumbers,
            checksum,
            rawPayload: draw,
          },
          update: {
            winningNumbers: draw.winningNumbers,
            machineNumbers: draw.machineNumbers,
            checksum,
            rawPayload: draw,
          },
        });

        if (result.createdAt.getTime() === result.updatedAt.getTime()) {
          inserted++;
        } else {
          updated++;
        }
      }

      await this.prisma.lotoScrapeRun.update({
        where: { id: run.id },
        data: {
          status: "success",
          finishedAt: new Date(),
          totalFound: draws.length,
          totalInserted: inserted,
          totalUpdated: updated,
          totalRejected: rejected,
        },
      });
    } catch (error) {
      await this.prisma.lotoScrapeRun.update({
        where: { id: run.id },
        data: {
          status: "failed",
          finishedAt: new Date(),
          errors: {
            message: error instanceof Error ? error.message : String(error),
          },
        },
      });

      throw error;
    }
  }
}
```

---

## 11. Planification

### Option simple : cron NestJS

```ts
import { Cron } from "@nestjs/schedule";

@Injectable()
export class LotoScheduler {
  constructor(private readonly importService: LotoImportService) {}

  @Cron("15 23 * * *")
  async syncDailyResults() {
    await this.importService.importOfficialResults();
  }
}
```

Le job peut tourner tous les jours à 23h15.

### Option robuste : BullMQ

Recommandé si tu veux :

- retry automatique ;
- suivi d’état ;
- exécution asynchrone ;
- monitoring ;
- historisation des échecs.

```txt
Queue: loto-import
Job: import-official-results
Repeat: daily
Retry: 3
Backoff: exponential
```

---

## 12. Analyse statistique (descriptive uniquement)

Ces indicateurs sont **descriptifs**, jamais prédictifs. Un tirage Loto Bonheur est mécaniquement indépendant du précédent (90 boules rechargées à chaque tirage, machine certifiée ISO 9001 / Bureau Veritas) : aucune fréquence passée ne modifie la probabilité du prochain tirage. Ils servent à informer un joueur, pas à lui suggérer un numéro.

### 12.1 Fréquence simple

```sql
SELECT number, COUNT(*) AS frequency
FROM loto_draws,
LATERAL unnest(winning_numbers) AS number
GROUP BY number
ORDER BY frequency DESC;
```

### 12.2 Numéros en retard

Principe :

```txt
Pour chaque numéro de 1 à 90 :
  trouver la dernière date où il est sorti
  calculer le nombre de tirages depuis cette date
```

### 12.3 Analyse par tirage

Ne pas mélanger tous les tirages trop vite.

Exemple :

```txt
Digital 21h
National
Awale
Afterwork
Digital Reveil 7h
```

Chaque tirage peut avoir son propre historique statistique.

### 12.4 Cooccurrences

Identifier les paires qui apparaissent ensemble :

```ts
function getPairs(numbers: number[]): [number, number][] {
  const pairs: [number, number][] = [];

  for (let i = 0; i < numbers.length; i++) {
    for (let j = i + 1; j < numbers.length; j++) {
      pairs.push(
        [numbers[i], numbers[j]].sort((a, b) => a - b) as [number, number],
      );
    }
  }

  return pairs;
}
```

---

## 13. Audit d'équité et tests d'hypothèses

### 13.1 Pourquoi ce module remplace le "générateur de stratégie"

Un score composite (fréquence + retard + cooccurrence) suggère un signal prédictif qui n'existe pas sur un tirage indépendant — c'est un biais du joueur (gambler's fallacy), pas une stratégie. À la place, on **teste rigoureusement** les théories que les joueurs avancent (biais de la machine, dépendance entre tirages du même jour, etc.) et on publie le résultat honnêtement, qu'il confirme ou non une théorie.

Toute théorie testée suit le même protocole, pour éviter de transformer du bruit en signal :

```txt
1. Formuler l'hypothèse AVANT de regarder les données récentes
2. Split train / validation / test (ex: 2020-2023 / 2024-2025 / 2026)
3. Tester sur la période train uniquement
4. Corriger pour tests multiples (Bonferroni ou FDR)
   -> avec 90 numéros et des milliers de tirages, des "motifs" apparaissent
      par pur hasard si on ne corrige pas
5. Un résultat significatif sur train doit se reconfirmer sur validation
   avant d'être affiché comme un résultat
6. Publier le résultat même s'il est négatif ("aucune anomalie détectée")
```

### 13.2 Test d'équité de la machine (biais mécanique)

Hypothèse : une machine physique peut avoir un biais d'usure minime et persistant (contrairement à un vrai signal prédictif, un biais mécanique aurait une cause physique réelle).

```txt
Test du chi² : distribution observée des 90 numéros vs distribution uniforme attendue
Test de série : dépendance entre boules consécutives d'un même tirage
Fenêtre glissante : recalculer sur les N derniers tirages pour détecter
                    une dérive récente (usure, recalibrage machine)
```

Attente réaliste, d'après les audits publics sur d'autres loteries (chi² sur 20 000+ tirages, aucun biais persistant détecté au-delà des artefacts attendus) : la plupart du temps, **aucune anomalie significative**. C'est le résultat attendu, pas un échec du module — la valeur produit est la transparence de l'audit lui-même, pas la découverte d'un biais.

### 13.3 Test de dépendance inter-tirages

Hypothèse rapportée par des joueurs : la sortie d'un numéro à un tirage (ex: le matin) influencerait un numéro à un tirage suivant (ex: le soir) du même jour.

```txt
Construire la table de contingence :
  numéro sorti au tirage N  x  numéro sorti au tirage N+1
Test d'indépendance (chi²) sur chaque paire de tirages consécutifs
Correction FDR/Bonferroni obligatoire (des milliers de paires testées)
Toute paire significative sur 2020-2024 doit être revalidée sur 2025-2026
  avant d'être considérée comme autre chose que du bruit
```

Il n'existe aucun mécanisme physique reliant deux tirages (les 90 boules sont rechargées à chaque tirage) : l'hypothèse de base est que ce test ne trouvera rien après correction. On le fait quand même, pour trancher avec des données plutôt qu'avec une anecdote de joueur.

### 13.4 Test de persistance (répétition d'un numéro à travers tous les jeux)

Généralisation du §13.3 : au lieu de ne regarder qu'un seul délai (tirage du matin → tirage du soir), on teste si un numéro a tendance à **se répéter dans les K tirages suivants, tous types de jeux confondus** (Reveil, Etoile, Akwaba, Digital 21h, etc.), pour tout délai K.

```txt
Pour chaque numéro (1 à 90) et chaque délai K (1, 2, 3, ...) :
  taux de répétition attendu sous indépendance = calcul analytique exact
    (probabilité qu'un numéro donné ressorte dans un tirage = 5/90 ≈ 5,56 %,
     ou simulation Monte Carlo si on veut intégrer les particularités
     des tirages, ex. absence de machineNumbers)
  taux de répétition observé = fréquence réelle sur l'historique
  test binomial ou chi² : observé vs attendu
Correction FDR obligatoire (90 numéros x plusieurs délais x ~28 types
  de tirage/jour = dizaines de milliers de combinaisons testées)
Toute combinaison significative sur train doit se reconfirmer sur
  validation (2024-2025) puis test (2026) avant d'être publiée
```

Avec ~28 types de tirages par jour, c'est le test le plus exposé au risque de faux positifs par tests multiples de tout le module — la correction FDR n'est pas optionnelle ici. Attente réaliste : le taux observé colle au taux théorique 5/90, parce que c'est ce que produit mathématiquement un tirage indépendant, quel que soit le nombre de jeux traversés.

### 13.5 Génération de grille — équilibrée, jamais scorée

Un utilitaire de génération peut rester, mais **sans score** ni prétention de probabilité supérieure :

```txt
5 numéros uniques, entre 1 et 90
équilibre pair / impair
équilibre petits / moyens / grands
éviter 5 numéros d'une même dizaine
tirage aléatoire pur parmi les combinaisons respectant ces contraintes
```

Aucun poids de fréquence, de retard ou de cooccurrence n'entre dans ce choix — ce serait réintroduire par la porte de derrière le score qu'on vient d'écarter.

---

## 14. Backtesting

Le backtest est indispensable.

### 14.1 Objectif

Tester si une stratégie aurait eu un comportement intéressant dans le passé.

Exemple :

```txt
Pour chaque date D :
  prendre uniquement les tirages avant D
  générer une grille
  comparer avec le tirage réel de D
  mesurer :
    - 0 numéro trouvé
    - 1 numéro trouvé
    - 2 numéros trouvés
    - 3 numéros trouvés
    - 4 numéros trouvés
    - 5 numéros trouvés
```

### 14.2 Métriques

```txt
hitRate1
hitRate2
hitRate3
hitRate4
hitRate5
maxDrawdown
ROI théorique
variance
nombre de tirages testés
```

### 14.3 Attention

Une stratégie qui marche sur l’historique peut être sur-optimisée. C'est le même protocole que le §13.1 (test d'hypothèses) : ne pas croire un résultat train tant qu'il n'est pas revalidé sur une période non vue.

Il faut donc séparer :

```txt
train period
validation period
test period
```

Exemple :

```txt
2020-2023 : entraînement
2024-2025 : validation
2026 : test
```

---

## 15. Endpoints API recommandés

```txt
GET /loto/draws
GET /loto/draws/latest
GET /loto/draws/:id
GET /loto/stats/frequencies
GET /loto/stats/delays
GET /loto/stats/cooccurrences
GET /loto/odds/edge          -- edge par type de pari (cote officielle vs proba combinatoire)
GET /loto/audit/fairness      -- test d'équité machine (§13.2)
GET /loto/audit/cross-draw    -- test de dépendance inter-tirages (§13.3)
GET /loto/audit/persistence   -- test de persistance tous jeux/délais confondus (§13.4)
GET /loto/grids/generate      -- grille équilibrée aléatoire, non scorée (§13.5)
POST /loto/tracked-numbers   -- enregistrer une grille suivie par l'utilisateur
GET /loto/tracked-numbers/matches
POST /loto/import/official
GET /loto/import/runs
```

### Exemple DTO

```ts
export class GenerateLotoGridDto {
  drawSlug?: string;
  count?: number;
  fromDate?: string;
  toDate?: string;
}
```

Pas de champ `strategy` : la génération est aléatoire sous contraintes d'équilibre, jamais pondérée par un score.

---

## 16. Dashboard recommandé

Les écrans sont ordonnés selon leur rôle produit (voir §20) : accroche, rétention, différenciation.

### Écrans utiles

```txt
1. Résultats du jour + historique                (accroche)
2. Mes numéros suivis + notifications            (accroche)
3. Comparateur de cotes / edge par type de pari   (rétention)
4. Mon budget loto (mise, ROI réel, alertes)      (différenciation)
5. Audit d'équité de la machine                   (différenciation)
6. Dépendance inter-tirages                       (différenciation)
7. Statistiques descriptives (fréquences, retards, cooccurrences) — support, jamais mis en avant comme argument de décision
8. Import / santé des données
9. Backtesting des hypothèses testées
```

### Cartes importantes

```txt
Nombre total de tirages
Dernière synchronisation
Tirages importés aujourd’hui
Tirages rejetés
Numéro le plus fréquent (descriptif)
Numéro le plus en retard (descriptif)
Résultat du dernier audit d'équité (anomalie détectée : oui/non)
ROI réel agrégé des joueurs ayant activé le suivi de budget
```

---

## 17. Qualité des données

### 17.1 Contrôles automatiques

À chaque import :

```txt
vérifier les doublons
vérifier les dates manquantes
vérifier les tirages sans machineNumbers
vérifier les numéros hors plage
vérifier les noms de tirage inconnus
vérifier les changements de checksum
```

### 17.2 Rapport d’import

Exemple :

```json
{
  "source": "official",
  "status": "success",
  "totalFound": 245,
  "inserted": 12,
  "updated": 3,
  "rejected": 0,
  "missingDates": [],
  "unknownDrawNames": []
}
```

---

## 18. Avertissement produit

L’interface doit afficher une mention claire :

```txt
Les analyses proposées sont statistiques et informatives. Elles ne garantissent aucun gain. Le loto reste un jeu de hasard.
```

La LONACI indique dans sa page d’éducation du joueur qu’il n’existe aucun moyen de prédire les numéros qui sortiront. Chaque tirage est réalisé par une machine physique certifiée ISO 9001 / Bureau Veritas, avec 90 boules rechargées à chaque tirage : aucun mécanisme ne relie un tirage au suivant.

Toute théorie de joueur (biais de machine, dépendance entre tirages, etc.) peut être testée honnêtement via le module d'audit (§13) — jamais affirmée sans test, et jamais présentée comme un signal exploitable tant qu'elle n'a pas survécu à une validation hors échantillon.

---

## 19. Roadmap d’implémentation

### Phase 1 — Dataset propre

```txt
Créer modèle Prisma
Créer scraper Playwright
Importer tous les mois disponibles
Valider les données
Exporter CSV/JSON
```

### Phase 2 — Statistiques

```txt
Fréquences globales
Fréquences par tirage
Retards
Paires fréquentes
Numéros chauds/froids
```

### Phase 3 — Edge par type de pari + audit d'équité

```txt
Calcul de la probabilité combinatoire réelle par type de pari (PN, 1N...5N, Turbo, Chance)
Comparaison à la cote officielle -> edge par type de pari
Test d'équité machine (chi², test de série) - §13.2
Test de dépendance inter-tirages (contingence + correction FDR) - §13.3
Test de persistance tous jeux/délais confondus (correction FDR) - §13.4
Générateur de grille équilibrée, non scoré - §13.5
```

### Phase 4 — Backtest et validation des hypothèses

```txt
Split train / validation / test sur tout résultat d'audit
Backtest par tirage
Simulation de mise
Comparaison ROI théorique
Rapport de performance
```

### Phase 5 — Produit

```txt
Mes numéros suivis + notifications (accroche)
Mon budget loto : mise, ROI réel, alertes anti-tilt (différenciation)
Dashboard web
API publique interne
Jobs automatiques
Monitoring import
Alertes Telegram/WhatsApp optionnelles
```

---

## 20. Recommandation finale

La bonne approche est de traiter ce projet comme un mini **EVCore Loto**, mais avec une séparation très claire :

```txt
loto-data
loto-analysis
loto-audit        (équité machine, dépendance inter-tirages)
loto-backtest
loto-dashboard
```

Le cœur de valeur ne sera pas la prédiction, mais un triptyque produit :

```txt
accroche         : résultats fiables + mes numéros suivis + notifications
rétention        : edge réel par type de pari (le seul calcul vraiment fondé)
différenciation  : discipline de mise honnête (ROI réel, même négatif) +
                   audits d'équité et de dépendance publiés, résultat négatif inclus
```

Ce qu'on ne construit délibérément pas : une grille "stratégie" scorée (fréquence + retard + cooccurrence) ou des numéros chauds/froids mis en avant comme argument de décision — ça reproduirait le biais du joueur que la LONACI elle-même déconseille, et ça contredirait la discipline affichée sur l'écran budget. Toute théorie de joueur passe par le protocole de test du §13.1 avant d'être crue ou rejetée.

C’est exactement ce qui peut différencier ton outil des applications loto classiques : les concurrents vendent du signal illusoire, EVCore Loto vend de la transparence vérifiée.
