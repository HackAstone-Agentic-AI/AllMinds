# AllMinds Render Deployment Guide

This repository deploys to Render as three web services plus one Postgres database.

## Services

- `allminds-frontend`: Next.js dashboard
- `allminds-backend`: Express API
- `allminds-agents`: FastAPI agent service
- `allminds-postgres`: Render Postgres database

The root `render.yaml` is the Blueprint file.

## First Deploy URLs

The Blueprint is configured to deploy first with Render subdomains:

- Frontend: `https://allminds-frontend.onrender.com`
- Backend: `https://allminds-backend.onrender.com`
- Agents: `https://allminds-agents.onrender.com`

After DNS is connected, replace those values in Render environment variables with your purchased domain values.

Recommended production domain layout:

- Frontend: `https://YOUR_DOMAIN`
- Backend: `https://api.YOUR_DOMAIN`
- Agents: `https://agents.YOUR_DOMAIN`

Then update:

- Backend `BACKEND_URL=https://api.YOUR_DOMAIN`
- Backend `FRONTEND_URL=https://YOUR_DOMAIN`
- Backend `AGENTIC_AI_URL=https://agents.YOUR_DOMAIN`
- Backend `ALLOWED_ORIGINS=https://YOUR_DOMAIN`
- Frontend `NEXT_PUBLIC_API_URL=https://api.YOUR_DOMAIN/api`
- Frontend `BACKEND_API_URL=https://api.YOUR_DOMAIN/api`
- Frontend `AGENTIC_AI_URL=https://agents.YOUR_DOMAIN`
- Agents `ALLOWED_ORIGINS=https://YOUR_DOMAIN`

## Required Render Secrets

Render will prompt for these because `render.yaml` marks them as `sync: false`:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GROQ_API_KEY`
- `GEMINI_API_KEY`
- `YOUTUBE_API_KEY`
- Email values if password reset email is needed
- Microsoft/Apple OAuth values only if those providers are enabled

`JWT_SECRET` is generated automatically by Render.

## Database

The backend pre-deploy command runs:

```bash
npm run db:init && npm run db:migrate
```

`db:init` loads `docs/database/allminds_complete_schema.sql` only if the fresh Render database does not yet have a `users` table. `db:migrate` then applies SQL files in `apps/backend/database/migrations`.

## Google OAuth Redirect URIs

For the initial Render subdomain deployment, add these redirect URIs in Google Cloud Console:

```text
https://allminds-backend.onrender.com/api/auth/google/callback
https://allminds-backend.onrender.com/api/calendar/callback
```

For local development, keep:

```text
http://localhost:5000/api/auth/google/callback
http://localhost:5000/api/calendar/callback
```

After the custom domain is connected, also add:

```text
https://api.YOUR_DOMAIN/api/auth/google/callback
https://api.YOUR_DOMAIN/api/calendar/callback
```

## Smoke Checks

After deployment:

```text
https://allminds-backend.onrender.com/api/health
https://allminds-agents.onrender.com/health
https://allminds-frontend.onrender.com
```

Then test:

1. Register or log in.
2. Open the dashboard.
3. Use the Thandi chat widget.
4. Connect Google Calendar from settings.
5. Ask: `what's on my calendar`.
6. Ask: `schedule a test event tomorrow at 9am`.
