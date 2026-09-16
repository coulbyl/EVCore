# Marge par marché et par book

Régénérable : `pnpm --filter @evcore/backtest-core probe:margins`.
Échantillon : 100 rencontres tirées au hasard depuis la base.

La marge est la somme des probabilités implicites des issues complètes d'un
marché, moins 1. C'est le coût d'entrée de chaque jambe, avant tout modèle.
Un groupe d'issues incomplet est ignoré : sommer deux issues sur trois
produirait une marge négative qui n'existe pas.

## Le marché le moins cher, par book le moins cher

| Marché | Book le moins cher | Marge | Lignes | Rencontres |
| --- | --- | --- | --- | --- |
| Odd/Even | SBO | 3.81 % | 22 | 22 |
| Asian Handicap | Pinnacle | 4.26 % | 223 | 24 |
| Goals Over/Under | Pinnacle | 4.63 % | 200 | 24 |
| Match Winner | Pinnacle | 4.84 % | 24 | 24 |
| Double Chance | Betano | 5.05 % | 23 | 23 |
| Total - Home | Pinnacle | 5.35 % | 53 | 24 |
| Goals Over/Under First Half | Pinnacle | 5.36 % | 122 | 24 |
| Total - Away | Pinnacle | 5.39 % | 46 | 24 |
| First Half Winner | Pinnacle | 5.40 % | 24 | 24 |
| Odd/Even - First Half | Bet365 | 5.48 % | 24 | 24 |
| Total Corners (1st Half) | Bet365 | 5.53 % | 25 | 24 |
| Goals Over/Under - Second Half | Bet365 | 5.83 % | 114 | 24 |
| Cards Over/Under | Pinnacle | 6.44 % | 15 | 3 |
| Corners Over Under | Pinnacle | 6.58 % | 104 | 20 |
| Both Teams Score | Bet365 | 7.44 % | 24 | 24 |
| Highest Scoring Half | Bet365 | 9.71 % | 24 | 24 |
| Team To Score First | Marathonbet | 10.94 % | 24 | 24 |

## Détail book x marché

| Book | Marché | Lignes | Rencontres | Marge |
| --- | --- | --- | --- | --- |
| SBO | Odd/Even | 22 | 22 | 3.81 % |
| Bet365 | Odd/Even | 24 | 24 | 4.04 % |
| Pinnacle | Asian Handicap | 223 | 24 | 4.26 % |
| Pinnacle | Goals Over/Under | 200 | 24 | 4.63 % |
| SBO | Asian Handicap | 37 | 21 | 4.77 % |
| Pinnacle | Match Winner | 24 | 24 | 4.84 % |
| Betano | Double Chance | 23 | 23 | 5.05 % |
| SBO | Goals Over/Under | 39 | 22 | 5.27 % |
| Pinnacle | Total - Home | 53 | 24 | 5.35 % |
| Pinnacle | Goals Over/Under First Half | 122 | 24 | 5.36 % |
| Pinnacle | Total - Away | 46 | 24 | 5.39 % |
| Pinnacle | First Half Winner | 24 | 24 | 5.40 % |
| Bet365 | Odd/Even - First Half | 24 | 24 | 5.48 % |
| SBO | Goals Over/Under First Half | 29 | 22 | 5.50 % |
| Bet365 | Total Corners (1st Half) | 25 | 24 | 5.53 % |
| Bet365 | Goals Over/Under | 172 | 24 | 5.60 % |
| Bet365 | Goals Over/Under - Second Half | 114 | 24 | 5.83 % |
| Bet365 | Asian Handicap | 360 | 24 | 5.91 % |
| Bet365 | Total - Away | 102 | 24 | 6.01 % |
| Betano | Asian Handicap | 119 | 23 | 6.05 % |
| Bet365 | Total - Home | 114 | 24 | 6.10 % |
| William Hill | Double Chance | 23 | 23 | 6.11 % |
| Bet365 | Goals Over/Under First Half | 97 | 24 | 6.24 % |
| Betano | Goals Over/Under | 239 | 23 | 6.39 % |
| Pinnacle | Cards Over/Under | 15 | 3 | 6.44 % |
| 888Sport | Total - Home | 17 | 4 | 6.50 % |
| 888Sport | Goals Over/Under | 24 | 4 | 6.56 % |
| Pinnacle | Corners Over Under | 104 | 20 | 6.58 % |
| 888Sport | Total - Away | 18 | 4 | 6.64 % |
| Betano | Goals Over/Under First Half | 158 | 23 | 6.65 % |
| Bet365 | Corners Over Under | 40 | 24 | 6.77 % |
| Betano | Goals Over/Under - Second Half | 60 | 20 | 6.82 % |
| William Hill | Goals Over/Under First Half | 88 | 23 | 6.86 % |
| Bet365 | Double Chance | 24 | 24 | 6.91 % |
| Betano | Total - Away | 86 | 20 | 6.96 % |
| Betano | Total - Home | 96 | 20 | 6.97 % |
| 10Bet | Goals Over/Under | 17 | 4 | 6.99 % |
| William Hill | Goals Over/Under - Second Half | 90 | 22 | 7.03 % |
| Betano | Corners Over Under | 130 | 22 | 7.07 % |
| Betano | Total Corners (1st Half) | 73 | 22 | 7.08 % |
| Betfair | Asian Handicap | 29 | 6 | 7.24 % |
| Betfair | Goals Over/Under | 127 | 22 | 7.31 % |
| 888Sport | Goals Over/Under - Second Half | 15 | 4 | 7.40 % |
| Bet365 | Both Teams Score | 24 | 24 | 7.44 % |
| Betano | Cards Over/Under | 22 | 4 | 7.54 % |
| Betfair | Total - Away | 66 | 19 | 7.60 % |
| Betfair | Total - Home | 72 | 19 | 7.64 % |
| Betano | Match Winner | 23 | 23 | 7.65 % |
| Pinnacle | Total Corners (1st Half) | 57 | 20 | 7.65 % |
| Betfair | Goals Over/Under First Half | 88 | 23 | 7.66 % |
| Betfair | Both Teams Score | 22 | 22 | 7.75 % |
| Betano | Both Teams Score | 20 | 20 | 7.77 % |
| William Hill | Both Teams Score | 23 | 23 | 7.86 % |
| 1xBet | Match Winner | 23 | 23 | 7.89 % |
| Betano | Odd/Even | 23 | 23 | 7.89 % |
| Betfair | Corners Over Under | 35 | 3 | 7.93 % |
| Superbet | Corners Over Under | 20 | 4 | 7.94 % |
| Superbet | Total Corners (1st Half) | 17 | 4 | 7.95 % |
| William Hill | Odd/Even - First Half | 12 | 12 | 7.98 % |
| 1xBet | Goals Over/Under - Second Half | 252 | 23 | 8.10 % |
| 1xBet | Both Teams Score | 23 | 23 | 8.22 % |
| William Hill | Odd/Even | 12 | 12 | 8.25 % |
| Marathonbet | Total - Away | 117 | 24 | 8.25 % |
| Marathonbet | Total - Home | 129 | 24 | 8.29 % |
| 10Bet | Asian Handicap | 5 | 4 | 8.30 % |
| 1xBet | Double Chance | 23 | 23 | 8.33 % |
| Betfair | Double Chance | 23 | 23 | 8.45 % |
| 1xBet | Goals Over/Under First Half | 229 | 23 | 8.46 % |
| Superbet | Total - Home | 15 | 4 | 8.46 % |
| Marathonbet | Double Chance | 24 | 24 | 8.48 % |
| 1xBet | Total - Away | 125 | 23 | 8.58 % |
| 10Bet | Goals Over/Under First Half | 8 | 4 | 8.58 % |
| 1xBet | Total - Home | 140 | 23 | 8.60 % |
| Superbet | Goals Over/Under - Second Half | 14 | 4 | 8.67 % |
| Marathonbet | Match Winner | 24 | 24 | 8.78 % |
| Marathonbet | Goals Over/Under - Second Half | 116 | 24 | 8.79 % |
| Marathonbet | Odd/Even - First Half | 24 | 24 | 8.79 % |
| Superbet | Goals Over/Under | 22 | 4 | 8.80 % |
| 1xBet | Odd/Even - First Half | 23 | 23 | 8.80 % |
| Marathonbet | Odd/Even | 24 | 24 | 8.82 % |
| 1xBet | Odd/Even | 23 | 23 | 8.82 % |
| 10Bet | Total - Home | 10 | 4 | 8.86 % |
| Marathonbet | Goals Over/Under First Half | 114 | 24 | 8.87 % |
| Bet365 | Match Winner | 24 | 24 | 8.88 % |
| 10Bet | Total - Away | 9 | 4 | 8.88 % |
| Superbet | Goals Over/Under First Half | 13 | 4 | 8.93 % |
| Marathonbet | Both Teams Score | 24 | 24 | 8.94 % |
| Superbet | Total - Away | 12 | 4 | 8.98 % |
| Bet365 | First Half Winner | 24 | 24 | 9.05 % |
| BetVictor | Double Chance | 23 | 23 | 9.06 % |
| Betfair | Match Winner | 23 | 23 | 9.08 % |
| 1xBet | Goals Over/Under | 455 | 23 | 9.12 % |
| BetVictor | Odd/Even | 23 | 23 | 9.15 % |
| Unibet | Goals Over/Under | 35 | 4 | 9.15 % |
| Superbet | Asian Handicap | 17 | 4 | 9.17 % |
| Unibet | Corners Over Under | 16 | 4 | 9.20 % |
| Marathonbet | Total Corners (1st Half) | 35 | 20 | 9.20 % |
| Unibet | Goals Over/Under First Half | 10 | 4 | 9.46 % |
| Bet365 | Highest Scoring Half | 24 | 24 | 9.71 % |
| 1xBet | Total Corners (1st Half) | 236 | 19 | 9.81 % |
| 1xBet | Asian Handicap | 367 | 23 | 9.87 % |
| Marathonbet | Goals Over/Under | 405 | 24 | 9.98 % |
| BetVictor | Total - Home | 68 | 23 | 10.00 % |
| Marathonbet | Corners Over Under | 121 | 20 | 10.11 % |
| Marathonbet | Asian Handicap | 363 | 24 | 10.16 % |
| William Hill | Match Winner | 24 | 24 | 10.21 % |
| 1xBet | First Half Winner | 23 | 23 | 10.24 % |
| BetVictor | Match Winner | 23 | 23 | 10.30 % |
| BetVictor | Goals Over/Under | 221 | 23 | 10.32 % |
| BetVictor | Goals Over/Under First Half | 143 | 23 | 10.32 % |
| BetVictor | Total - Away | 61 | 23 | 10.39 % |
| 1xBet | Corners Over Under | 569 | 23 | 10.46 % |
| Unibet | Total - Home | 10 | 4 | 10.49 % |
| BetVictor | Both Teams Score | 23 | 23 | 10.51 % |
| SBO | Double Chance | 22 | 22 | 10.53 % |
| BetVictor | First Half Winner | 23 | 23 | 10.59 % |
| Unibet | Asian Handicap | 12 | 4 | 10.62 % |
| Superbet | Cards Over/Under | 6 | 2 | 10.65 % |
| 1xBet | Highest Scoring Half | 23 | 23 | 10.83 % |
| Betano | First Half Winner | 23 | 23 | 10.84 % |
| Unibet | Total - Away | 11 | 4 | 10.86 % |
| Marathonbet | Team To Score First | 24 | 24 | 10.94 % |
| BetVictor | Asian Handicap | 140 | 23 | 10.97 % |
| Marathonbet | First Half Winner | 24 | 24 | 11.04 % |
| Betfair | First Half Winner | 23 | 23 | 11.34 % |
| Bet365 | Team To Score First | 24 | 24 | 11.38 % |
| William Hill | First Half Winner | 23 | 23 | 11.59 % |
| William Hill | Highest Scoring Half | 12 | 12 | 11.69 % |
| Betano | Highest Scoring Half | 23 | 23 | 13.22 % |
| SBO | Match Winner | 22 | 22 | 13.99 % |
| SBO | First Half Winner | 22 | 22 | 15.32 % |

## Couverture par book

| Book | Marchés servis |
| --- | --- |
| Bet365 | 100 |
| Betano | 88 |
| 1xBet | 83 |
| Marathonbet | 56 |
| Superbet | 51 |
| William Hill | 48 |
| 10Bet | 47 |
| Unibet | 25 |
| Pinnacle | 19 |
| Betfair | 17 |
| BetVictor | 14 |
| SBO | 13 |
| 888Sport | 12 |
| Dafabet | 1 |
