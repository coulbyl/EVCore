# Revue de conformité des textes — 31/10/2026

_Revue des textes que voit un joueur ou un visiteur (landing, `/resultats`, Aujourd'hui, Matchs, ticket, Résultats, aide, image de partage), demandée pendant la revue de la refonte. Source : `apps/web/messages/fr.json`, `apps/web/domains/help/help-sheets.ts`, `apps/web/app/(public)/_og/share-image.tsx`._

**Ce document n'est pas un avis juridique.** Il relève les risques et propose des formulations. Avant la mise en avant du site, il faut le faire relire par un juriste de Côte d'Ivoire : régime des jeux de hasard, publicité, protection des données (ARTCI), marques.

## 1. Le nom « 1xBet » — le risque principal

Seize textes du joueur et douze passages de l'aide nomment 1xBet. Exemples : « 1xBet garde 7 % sur ce pari », « Sur la durée, 1xBet garde 31 % de ta mise sur ce ticket », « On lit les matchs et les cotes de 1xBet ».

Ça pose trois problèmes.

1. **On utilise une marque qui n'est pas la nôtre.** Citer une marque pour dire d'où vient un chiffre est en général admis. La répéter partout, dans les titres et les phrases d'appel, peut laisser croire à un partenariat ou à une recommandation de cet opérateur. Promouvoir un opérateur de paris est encadré, et nous n'avons aucun accord avec lui.
2. **Le ton peut se lire comme du dénigrement.** « 1xBet garde X % de ta mise » est arithmétiquement juste : c'est la marge, présente chez tous les bookmakers. Mais la phrase désigne une seule entreprise et dit qu'elle « garde ta mise ». Un opérateur pourrait y voir une présentation trompeuse ou dénigrante de son activité.
3. **La décision était déjà ouverte.** `PRODUCT.md` (décisions ouvertes) note : « Nom du bookmaker à l'écran : "1xBet" affiché depuis le 2026-10-18 ; "cote jouable estimée" sans nom proposé pour raisons réglementaires ». La refonte a généralisé le nom au lieu de trancher.

**Recommandation.**
- Ne plus nommer l'opérateur dans les phrases. Parler du « bookmaker » et de « sa marge », un fait qui vaut pour tous.
- Nommer la source une seule fois, à un endroit neutre : une ligne « Cotes relevées chez 1xBet via API-Football » dans l'Aide et les mentions légales, comme on cite une source.
- Garder « 1xBet » partout dans le code et les données : c'est l'affichage qui change, pas le calcul.

| Aujourd'hui | Proposé |
| --- | --- |
| 1xBet garde 7 % sur ce pari | Marge du bookmaker : 7 % |
| Sur la durée, 1xBet garde 31 % de ta mise sur ce ticket | Sur la durée, le bookmaker garde 31 % des mises sur ce ticket |
| 1xBet prend 9 % sur ce match | Marge du bookmaker sur ce match : 9 % |
| Pas coté chez 1xBet | Pas encore de cote |
| Pas de lecture · la cote 1xBet est trop basse | Pas de lecture : la cote est trop basse pour valoir le coup |
| la cote 1xBet, celle que ton ticket paiera | la cote, celle que ton ticket paiera |
| Aide : ce que 1xBet garde | Aide : la marge du bookmaker |
| On lit les matchs et les cotes de 1xBet… | On lit chaque match et ses cotes… |
| réglé au prix 1xBet | réglé à la cote du jour |

## 2. Inciter à jouer — à surveiller

Le produit est un service d'analyse, pas un opérateur. Plusieurs formulations le rapprochent pourtant d'une publicité pour le jeu.

- **« Un pari par jour. »** La phrase de marque peut se lire comme une invitation à parier tous les jours, contraire au principe « Jamais de pression à jouer » de `PRODUCT.md`. Proposé : « Chaque jour, un pari analysé. Compté, daté, pertes comprises. »
- **« Dernier coupon gagné »** (choix du 31/10). Il reste défendable tant qu'il est dit comme tel et accompagné du bilan complet, ce qui est le cas aujourd'hui. À ne jamais montrer seul : ni dans l'image de partage, ni dans une publicité, ni sans la ligne « Nos résultats ».
- **« Favori du jour »** sur un coupon du 27/10 : le titre ment sur la date. Pour un coupon passé, titrer « Favori du 27/10 ».

## 3. Mentions obligatoires — non conformes à nos propres règles

`PRODUCT.md` impose sur les surfaces publiques : « 18+ » (« 21+ au Cameroun ») et « Parier comporte des risques de perte. Ne mise que ce que tu peux perdre. »

- Le pied des écrans dit seulement « 18+ · Parier comporte des risques de perte » : il manque « 21+ au Cameroun » et « Ne mise que ce que tu peux perdre ».
- L'image de partage, qui circule hors du site, a la même ligne incomplète.
- La ressource d'aide de Jeu responsable est **SOS Joueurs · 09 74 75 13 13 (France)**, un numéro français pour un public ivoirien, sénégalais et camerounais. Il faut une ressource locale, ou à défaut une ressource internationale accessible depuis ces pays, à confirmer.

Proposé, pour le pied : « 18+ (21+ au Cameroun) · Parier comporte des risques de perte · Ne mise que ce que tu peux perdre. »

## 4. Données

Rien à signaler côté textes. Le ticket reste sur l'appareil, il est compté de façon anonyme, et les e-mails sont sur opt-in. Les champs de l'éditeur dans les mentions légales (raison sociale, déclaration ARTCI…) restent à remplir : c'est un préalable à toute mise en avant (D6).

## 5. Le ton — trop « robot »

Le style télégraphique, avec le point médian entre deux bouts de phrase, vient du « tableau d'affichage ». Il marche pour des chiffres (« FAV ✓ 1,24 »), mal pour des phrases. Les cas les plus secs :

| Aujourd'hui | Proposé |
| --- | --- |
| Dernier coupon gagné · 27/10 | Notre dernier coupon gagnant, le 27/10 |
| Pas de coupon pour l'instant · réessaie plus tard | Les coupons du jour arrivent bientôt. |
| Trop tôt · 5 avis | Encore trop tôt : 5 avis réglés |
| Pas encore joué · lancé le 29/10 | Lancé le 29/10, pas encore de jour joué |
| Rien à jouer aujourd'hui | Aujourd'hui, on passe notre tour |
| Nos résultats, depuis le 13/10 | Nos résultats depuis le 13/10, pertes comprises |
| On lit les matchs et les cotes de 1xBet, on propose un pari par jour, on compte ce qu'il a donné. Toi, tu suis ou pas. | On lit chaque match, on te propose le pari qui nous paraît le plus sûr, et on compte tout ce qu'il donne, même quand il perd. Tu suis, ou pas. |
| C'est gratuit. On ne prend jamais ta mise. | Gratuit. On ne touche jamais à ton argent. |

**Attention à « le plus sûr »** : « sûr » est sur la liste des mots interdits de `PRODUCT.md`. La phrase proposée l'emploie au comparatif pour décrire une sélection, pas une promesse. Si on veut rester strict, écrire plutôt « le pari qui a le plus de chances ».

## 6. Ce qu'on garde

- « Compté, daté, pertes comprises » : c'est la promesse, elle est vraie et elle protège.
- Les chances écrites en fréquence (« 8 sur 10 »), jamais en promesse.
- « On ne prend jamais ta mise » : ça dit clairement qu'on n'est pas un opérateur. Garder l'idée, alléger la phrase.
- Aucun taux de réussite ni ROI mis en avant, seulement des comptes datés.

## Appliqué le 31/10

Points 1 à 4 validés et appliqués en français et en anglais, dans l'appli, l'Aide, l'image de partage et les raisons du résumé du matin. La ressource d'aide française a été remplacée par « écris-nous dans Messages » en attendant une ressource locale. Les écrans de l'admin gardent « 1xBet » jusqu'à leur refonte (phase G). Restent ouverts : une ressource d'aide locale, et la relecture par un juriste (point 5).

## Décisions à prendre

1. Retirer le nom de l'opérateur des phrases et le citer une fois comme source (recommandé).
2. Changer la phrase de marque.
3. Compléter la ligne légale et trouver une ressource d'aide locale.
4. Adopter les reformulations du § 5, ou en proposer d'autres.
5. Faire relire le tout par un juriste avant la promotion du site.
