# EVCore — TODO

## Feature: Refonte des annonces

---

### 1. Schéma Prisma — `packages/db/prisma/schema.prisma`

**Modèle `Announcement` (ligne ~324) :**

- Changer `description String?` → `description String` (required, type rich text / HTML sérialisé — supprimer la contrainte de longueur)
- Changer `href String` → `href String?` (optionnel)
- Ajouter `expiresAt DateTime?`

> Ne pas générer de migration. Lancer `db generate` + `db build` uniquement. La migration sera lancée manuellement.

---

### 2. Backend — DTOs

**`apps/backend/src/modules/announcements/dto/create-announcement.dto.ts`**

- `description` : retirer `@IsOptional`, retirer `@MaxLength(500)`, type `string` (HTML/JSON)
- `href` : ajouter `@IsOptional`, retirer la contrainte required
- Ajouter `expiresAt?: Date` avec `@IsOptional`, `@IsDateString()`

**`apps/backend/src/modules/announcements/dto/update-announcement.dto.ts`**

- Mêmes changements que Create (tous les champs restent optionnels pour le PATCH)

**`apps/web/domains/announcements/types/announcements.ts`**

- `description: string | undefined` → `description: string` (required)
- `href: string` → `href?: string`
- Ajouter `expiresAt?: string`
- Mettre à jour `CreateAnnouncementInput` et `UpdateAnnouncementInput` en conséquence

---

### 3. Backend — Service

**`apps/backend/src/modules/announcements/announcements.service.ts`**

- `listPublished()` : ajouter un filtre pour exclure les annonces dont `expiresAt` est dans le passé
  ```
  where: { published: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }
  ```

---

### 4. Frontend — Rich Text Editor (création d'annonce)

**`apps/web/app/dashboard/announcements/components/announcements-admin-page-client.tsx`**

Remplacer le `<textarea>` de `description` par un éditeur **Tiptap** (retenu sur Lexical : extensions officielles couvrent tous les besoins, `Node.create()` suffit pour `CopyBlock`, meilleure ergonomie React).

Dépendances à installer au moment du dev :

@tiptap/starter-kit embarque bold, italic, listes, paragraphe. @tiptap/extension-link pour les liens. CopyBlock sera une extension locale dans le projet.

pnpm --filter ui add @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-link

check pour voir si on ajoute dans catalog:

**Fonctionnalités attendues de l'éditeur :**

| Extension                | Comportement                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------- |
| Bold / Italic            | Formatage inline classique                                                             |
| BulletList / OrderedList | Listes                                                                                 |
| Link                     | Insertion d'un lien avec preview URL inline (titre + favicon)                          |
| CopyBlock                | Composant custom — affiche un texte avec bouton "copier" intégré (ex. un code `h12GR`) |

**Règles :**

- `description` devient required dans le formulaire
- `href` : retirer le `required`, champ optionnel
- Ajouter un champ `expiresAt` (date picker) — optionnel
- Adapter la validation client en conséquence (titre + description suffisent pour submit)

---

### 5. Frontend — Composant d'affichage dashboard

**`apps/web/components/announcements.tsx`**

Refonte complète du composant. Comportement actuel (Alert cards toutes visibles + dismiss localStorage) → remplacé par :

**Nouvelle logique :**

- Afficher **une seule annonce à la fois**, la plus récente non lue
- Quand elle est marquée lue → passer à la suivante dans la queue (ordre `publishedAt desc`)
- Les annonces dont `expiresAt` est dépassé sont considérées comme lues (filtrées côté backend — voir §3)
- Persistance du "lu" : conserver le mécanisme localStorage existant (`"evcore:dashboard:announcements:dismissed:v1"`)

**Nouveau layout (ligne dans le dashboard) :**

```
[Titre de l'annonce]                [Lire →]
```

**Dialog (au clic sur "Lire") :**

- **Header** : titre de l'annonce
- **Content** : rendu rich text (lecture seule) — avec support des blocs copiables
- **Footer** :
  - Si `href` défini → bouton "Marquer comme lu" navigue vers `href` ET marque comme lu
  - Sinon → bouton "Marquer comme lu" ferme le dialog et marque comme lu

**Props du composant (à adapter) :**

```typescript
{ items: Announcement[], className?: string }
```

---

### 6. Dashboard — Intégration

**`apps/web/app/dashboard/components/dashboard-page-client-operator.tsx`**

- Le composant `<Announcements>` garde sa position en haut du dashboard
- Adapter le mapping si les props changent (ex. `href` devient optionnel)

---

### Ordre d'implémentation

1. Schéma Prisma + `db generate` + `db build`
2. DTOs backend + types frontend
3. Service : filtre `expiresAt`
4. Intégrer Tiptap + extension CopyBlock dans le formulaire admin
5. Refonte du composant `announcements.tsx` + dialog
6. Vérifier l'intégration dans le dashboard opérateur
