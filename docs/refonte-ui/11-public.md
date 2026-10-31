# Refonte UI — 11. Le public, avant la connexion

_29/10/2026. Proposition à corriger. La landing, l'inscription, la connexion et ses suites, les pages légales, la page introuvable. Suite de [01-ce-qu-on-montre.md](01-ce-qu-on-montre.md) § 8 : on montre au lieu de dire._

## 1. La landing

Un écran, pas une page qui défile sur dix sections. Ce qu'un visiteur voit, c'est **le coupon du jour en vrai**, le même qu'un joueur connecté, avec sa forme. La page actuelle (familles de moteurs, canaux, « Poisson plein-match », « Implicite marché ») disparaît : elle explique le moteur à des gens qui veulent savoir si ça marche.

```
 EVCore                                   Se connecter
────────────────────────────────────────────────
 Un pari par jour. Compté, daté, pertes comprises.
────────────────────────────────────────────────
 Favori du jour                           aujourd'hui
 [PSG] PSG – Lens          19:00
 Victoire du PSG                                1,28
 ● ● ● ● ● ● ● ● ○ ○    8 sur 10
 ✓ ✓ ✗ ✓ ✓ ✓ ✓ ✗ ✓ ✓ ✓ ✓ ✓ ✗ ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓
 19 jours gagnés sur 24 · depuis le 13/10
────────────────────────────────────────────────
              [ Créer mon compte ]
          C'est gratuit. On ne prend jamais ta mise.
────────────────────────────────────────────────
 Nos résultats, depuis le 13/10
 Favori      11 jours gagnés sur 14
 Combiné     11 jours gagnés sur 15
 Cote 2      Trop tôt · 1 jour
 Avis IA     136 avis gagnés sur 207
 Tout voir ›
────────────────────────────────────────────────
 Comment ça marche
 On lit les matchs et les cotes de 1xBet, on propose un pari
 par jour, on compte ce qu'il a donné. Toi, tu suis ou pas.
────────────────────────────────────────────────
 18+ · Parier comporte des risques de perte
 Conditions · Confidentialité · Mentions · Jeu responsable
```

**De haut en bas**

1. **La phrase de marque**, une ligne : « Un pari par jour. Compté, daté, pertes comprises. » C'est le seul titre.
2. **Le héros du jour**, exactement la carte d'Aujourd'hui ([04](04-aujourdhui-en-detail.md) § 1) sans le bouton Suivre : équipes, heure, pari, cote 1xBet, « 8 sur 10 », la forme sur 30 jours et son compte daté. Le soir, la carte porte ✓ ou ✗ comme pour les joueurs ; un jour sans héros montre le relais, et un jour sans aucun coupon montre la ligne Hier et « Rien à jouer aujourd'hui · pourquoi › ». Un visiteur voit donc aussi les jours perdus et les jours vides : c'est voulu.
3. **Le bouton**, « Créer mon compte », et une ligne dessous : gratuit, on ne prend jamais ta mise.
4. **Nos résultats** : les quatre premières lignes de Résultats ([08](08-resultats.md) § 1), datées, avec « Trop tôt » quand c'est trop tôt, et un lien vers la page publique des résultats (la même que l'onglet Résultats, en lecture seule, sans connexion).
5. **Comment ça marche**, trois lignes, le second et dernier paragraphe autorisé du site.
6. **Le pied** : la ligne 18+, les quatre pages légales.

**Ce qui sort** : les chiffres d'ensemble (« 6 440 matchs », « 58 656 pronostics », « 62 ligues » : vrais mais ils ne répondent pas à la question du visiteur), les familles de moteurs, la liste des types de pari, le mode sombre en argument, les captures d'écran, les témoignages (on n'en a pas et on n'en inventera pas).

**Budget** : un titre, deux paragraphes de trois lignes, trois chiffres sur la carte.

### La page publique des résultats

`/resultats`, sans connexion : l'onglet Résultats en lecture seule, mêmes lignes, même détail par produit, mêmes périodes. C'est la page de conformité : tout ce qu'on affirme sur la landing s'y vérifie. Elle remplace la page Mesures historiques publique.

### L'image de partage

Quand un lien EVCore est collé dans WhatsApp : le héros du jour en image (équipes, pari, « 8 sur 10 », la ligne 18+), régénérée chaque jour. C'est l'image `og` déjà en place, avec le contenu du héros à la place du texte générique.

## 2. L'inscription

```
 ‹                                   Créer mon compte
────────────────────────────────────────────────
 Prénom            [ Kouassi                    ]
 E-mail            [ kouassi@…                  ]
 Mot de passe      [ ••••••••    ] 8 caractères au moins
────────────────────────────────────────────────
 [ ] J'ai 18 ans ou plus (21 au Cameroun), ou l'âge
     légal de mon pays
 [ ] J'accepte les conditions d'utilisation
────────────────────────────────────────────────
              [ Créer mon compte ]
          Déjà un compte ? Se connecter
```

- **Trois champs** : prénom, e-mail, mot de passe. Le **nom d'utilisateur disparaît** : on se connecte avec l'e-mail, le prénom suffit pour « Kouassi » en haut de Moi. Pas de téléphone à l'inscription (il se renseigne dans Compte, s'il le veut).
- **Deux cases**, les mêmes que depuis le 27/10 (âge, conditions), obligatoires, jamais pré-cochées.
- **Les erreurs** s'écrivent sous le champ, en une ligne, dans les mots du joueur : « Cet e-mail a déjà un compte · Se connecter ». Jamais un message en haut de page.
- **Après le bouton** : l'écran de vérification de l'e-mail (§ 4), puis Aujourd'hui avec la ligne d'accueil ([10](10-transverse.md) § 1). Pas de « sécurise ton compte » obligatoire entre les deux.

## 3. La connexion

```
 ‹                                       Se connecter
────────────────────────────────────────────────
 E-mail            [                            ]
 Mot de passe      [ ••••••••    ]      afficher
────────────────────────────────────────────────
              [ Se connecter ]
          Mot de passe oublié ?  ·  Créer un compte
```

- E-mail et mot de passe. Le nom d'utilisateur reste accepté pour les comptes qui en ont un, sans le dire à l'écran.
- **Session longue** : on reste connecté sur l'appareil (c'est un téléphone personnel), avec « Déconnecter les autres appareils » dans Compte ([09](09-moi.md) § 5).
- Si la double authentification est activée, un écran de plus : « Le code de ton application », six chiffres.
- **Erreur** : « E-mail ou mot de passe incorrect », une ligne sous le bouton, les champs gardés.

## 4. La vérification de l'e-mail

Juste après l'inscription, ou plus tard depuis Compte :

```
 Vérifie ton e-mail
 On a envoyé un code à kouassi@…
 [ _ _ _ _ _ _ ]
 Renvoyer le code (dans 30 s)  ·  Changer d'e-mail
```

- Six chiffres, saisie automatique quand le téléphone lit l'e-mail, et un lien dans l'e-mail qui fait la même chose.
- **On peut passer** : « Plus tard » mène à Aujourd'hui ; tant que l'e-mail n'est pas vérifié, Compte montre « Vérifie ton e-mail › » et les notifications par e-mail sont grisées ([09](09-moi.md) § 7). Un compte non vérifié peut suivre des coupons : on ne bloque pas le premier geste.

## 5. Le mot de passe oublié

Trois écrans, un par étape : l'e-mail, le code reçu (six chiffres, même écran qu'en § 4), le nouveau mot de passe. Puis connecté directement, sans repasser par la connexion. Si la double authentification est activée, son code est demandé après le code e-mail ; sans accès à l'application d'authentification, le joueur écrit à l'équipe (Messages est inaccessible hors connexion : un lien « Écrire à l'équipe » ouvre un e-mail à l'adresse de support).

## 6. La double authentification

**Facultative**, proposée dans Compte › Sécurité, jamais imposée à l'inscription. Aujourd'hui l'écran « Sécurise ton compte » est la dernière étape avant le tableau de bord ; pour un joueur qui vient voir un pari, c'est une porte de trop. Elle reste conseillée dans Compte, en une ligne : « Protège ton compte avec un code à chaque connexion ». Le parcours de configuration (QR, clé manuelle, code de confirmation) ne change pas.

## 7. Les pages légales

Conditions, confidentialité, mentions légales, jeu responsable : le contenu livré le 27/10 reste, avec son sommaire. Deux changements :

- **le style** sera celui de l'application, pas un gabarit à part ;
- **les neuf champs « À compléter »** de l'éditeur (raison sociale, adresse, numéro…) doivent être remplis avant la mise en ligne de la refonte : une page légale avec des trous est pire qu'absente.

Les numéros d'aide par pays de Jeu responsable sont la source unique pour [09](09-moi.md) § 4.

## 8. La page introuvable

```
 Cette page n'existe pas.
 [ Aujourd'hui ]
```

Une ligne, un bouton vers Aujourd'hui (ou vers la landing si on n'est pas connecté). Les anciennes adresses connues (Formation, Glossaire, Décisions, Avis IA, Mesures historiques, Coupons, Mes coupons, Suivi de mise) **redirigent** vers le nouvel écran correspondant au lieu de tomber ici.

## 9. Les états

| État | Ce qu'on montre |
| --- | --- |
| **Landing sans coupon** (panne, pas encore composé) | La carte dit « Pas de coupon pour l'instant » et la forme des 30 derniers jours reste : la page ne doit jamais être vide. |
| **Landing pendant une maintenance** | La page de maintenance ([10](10-transverse.md) § 2). |
| **E-mail déjà pris** | Sous le champ : « Cet e-mail a déjà un compte · Se connecter ». |
| **Code expiré** | « Ce code a expiré · Renvoyer un code ». |
| **Trop de tentatives** | « Réessaie dans 10 minutes », sans dire combien d'essais restent. |
| **Compte en pause** à la connexion | Connexion acceptée ; Aujourd'hui est fermé avec la date de retour, Moi ouvert. |
| **Compte supprimé** à la connexion | « E-mail ou mot de passe incorrect », comme un compte inconnu. |

## 10. Ce qu'il faut construire

- **Le héros du jour sans connexion** : un point d'entrée public qui sert la carte (jamais les jambes de tous les produits, seulement le héros et sa forme), et la page `/resultats` publique sur le même point d'entrée que l'onglet.
- **L'image de partage** régénérée chaque jour avec le héros.
- **L'inscription à trois champs** : le nom d'utilisateur devient facultatif côté serveur, puis disparaît.
- **La vérification de l'e-mail** facultative au premier passage, avec son rappel dans Compte.
- **La double authentification** sortie du parcours d'inscription.
- **Les redirections** des anciennes adresses.
- **Les champs légaux** à compléter (hors code : une décision de l'éditeur).

## 11. Tranché le 29/10

1. **Le nom d'utilisateur** disparaît ; on se connecte avec l'e-mail.
2. **La double authentification** est facultative, proposée dans Compte.
3. **La vérification de l'e-mail** peut être passée et finie plus tard.
