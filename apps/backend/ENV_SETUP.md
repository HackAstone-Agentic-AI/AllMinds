# AllMinds Environment Setup

Use the single repo-level `.env` file in the project root. Do not keep separate `.env` files under `apps/`.

## Required variables

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_database_password
DB_NAME=allminds_db
JWT_SECRET=your-long-random-jwt-secret
```

## Recommended variables

```env
PORT=5000
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=10
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:5000
```

## Social sign-in providers

Each provider needs both of its env vars.

### Google

```env
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

Callback URL:

```text
http://localhost:5000/api/auth/google/callback
```

### Microsoft

```env
MICROSOFT_CLIENT_ID=your_microsoft_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret
```

Callback URL:

```text
http://localhost:5000/api/auth/microsoft/callback
```

### Apple

```env
APPLE_CLIENT_ID=your_apple_service_id
APPLE_CLIENT_SECRET=your_apple_client_secret
```

Callback URL:

```text
http://localhost:5000/api/auth/apple/callback
```

## Frontend

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

## Validation behavior

The backend now:

- fails fast when required DB/JWT variables are missing,
- warns on partially configured OAuth providers,
- defaults `FRONTEND_URL` and `BACKEND_URL` for local development when omitted.
