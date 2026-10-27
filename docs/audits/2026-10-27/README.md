# Audits du 2026-10-27

| Fichier                                                      | Contenu                                                                                                                                                         |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [CONFORMITE-PUBLIQUE.md](CONFORMITE-PUBLIQUE.md)             | Étape 2 du plan produit : landing, inscription, pages légales, SEO, en-têtes de sécurité ; avant/après, bloquants avant promotion.                              |
| [MESURES-HISTORIQUES.md](MESURES-HISTORIQUES.md)             | Étape 3 : Mesures historiques en annoncé/réalisé, par cote et par canal ; retrait du classement des joueurs et des badges de volume ; revue 18/40, avant/après. |
| `captures/avant`, `captures/apres`                           | Pages publiques en 375 et 1280 px, clair et sombre (`apps/web/e2e/captures.spec.ts`, routes publiques sans session).                                            |
| `scripts/`                                                   | Sorties JSON des deux détecteurs, avant et après (`ANONYMOUS=1`).                                                                                               |
| `captures/track-record-avant`, `captures/track-record-apres` | Mesures historiques en 375 et 1280 px, clair et sombre, faux backend `E2E_ROLE=OPERATOR`.                                                                       |
| `scripts/tr-*.json`                                          | Sorties des deux détecteurs sur Mesures historiques, avant et après.                                                                                            |
