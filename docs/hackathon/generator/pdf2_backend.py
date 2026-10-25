from common import *


def fig_pipeline():
    fig, ax = canvas(12, 3.4)
    steps = [("Request", "from Next.js /\nbrowser", "fe"), ("helmet", "security\nheaders", "be"),
             ("compression", "gzip", "be"), ("CORS", "origin\nallow-list", "be"),
             ("body parsers", "json +\nurlencoded", "be"), ("passport", "initialize\n(OAuth only)", "be"),
             ("route + limiter", "auth 20/15m\nAI 60/15m/user", "warn"), ("authenticate\nToken", "jwt.verify ->\nreq.user", "warn"),
             ("controller", "validation +\nSQL ($1 params)", "be"), ("pg Pool", "max 20 conns\n2 s connect t/o", "db")]
    w = 8.6
    for i, (a, b, k) in enumerate(steps):
        x = 1 + i * 9.9
        box(ax, x, 40, w, 30, f"{a}\n{b}", k, fs=7.5)
        if i:
            arrow(ax, (x - 1.2, 55), (x - 0.1, 55))
    box(ax, 1, 4, 40, 22, "Errors\n404 handler -> {error:'Not found'}; global handler ->\n{error, stack only when NODE_ENV != production}", "warn", fs=8)
    box(ax, 46, 4, 53, 22, "Process lifecycle (server.js)\nSIGTERM/SIGINT -> server.close() -> pool.end();\nforce exit after 10 s; uncaughtException -> graceful shutdown", "ext", fs=8)
    return save(fig, "be_pipeline.png", "Express request pipeline (src/app.js)")


def fig_erd():
    fig, ax = canvas(12.5, 9)
    def ent(x, y, w, h, name, cols, kind="db"):
        box(ax, x, y, w, h, name + "\n" + "\n".join(cols), kind, fs=7.2)
        return (x, y, w, h)
    ent(38, 70, 24, 27, "users", ["id PK (serial)", "email UNIQUE", "password_hash (bcrypt)", "full_name, role",
                                  "school_name, province, city", "language_pref, is_active", "email_verified"], "be")
    ent(4, 80, 22, 15, "teacher_profiles", ["user_id FK UNIQUE (1:1)", "title, name, surname", "theme_preference"])
    ent(4, 58, 22, 18, "learner_profiles", ["id PK", "teacher_id FK -> users", "anonymous_id UNIQUE", "profile_data JSONB"])
    ent(4, 36, 22, 14, "learner_progress", ["learner_id FK, teacher_id FK", "progress_data JSONB", "recorded_at"])
    ent(4, 16, 22, 14, "sensory_toolkit_logs", ["learner_id FK, teacher_id FK", "log_data JSONB"])
    ent(29, 36, 22, 16, "learner_schedule_items", ["teacher_id FK, learner_id FK", "title, start_time TIME", "notes",
                                                   "UNIQUE(learner_id,start_time)"])
    ent(29, 14, 22, 16, "parent_communications", ["teacher_id FK, learner_id FK", "type: progress|concern",
                                                  "content TEXT"])
    ent(74, 82, 24, 15, "google_calendar_tokens", ["user_id FK UNIQUE", "gmail_email", "access/refresh_token",
                                                   "scopes[], expiry"], "ai")
    ent(74, 64, 24, 14, "oauth_login_codes", ["code_hash CHAR(64) PK", "user_id FK", "expires_at (+5 min)"])
    ent(74, 46, 24, 14, "password_reset_tokens\n/ email_verification_tokens", ["token = SHA-256 hash", "user_id FK",
                                                                           "expires_at (+24 h)"])
    ent(56, 26, 20, 14, "lesson_plans", ["teacher_id FK", "title, content TEXT"])
    ent(56, 8, 20, 14, "teacher_tasks", ["teacher_id FK", "status, priority", "due_date"])
    ent(79, 26, 19, 14, "activities", ["teacher_id FK", "activity_type", "description"])
    ent(79, 8, 19, 14, "forum_posts +\nforum_comments", ["teacher_id FK", "post_id FK (comments)"])
    ux, uy = 38, 83
    for (x, y) in [(26.5, 87), (26.5, 67)]:
        arrow(ax, (ux - 0.5, uy), (x, y), color=C["be_e"])
    for (x, y) in [(73.5, 89), (73.5, 71), (73.5, 53)]:
        arrow(ax, (62.5, uy), (x, y), color=C["be_e"])
    for (x, y) in [(66, 40.5), (88, 40.5), (66, 22.5), (88, 22.5)]:
        arrow(ax, (50, 69.5), (x, y), color="#999999", ls=":")
    arrow(ax, (15, 57.5), (15, 50.5), color=C["db_e"])
    arrow(ax, (12, 57.5), (12, 30.5), color=C["db_e"], rad=0.25)
    arrow(ax, (26.5, 62), (35, 52.5), color=C["db_e"])
    arrow(ax, (26.5, 60), (36, 30.5), color=C["db_e"], rad=-0.1)
    ax.text(30, 2, "All child tables use ON DELETE CASCADE -> deleting a user removes all of their data.  "
                   "Purple table is also read/written by the Python agents.", fontsize=8, color=C["ink"])
    return save(fig, "be_erd.png", "Core data model actually used by the running app (PostgreSQL)")


def fig_register():
    return sequence("be_register.png", ["Signup page", "Express\nauthController", "bcrypt", "PostgreSQL"],
                    [(0, 1, "POST /api/auth/register {email, password, full_name, ...}"),
                     (1, 1, "normalise email (trim+lowercase); pw 8-128 chars"),
                     (1, 3, "SELECT id FROM users WHERE LOWER(email)=$1"),
                     (3, 1, "none -> continue (else 409)", "r"),
                     (1, 2, "hash(password, BCRYPT_ROUNDS=10)"),
                     (2, 1, "$2b$10$... hash", "r"),
                     (1, 3, "BEGIN; INSERT users(... email_verified=true)"),
                     (1, 3, "INSERT teacher_profiles ON CONFLICT(user_id) DO UPDATE"),
                     (1, 3, "COMMIT  (ROLLBACK on any error)"),
                     (1, 0, "201 {message, email}", "r")],
                    title="Registration: one transaction writes users + teacher_profiles",
                    kinds=["fe", "be", "ext", "db"])


def fig_oauth():
    return sequence("be_oauth.png", ["Browser", "Express\n/api/auth", "Google /\nMS / Apple", "PostgreSQL",
                                     "/oauth-callback"],
                    [(0, 1, "GET /api/auth/google (30 req/15 min)"),
                     (1, 2, "302 to provider consent (scope profile,email)"),
                     (2, 1, "GET /google/callback?code=..."),
                     (1, 3, "findOrCreateOAuthUser (password_hash='')"),
                     (1, 3, "INSERT oauth_login_codes(sha256(code), +5 min)"),
                     (1, 4, "302 /oauth-callback?code=<random 32 bytes>"),
                     (4, 1, "POST /api/auth/oauth/exchange {code}"),
                     (1, 3, "DELETE ... WHERE code_hash=$1 AND not expired RETURNING user_id"),
                     (1, 4, "{token: JWT(7d), user}", "r")],
                    title="OAuth sign-in with a one-time exchange code (JWT never in the URL)",
                    kinds=["fe", "be", "ext", "db", "fe"])


def fig_agents_link():
    fig, ax = canvas(12, 5.6)
    box(ax, 2, 55, 24, 38, "Express backend\n/api/agent/chat proxy\n- authenticateToken\n- agentLimiter keyed by\n  req.user.id\n- thread_id := user.id\n- AbortSignal 180 s", "be", fs=8, align="left")
    box(ax, 38, 55, 24, 38, "FastAPI agents\nget_authenticated_user_id()\n-> GET {BACKEND_API_URL}\n   /auth/profile\n200 -> user_id = id\n401 -> 'Invalid or expired'\n503 -> backend down", "ai", fs=8, align="left")
    box(ax, 74, 55, 24, 38, "Scheduling agent\ncalendar_token_store.py\nSELECT access/refresh token\nFROM google_calendar_tokens\nWHERE user_id = thread_id\nrefresh -> UPDATE row", "ai", fs=8, align="left")
    box(ax, 30, 4, 40, 30, "PostgreSQL\nusers (identity)  |  google_calendar_tokens\n(written by Express OAuth callback,\nread + refreshed by Python agent)", "db", fs=8)
    arrow(ax, (26.5, 80), (37.5, 80), "POST /chat + Bearer JWT")
    arrow(ax, (37.5, 66), (26.5, 66), "GET /auth/profile", color=C["ai_e"])
    arrow(ax, (14, 54.5), (34, 34.5), "pg (Node)", off=(-6, 0))
    arrow(ax, (86, 54.5), (66, 34.5), "psycopg2", off=(6, 0), color=C["ai_e"])
    arrow(ax, (62.5, 74), (73.5, 74), "tool 'schedule'")
    return save(fig, "be_agents_link.png", "How identity and data are shared between the backend and the agents")


def build():
    d = Doc("AllMinds_2_Backend_Database_and_Auth.pdf", "Backend, Database & Authentication",
            "Express REST API, PostgreSQL data model, how users are stored and logged in, and how the backend "
            "connects the frontend to the AI agents")
    d.h1("1. Role of the backend in the overall goal")
    d.p("The Express service (apps/backend, port 5000) is the <b>system of record and the security gateway</b>. "
        "It owns user identity, every piece of classroom data (learners, progress, schedules, saved plans, letters) "
        "and the third-party integrations that need secrets (OAuth, Google Calendar, SMTP). It is also the only "
        "door to the AI service: every AI request is authenticated and rate-limited here before it reaches "
        "FastAPI. That lets the agents stay stateless and focus purely on generating teaching support.")
    d.fig(system_overview_figure(), "Position of the backend (green) between the frontend and the agents.")
    d.h2("1.1 Stack")
    d.table([["Area", "Implementation"],
             ["Runtime / framework", "Node 18+, Express 4.18 (server.js boots src/app.js)"],
             ["Database driver", "pg (node-postgres) Pool: max 20 connections, idle 30 s, connect timeout 2 s; "
              "DATABASE_URL with SSL in production, or DB_HOST/PORT/USER/PASSWORD/NAME locally"],
             ["Security", "helmet, CORS allow-list, express-rate-limit, bcrypt, jsonwebtoken, crypto (SHA-256, HMAC)"],
             ["Auth providers", "passport, passport-google-oauth20, passport-oauth2 (Microsoft, Apple with JWKS check)"],
             ["Other", "multer (admin document upload), nodemailer (reset/verify e-mail), compression"],
             ["Schema management", "npm run db:init (docs/database/allminds_complete_schema.sql) then npm run "
              "db:migrate (ordered .sql files, tracked in schema_migrations, each in a transaction)"],
             ["Deployment", "Render web service (Frankfurt) with managed Postgres; preDeploy runs init + migrate; "
              "health check GET /api/health"]],
            [4, 13], "Backend stack")

    d.h1("2. Request pipeline and API surface")
    d.fig(fig_pipeline(), "Every request passes the same middleware chain before reaching a controller.")
    d.table([["Mount point", "Endpoints", "Protection"],
             ["/api/auth", "POST /register, POST /login, GET /profile, GET|POST /verify-email, "
              "POST /resend-verification", "login/register: 20 req / 15 min / IP"],
             ["/api/auth (oauthRoutes)", "GET /google, /microsoft, /apple (+ /callback), POST /oauth/exchange",
              "30 req / 15 min"],
             ["/api/auth (passwordReset)", "POST /forgot-password, POST /reset-password",
              "5 / hour and 20 / hour"],
             ["/api/profile", "GET /, PUT / (users + teacher_profiles + language_pref)", "JWT"],
             ["/api/learners", "GET /, POST /, POST /bulk (1-1000 rows, one transaction), GET|POST "
              "/:id/sensory-logs, GET|POST /:id/progress", "JWT, scoped by teacher_id"],
             ["/api/activities", "GET /activities, lesson-plans CRUD, tasks GET/POST/PATCH, schedule-items "
              "GET/POST/PATCH/DELETE", "JWT"],
             ["/api/parent-communications", "GET /?learnerId, POST /", "JWT"],
             ["/api/forum", "GET /, POST /, GET|POST /:postId/comments", "GET public, POST JWT"],
             ["/api/strategies", "GET /, GET /:id, POST /, POST /:id/vote (UNIQUE strategy_id,user_id)", "writes JWT"],
             ["/api/ngos", "GET /, GET /:id, POST /:id/review", "review JWT"],
             ["/api/school", "classes, teachers, assign-teacher, learners, documents/upload (multer)",
              "JWT + authorizeAdmin"],
             ["/api/stats", "GET /admin, GET /teacher", "JWT"],
             ["/api/calendar", "GET /connect, GET /callback, GET /status, POST /events, DELETE /disconnect",
              "JWT (callback uses signed state)"],
             ["/api/agent", "POST /chat -> FastAPI /chat", "JWT + 60 req / 15 min per user"],
             ["/api/health", "status, timestamp, configured OAuth providers", "public"]],
            [3.6, 9.4, 4], "Complete Express route map")

    d.h1("3. Database - how users and data are stored")
    d.fig(fig_erd(), "Entity-relationship view of the tables the controllers query. users is the root of "
                     "everything; learner data hangs off learner_profiles.")
    d.h2("3.1 How a user is stored")
    d.bullets([
        "<b>users</b> holds identity: unique lower-cased e-mail, <b>bcrypt hash</b> (never the password), full "
        "name, role ('teacher' or 'admin'), school/province/city/phone, language_pref, is_active and "
        "email_verified. A trigger keeps updated_at current.",
        "<b>teacher_profiles</b> is a strict 1:1 extension (UNIQUE user_id) with title, name, surname and "
        "theme_preference. Register and OAuth both upsert it, so every user always has one.",
        "OAuth-only accounts are inserted with <i>password_hash = ''</i>; bcrypt.compare can never match an empty "
        "hash, so those accounts cannot be logged into with a password - only through their provider.",
        "Secrets that are bearer-equivalent are stored <b>hashed</b>: password-reset and e-mail verification tokens "
        "(SHA-256, 24 h expiry, single use), and OAuth exchange codes (SHA-256, 5 min, deleted on use).",
    ])
    d.h2("3.2 How learners are stored (privacy by design)")
    d.p("Learners are not users. A <b>learner_profiles</b> row belongs to one teacher (teacher_id) and is identified "
        "by an <b>anonymous_id</b> (e.g. LEARNER-1A2B3C4D generated with crypto.randomUUID when the CSV lacks one). "
        "Everything else lives in a flexible <b>profile_data JSONB</b> column, so schools can upload any CSV shape. "
        "Progress and sensory observations are append-only JSONB rows in learner_progress and sensory_toolkit_logs; "
        "each insert also writes an <i>activities</i> row that feeds the dashboard timeline. Every query filters by "
        "<i>teacher_id = req.user.id</i>, so one teacher can never read another's learners.")
    d.note("The schema file also contains a school-level model (schools, classes, teacher_classes, learners, "
           "curriculum_documents, lesson_history, ngos, community_strategies) used by the admin /api/school and "
           "/api/stats endpoints. The teacher app primarily uses the learner_profiles family shown in the figure.")

    d.h1("4. Authentication and login")
    d.fig(fig_register(), "Registration writes the user and profile atomically.")
    d.h2("4.1 Login and the JWT")
    d.p("<b>POST /api/auth/login</b> normalises the e-mail, loads the user, rejects inactive accounts, runs "
        "<i>bcrypt.compare</i> and issues <i>jwt.sign({id, email, role}, JWT_SECRET, {expiresIn: '7d'})</i>. The "
        "same generic 'Invalid email or password' is returned for unknown users and bad passwords (no account "
        "enumeration). <b>authenticateToken</b> reads 'Authorization: Bearer', verifies the signature and expiry, "
        "and sets <i>req.user</i>; expired -> 401 'Token expired', tampered -> 403. <b>authorizeAdmin</b> "
        "additionally requires role 'admin'. The token is stateless, which is why the Python agents can validate "
        "it simply by calling GET /api/auth/profile.")
    d.fig(fig_oauth(), "OAuth flow for Google / Microsoft / Apple.")
    d.h2("4.2 Password reset and e-mail verification")
    d.p("forgot-password always answers with the same message (no enumeration), stores SHA-256(token) with a 24 h "
        "expiry, removes older tokens for that user and e-mails <i>FRONTEND_URL/reset-password?token=...</i>. In "
        "development without SMTP it returns reset_link in the JSON. reset-password looks up the hash, checks "
        "expiry, deletes the token (single use) and stores a new bcrypt hash. E-mail verification uses the same "
        "pattern but is currently switched off: register sets email_verified=true until SMTP is configured.")
    d.h2("4.3 Google Calendar connection")
    d.p("GET /api/calendar/connect builds Google's consent URL with a <b>signed state</b>: "
        "base64url(userId:timestamp:HMAC-SHA256(JWT_SECRET)). The callback verifies the HMAC with timingSafeEqual, "
        "rejects states older than 10 minutes, exchanges the code (10 s HTTPS timeout), fetches the Gmail address "
        "and upserts <b>google_calendar_tokens</b> (keeping the old refresh token if Google does not send a new "
        "one). POST /api/calendar/events refreshes the access token if it expires within 60 s and creates the "
        "event in Africa/Johannesburg time.")

    d.h1("5. How the backend connects the frontend and the agents")
    d.fig(fig_agents_link(), "Two integration paths: the HTTP proxy for every AI request, and the shared calendar "
                             "token table used by the scheduling agent.")
    d.bullets([
        "<b>Proxy:</b> agentController.proxyAgentChat copies the request body, forces <i>thread_id</i> to the "
        "authenticated user's id (a client cannot impersonate another thread), forwards the Authorization header "
        "and maps upstream errors ({detail} from FastAPI) to {error}. Timeout -> 502 'The AI request timed out'.",
        "<b>Identity check-back:</b> FastAPI refuses any /chat without a Bearer token and validates it against "
        "Express (30 s timeout). The agents never hold JWT_SECRET.",
        "<b>Shared table:</b> the scheduling agent reads and refreshes tokens in google_calendar_tokens directly "
        "through psycopg2 using the same DATABASE_URL - Express writes, Python reads.",
        "<b>Persisting AI output:</b> agents return text only; the frontend saves results through normal REST "
        "endpoints (lesson_plans, parent_communications), so all durable data flows through Express.",
    ])
    d.h2("5.1 Backend latency budget")
    d.table([["Operation", "Typical time (estimate)", "Configured limit"],
             ["Simple SELECT via pool (same region)", "2-20 ms", "2 s connection timeout"],
             ["Login (bcrypt cost 10)", "60-150 ms (bcrypt dominates, ~50-100 ms)", "20 req / 15 min / IP"],
             ["Bulk learner upload (1000 rows, one transaction)", "0.5-3 s", "1000 rows max"],
             ["Calendar token exchange / event create", "300 ms - 1.5 s (Google round trips)", "10 s per HTTPS call"],
             ["AI proxy", "adds ~5-30 ms; total dominated by the agent (see PDF 3)", "180 s upstream timeout"]],
            [6.2, 6.3, 4.5], "Backend timings. Estimates assume services co-located in one Render region; the "
                             "repository has no load-test data.")

    d.br()
    d.h1("6. Hackathon final - likely questions and model answers")
    d.qa([
        ("How are passwords stored?",
         "Only as bcrypt hashes (cost factor BCRYPT_ROUNDS, default 10) in users.password_hash. Login uses "
         "bcrypt.compare; passwords must be 8-128 characters. OAuth users have an empty hash so password login "
         "is impossible for them."),
        ("Why JWT instead of server sessions?",
         "We have three services. A stateless signed token lets Express validate locally and lets FastAPI "
         "validate by asking Express (/auth/profile) without shared session storage. Trade-off: revocation is "
         "hard before the 7-day expiry - mitigations are short-lived tokens plus refresh tokens or a deny-list."),
        ("How do you stop one teacher seeing another teacher's learners?",
         "Every learner, progress, sensory-log, schedule, plan and letter query is filtered by teacher_id = "
         "req.user.id taken from the verified JWT, never from the request body. Foreign keys with ON DELETE "
         "CASCADE keep ownership consistent."),
        ("How is learner data protected under POPIA?",
         "Learners are stored with an anonymous_id and teacher-controlled JSONB data rather than as user "
         "accounts; AI requests are PII-scrubbed (ID numbers, e-mails, phones) before reaching an LLM; tokens are "
         "hashed; CORS is restricted; Helmet sets security headers. Next steps: encryption at rest for calendar "
         "tokens and a data-retention policy."),
        ("Why JSONB for profile_data and progress_data?",
         "Schools upload CSVs with different columns and progress observations evolve. JSONB keeps the schema "
         "stable while allowing flexible fields, and Postgres can still index and query inside it."),
        ("Explain the OAuth exchange-code design.",
         "After the provider callback we never put the JWT in a URL. We redirect with a random 32-byte code, "
         "store only its SHA-256 with a 5-minute expiry, and the frontend swaps it for a JWT via POST. The DELETE "
         "... RETURNING makes the code single-use even under races."),
        ("What rate limits exist and why?",
         "Login/register 20 per 15 min per IP (credential stuffing), OAuth 30 per 15 min, forgot-password 5 per "
         "hour (e-mail abuse), reset 20 per hour (token guessing), AI chat 60 per 15 min per user (LLM cost "
         "control)."),
        ("How do schema changes get deployed?",
         "Render's preDeploy runs db:init then db:migrate. The migration runner applies .sql files in filename "
         "order, each inside a transaction, and records them in schema_migrations so they run exactly once."),
        ("What happens if the agent service is down?",
         "The proxy catches the fetch failure and returns 502 'Unable to reach the agent service'; the rest of "
         "the app (learners, plans, forum) is unaffected because it does not depend on the agents."),
        ("What are the known weaknesses?",
         "E-mail verification is disabled until SMTP is configured; JWTs live in localStorage; Google calendar "
         "access/refresh tokens are stored in plaintext; the schema SQL and migrations overlap (two sources of "
         "truth); there are no automated backend tests in the repo. Each has a clear remediation path."),
    ])
    return d.build()


if __name__ == "__main__":
    print(build())
