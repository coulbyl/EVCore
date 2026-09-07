# Pièces jointes support chat (vocaux, photos, fichiers) — architecture

> Statut : backend + infra Docker + frontend implémentés sur cette branche.
> Non vérifié en conditions réelles dans cette session — voir §7 (limite
> d'environnement, pas un doute sur la conception).

## 1. Pourquoi RustFS plutôt que MinIO

Demandé explicitement (alternative à MinIO). RustFS est un stockage objet
S3-compatible, open-source (Apache 2.0), pensé pour la coexistence/migration
avec MinIO — même API S3 (SigV4, presigned URLs, `CreateBucket`/`HeadObject`
standards), donc le SDK AWS officiel (`@aws-sdk/client-s3` +
`@aws-sdk/s3-request-presigner`) fonctionne sans adaptation, juste pointé
sur un endpoint différent (`forcePathStyle: true`, comme pour MinIO).
Sources : [dépôt GitHub rustfs/rustfs](https://github.com/rustfs/rustfs),
[doc Docker officielle](https://docs.rustfs.com/en/installation/container),
[liste des variables d'environnement](https://github.com/orgs/rustfs/discussions/971).

Ports par défaut : `9000` (API S3), `9001` (console web). Le conteneur
tourne en utilisateur non-root (`10001:10001`) — géré ici par un volume
Docker nommé, pas un bind-mount, donc pas de souci de permissions.

## 2. Ne jamais proxyer les fichiers par le backend

Le backend NestJS ne lit ni n'écrit jamais le contenu d'un fichier. Le flux :

```
1. Client → POST /support/attachments/upload-url { kind, mimeType, sizeBytes }
2. Backend → valide (allowlist mime + taille par kind, config/storage.constants.ts)
           → génère objectKey = support/{conversationId}/{uuid}.{ext}
           → signe une URL PUT (ContentType + ContentLength inclus dans la signature)
3. Client → PUT <uploadUrl>  (directement vers RustFS, jamais via le backend)
4. Client → POST /support/messages { content?, attachment: { objectKey, kind, ... } }
5. Backend → vérifie que objectKey appartient bien à cette conversation (préfixe)
           → HeadObject sur RustFS (confirme l'upload, lit taille/type réels)
           → écrit SupportMessage + SupportAttachment
           → émet le message via Socket (avec une URL de lecture déjà signée)
```

Le backend ne fait jamais confiance à ce que le client déclare une seconde
fois : `ContentType`/`ContentLength` sont des paramètres signés côté upload
(RustFS refuse une requête dont les en-têtes réels ne correspondent pas), et
`HeadObject` relit les valeurs faisant foi avant d'écrire la ligne en base.

## 3. Bucket privé, jamais d'URL permanente

Aucune politique de lecture publique. Chaque URL de lecture (`GET`) est
regénérée à chaque lecture/diffusion du message (`SupportService.toMessageDto`),
expire en 15 minutes (`SUPPORT_ATTACHMENT_LIMITS.DOWNLOAD_URL_EXPIRY_SECONDS`),
et n'est jamais stockée en base — seul `objectKey` l'est.

## 4. Deux endpoints RustFS distincts (interne / public)

En production, le backend et le navigateur n'atteignent pas RustFS de la
même façon :

- `RUSTFS_ENDPOINT` — réseau Docker interne (`http://rustfs:9000`), utilisé
  par le backend pour ses propres appels (`HeadBucket`, `CreateBucket`,
  `HeadObject`).
- `RUSTFS_PUBLIC_ENDPOINT` — hôte public HTTPS, utilisé uniquement pour
  signer les URLs remises au navigateur (upload/download). Doit pointer vers
  un reverse proxy qui transmet la requête sans la modifier (pas de réécriture
  de chemin, query string intacte — toute modification casse la signature
  SigV4).

En dev, les deux valent `http://localhost:9000` (même port publié, backend
et navigateur y accèdent tous les deux directement) — pas de configuration
supplémentaire nécessaire.

`StorageService` instancie donc deux `S3Client` (mêmes identifiants, hôte de
signature différent) — voir `apps/backend/src/modules/storage/storage.service.ts`.

## 5. Dégradation gracieuse

Si `RUSTFS_ACCESS_KEY`/`RUSTFS_SECRET_KEY` ne sont pas renseignées, le
backend démarre quand même (même pattern que `MailService`/`PushService`) :
`StorageService.isEnabled()` retourne `false`, les endpoints d'upload
répondent une erreur explicite, le reste de la messagerie (texte) continue
de fonctionner normalement.

## 6. Limites et provisioning automatique

Allowlist mime + taille par type dans `config/storage.constants.ts` (images
10 Mo, audio 15 Mo, fichiers génériques 20 Mo). Le bucket
(`RUSTFS_BUCKET`, défaut `evcore-support`) est créé automatiquement au
démarrage du backend s'il n'existe pas encore (`HeadBucket` puis
`CreateBucket` si absent) — aucune étape manuelle dans la console RustFS.

## 7. Limite de vérification dans cette session

L'environnement d'exécution de cette session bloque les pulls Docker Hub
(politique d'egress du proxy — confirmé via
`curl http://127.0.0.1:45623/__agentproxy/status`, échec `403` sur
`production.cloudfront.docker.com`). Il n'a donc pas été possible de faire
tourner un vrai conteneur RustFS ni Postgres ici pour un test de bout en
bout. Ce qui a été vérifié dans cette session :

- Schéma Prisma + migration SQL écrite à la main (`prisma generate` valide
  le schéma ; pas de `prisma migrate dev` réel — pas de Postgres accessible).
- `docker compose config` sur les deux fichiers compose (dev + prod) — la
  configuration s'interpole et se résout sans erreur.
- Tests unitaires du service (mocks du repository/`StorageService`) — la
  logique métier (validation, résolution d'attachment, pagination) est
  couverte.
- Recherche documentaire RustFS (compatibilité S3, presigned URLs, variables
  d'environnement) — voir sources §1.

Ce qui reste à valider avant mise en prod : `pnpm --filter @evcore/db
db:migrate` contre une vraie base, puis un envoi réel (vocal + image) en
suivant le flux du §2 avec `docker compose up rustfs`.
