# EVCore — Notes de développement

## État du produit

Socle complet : auth, dashboard, fixtures, audit, tickets, bet-slip, analyse quotidienne auto. Polish produit et UX terminés.

## Règles de codage

- Ne jamais créer de migration Prisma — migrations créées manuellement par l'utilisateur
- L'agent peut utiliser uniquement `db:generate` pour rester aligné avec Prisma
- L'authentification reste centralisée dans `apps/backend` avec sessions opaques serveur
- Tous les filtres web restent server-side
- `page.tsx` sert à l'assemblage, pas à la logique métier lourde

## Règles UI

- Toute UI pensée mobile-first, touch targets minimum `44px`
- Pas de hover-only interactions, pas de tooltips desktop-only
- Vocabulaire simple et français correct : `cote`, `ticket`, `mise`, `paris joués`
- Table fixtures sur mobile = cards empilées
- Détail fixture = drawer mobile / side panel desktop

## Structure web

- `apps/web/constants/` pour les constantes partagées
- `constants/` dans un domaine pour les constantes spécifiques
- `lib/date.ts` comme point de passage unique pour la logique de date
- Un composant = un fichier
