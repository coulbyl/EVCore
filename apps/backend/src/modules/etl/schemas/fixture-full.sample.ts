// Three real entries of API-Football GET /fixtures?ids= (03/11/2026),
// trimmed: a few lineup players and player statistics per team, logos and
// colours removed. 1557450: red card, penalty, VAR cancellations without a
// goal. 1575193: missed penalties and a goal cancelled by VAR that the API
// still lists without a scorer. 1557439: an own goal.

const SAMPLE = {
  get: 'fixtures',
  parameters: {
    ids: '1557450-1575193-1557439',
  },
  errors: [],
  results: 3,
  paging: {
    current: 1,
    total: 1,
  },
  response: [
    {
      fixture: {
        id: 1557450,
        date: '2026-10-31T12:30:00+00:00',
        status: {
          long: 'Match Finished',
          short: 'FT',
          elapsed: 90,
          extra: null,
        },
      },
      league: {
        id: 39,
        name: 'Premier League',
        season: 2026,
      },
      teams: {
        home: {
          id: 49,
          name: 'Chelsea',
        },
        away: {
          id: 33,
          name: 'Manchester United',
        },
      },
      goals: {
        home: 2,
        away: 0,
      },
      score: {
        halftime: {
          home: 0,
          away: 0,
        },
        fulltime: {
          home: 2,
          away: 0,
        },
        extratime: {
          home: null,
          away: null,
        },
        penalty: {
          home: null,
          away: null,
        },
      },
      events: [
        {
          time: {
            elapsed: 34,
            extra: null,
          },
          team: {
            id: 33,
            name: 'Manchester United',
          },
          player: {
            id: 1165,
            name: 'Matheus Cunha',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Var',
          detail: 'Goal cancelled',
          comments: null,
        },
        {
          time: {
            elapsed: 50,
            extra: null,
          },
          team: {
            id: 49,
            name: 'Chelsea',
          },
          player: {
            id: 19170,
            name: 'Morgan Rogers',
          },
          assist: {
            id: 282125,
            name: 'Romeo Lavia',
          },
          type: 'Goal',
          detail: 'Normal Goal',
          comments: null,
        },
        {
          time: {
            elapsed: 58,
            extra: null,
          },
          team: {
            id: 33,
            name: 'Manchester United',
          },
          player: {
            id: 356041,
            name: 'Carlos Baleba',
          },
          assist: {
            id: 284322,
            name: 'Kobbie Mainoo',
          },
          type: 'subst',
          detail: 'Substitution 2',
          comments: null,
        },
        {
          time: {
            elapsed: 59,
            extra: null,
          },
          team: {
            id: 33,
            name: 'Manchester United',
          },
          player: {
            id: 2467,
            name: 'Lisandro Martínez',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Card',
          detail: 'Yellow Card',
          comments: 'Foul',
        },
        {
          time: {
            elapsed: 61,
            extra: null,
          },
          team: {
            id: 49,
            name: 'Chelsea',
          },
          player: {
            id: 22094,
            name: 'Wesley Fofana',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Var',
          detail: 'Penalty confirmed',
          comments: null,
        },
        {
          time: {
            elapsed: 63,
            extra: null,
          },
          team: {
            id: 33,
            name: 'Manchester United',
          },
          player: {
            id: 2467,
            name: 'Lisandro Martínez',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Card',
          detail: 'Red Card',
          comments: null,
        },
        {
          time: {
            elapsed: 64,
            extra: null,
          },
          team: {
            id: 49,
            name: 'Chelsea',
          },
          player: {
            id: 152982,
            name: 'Cole Palmer',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Goal',
          detail: 'Penalty',
          comments: null,
        },
        {
          time: {
            elapsed: 65,
            extra: null,
          },
          team: {
            id: 33,
            name: 'Manchester United',
          },
          player: {
            id: 2935,
            name: 'Harry Maguire',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Card',
          detail: 'Yellow Card',
          comments: 'Foul',
        },
        {
          time: {
            elapsed: 66,
            extra: null,
          },
          team: {
            id: 33,
            name: 'Manchester United',
          },
          player: {
            id: 1165,
            name: 'Matheus Cunha',
          },
          assist: {
            id: 19220,
            name: 'Mason Mount',
          },
          type: 'subst',
          detail: 'Substitution 4',
          comments: null,
        },
        {
          time: {
            elapsed: 70,
            extra: null,
          },
          team: {
            id: 33,
            name: 'Manchester United',
          },
          player: {
            id: 284322,
            name: 'Kobbie Mainoo',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Card',
          detail: 'Yellow Card',
          comments: 'Foul',
        },
        {
          time: {
            elapsed: 71,
            extra: null,
          },
          team: {
            id: 49,
            name: 'Chelsea',
          },
          player: {
            id: 425733,
            name: 'Estêvão Willian Almeida de Oliveira Gonçalves',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Var',
          detail: 'Goal cancelled',
          comments: null,
        },
        {
          time: {
            elapsed: 81,
            extra: null,
          },
          team: {
            id: 33,
            name: 'Manchester United',
          },
          player: {
            id: 20589,
            name: 'Bryan Mbeumo',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Card',
          detail: 'Yellow Card',
          comments: 'Not Retreating',
        },
        {
          time: {
            elapsed: 86,
            extra: null,
          },
          team: {
            id: 33,
            name: 'Manchester United',
          },
          player: {
            id: 70100,
            name: 'Joshua Zirkzee',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Card',
          detail: 'Yellow Card',
          comments: 'Foul',
        },
        {
          time: {
            elapsed: 90,
            extra: 3,
          },
          team: {
            id: 49,
            name: 'Chelsea',
          },
          player: {
            id: 340151,
            name: 'Mike Penders',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Card',
          detail: 'Yellow Card',
          comments: 'Time Wasting',
        },
      ],
      lineups: [
        {
          team: {
            id: 49,
            name: 'Chelsea',
          },
          coach: {
            id: 6801,
            name: 'Xabi Alonso',
          },
          formation: '4-2-3-1',
          startXI: [
            {
              player: {
                id: 340151,
                name: 'M. Penders',
                number: 39,
                pos: 'G',
                grid: '1:1',
              },
            },
            {
              player: {
                id: 366735,
                name: 'Joshua Kofi Acheampong',
                number: 34,
                pos: 'D',
                grid: '2:4',
              },
            },
          ],
          substitutes: [
            {
              player: {
                id: 1469,
                name: 'D. Welbeck',
                number: 18,
                pos: 'F',
                grid: null,
              },
            },
          ],
        },
        {
          team: {
            id: 33,
            name: 'Manchester United',
          },
          coach: {
            id: 16246,
            name: 'M. Carrick',
          },
          formation: '4-2-3-1',
          startXI: [
            {
              player: {
                id: 162511,
                name: 'S. Lammens',
                number: 1,
                pos: 'G',
                grid: '1:1',
              },
            },
            {
              player: {
                id: 342970,
                name: 'L. Yoro',
                number: 15,
                pos: 'D',
                grid: '2:4',
              },
            },
          ],
          substitutes: [
            {
              player: {
                id: 18885,
                name: 'K. Darlow',
                number: 12,
                pos: 'G',
                grid: null,
              },
            },
          ],
        },
      ],
      statistics: [
        {
          team: {
            id: 49,
            name: 'Chelsea',
          },
          statistics: [
            {
              type: 'expected_goals',
              value: '2.71',
            },
            {
              type: 'Passes accurate',
              value: 496,
            },
            {
              type: 'Shots insidebox',
              value: 13,
            },
            {
              type: 'Shots outsidebox',
              value: 6,
            },
            {
              type: 'Blocked Shots',
              value: 3,
            },
            {
              type: 'Free Kicks',
              value: 20,
            },
            {
              type: 'Shots on Goal',
              value: 10,
            },
            {
              type: 'Goalkeeper Saves',
              value: 3,
            },
            {
              type: 'Shots off Goal',
              value: 6,
            },
            {
              type: 'Offsides',
              value: 3,
            },
            {
              type: 'Total passes',
              value: 561,
            },
            {
              type: 'Total Shots',
              value: 19,
            },
            {
              type: 'Yellow Cards',
              value: 1,
            },
            {
              type: 'Corner Kicks',
              value: 8,
            },
            {
              type: 'Red Cards',
              value: 0,
            },
            {
              type: 'Fouls',
              value: 8,
            },
            {
              type: 'Ball Possession',
              value: '59%',
            },
          ],
        },
        {
          team: {
            id: 33,
            name: 'Manchester United',
          },
          statistics: [
            {
              type: 'expected_goals',
              value: '1.19',
            },
            {
              type: 'Passes accurate',
              value: 308,
            },
            {
              type: 'Shots insidebox',
              value: 7,
            },
            {
              type: 'Shots outsidebox',
              value: 5,
            },
            {
              type: 'Blocked Shots',
              value: 3,
            },
            {
              type: 'Free Kicks',
              value: 8,
            },
            {
              type: 'Shots on Goal',
              value: 5,
            },
            {
              type: 'Goalkeeper Saves',
              value: 8,
            },
            {
              type: 'Shots off Goal',
              value: 4,
            },
            {
              type: 'Offsides',
              value: 2,
            },
            {
              type: 'Total passes',
              value: 396,
            },
            {
              type: 'Total Shots',
              value: 12,
            },
            {
              type: 'Yellow Cards',
              value: 4,
            },
            {
              type: 'Corner Kicks',
              value: 7,
            },
            {
              type: 'Red Cards',
              value: 1,
            },
            {
              type: 'Fouls',
              value: 20,
            },
            {
              type: 'Ball Possession',
              value: '41%',
            },
          ],
        },
      ],
      players: [
        {
          team: {
            id: 33,
            name: 'Manchester United',
          },
          players: [
            {
              player: {
                id: 1165,
                name: 'Matheus Cunha',
                photo: 'https://media.api-sports.io/football/players/1165.png',
              },
              statistics: [
                {
                  games: {
                    minutes: 66,
                    number: 10,
                    position: 'M',
                    rating: '5.8',
                    captain: false,
                    substitute: false,
                  },
                  offsides: 1,
                  shots: {
                    total: 1,
                    on: 1,
                  },
                  goals: {
                    total: 0,
                    conceded: null,
                    assists: 0,
                    saves: 0,
                  },
                  passes: {
                    total: 27,
                    key: 1,
                    accuracy: '20',
                  },
                  tackles: {
                    total: 3,
                    blocks: 0,
                    interceptions: 1,
                  },
                  duels: {
                    total: 13,
                    won: 7,
                  },
                  dribbles: {
                    attempts: 2,
                    success: 1,
                    past: null,
                  },
                  fouls: {
                    drawn: 2,
                    committed: 1,
                  },
                  cards: {
                    yellow: 0,
                    red: 0,
                  },
                  penalty: {
                    won: null,
                    commited: null,
                    scored: 0,
                    missed: null,
                    saved: null,
                  },
                },
              ],
            },
            {
              player: {
                id: 70100,
                name: 'J. Zirkzee',
                photo: 'https://media.api-sports.io/football/players/70100.png',
              },
              statistics: [
                {
                  games: {
                    minutes: 13,
                    number: 11,
                    position: 'F',
                    rating: '6.25',
                    captain: false,
                    substitute: false,
                  },
                  offsides: 0,
                  shots: {
                    total: 2,
                    on: 1,
                  },
                  goals: {
                    total: 0,
                    conceded: null,
                    assists: 0,
                    saves: 0,
                  },
                  passes: {
                    total: 1,
                    key: 0,
                    accuracy: '1',
                  },
                  tackles: {
                    total: 0,
                    blocks: 1,
                    interceptions: 0,
                  },
                  duels: {
                    total: 5,
                    won: 1,
                  },
                  dribbles: {
                    attempts: 1,
                    success: 0,
                    past: null,
                  },
                  fouls: {
                    drawn: 1,
                    committed: 2,
                  },
                  cards: {
                    yellow: 1,
                    red: 0,
                  },
                  penalty: {
                    won: null,
                    commited: null,
                    scored: 0,
                    missed: null,
                    saved: null,
                  },
                },
              ],
            },
          ],
        },
        {
          team: {
            id: 49,
            name: 'Chelsea',
          },
          players: [
            {
              player: {
                id: 366735,
                name: 'Joshua Kofi Acheampong',
                photo:
                  'https://media.api-sports.io/football/players/366735.png',
              },
              statistics: [
                {
                  games: {
                    minutes: 90,
                    number: 34,
                    position: 'D',
                    rating: '7.2',
                    captain: false,
                    substitute: false,
                  },
                  offsides: 0,
                  shots: {
                    total: 2,
                    on: 1,
                  },
                  goals: {
                    total: 0,
                    conceded: null,
                    assists: 0,
                    saves: 0,
                  },
                  passes: {
                    total: 65,
                    key: 0,
                    accuracy: '60',
                  },
                  tackles: {
                    total: 4,
                    blocks: 1,
                    interceptions: 1,
                  },
                  duels: {
                    total: 10,
                    won: 7,
                  },
                  dribbles: {
                    attempts: 2,
                    success: 1,
                    past: null,
                  },
                  fouls: {
                    drawn: 1,
                    committed: 0,
                  },
                  cards: {
                    yellow: 0,
                    red: 0,
                  },
                  penalty: {
                    won: null,
                    commited: null,
                    scored: 0,
                    missed: null,
                    saved: null,
                  },
                },
              ],
            },
            {
              player: {
                id: 152953,
                name: 'L. Colwill',
                photo:
                  'https://media.api-sports.io/football/players/152953.png',
              },
              statistics: [
                {
                  games: {
                    minutes: 90,
                    number: 6,
                    position: 'D',
                    rating: '7.16',
                    captain: false,
                    substitute: false,
                  },
                  offsides: 0,
                  shots: {
                    total: 0,
                    on: 0,
                  },
                  goals: {
                    total: 0,
                    conceded: null,
                    assists: 0,
                    saves: 0,
                  },
                  passes: {
                    total: 66,
                    key: 1,
                    accuracy: '61',
                  },
                  tackles: {
                    total: 1,
                    blocks: 0,
                    interceptions: 1,
                  },
                  duels: {
                    total: 9,
                    won: 6,
                  },
                  dribbles: {
                    attempts: 0,
                    success: 0,
                    past: null,
                  },
                  fouls: {
                    drawn: 1,
                    committed: 2,
                  },
                  cards: {
                    yellow: 0,
                    red: 0,
                  },
                  penalty: {
                    won: null,
                    commited: null,
                    scored: 0,
                    missed: null,
                    saved: null,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    {
      fixture: {
        id: 1575193,
        date: '2026-10-17T13:30:00+00:00',
        status: {
          long: 'Match Finished',
          short: 'FT',
          elapsed: 90,
          extra: null,
        },
      },
      league: {
        id: 78,
        name: 'Bundesliga',
        season: 2026,
      },
      teams: {
        home: {
          id: 1660,
          name: 'SV Elversberg',
        },
        away: {
          id: 170,
          name: 'FC Augsburg',
        },
      },
      goals: {
        home: 4,
        away: 3,
      },
      score: {
        halftime: {
          home: 3,
          away: 1,
        },
        fulltime: {
          home: 4,
          away: 3,
        },
        extratime: {
          home: null,
          away: null,
        },
        penalty: {
          home: null,
          away: null,
        },
      },
      events: [
        {
          time: {
            elapsed: 2,
            extra: null,
          },
          team: {
            id: 1660,
            name: 'SV Elversberg',
          },
          player: {
            id: 162079,
            name: 'Lasse Günther',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Var',
          detail: 'Penalty confirmed',
          comments: null,
        },
        {
          time: {
            elapsed: 4,
            extra: null,
          },
          team: {
            id: 1660,
            name: 'SV Elversberg',
          },
          player: {
            id: 177452,
            name: 'Lukas Petkov',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Goal',
          detail: 'Missed Penalty',
          comments: null,
        },
        {
          time: {
            elapsed: 4,
            extra: null,
          },
          team: {
            id: 1660,
            name: 'SV Elversberg',
          },
          player: {
            id: 177452,
            name: 'L. Petkov',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Goal',
          detail: 'Normal Goal',
          comments: null,
        },
        {
          time: {
            elapsed: 7,
            extra: null,
          },
          team: {
            id: 1660,
            name: 'SV Elversberg',
          },
          player: {
            id: 162079,
            name: 'L. Gunther',
          },
          assist: {
            id: 342170,
            name: 'M. Krattenmacher',
          },
          type: 'Goal',
          detail: 'Normal Goal',
          comments: null,
        },
        {
          time: {
            elapsed: 28,
            extra: null,
          },
          team: {
            id: 1660,
            name: 'SV Elversberg',
          },
          player: {
            id: 126951,
            name: 'M. Rohr',
          },
          assist: {
            id: 280070,
            name: 'F. Keidel',
          },
          type: 'Goal',
          detail: 'Normal Goal',
          comments: null,
        },
        {
          time: {
            elapsed: 30,
            extra: null,
          },
          team: {
            id: 170,
            name: 'FC Augsburg',
          },
          player: {
            id: 341641,
            name: 'Rodrigo Ribeiro',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Card',
          detail: 'Yellow Card',
          comments: 'Foul',
        },
        {
          time: {
            elapsed: 30,
            extra: null,
          },
          team: {
            id: 170,
            name: 'FC Augsburg',
          },
          player: {
            id: 110,
            name: 'Han-Noah Massengo',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Card',
          detail: 'Yellow Card',
          comments: 'Foul',
        },
        {
          time: {
            elapsed: 40,
            extra: null,
          },
          team: {
            id: 1660,
            name: 'SV Elversberg',
          },
          player: {
            id: 25063,
            name: 'J. Gyamerah',
          },
          assist: {
            id: 177509,
            name: 'L. Sirch',
          },
          type: 'subst',
          detail: 'Substitution 1',
          comments: null,
        },
        {
          time: {
            elapsed: 40,
            extra: null,
          },
          team: {
            id: 1660,
            name: 'SV Elversberg',
          },
          player: {
            id: 412704,
            name: 'N. Darvich',
          },
          assist: {
            id: 203260,
            name: 'F. Schmahl',
          },
          type: 'subst',
          detail: 'Substitution 2',
          comments: null,
        },
        {
          time: {
            elapsed: 45,
            extra: 7,
          },
          team: {
            id: 170,
            name: 'FC Augsburg',
          },
          player: {
            id: 26,
            name: 'Marius Wolf',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Var',
          detail: 'Penalty confirmed',
          comments: null,
        },
        {
          time: {
            elapsed: 45,
            extra: null,
          },
          team: {
            id: 170,
            name: 'FC Augsburg',
          },
          player: {
            id: 163032,
            name: 'F. Rieder',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Goal',
          detail: 'Penalty',
          comments: null,
        },
        {
          time: {
            elapsed: 52,
            extra: null,
          },
          team: {
            id: 170,
            name: 'FC Augsburg',
          },
          player: {
            id: 163039,
            name: 'Chrislain Matsima',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Card',
          detail: 'Yellow Card',
          comments: 'Foul',
        },
        {
          time: {
            elapsed: 54,
            extra: null,
          },
          team: {
            id: 1660,
            name: 'SV Elversberg',
          },
          player: {
            id: 280070,
            name: 'Felix Keidel',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Card',
          detail: 'Yellow Card',
          comments: 'Time wasting',
        },
        {
          time: {
            elapsed: 75,
            extra: null,
          },
          team: {
            id: 1660,
            name: 'SV Elversberg',
          },
          player: {
            id: 177731,
            name: 'Lukas Finn Pinckert',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Card',
          detail: 'Yellow Card',
          comments: 'Foul',
        },
        {
          time: {
            elapsed: 76,
            extra: null,
          },
          team: {
            id: 170,
            name: 'FC Augsburg',
          },
          player: {
            id: 25297,
            name: 'M. Gregoritsch',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Goal',
          detail: 'Penalty',
          comments: null,
        },
        {
          time: {
            elapsed: 79,
            extra: null,
          },
          team: {
            id: 1660,
            name: 'SV Elversberg',
          },
          player: {
            id: 554307,
            name: 'Raif Adam',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Var',
          detail: 'Goal cancelled',
          comments: null,
        },
        {
          time: {
            elapsed: 84,
            extra: null,
          },
          team: {
            id: 1660,
            name: 'SV Elversberg',
          },
          player: {
            id: 178194,
            name: 'Nicolas Kristof',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Card',
          detail: 'Yellow Card',
          comments: 'Argument',
        },
        {
          time: {
            elapsed: 87,
            extra: null,
          },
          team: {
            id: 170,
            name: 'FC Augsburg',
          },
          player: {
            id: 25297,
            name: 'Michael Gregoritsch',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Var',
          detail: 'Penalty cancelled',
          comments: null,
        },
        {
          time: {
            elapsed: 87,
            extra: null,
          },
          team: {
            id: 170,
            name: 'FC Augsburg',
          },
          player: {
            id: null,
            name: null,
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Goal',
          detail: 'Normal Goal',
          comments: null,
        },
        {
          time: {
            elapsed: 89,
            extra: null,
          },
          team: {
            id: 1660,
            name: 'SV Elversberg',
          },
          player: {
            id: 203260,
            name: 'F. Schmahl',
          },
          assist: {
            id: 177452,
            name: 'L. Petkov',
          },
          type: 'Goal',
          detail: 'Normal Goal',
          comments: null,
        },
        {
          time: {
            elapsed: 90,
            extra: 8,
          },
          team: {
            id: 1660,
            name: 'SV Elversberg',
          },
          player: {
            id: 196500,
            name: 'Noel Futkeu',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Goal',
          detail: 'Missed Penalty',
          comments: null,
        },
        {
          time: {
            elapsed: 90,
            extra: 6,
          },
          team: {
            id: 1660,
            name: 'SV Elversberg',
          },
          player: {
            id: 203260,
            name: 'Frederik Schmahl',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Card',
          detail: 'Yellow Card',
          comments: 'Foul',
        },
        {
          time: {
            elapsed: 90,
            extra: null,
          },
          team: {
            id: 170,
            name: 'FC Augsburg',
          },
          player: {
            id: 348888,
            name: 'M. Komur',
          },
          assist: {
            id: 353143,
            name: 'H. Behrens',
          },
          type: 'Goal',
          detail: 'Normal Goal',
          comments: null,
        },
      ],
      lineups: [
        {
          team: {
            id: 1660,
            name: 'SV Elversberg',
          },
          coach: {
            id: 15522,
            name: 'Vincent Wagner',
          },
          formation: '4-2-3-1',
          startXI: [
            {
              player: {
                id: 178194,
                name: 'N. Kristof',
                number: 20,
                pos: 'G',
                grid: '1:1',
              },
            },
            {
              player: {
                id: 25063,
                name: 'J. Gyamerah',
                number: 30,
                pos: 'D',
                grid: '2:4',
              },
            },
          ],
          substitutes: [
            {
              player: {
                id: 25113,
                name: 'T. Boss',
                number: 28,
                pos: 'G',
                grid: null,
              },
            },
          ],
        },
        {
          team: {
            id: 170,
            name: 'FC Augsburg',
          },
          coach: {
            id: 28454,
            name: 'Manuel Baum',
          },
          formation: '3-4-2-1',
          startXI: [
            {
              player: {
                id: 25903,
                name: 'F. Dahmen',
                number: 1,
                pos: 'G',
                grid: '1:1',
              },
            },
            {
              player: {
                id: 449509,
                name: 'J. Bah',
                number: 35,
                pos: 'D',
                grid: '2:3',
              },
            },
          ],
          substitutes: [
            {
              player: {
                id: 14553,
                name: 'N. Labrovic',
                number: 22,
                pos: 'G',
                grid: null,
              },
            },
          ],
        },
      ],
      statistics: [
        {
          team: {
            id: 1660,
            name: 'SV Elversberg',
          },
          statistics: [
            {
              type: 'Shots on Goal',
              value: 8,
            },
            {
              type: 'Shots off Goal',
              value: 4,
            },
            {
              type: 'Total Shots',
              value: 19,
            },
            {
              type: 'Blocked Shots',
              value: 7,
            },
            {
              type: 'Shots insidebox',
              value: 17,
            },
            {
              type: 'Shots outsidebox',
              value: 2,
            },
            {
              type: 'Fouls',
              value: 16,
            },
            {
              type: 'Corner Kicks',
              value: 4,
            },
            {
              type: 'Offsides',
              value: 3,
            },
            {
              type: 'Ball Possession',
              value: '40%',
            },
            {
              type: 'Yellow Cards',
              value: 4,
            },
            {
              type: 'Red Cards',
              value: null,
            },
            {
              type: 'Goalkeeper Saves',
              value: 5,
            },
            {
              type: 'Total passes',
              value: 325,
            },
            {
              type: 'Passes accurate',
              value: 250,
            },
            {
              type: 'Passes %',
              value: '77%',
            },
            {
              type: 'expected_goals',
              value: '3.78',
            },
            {
              type: 'goals_prevented',
              value: '0.33',
            },
          ],
        },
        {
          team: {
            id: 170,
            name: 'FC Augsburg',
          },
          statistics: [
            {
              type: 'Shots on Goal',
              value: 8,
            },
            {
              type: 'Shots off Goal',
              value: 9,
            },
            {
              type: 'Total Shots',
              value: 29,
            },
            {
              type: 'Blocked Shots',
              value: 12,
            },
            {
              type: 'Shots insidebox',
              value: 26,
            },
            {
              type: 'Shots outsidebox',
              value: 3,
            },
            {
              type: 'Fouls',
              value: 14,
            },
            {
              type: 'Corner Kicks',
              value: 12,
            },
            {
              type: 'Offsides',
              value: 2,
            },
            {
              type: 'Ball Possession',
              value: '60%',
            },
            {
              type: 'Yellow Cards',
              value: 3,
            },
            {
              type: 'Red Cards',
              value: null,
            },
            {
              type: 'Goalkeeper Saves',
              value: 4,
            },
            {
              type: 'Total passes',
              value: 468,
            },
            {
              type: 'Passes accurate',
              value: 381,
            },
            {
              type: 'Passes %',
              value: '81%',
            },
            {
              type: 'expected_goals',
              value: '3.92',
            },
            {
              type: 'goals_prevented',
              value: '0.33',
            },
          ],
        },
      ],
      players: [
        {
          team: {
            id: 1660,
            name: 'SV Elversberg',
          },
          players: [
            {
              player: {
                id: 178194,
                name: 'Nicolas Kristof',
                photo:
                  'https://media.api-sports.io/football/players/178194.png',
              },
              statistics: [
                {
                  games: {
                    minutes: 90,
                    number: 20,
                    position: 'G',
                    rating: '6.6',
                    captain: false,
                    substitute: false,
                  },
                  offsides: null,
                  shots: {
                    total: null,
                    on: null,
                  },
                  goals: {
                    total: null,
                    conceded: 3,
                    assists: 0,
                    saves: 5,
                  },
                  passes: {
                    total: 45,
                    key: null,
                    accuracy: '35',
                  },
                  tackles: {
                    total: null,
                    blocks: null,
                    interceptions: null,
                  },
                  duels: {
                    total: 1,
                    won: 1,
                  },
                  dribbles: {
                    attempts: null,
                    success: null,
                    past: null,
                  },
                  fouls: {
                    drawn: null,
                    committed: null,
                  },
                  cards: {
                    yellow: 1,
                    red: 0,
                  },
                  penalty: {
                    won: null,
                    commited: null,
                    scored: 0,
                    missed: 0,
                    saved: 0,
                  },
                },
              ],
            },
            {
              player: {
                id: 25063,
                name: 'Jan Gyamerah',
                photo: 'https://media.api-sports.io/football/players/25063.png',
              },
              statistics: [
                {
                  games: {
                    minutes: 40,
                    number: 30,
                    position: 'D',
                    rating: '6.9',
                    captain: false,
                    substitute: false,
                  },
                  offsides: null,
                  shots: {
                    total: null,
                    on: null,
                  },
                  goals: {
                    total: null,
                    conceded: 0,
                    assists: 0,
                    saves: null,
                  },
                  passes: {
                    total: 9,
                    key: 1,
                    accuracy: '8',
                  },
                  tackles: {
                    total: 1,
                    blocks: null,
                    interceptions: 1,
                  },
                  duels: {
                    total: 4,
                    won: 2,
                  },
                  dribbles: {
                    attempts: null,
                    success: null,
                    past: 1,
                  },
                  fouls: {
                    drawn: null,
                    committed: 1,
                  },
                  cards: {
                    yellow: 0,
                    red: 0,
                  },
                  penalty: {
                    won: null,
                    commited: null,
                    scored: 0,
                    missed: 0,
                    saved: null,
                  },
                },
              ],
            },
          ],
        },
        {
          team: {
            id: 170,
            name: 'FC Augsburg',
          },
          players: [
            {
              player: {
                id: 25903,
                name: 'Finn Dahmen',
                photo: 'https://media.api-sports.io/football/players/25903.png',
              },
              statistics: [
                {
                  games: {
                    minutes: 90,
                    number: 1,
                    position: 'G',
                    rating: '7.3',
                    captain: false,
                    substitute: false,
                  },
                  offsides: null,
                  shots: {
                    total: null,
                    on: null,
                  },
                  goals: {
                    total: null,
                    conceded: 4,
                    assists: 0,
                    saves: 4,
                  },
                  passes: {
                    total: 34,
                    key: null,
                    accuracy: '29',
                  },
                  tackles: {
                    total: null,
                    blocks: null,
                    interceptions: null,
                  },
                  duels: {
                    total: null,
                    won: null,
                  },
                  dribbles: {
                    attempts: null,
                    success: null,
                    past: null,
                  },
                  fouls: {
                    drawn: null,
                    committed: null,
                  },
                  cards: {
                    yellow: 0,
                    red: 0,
                  },
                  penalty: {
                    won: null,
                    commited: null,
                    scored: 0,
                    missed: 0,
                    saved: 1,
                  },
                },
              ],
            },
            {
              player: {
                id: 449509,
                name: 'Abdulai Juma Bah',
                photo:
                  'https://media.api-sports.io/football/players/449509.png',
              },
              statistics: [
                {
                  games: {
                    minutes: 45,
                    number: 35,
                    position: 'D',
                    rating: '5.9',
                    captain: false,
                    substitute: false,
                  },
                  offsides: null,
                  shots: {
                    total: 1,
                    on: null,
                  },
                  goals: {
                    total: null,
                    conceded: 0,
                    assists: 0,
                    saves: null,
                  },
                  passes: {
                    total: 28,
                    key: null,
                    accuracy: '27',
                  },
                  tackles: {
                    total: 1,
                    blocks: null,
                    interceptions: null,
                  },
                  duels: {
                    total: 7,
                    won: 4,
                  },
                  dribbles: {
                    attempts: 1,
                    success: 1,
                    past: null,
                  },
                  fouls: {
                    drawn: 1,
                    committed: 2,
                  },
                  cards: {
                    yellow: 0,
                    red: 0,
                  },
                  penalty: {
                    won: null,
                    commited: null,
                    scored: 0,
                    missed: 0,
                    saved: null,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    {
      fixture: {
        id: 1557439,
        date: '2026-10-24T16:30:00+00:00',
        status: {
          long: 'Match Finished',
          short: 'FT',
          elapsed: 90,
          extra: null,
        },
      },
      league: {
        id: 39,
        name: 'Premier League',
        season: 2026,
      },
      teams: {
        home: {
          id: 49,
          name: 'Chelsea',
        },
        away: {
          id: 47,
          name: 'Tottenham',
        },
      },
      goals: {
        home: 0,
        away: 2,
      },
      score: {
        halftime: {
          home: 0,
          away: 0,
        },
        fulltime: {
          home: 0,
          away: 2,
        },
        extratime: {
          home: null,
          away: null,
        },
        penalty: {
          home: null,
          away: null,
        },
      },
      events: [
        {
          time: {
            elapsed: 67,
            extra: null,
          },
          team: {
            id: 47,
            name: 'Tottenham',
          },
          player: {
            id: 67972,
            name: 'Conor Gallagher',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Card',
          detail: 'Yellow Card',
          comments: 'Foul',
        },
        {
          time: {
            elapsed: 71,
            extra: null,
          },
          team: {
            id: 49,
            name: 'Chelsea',
          },
          player: {
            id: 152982,
            name: 'Cole Palmer',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Card',
          detail: 'Yellow Card',
          comments: 'Argument',
        },
        {
          time: {
            elapsed: 71,
            extra: null,
          },
          team: {
            id: 47,
            name: 'Tottenham',
          },
          player: {
            id: 336585,
            name: 'Mateus Fernandes',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Card',
          detail: 'Yellow Card',
          comments: 'Handball',
        },
        {
          time: {
            elapsed: 71,
            extra: null,
          },
          team: {
            id: 47,
            name: 'Tottenham',
          },
          player: {
            id: 152849,
            name: 'Micky van de Ven',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Card',
          detail: 'Yellow Card',
          comments: 'Foul',
        },
        {
          time: {
            elapsed: 77,
            extra: null,
          },
          team: {
            id: 47,
            name: 'Tottenham',
          },
          player: {
            id: 340151,
            name: 'Mike Penders',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Goal',
          detail: 'Own Goal',
          comments: null,
        },
        {
          time: {
            elapsed: 79,
            extra: null,
          },
          team: {
            id: 49,
            name: 'Chelsea',
          },
          player: {
            id: 1864,
            name: 'Pedro Neto',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Card',
          detail: 'Yellow Card',
          comments: 'Foul',
        },
        {
          time: {
            elapsed: 80,
            extra: null,
          },
          team: {
            id: 49,
            name: 'Chelsea',
          },
          player: {
            id: 152982,
            name: 'Cole Palmer',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Card',
          detail: 'Yellow Card',
          comments: 'Foul',
        },
        {
          time: {
            elapsed: 80,
            extra: null,
          },
          team: {
            id: 49,
            name: 'Chelsea',
          },
          player: {
            id: 152982,
            name: 'Cole Palmer',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Card',
          detail: 'Red Card',
          comments: 'Foul',
        },
        {
          time: {
            elapsed: 87,
            extra: null,
          },
          team: {
            id: 47,
            name: 'Tottenham',
          },
          player: {
            id: 270510,
            name: 'Mathys Tel',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Goal',
          detail: 'Normal Goal',
          comments: null,
        },
        {
          time: {
            elapsed: 90,
            extra: 1,
          },
          team: {
            id: 49,
            name: 'Chelsea',
          },
          player: {
            id: 19170,
            name: 'Morgan Rogers',
          },
          assist: {
            id: null,
            name: null,
          },
          type: 'Card',
          detail: 'Yellow Card',
          comments: 'Foul',
        },
      ],
      lineups: [
        {
          team: {
            id: 49,
            name: 'Chelsea',
          },
          coach: {
            id: 6801,
            name: 'Xabi Alonso',
          },
          formation: '4-2-3-1',
          startXI: [
            {
              player: {
                id: 340151,
                name: 'Mike Penders',
                number: 39,
                pos: 'G',
                grid: '1:1',
              },
            },
          ],
          substitutes: [],
        },
        {
          team: {
            id: 47,
            name: 'Tottenham',
          },
          coach: {
            id: 2424,
            name: 'R. De Zerbi',
          },
          formation: '4-2-3-1',
          startXI: [
            {
              player: {
                id: 265826,
                name: 'Antonín Kinský',
                number: 31,
                pos: 'G',
                grid: '1:1',
              },
            },
          ],
          substitutes: [],
        },
      ],
      statistics: [
        {
          team: {
            id: 49,
            name: 'Chelsea',
          },
          statistics: [
            {
              type: 'Shots on Goal',
              value: 4,
            },
            {
              type: 'Shots off Goal',
              value: 1,
            },
            {
              type: 'Total Shots',
              value: 7,
            },
            {
              type: 'Blocked Shots',
              value: 2,
            },
            {
              type: 'Shots insidebox',
              value: 6,
            },
            {
              type: 'Shots outsidebox',
              value: 1,
            },
            {
              type: 'Fouls',
              value: 14,
            },
            {
              type: 'Corner Kicks',
              value: 4,
            },
            {
              type: 'Offsides',
              value: 2,
            },
            {
              type: 'Ball Possession',
              value: '31%',
            },
            {
              type: 'Yellow Cards',
              value: 4,
            },
            {
              type: 'Red Cards',
              value: 1,
            },
            {
              type: 'Goalkeeper Saves',
              value: 3,
            },
            {
              type: 'Total passes',
              value: 288,
            },
            {
              type: 'Passes accurate',
              value: 215,
            },
            {
              type: 'Passes %',
              value: '75%',
            },
            {
              type: 'expected_goals',
              value: '0.47',
            },
            {
              type: 'goals_prevented',
              value: '0.35',
            },
          ],
        },
        {
          team: {
            id: 47,
            name: 'Tottenham',
          },
          statistics: [
            {
              type: 'Shots on Goal',
              value: 4,
            },
            {
              type: 'Shots off Goal',
              value: 4,
            },
            {
              type: 'Total Shots',
              value: 15,
            },
            {
              type: 'Blocked Shots',
              value: 7,
            },
            {
              type: 'Shots insidebox',
              value: 8,
            },
            {
              type: 'Shots outsidebox',
              value: 7,
            },
            {
              type: 'Fouls',
              value: 14,
            },
            {
              type: 'Corner Kicks',
              value: 6,
            },
            {
              type: 'Offsides',
              value: 1,
            },
            {
              type: 'Ball Possession',
              value: '69%',
            },
            {
              type: 'Yellow Cards',
              value: 3,
            },
            {
              type: 'Red Cards',
              value: 0,
            },
            {
              type: 'Goalkeeper Saves',
              value: 4,
            },
            {
              type: 'Total passes',
              value: 654,
            },
            {
              type: 'Passes accurate',
              value: 569,
            },
            {
              type: 'Passes %',
              value: '87%',
            },
            {
              type: 'expected_goals',
              value: '0.74',
            },
            {
              type: 'goals_prevented',
              value: '0.35',
            },
          ],
        },
      ],
      players: [
        {
          team: {
            id: 49,
            name: 'Chelsea',
          },
          players: [
            {
              player: {
                id: 340151,
                name: 'Mike Penders',
                photo:
                  'https://media.api-sports.io/football/players/340151.png',
              },
              statistics: [
                {
                  games: {
                    minutes: 90,
                    number: 39,
                    position: 'G',
                    rating: '5.3',
                    captain: false,
                    substitute: false,
                  },
                  offsides: 0,
                  shots: {
                    total: null,
                    on: 0,
                  },
                  goals: {
                    total: 0,
                    conceded: 2,
                    assists: 0,
                    saves: 3,
                  },
                  passes: {
                    total: 38,
                    key: null,
                    accuracy: '20',
                  },
                  tackles: {
                    total: 0,
                    blocks: 0,
                    interceptions: 0,
                  },
                  duels: {
                    total: 1,
                    won: 1,
                  },
                  dribbles: {
                    attempts: 0,
                    success: 0,
                    past: 0,
                  },
                  fouls: {
                    drawn: 0,
                    committed: 0,
                  },
                  cards: {
                    yellow: 0,
                    red: 0,
                  },
                  penalty: {
                    won: 0,
                    commited: 0,
                    scored: 0,
                    missed: 0,
                    saved: 0,
                  },
                },
              ],
            },
          ],
        },
        {
          team: {
            id: 47,
            name: 'Tottenham',
          },
          players: [
            {
              player: {
                id: 265826,
                name: 'Antonín Kinský',
                photo:
                  'https://media.api-sports.io/football/players/265826.png',
              },
              statistics: [
                {
                  games: {
                    minutes: 90,
                    number: 31,
                    position: 'G',
                    rating: '7.2',
                    captain: false,
                    substitute: false,
                  },
                  offsides: 0,
                  shots: {
                    total: null,
                    on: 0,
                  },
                  goals: {
                    total: 0,
                    conceded: 0,
                    assists: 0,
                    saves: 4,
                  },
                  passes: {
                    total: 49,
                    key: null,
                    accuracy: '36',
                  },
                  tackles: {
                    total: 0,
                    blocks: 0,
                    interceptions: 0,
                  },
                  duels: {
                    total: null,
                    won: 0,
                  },
                  dribbles: {
                    attempts: 0,
                    success: 0,
                    past: 0,
                  },
                  fouls: {
                    drawn: 0,
                    committed: 0,
                  },
                  cards: {
                    yellow: 0,
                    red: 0,
                  },
                  penalty: {
                    won: 0,
                    commited: 0,
                    scored: 0,
                    missed: 0,
                    saved: 0,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

export type FixturesByIdsSample = typeof SAMPLE;

/** A fresh copy, free to mutate in a test. */
export function fixturesByIdsSample(): FixturesByIdsSample {
  return structuredClone(SAMPLE);
}
