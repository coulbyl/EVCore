# Première lecture après déploiement (dump de production du 2026-10-16)

Quatre à six jours de données selon le produit : une première lecture,
pas une conclusion. Les chiffres sont donnés avec leur taille d'échantillon ;
aucun ROI, à ces volumes il n'a pas de puissance (CLAUDE.md).

## 1. Les coupons, jour par jour (depuis le 2026-10-11)

| Produit                            | Jours réglés | Jours gagnés | Jambes réglées | Réel / annoncé (jambes) | Cote moy. |
| ---------------------------------- | -----------: | -----------: | -------------: | ----------------------- | --------: |
| Pari sûr du jour (favori, 1 jambe) |            4 |        **4** |          4 / 4 | 1,00 / 0,85             |      1,18 |
| Combiné du jour (moteur, 3 jambes) |            4 |        **3** |        11 / 12 | 0,92 / 0,85             |      1,40 |
| Combiné Analyse IA (LLM, 3 jambes) |            2 |        **2** |          6 / 6 | 1,00 / 0,83             |      1,68 |
| Coupon long 5–15 (prix)            |            6 |        **0** |         2 / 12 | 0,17 / 0,38             |      6,15 |
| Coupon long 5–15 (LLM, dernier)    |            1 |            0 |          2 / 4 | —                       |      6,46 |

Le coupon long fait exactement ce que l'arithmétique prévoit (un jour sur
sept au mieux). Les trois produits courts gagnent presque tous les jours,
avec des jambes qui réalisent au moins ce qu'elles annoncent — sur 4 à 12
jambes, ce qui ne prouve rien encore mais ne contredit rien.

Les cartes affichent l'historique réel dès cinq jours réglés : le pari sûr
et le coupon long l'ont déjà, les combinés l'auront ce week-end.

## 2. VANTAGE v4 (depuis le 2026-10-13)

| Mesure                                          |                             v4 |      Avant (v3) |
| ----------------------------------------------- | -----------------------------: | --------------: |
| Décisions                                       |                            176 |               — |
| Taux de « play »                                |                       **79 %** |         70–86 % |
| Avis au-dessus de cote 1,80                     | **0** (aucun refus nécessaire) | ~45 % du volume |
| Textes avec un code, « canal » ou un ratio brut |                    **0 / 139** |         24–36 % |
| Réel / annoncé, cote < 1,50 (n = 42)            |                           0,90 |            0,98 |
| Réel / annoncé, cote 1,50–1,80 (n = 35)         |                           0,92 |            0,94 |

Ce qui a marché : le bloc de contraintes avant les chiffres. Le modèle ne
propose plus rien au-dessus de 1,80, le plafond n'a jamais eu à refuser.
Le nettoyage du texte est complet. Par base déclarée : tension 36 avis
(0,94), statistiques brutes 25 (0,88), lecture proche du seuil 17 (0,85) —
trop tôt pour départager.

Ce qui n'a pas marché : le budget « trois sur dix ». Le modèle joue encore
quatre matchs sur cinq. La consigne chiffrée ne suffit pas ; si le taux
reste là dans deux semaines, il faudra un plafond déterministe par journée
(garder les N avis les mieux fondés) plutôt qu'une phrase de plus.

Qualité des textes, à l'œil sur les six derniers : plus aucun code, mais
« nos données internes » revient parfois deux fois dans la même phrase, et
une mention « la cote proposée respecte nos contraintes » n'a rien à faire
devant un joueur. À reprendre dans le nettoyeur, pas dans le prompt.

## 3. Sélections du jour (canaux fiables, cote 1,20–1,65)

1 499 sélections réglées depuis le 11 octobre : réel 0,736 pour 0,730
annoncé. La bande resserrée est calibrée.

## 4. Un point à corriger côté production

Sept passes du générateur LLM ont échoué entre le 10 et le 16 octobre avec
`401 Invalid API key` sur Together.ai (20:30 et 21:15, les 10-10, 10-12,
10-14 soir et 10-16). Les jours où un fournisseur de secours a répondu, le
combiné IA est sorti ; les autres jours il manque. La clé Together en
production est toujours invalide : la corriger, ou retirer `together` de
`LLM_PROVIDER` / `LLM_PROVIDER_FALLBACKS`.
