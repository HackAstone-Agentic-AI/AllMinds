
# Team Database Setup Guide

## What You Need

- PostgreSQL installed locally
- Node.js installed
- The two project folders:
  - `C:\Users\lenovo\OneDrive\Desktop\AllMinds\allminds-backend`
  - `C:\Users\lenovo\OneDrive\Desktop\AllMinds\Front-End-main`

## 1. Create The Database

1. Open PostgreSQL or pgAdmin.
2. Create a new database called `allminds_db`.
3. Keep note of your PostgreSQL username and password.

## 2. Load The SQL Schema

1. Open the file:
   `C:\Users\lenovo\OneDrive\Desktop\AllMinds\README\allminds_complete_schema.sql`
2. Run that SQL against `allminds_db`.
3. This creates the tables, indexes, triggers, and demo data.

## 3. Update Backend Environment Variables

1. Go to:
   `C:\Users\lenovo\OneDrive\Desktop\AllMinds\allminds-backend`
2. Copy `.env.example` to `.env` if `.env` does not already exist.
3. Open `.env`.
4. Update these values with your own PostgreSQL settings:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_actual_postgres_password
DB_NAME=allminds_db
```

5. Also set a real JWT secret:

```env
JWT_SECRET=use-a-long-random-secret-here
```

## 4. Optional OAuth Setup

If you want Google, Microsoft, or Apple sign-in to work, update these in `allminds-backend/.env` too:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
APPLE_CLIENT_ID=
APPLE_CLIENT_SECRET=
```

If you are not using social login yet, the app will still run without these.

## 5. Frontend Environment Check

1. Open:
   `C:\Users\lenovo\OneDrive\Desktop\AllMinds\Front-End-main\.env.local`
2. Make sure it contains:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

## 6. Install Dependencies

Backend:

```powershell
cd C:\Users\lenovo\OneDrive\Desktop\AllMinds\allminds-backend
npm install
```

Frontend:

```powershell
cd C:\Users\lenovo\OneDrive\Desktop\AllMinds\Front-End-main
npm install
```

## 7. Start The Backend

```powershell
cd C:\Users\lenovo\OneDrive\Desktop\AllMinds\allminds-backend
npm run dev
```

Expected API base URL:

- `http://localhost:5000/api`

## 8. Start The Frontend

```powershell
cd C:\Users\lenovo\OneDrive\Desktop\AllMinds\Front-End-main
npm run dev
```

Expected frontend URL:

- `http://localhost:3000`

## 9. Files Team Members May Need To Update

- `C:\Users\lenovo\OneDrive\Desktop\AllMinds\allminds-backend\.env`
  This is where each developer sets their PostgreSQL username, password, DB name, JWT secret, mail config, and OAuth credentials.

- `C:\Users\lenovo\OneDrive\Desktop\AllMinds\Front-End-main\.env.local`
  This should point the frontend to the correct backend API URL.

## Quick Troubleshooting

- If backend boot says PostgreSQL connection failed:
  check `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and whether PostgreSQL is running.

- If login works but data pages fail:
  confirm `NEXT_PUBLIC_API_URL` points to `http://localhost:5000/api`.

- If social sign-in fails:
  verify provider credentials and redirect URLs in both the provider console and backend `.env`.

- If new task routes fail:
  rerun the latest schema SQL so the `teacher_tasks` table exists locally.
