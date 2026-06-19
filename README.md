# AllMinds

AllMinds is a teacher-facing platform built for educators who support neurodivergent learners (ADHD, autism spectrum, dyslexia, dyscalculia, sensory processing differences, and related profiles). It is structured as a monorepo with three independently runnable services.

---

## Repository Structure

```
AllMinds/
├── apps/
│   ├── frontend/          Next.js 13 — teacher dashboard UI
│   ├── backend/           Express — auth, profiles, learners, forum, tasks
│   └── agents/            FastAPI — multi-agent AI teaching companion
├── docs/
│   ├── database/          Schema and setup notes
│   └── audit/             Project improvement notes
└── .env                   Single shared environment file (repo root)
```

---

## Services at a Glance

| Service | Stack | Default Port | Responsibility |
|---|---|---|---|
| `apps/frontend` | Next.js 13, Tailwind CSS | 3000 | Teacher dashboard, chat UI |
| `apps/backend` | Node.js, Express, PostgreSQL | 5000 | Auth, learner profiles, tasks, forum |
| `apps/agents` | Python, FastAPI, LangChain, LangGraph | 8000 | AI multi-agent teaching companion |

---

## What Was Built and Changed

### Agents Service (`apps/agents`)

#### Bug Fixes
| File | Fix |
|---|---|
| `app/core/router.py` | **Complete rewrite.** File was corrupted — contained a raw PowerShell here-string command instead of Python code. Replaced with correct `run_multi_agent` routing function. |
| `app/agents/rag_agent.py` | **Lazy initialisation.** PDF loading and HuggingFace embedding model were running at module import time, crashing the entire server on startup. Moved into a `_get_db()` function that only runs on first RAG request. |
| `app/agents/general_agent.py` | Fixed model name typo: `"gemini -2.5-flash"` → `"gemini-2.5-flash"` |
| `app/agents/lesson_planer_agent.py` | Fixed model name typo: `"gemini -2.5-flash"` → `"gemini-2.5-flash"` |
| `app/agents/Multimodal_agent.py` | Fixed model name typo: `"gemini -2.5-flash"` → `"gemini-2.5-flash"` |

#### Missing Packages Installed
The following packages were in `requirements.txt` but not present in `.venv`:
- `langchain-google-genai`
- `langchain-community`
- `langchain-huggingface`
- `langchain-text-splitters`
- `langgraph`
- `chromadb`
- `pypdf`
- `matplotlib`
- `sentence-transformers`

#### Guardrails (`app/core/guardrails.py`) — New File
A guardrail layer was added to protect every request before it reaches any LLM. It runs at two levels: the API layer (`app/api/index.py`) returns HTTP 400 for blocked requests, and the router layer (`app/core/router.py`) acts as a second check.

| Guardrail | What It Does |
|---|---|
| **Prompt injection** | Blocks "ignore/disregard/forget instructions", "you are now", "jailbreak", "system prompt", "reveal your prompt", "DAN mode", and similar patterns |
| **Harmful content** | Blocks self-harm, abuse, child exploitation, violence, weapon/drug synthesis instructions |
| **Off-topic abuse** | Blocks requests for malware, credential hacking, counterfeit documents, explicit content |
| **PII scrubbing** | Strips 13-digit IDs, email addresses, and phone numbers from all inputs before they reach any LLM |
| **Input length cap** | Rejects inputs over 2,000 characters |
| **Output sanitisation** | Strips `API_KEY=...`, `Bearer ...`, and `sk-...` secrets from responses; truncates responses at 8,000 characters |

#### Router Hardening (`app/core/router.py`)
- Guardrail `check_input` runs before supervisor routing — blocked messages never reach any LLM
- All agent calls wrapped in `try/except` — API key errors and connection failures return a clean message instead of an HTTP 500

### Frontend (`apps/frontend`)

#### Agent Chat Proxy Route (`app/api/agent/chat/route.ts`)
Previously pointed to `http://localhost:5000/api/agent/chat` (the Express backend). Updated to proxy directly to the FastAPI agents service at `AGENTIC_AI_URL/chat`.

#### `lib/api.ts` — `chatWithAgent`
Previously called the Express backend URL for agent requests. Updated to call the Next.js proxy route at `/api/agent/chat` using a relative URL, which keeps CORS clean and decouples the frontend from the agents port.

#### `components/AgentChat.tsx` — New File
A floating chat widget that appears on every dashboard page:
- Floating button (bottom-right corner) opens a slide-in panel
- Chat history with user and assistant bubbles
- "Thinking..." loading state while waiting for a response
- `Enter` to send, `Shift+Enter` for a new line
- Passes `thread_id` from `localStorage` so conversation context is per-user
- Handles errors gracefully (displays error message in the chat rather than crashing)

#### `components/DashboardLayout.tsx`
`<AgentChat />` added so it renders on every dashboard page without needing to add it to each page individually.

#### `.env.local` — New File
```
AGENTIC_AI_URL=http://127.0.0.1:8000
```
Picked up by the Next.js proxy route at server runtime. Not committed — each developer sets their own local values.

---

## Environment Variables

All variables live in a single `.env` file at the repo root (`AllMinds/.env`). Copy the values below as a starting point.

```env
# ── Ports ────────────────────────────────────────────────────────────────────
PORT=5000

# ── Database ─────────────────────────────────────────────────────────────────
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_db_password
DB_NAME=allminds_db

# ── Auth ─────────────────────────────────────────────────────────────────────
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=10

# ── Email ────────────────────────────────────────────────────────────────────
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=noreply@allminds.org

# ── URLs ─────────────────────────────────────────────────────────────────────
BACKEND_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:5000/api
AGENTIC_AI_URL=http://127.0.0.1:8000
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
APP_TIMEZONE=Africa/Johannesburg

# ── AI API Keys ───────────────────────────────────────────────────────────────
GROQ_API_KEY=your_groq_api_key         # Used by the supervisor agent (routing)
GEMINI_API_KEY=your_gemini_api_key     # Used by all content-generating agents
```

> **Never commit real API keys.** The `.env` file is in `.gitignore`. Each developer must populate it locally.

---

## How to Run Locally

You need three terminals running simultaneously.

### Prerequisites
- Node.js 18+
- Python 3.11+
- PostgreSQL (running locally)
- A `.env` file at `AllMinds/` with real values for `DB_*`, `GROQ_API_KEY`, and `GEMINI_API_KEY`

---

### Step 1 — Database

Make sure PostgreSQL is running and the database exists:

```bash
psql -U postgres -c "CREATE DATABASE allminds_db;"
```

Then run the schema (from `docs/database/`):

```bash
psql -U postgres -d allminds_db -f docs/database/schema.sql
```

---

### Step 2 — Backend (Express)

```bash
cd apps/backend
npm install
npm run dev
```

Runs on `http://localhost:5000`. Handles auth, learner profiles, tasks, forum, and parent communications.

---

### Step 3 — Agentic AI (FastAPI)

```bash
cd apps/agents
python -m venv .venv                        # only needed once
.venv/Scripts/activate                      # Windows
# source .venv/bin/activate                 # Mac/Linux
pip install -r requirements.txt             # only needed once
python main.py
```

Runs on `http://localhost:8000`. Test it is healthy:

```bash
curl http://localhost:8000/health
# {"status": "ok"}
```

---

### Step 4 — Frontend (Next.js)

```bash
cd apps/frontend
npm install
npm run dev
```

Runs on `http://localhost:3000`.

Also create `apps/frontend/.env.local` with:

```env
AGENTIC_AI_URL=http://127.0.0.1:8000
```

---

### Step 5 — Open the App

Go to `http://localhost:3000`, register or log in, and open the dashboard.

The **Thandi** chat button (blue, bottom-right corner) connects to the agents service. Click it and ask anything — lesson plans, visual support ideas, behaviour strategies, scheduling help, or analytics questions.

---

## Request Flow

```
Browser
  │
  ├── GET/POST /api/* (auth, learners, tasks...)
  │     └── Express backend  (port 5000)
  │           └── PostgreSQL (port 5432)
  │
  └── POST /api/agent/chat
        └── Next.js proxy route
              └── FastAPI agents  (port 8000)
                    ├── Guardrails (input check, PII scrub)
                    ├── Supervisor agent  → Groq (routing decision)
                    └── Worker agent      → Gemini (response)
```

---

## Agentic AI — Agent Routing

The supervisor uses a Groq LLM to classify each teacher request and route it to the right worker:

| Agent | Handles |
|---|---|
| `general` | Classroom strategies, behaviour support, IEP guidance, parent communication, general advice |
| `lesson` | Creating or adapting lesson plans, worksheets, scaffolded activities |
| `multimodal` | Multi-format learning experiences (text, visual, tactile, audio, sensory) |
| `schedule` | Visual schedules, timetables, transition routines, time-blocking |
| `visual` | Visual supports — now/next boards, social stories, emotion charts, token boards |
| `analytics` | Student progress tracking, behaviour charts, IEP goal metrics |

If the Groq API key is missing, the supervisor defaults to the `general` agent. If the Gemini API key is missing, agents return a clear error message instead of crashing.

---

## Guardrails — What Gets Blocked

Every message passes through `app/core/guardrails.py` before reaching any LLM:

- Prompt injection attempts (jailbreaks, "ignore instructions", persona overrides)
- Self-harm, abuse, or violent content
- Requests for malware, credential hacking, or counterfeit documents
- Messages over 2,000 characters
- PII is scrubbed (IDs, emails, phone numbers) from all inputs automatically
- API keys and secrets are stripped from all outputs automatically

Blocked requests return HTTP 400 with a plain-English reason. They never reach the LLM.
