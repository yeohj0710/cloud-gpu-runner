# Cloud Credit Dashboard

Next.js dashboard for testing small, cost-capped cloud-credit experiments.

## Local

```powershell
npm run dev
npm run verify
```

The app reads environment variables from this app's `.env.local`, the repo root `.env.local`, and `process.env`.

## Vercel

Set the NCP variables from the repo root `.env.example` in the Vercel project environment.
Set `DASHBOARD_RUN_TOKEN` before enabling execute actions on a public deployment.

## Routes

- `POST /api/ncp/region-smoke`
- `POST /api/ncp/cost-snapshot`
- `POST /api/ncp/object-storage-smoke`
- `GET /api/config/status`
