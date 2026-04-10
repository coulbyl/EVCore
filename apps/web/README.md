# EVCore Web

Next.js dashboard for the EVCore betting engine.

- **Production**: https://c-evcore.com
- **Backend API**: https://api.c-evcore.com

## Environment variables

| Variable              | Description                           | Example                    |
| --------------------- | ------------------------------------- | -------------------------- |
| `NEXT_PUBLIC_API_URL` | Backend API URL (baked at build time) | `https://api.c-evcore.com` |

> `NEXT_PUBLIC_API_URL` is inlined into the JS bundle at build time. Changing it requires a full image rebuild.

## Dev

```bash
pnpm --filter web dev
```

The web app expects the backend running at `http://localhost:3001` by default (fallback in `lib/dashboard-api.ts`).
