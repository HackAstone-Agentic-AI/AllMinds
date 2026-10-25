from common import *
import numpy as np

# (id, severity, issue, evidence, suggested fix)
SEC = [
    ("S1", "High", "OAuth accounts are auto-linked by e-mail with no proof the provider verified it. Microsoft uses "
     "mail or userPrincipalName; every OAuth login also forces email_verified = true.",
     "config/passport.js findOrCreateOAuthUser, Microsoft profile mapping",
     "Require the provider's email_verified claim; add a user_identities(provider, subject) table and link on "
     "subject id, not e-mail; ask for confirmation before linking to an existing password account."),
    ("S2", "High", "JWT lives in localStorage for 7 days with no logout, refresh or revocation.",
     "lib/api.ts, login/page.tsx, authController.js",
     "httpOnly + Secure + SameSite cookie; 15-minute access token plus rotating refresh token; token_version "
     "column so a password reset or logout invalidates old tokens."),
    ("S3", "High", "No Content-Security-Policy anywhere (Helmet CSP disabled, none in next.config.js). Together "
     "with S2, any XSS becomes full account takeover.",
     "app.js helmet({contentSecurityPolicy:false}); next.config.js headers",
     "Ship a strict CSP (nonces, no inline scripts, connect-src limited to API hosts); add Trusted Types later."),
    ("S4", "High", "Google Calendar access and refresh tokens are stored in plaintext in Postgres.",
     "google_calendar_tokens; calendarController.js; calendar_token_store.py",
     "Encrypt with AES-256-GCM using a key from a secrets manager (or pgcrypto + KMS); rotate keys; request the "
     "narrowest scope (calendar.events instead of full calendar)."),
    ("S5", "High", "/api/stats/admin has no authorizeAdmin and reads users.school_id, a column that does not "
     "exist, so it fails for everyone.",
     "routes/statsRoutes.js; statsController.js getSchoolIdByAdmin",
     "Add authorizeAdmin, add users.school_id (FK to schools) via a migration, and add a test for 403 vs 200."),
    ("S6", "Medium", "E-mail verification is switched off, so anyone can register with any address "
     "(squatting, spam, fake accounts).", "authController.register; emailVerificationController.js",
     "Configure a transactional e-mail provider (SES, Postmark, Resend), turn the gate back on, add SPF/DKIM/DMARC."),
    ("S7", "Medium", "Database TLS accepts any certificate (rejectUnauthorized:false).", "config/database.js",
     "Use the provider's CA bundle with verification on, or Render's private network URL."),
    ("S8", "Medium", "Configuration fails open: CORS allows every origin if ALLOWED_ORIGINS/FRONTEND_URL are empty; "
     "missing URLs silently default to localhost; only JWT_SECRET is checked and not for strength.",
     "app.js CORS callback; config/env.js",
     "In production refuse to start unless required variables are present; require JWT_SECRET >= 32 random bytes; "
     "validate with zod/envalid."),
    ("S9", "Medium", "Rate limiters use the default in-memory store: counters are per instance and reset on every "
     "restart, so limits weaken as soon as you run two instances.", "express-rate-limit usage in routes/*.js",
     "Use a Redis store; add per-account lockout/backoff on repeated failed logins."),
    ("S10", "Medium", "bcrypt only reads the first 72 bytes but passwords up to 128 characters are accepted; there "
     "is no breached-password check.", "authController.js, passwordResetController.js",
     "Cap at 72 bytes or pre-hash with SHA-256, or move to argon2id; check the Have I Been Pwned k-anonymity API."),
    ("S11", "Medium", "The same JWT_SECRET signs login tokens and the calendar OAuth state HMAC (key reuse).",
     "calendarController.js buildState", "Use separate secrets per purpose (derive with HKDF)."),
    ("S12", "Medium", "Prompt-injection guard only inspects the chat message. learner_name, records[], "
     "support_need and other structured fields go into prompts unchecked.", "api/index.py ChatRequest; agents",
     "Validate with strict pydantic models, length-limit and strip control text, wrap user data in delimiters "
     "and tell the model to treat it as data; add an injection test suite."),
    ("S13", "Medium", "A teacher who writes 'my student talks about self-harm' is blocked by the regex with a "
     "generic refusal, exactly when a safeguarding answer is needed.", "core/guardrails.py _HARM_PATTERNS",
     "Split 'unsafe request' from 'safeguarding concern': respond with a vetted script (who to tell, SA helplines, "
     "school child-protection procedure) instead of a refusal; log for review."),
    ("S14", "Low", "Reset links are returned in the API response whenever NODE_ENV is not 'production' and SMTP is "
     "missing; a mis-set staging environment would leak them.", "passwordResetController.js",
     "Gate on an explicit ALLOW_DEV_RESET_LINK flag that is never set outside local development."),
]

DATA = [
    ("D1", "High", "Migration 20260629 uses ADD CONSTRAINT IF NOT EXISTS, which PostgreSQL does not support. "
     "Because Render runs db:migrate before every deploy, this blocks releases on a clean database.",
     "migrations/20260629_forum_comments_and_schedule_unique.sql",
     "Wrap in a DO $$ ... IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = ...) $$ block; run all "
     "migrations on an empty database in CI."),
    ("D2", "High", "teacher_profiles.name and surname are NOT NULL, but register and OAuth insert NULL when a "
     "value is missing (a single-word Google display name gives an empty surname), so sign-in can fail with a "
     "constraint error.", "docs/database schema lines 185-186; authController.js; passport.js parseName",
     "Make the columns nullable or default to '', and add a test for single-name and missing-name sign-ups."),
    ("D3", "Medium", "Three sources of truth for the schema (docs/database, README/ copy with a different hash, "
     "migrations). The baseline lacks email_verified; init-db skips if users already exists.",
     "README/allminds_complete_schema.sql; docs/database; scripts/init-db.js",
     "One baseline plus numbered, immutable migrations (node-pg-migrate or Flyway); delete the duplicate; "
     "CI check that a fresh database equals the migrated one."),
    ("D4", "Medium", "E-mail case is inconsistent: register lowercases, OAuth inserts and looks up the raw "
     "address, login uses email = $1. Duplicate or unreachable accounts are possible.",
     "passport.js; authController.js",
     "Use citext or a unique index on lower(email); normalise at every entry point."),
    ("D5", "Medium", "Teacher data has no deletion or export path (POPIA right to erasure and access); no backup, "
     "point-in-time-recovery or restore drill is documented.", "no endpoint; render.yaml basic-256mb plan",
     "DELETE /api/profile (cascades already exist), data-export endpoint, retention policy; enable PITR and test "
     "a restore."),
    ("D6", "Medium", "Uploaded curriculum documents are written to local disk (multer diskStorage), which Render "
     "wipes on every deploy; no malware scan.", "schoolController.js",
     "Store in S3-compatible object storage with signed URLs and a virus scan; keep only metadata in Postgres."),
    ("D7", "Low", "Pool of 20 connections per instance can exceed the connection cap of a small Postgres plan; "
     "2 s connect timeout is tight; no statement_timeout.", "config/database.js",
     "Put PgBouncer in front, size the pool from the plan, set statement_timeout and idle_in_transaction timeouts."),
    ("D8", "Low", "language_pref defaults to 'English' in the schema but the code uses codes such as 'en', 'zu'.",
     "users.language_pref", "Default to 'en' and add a CHECK against the 11 supported codes."),
]

AI = [
    ("A1", "High", "Blocking LLM calls inside an async FastAPI handler. While one 60-second lesson plan runs, the "
     "event loop is blocked, so /health and every other request stall on that worker.",
     "api/index.py chat_endpoint -> run_multi_agent (sync)",
     "Declare the endpoint with def (thread pool) or use run_in_threadpool / async LLM clients; run several "
     "Uvicorn workers; make /health independent of work."),
    ("A2", "High", "RAG index is rebuilt with Chroma.from_documents on every process start. On a persisted "
     "directory this re-adds the same chunks (duplicate hits, growing store) and causes a 30-120 s cold start; "
     "the folder is also on ephemeral disk.", "agents/rag_agent.py _get_db",
     "Build the index once at image build time (or a CI job), load with Chroma(persist_directory=...), use "
     "deterministic chunk ids, warm it at startup and report readiness in /health."),
    ("A3", "High", "No per-call timeouts, retries, circuit breaker or fallback model. Only the outer 180 s limit "
     "protects the request; one slow provider ties up a worker for minutes.", "all agents (llm.invoke)",
     "Set request_timeout and max_retries on each client, add tenacity back-off, circuit-break a failing "
     "provider, and fall back Pro -> Flash for lesson plans."),
    ("A4", "High", "Failures are invisible: run_multi_agent catches every exception, logs nothing, and guesses the "
     "cause by looking for 'api', 'key' or 'connect' in the message.", "core/router.py except block",
     "logger.exception with request id, user id (hashed) and agent; return stable error codes; alert on rate."),
    ("A5", "Medium", "Conversation memory is not wired in; the SQLite file uses a relative path, opens a "
     "connection per call and would be lost on redeploy.", "core/memory_tools.py",
     "Add langgraph + langgraph-checkpoint-sqlite (or use Postgres), absolute MEMORY_DB_PATH on a persistent "
     "disk, scrub PII before saving, expose a delete-my-memory call."),
    ("A6", "Medium", "Analytics charts are written to a relative 'charts/' folder named after the learner label: "
     "two teachers with the same label overwrite each other's files, files are never deleted and the paths are "
     "never returned to the UI.", "core/analytics_automation.py build_charts",
     "Render to in-memory buffers (or a temp dir with uuid names, cleaned up) and return them, or remove the "
     "dead code because the frontend draws its own charts."),
    ("A7", "Medium", "Images are generated one after another and returned as base64 data URIs inside the JSON "
     "(megabytes per response, slow, uncacheable).", "core/visual_media.py",
     "Generate in parallel, upload to object storage and return URLs; cache by topic+grade."),
    ("A8", "Medium", "Cost control is limited to 60 requests / 15 min per user. No daily token or spend budget, no "
     "caching of repeat curriculum questions, visual agent may call the LLM twice.", "agentRoutes.js; "
     "visual_support_agent.py retry",
     "Per-user and per-school daily quotas, response cache for RAG and common prompts, spend alerts at the "
     "provider."),
    ("A9", "Medium", "Every chat does an extra HTTP call to Express to validate the JWT, making Express a single "
     "point of failure for the AI path.", "api/index.py get_authenticated_user_id",
     "Verify the JWT locally (RS256 public key) or cache validation for 60 s."),
    ("A10", "Medium", "No automated quality evaluation: routing accuracy, curriculum correctness and "
     "neurodivergent-affirming tone are untested; RAG answers return no source page citations.",
     "no eval set; rag_agent.py",
     "Build a golden set of 100+ prompts, run it in CI with LLM-as-judge plus human review, return page numbers "
     "from retrieved chunks."),
    ("A11", "Low", "apps/agents/vercel.json routes everything to a Vercel Python function; serverless time and size "
     "limits cannot host 25-90 s generations plus torch and ChromaDB.", "apps/agents/vercel.json",
     "Delete it or document that Render is the only supported host."),
    ("A12", "Low", "Dependencies use ranges with no lock file (pip) so builds are not reproducible; "
     "sqlalchemy is listed but only an unused model imports it.", "requirements.txt",
     "Lock with uv or pip-tools, use CPU-only torch, drop unused packages, add pip-audit."),
    ("A13", "Medium", "Learner and teacher text is sent to Google and Groq (outside South Africa). The repo has no "
     "data-processing agreement, consent text or opt-out.", "all agents",
     "Use paid/enterprise API tiers whose terms exclude training on your data, sign DPAs, document cross-border "
     "transfer under POPIA section 72, add consent and a 'do not enter identifying details' notice."),
]

FE = [
    ("F1", "Medium", "Long AI requests are a single blocking fetch (up to 185 s) with no cancel, progress or "
     "resume; intermediate proxies and mobile networks commonly drop idle connections well before that.",
     "lib/api.ts chatWithAgent; route.ts",
     "Job pattern: POST returns 202 + id, UI polls or listens over SSE; add an abort button and stream partial "
     "text."),
    ("F2", "Medium", "No automated tests of any kind in the repository (no unit, API, component or end-to-end "
     "tests), so every change is verified by hand.", "whole repo",
     "Jest + Supertest (backend), pytest with mocked LLMs (agents), Vitest/RTL and Playwright (frontend)."),
    ("F3", "Medium", "Very large page components (learnerAnalytics 1021 lines, assessment-planner 789) and "
     "widespread 'any' types; no error boundaries or error.tsx.", "app/dashboard/**",
     "Split into hooks and components, generate types from an OpenAPI spec, add error.tsx/not-found.tsx."),
    ("F4", "Low", "Next.js 13.5 is two majors behind; no dependency or licence scanning.",
     "package.json", "Upgrade to a supported Next.js, enable Dependabot and npm audit in CI."),
    ("F5", "Low", "Accessibility is not verified even though the audience is neurodivergent teachers; "
     "jsPDF default fonts may not render every SA-language character (e.g. Tshivenda).", "components, exports",
     "axe-core in CI, WCAG 2.2 AA review, embed a Unicode font (Noto Sans) in jsPDF."),
    ("F6", "Low", "Low-bandwidth and offline behaviour: large data-URI images, no caching or PWA support for "
     "schools with poor connectivity.", "image_aids handling", "Serve images by URL with CDN caching; PWA shell."),
]

OPS = [
    ("O1", "High", "No CI/CD: no pipeline for lint, test, build, migration test, dependency audit or secret "
     "scanning; no staging environment.", "no .github/ directory",
     "GitHub Actions: lint + test + build on PR, gitleaks, npm audit / pip-audit, deploy to staging, "
     "smoke test, manual promote to production."),
    ("O2", "Medium", "Observability gap: 83 console.log/error calls, no structured logs, request ids, metrics, "
     "tracing or alerting. /api/health always says OK without touching the database; the agent /health does not "
     "check models or the vector index.", "app.js; api/index.py",
     "pino/structlog JSON logs with request id propagated across the three services, Sentry, OpenTelemetry, "
     "uptime checks, readiness endpoints that test DB and providers."),
    ("O3", "Medium", "No .env.example and no Dockerfiles, so onboarding and environment parity depend on tribal "
     "knowledge; agent image will be large (torch + sentence-transformers).", "repo root",
     "Commit .env.example per service, multi-stage Dockerfiles, docker-compose for local dev, pre-download the "
     "embedding model in the image."),
    ("O4", "Medium", "Single region, single instance per service and no autoscaling policy; no documented "
     "SLOs, runbook or incident process.", "render.yaml",
     "Define SLOs (e.g. p95 chat latency, 99.5% availability), 2+ instances for stateless services, runbooks, "
     "on-call alert routes."),
    ("O5", "Low", "Repository hygiene: legacy demo HTML inside backend/src, README/ folder holding a schema copy, "
     "stale system-design.json (says Next.js calls FastAPI directly), file names with typos "
     "(lesson_planer_agent.py).", "apps/backend/src/frontend-demo; system-design.json",
     "Delete or move demo files, update the design doc, rename files."),
    ("O6", "Medium", "Legal and governance: no privacy policy, terms, consent flow, records of processing, "
     "information-officer details or AI-use disclaimer ('not a diagnostic tool; not a substitute for an "
     "educational psychologist').", "frontend, docs",
     "POPIA gap assessment, privacy notice and consent on sign-up, DPA with schools, appoint an information "
     "officer, show disclaimers on every AI result."),
]

GOOD = [
    "All SQL uses parameterised queries ($1...), including the dynamic NGO search.",
    "Every learner, progress, sensory and schedule query is scoped by teacher_id from the verified JWT "
    "(no insecure direct object references found).",
    "Reset, verification and OAuth tokens are stored only as SHA-256 hashes, single use and time-limited.",
    "Helmet, compression, CORS allow-list support, rate limits on auth, OAuth, reset and AI routes.",
    "Input and output guardrails, PII scrubbing and graceful degradation when a provider key is missing.",
    "Transactional registration, graceful shutdown, tracked migrations, health checks, security headers on Next.js.",
]


def fig_matrix():
    items = [  # id, effort(1-5), impact(1-5)
        ("S1", 3, 4.6), ("S2", 4, 4.5), ("S3", 2, 4.3), ("S4", 3, 4.0), ("S5", 1, 3.6), ("S6", 2, 3.5), ("S7", 1, 3.0),
        ("S8", 1, 3.9), ("S9", 2, 3.0), ("S12", 3, 3.4), ("S13", 2, 3.6), ("D1", 1, 4.8), ("D2", 1, 4.2), ("D3", 3, 3.2),
        ("D5", 3, 3.7), ("D6", 3, 3.0), ("A1", 2, 4.7), ("A2", 3, 4.4), ("A3", 2, 4.1), ("A4", 1, 4.0), ("A5", 3, 2.8),
        ("A8", 3, 3.3), ("A13", 4, 3.9), ("F1", 4, 3.2), ("F2", 4, 4.0), ("O1", 3, 4.5), ("O2", 3, 3.5), ("O6", 4, 4.2),
    ]
    fig, ax = plt.subplots(figsize=(9.5, 6))
    ax.axvspan(0.5, 2.5, ymin=0.5, ymax=1, color="#E3F4E1", alpha=0.7)
    ax.axvspan(2.5, 5.5, ymin=0.5, ymax=1, color="#FFF1D6", alpha=0.7)
    ax.axhline(3.4, color="#999", lw=0.8, ls="--")
    ax.axvline(2.5, color="#999", lw=0.8, ls="--")
    col = {"S": "#B23B3B", "D": "#B7791F", "A": "#8A3FA0", "F": "#2F6FB3", "O": "#3C8A3A"}
    seen = {}
    for i, (k, e, im) in enumerate(items):
        key = (e, round(im, 1))
        off = seen.get((e, int(im * 2)), 0)
        seen[(e, int(im * 2))] = off + 1
        ax.scatter(e + 0.12 * off - 0.06, im, s=260, color=col[k[0]], alpha=0.9, zorder=3)
        ax.text(e + 0.12 * off - 0.06, im, k, ha="center", va="center", color="white", fontsize=6.6, fontweight="bold", zorder=4)
    ax.text(0.6, 4.95, "QUICK WINS: do first", color="#3C8A3A", fontweight="bold", fontsize=9)
    ax.text(2.6, 4.95, "PLAN AND SCHEDULE", color="#B7791F", fontweight="bold", fontsize=9)
    ax.set_xlim(0.5, 5.2)
    ax.set_ylim(2.4, 5.1)
    ax.set_xticks([1, 2, 3, 4, 5])
    ax.set_xticklabels(["hours", "1-2 days", "~1 week", "2-3 weeks", "a month+"])
    ax.set_xlabel("Effort to fix", fontsize=9)
    ax.set_ylabel("Impact if it goes wrong", fontsize=9)
    from matplotlib.lines import Line2D
    ax.legend(handles=[Line2D([0], [0], marker="o", ls="", color=c, label=l, markersize=8) for c, l in
                       [(col["S"], "Security"), (col["D"], "Data / database"), (col["A"], "AI agents"),
                        (col["F"], "Frontend"), (col["O"], "Operations / legal")]], loc="lower right", fontsize=8)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    ax.set_title("Prioritisation: impact versus effort (top findings)", fontsize=11, fontweight="bold")
    return save(fig, "prod_matrix.png")


def fig_counts():
    cats = [("Security", SEC), ("Data / DB", DATA), ("AI agents", AI), ("Frontend", FE), ("Ops / legal", OPS)]
    fig, ax = plt.subplots(figsize=(9, 3.4))
    sev = [("High", "#B23B3B"), ("Medium", "#E0A030"), ("Low", "#7AA7D9")]
    left = np.zeros(len(cats))
    for name, c in sev:
        vals = [sum(1 for r in lst if r[1] == name) for _, lst in cats]
        ax.barh([x for x, _ in cats], vals, left=left, color=c, label=name)
        for i, v in enumerate(vals):
            if v:
                ax.text(left[i] + v / 2, i, str(v), ha="center", va="center", color="white", fontsize=8, fontweight="bold")
        left += np.array(vals)
    ax.invert_yaxis()
    ax.legend(loc="lower right", fontsize=8)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    ax.set_xlabel("number of findings", fontsize=9)
    ax.set_title("Findings by area and severity", fontsize=11, fontweight="bold")
    return save(fig, "prod_counts.png")


def fig_target():
    fig, ax = canvas(12, 6.2)
    box(ax, 1, 78, 18, 17, "Browser / PWA\nhttpOnly cookie, CSP,\nSSE progress,\nerror boundaries", "fe", fs=7.8)
    box(ax, 23, 78, 16, 17, "CDN + WAF\nTLS, bot and\nrate protection", "ext", fs=7.8)
    box(ax, 43, 78, 22, 17, "Express API (2+ instances)\nRS256 JWT, Redis rate limit,\nrequest id, Sentry, pino", "be", fs=7.8)
    box(ax, 69, 78, 30, 17, "Job queue (Redis)\nAI request -> 202 + job id\nworkers scale independently", "ai", fs=7.8)
    box(ax, 1, 48, 22, 20, "PgBouncer -> PostgreSQL\nPITR backups, TLS verify,\nciteext e-mail, migrations\nin CI", "db", fs=7.8)
    box(ax, 27, 48, 22, 20, "Object storage\ndocuments + generated\nimages (signed URLs,\nvirus scan)", "db", fs=7.8)
    box(ax, 53, 48, 22, 20, "Agent workers (stateless)\nasync/threadpool, timeouts,\nretries, circuit breaker,\nmodel fallback", "ai", fs=7.8)
    box(ax, 79, 48, 20, 20, "Memory + RAG\nLangGraph checkpointer in\nPostgres; prebuilt Chroma\nindex in the image", "ai", fs=7.8)
    box(ax, 1, 8, 30, 28, "Quality gates (GitHub Actions)\nlint, unit, API, e2e, migration test,\nnpm audit, pip-audit, gitleaks,\nAI eval set on every prompt change", "warn", fs=7.8)
    box(ax, 36, 8, 28, 28, "Observability\nstructured logs, traces,\nmetrics, SLO alerts,\nuptime + readiness checks", "ext", fs=7.8)
    box(ax, 69, 8, 30, 28, "Governance (POPIA)\nprivacy notice + consent, DPAs,\nretention + erasure, AI disclaimer,\nspend and quota alarms", "ext", fs=7.8)
    for x in (19.5, 39.5, 65.5):
        arrow(ax, (x, 86), (x + 3.2, 86))
    arrow(ax, (54, 77.5), (12, 68.5)); arrow(ax, (54, 77.5), (38, 68.5)); arrow(ax, (84, 77.5), (64, 68.5))
    arrow(ax, (64, 58), (78.5, 58))
    return save(fig, "prod_target.png", "Target production architecture (what the fixes add up to)")


def table_for(d, title, rows, cap):
    d.h2(title)
    d.table([["ID", "Severity", "Issue", "Where", "Suggested fix"]] + [[r[0], r[1], r[2], r[3], r[4]] for r in rows],
            [0.9, 1.8, 5.4, 3.2, 5.7], cap)


def build():
    d = Doc("AllMinds_4_Production_Readiness.pdf", "Production Readiness Review",
            "Issues found in the codebase that should be fixed before AllMinds is run as a production service, "
            "with a suggested fix for each")
    total = len(SEC + DATA + AI + FE + OPS)
    high = sum(1 for r in SEC + DATA + AI + FE + OPS if r[1] == "High")
    d.h1("1. Summary")
    d.p(f"AllMinds is a strong hackathon-grade product with a sensible architecture. This review lists "
        f"<b>{total} issues</b> that should be addressed to make it production grade; <b>{high} are rated High</b>. "
        "The most urgent are two defects that can break a release or sign-in outright (D1 migration syntax error, "
        "D2 NOT NULL profile columns), the blocking AI endpoint (A1), the RAG index rebuild (A2), the absence of any "
        "tests or CI (F2, O1), and a handful of security design choices (S1-S5).")
    d.note("<b>How this was produced.</b> Static review of the repository source (backend, agents, frontend, "
           "migrations, deployment files). Nothing was executed against live services or with real API keys, so "
           "timings and runtime behaviour are not measured. Severity is judgement: High means data loss, account "
           "takeover, a blocked release or an outage is plausible; Medium means a real weakness with a workaround; "
           "Low means hygiene. Items citing a file are verified in that file; items in the legal/operations section "
           "are gaps observed in the repository, which may be covered outside it.")
    d.fig(fig_counts(), "Distribution of findings.", width=14)
    d.h2("What is already done well")
    d.bullets(GOOD)
    d.h2("Recommended order of work")
    d.table([["When", "Do this", "Items"],
             ["This week (quick wins)", "Fix release blockers and fail-open configuration; add CI with the first tests; "
              "log AI failures; enable CSP in report-only mode.", "D1, D2, S5, S8, S7, A4, O1, S3"],
             ["Next 2-3 weeks", "Make the AI service non-blocking with timeouts and retries; prebuild the RAG index; "
              "move tokens to cookies with refresh; encrypt calendar tokens; fix OAuth linking; turn on e-mail "
              "verification; Redis rate limits.", "A1, A2, A3, S1, S2, S4, S6, S9"],
             ["Next 1-2 months", "Async job pattern with progress; memory with LangGraph; quotas and caching; AI "
              "evaluation set; observability stack; object storage; consolidate schema; POPIA programme.",
              "F1, A5, A8, A10, O2, D3, D6, O6, A13"],
             ["Ongoing", "Dependency upgrades, accessibility, load tests, SLO reviews, incident drills.",
              "F4, F5, O4"]],
            [3.2, 10.8, 3], "Suggested roadmap")
    d.fig(fig_matrix(), "Quick wins are in the top-left; High-impact items needing more work sit top-right.", width=14.5)

    d.br()
    d.h1("2. Findings and suggested fixes")
    table_for(d, "2.1 Security and authentication", SEC, "Security findings")
    table_for(d, "2.2 Database and data integrity", DATA, "Database findings")
    table_for(d, "2.3 AI agents (reliability, cost, quality, privacy)", AI, "Agent findings")
    table_for(d, "2.4 Frontend and user experience", FE, "Frontend findings")
    table_for(d, "2.5 Operations, delivery and governance", OPS, "Operations findings")

    d.h1("3. What 'production grade' should look like")
    d.fig(fig_target(), "The target state the fixes converge on.", width=17)
    d.h2("3.1 Launch checklist")
    d.table([["Area", "Done when"],
             ["Release", "Fresh database migrates cleanly in CI; staging mirrors production; one-click rollback."],
             ["Security", "Cookie auth with refresh, CSP enforced, tokens encrypted, OAuth linked by subject id, "
              "secrets in a manager, dependency and secret scans green."],
             ["Reliability", "AI calls have timeouts/retries/fallbacks; /health reflects real readiness; load test "
              "shows target p95 at expected concurrent teachers."],
             ["Data", "Backups with a tested restore, PITR on, erasure and export endpoints, retention schedule."],
             ["AI quality", "Evaluation set passes thresholds; safeguarding path for self-harm/abuse; clear "
              "disclaimers; cost alarms."],
             ["Compliance", "POPIA review complete, privacy notice and consent live, DPAs signed with Google, Groq "
              "and the hosting provider."],
             ["Operations", "Dashboards, alerts, runbooks, on-call owner, incident template."]],
            [3, 14], "Launch checklist")

    d.br()
    d.h1("4. Hackathon final - questions about production readiness")
    d.qa([
        ("Is this ready for real schools tomorrow?",
         "It is a working, well-structured product with good fundamentals (parameterised SQL, per-teacher data "
         "scoping, hashed tokens, guardrails). For paying schools we would first close the High items: release "
         "blockers, non-blocking AI service, tests and CI, and the token/CSP hardening. That is roughly a "
         "four-to-six-week plan, not a rewrite."),
        ("What is your biggest technical risk?",
         "Reliability of the AI path under concurrency: synchronous model calls on an async server plus a cold "
         "RAG index. We would fix it with a threadpool or job queue, prebuilt index, timeouts and a fallback model."),
        ("How do you protect children's data?",
         "Learners are pseudonymised, every query is scoped to the owning teacher, PII is scrubbed before any model "
         "call and tokens are hashed. Production needs encryption of calendar tokens, a retention and erasure "
         "process, signed processing agreements with AI providers, and POPIA consent."),
        ("How would you know the AI is good enough?",
         "A golden evaluation set run in CI on every prompt or model change: routing accuracy, curriculum "
         "correctness against DCAPS with citations, affirming-language checks, safety refusals, plus periodic "
         "review by an educational psychologist."),
        ("What happens when Gemini or Groq is down?",
         "Today: friendly error and keyword routing without Groq. Target: retries, circuit breaker, Pro-to-Flash "
         "fallback, queued jobs and a status banner, so teachers are never left with a spinner."),
        ("How will it scale to thousands of teachers?",
         "Stateless services behind a load balancer, PgBouncer for Postgres, Redis for rate limits and queues, "
         "object storage for files and images, AI workers scaled separately, and per-user quotas plus caching to "
         "control spend."),
        ("What would you do in the first week with the team?",
         "Fix D1/D2, put CI in place with the first API tests, add structured error logging to the agents, "
         "enforce fail-fast configuration, and ship CSP in report-only mode."),
        ("Why not just rewrite it?",
         "The architecture (Next.js, Express/Postgres, FastAPI agents) is sound and the problems are localised. "
         "Targeted fixes are cheaper and keep the product moving."),
    ])
    return d.build()


if __name__ == "__main__":
    print(build())
