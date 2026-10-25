# Win-readiness fixes (from AllMinds_5_Functional_Components_and_Win_Readiness.pdf)

Every item in the PDF's issue register was implemented. "Tested" says how it was checked in a
local stack (PostgreSQL 16, Express, FastAPI, Next.js production build) **without LLM API keys**,
so paths that need Gemini or Groq were verified with fakes and must be smoke-tested once with real
keys before the final.

## How to run the tests

```bash
# Backend (needs a database with baseline + migrations, e.g. allminds_test)
cd apps/backend && DB_NAME=allminds_test npm test             # 13 tests

# Agents (no keys needed; LLMs are faked)
cd apps/agents && pip install -r requirements.txt -r requirements-dev.txt && pytest   # 31 tests

# Frontend
cd apps/frontend && npx tsc --noEmit && npx next lint && npx next build

# End-to-end (frontend :3000, backend :5000, agents :8000 running)
cd apps/frontend && node e2e/smoke.cjs                         # 13 browser checks
```

## Item by item

| ID | What changed | Tested |
|---|---|---|
| R1 | Migration 20260629 now guards the constraint with a `DO $$ ... pg_constraint` block. | Reproduced the syntax error on a fresh DB, then all 16 migrations apply; a second run applies none. |
| R2 | `teacher_profiles.name/surname` nullable (migration + baseline). | API test inserts a profile with no surname. |
| R3 | `/chat` runs agents in the threadpool; Render starts 2 Uvicorn workers; every LLM client has a timeout and 2 retries. | Agent tests; live stack. |
| R4 | DCAPS index persisted outside the source tree, deterministic chunk ids (no duplicates), warmed at startup, built at deploy (`python -m app.agents.rag_agent build`), status in `/health`. Removed the orphaned partial index from git. | pytest builds the index twice with fake embeddings and checks the count and page citations. The real MiniLM model download was blocked in the sandbox, so run the build command once with network access. |
| W1 | Progress form captures engagement (1-5), task completion (1-5) and attendance; backend validates them; analytics shows "not enough data" under 3 records. | API test, E2E (record shows "Engagement 4/5"; analytics scores are non-zero). |
| W2 | New `support` agent (Gemini Flash) with request-type and urgency guidance; `ChatRequest` accepts `request_type`, `urgency`, `request_context`; the plan is shown on the page. | pytest (prompt contents), E2E (plan panel appears). |
| W3 | Pattern-based PII detector shared by browser and server (ID, e-mail, phone, street address, "named First Last"); applied to forum posts, comments, strategies and NGO reviews. | Unit + API tests, E2E ("students" allowed, phone blocked). |
| W4 | 16 organisations sourced from public directories (Western Cape Government, Disability Connect, SAnews, UFS and others), each with source URL and check date; placeholder rows hidden. Search by need/province/location, explainable ranking (0.5 distance + 0.3 need + 0.2 rating), map, call/WhatsApp/e-mail/directions, rating and "report wrong info". | API + E2E. **The PDF suggested 40-60 organisations; 16 could be sourced here because the organisations' own sites were unreachable from the sandbox. Phone and address fields were only filled where a public listing gave them. Verify each record and add more before the final.** |
| W5 | Demo seed moved out of the baseline (opt-in `npm run db:seed-demo`); shared demo account deactivated by migration; "Load demo classroom" / "Remove demo data" on the dashboard (10 synthetic learners, 8 weeks of records). | API + E2E. |
| W6 | `LoadError` banner with Retry on six pages; modal and comment errors shown instead of swallowed. | Type-check; manual review. |
| W7 | Deterministic event parser (weekday, dates, "at 3" = 15:00, bare numbers are never times); chat now proposes an event and the teacher confirms; schedule page has date and repeat (weekdays/daily/once). | 8 parser cases in pytest, API validation tests, E2E (proposal + confirm). |
| W8 | Analytics agent returns narrative, risk flags and summary; missing marks are "not assessed" instead of 0; invented constants removed; chart files no longer written to disk. | pytest, E2E (narrative + flags rendered). |
| W9 | Staged progress indicator on the planner and visual support; 6-hour response cache for lesson/visual/RAG/multimodal requests (errors never cached). | pytest (cache hit, errors not cached). Progress UI needs a live key to see real timings. |
| W10 | Rule-based "AI suggestions" renamed to next-step tips. | Code review. |
| W11 | Training moved to a `training_resources` table with real course pages (FutureLearn, Coursera/UC Davis, OpenLearn Create search, DBE SIAS policy, Class Central). | API + E2E. |
| W12 | Strategy Library page (filter, sort, vote, submit); authors see their pending submissions; admin approval route; 8 starter strategies; NGO review UI. | API + E2E. |
| W13 | Import preview flags identifying columns (by header and by value) with remove / first name + initial / keep; template download; full CSV export with escaping and formula-injection guard; server strips ID/phone/e-mail values. | API + E2E. |
| W14 | Afrikaans interface strings completed; language menus say "AI replies; interface partly English" where coverage is below 90%. | E2E. **Other languages still need native-speaker translations.** |
| W15 | Letter `.doc` export escapes HTML. | Code review. |
| W16 | Visual schedule: picture cards, live now/next, print view, "get visual support ideas". | E2E. |
| W17 | SQLite memory wired into Thandi: last turns, "remember that ..." facts, PII scrubbed, persistent path (`MEMORY_DB_PATH`, Render disk), view/erase endpoints and a delete button; learner context selector; streamed replies with a Stop button. | pytest, API (proxy), E2E (history restored after reload). Implemented directly on SQLite; LangGraph was not needed. |
| X1 | `ai_usage` table (no prompt text stored) + impact card: hours saved (stated assumptions), resources, languages. | API + E2E. |
| X2 | `ngo` agent picks the best 3 from the ranked candidates with a reason; falls back to the ranking without a key. | pytest + E2E (fallback path). |
| X3 | "Who needs attention" ranking with reasons, deep-linked to analytics. | API + E2E. |
| X4 | "Class pack" button: plan + visual supports + family letter in one PDF. | Type-check only: needs a live key to generate the plan first. |
| X5 | Voice input and read-aloud (Web Speech API); streaming over SSE through Next.js and Express. | Streaming: pytest + API + E2E. Voice: needs a real browser with a microphone. |
| X6 | DCAPS page citations returned with RAG answers and lesson enrichment, shown as chips. | pytest (citations from the real PDF). |

## New environment variables

| Variable | Service | Default | Purpose |
|---|---|---|---|
| `MEMORY_DB_PATH` | agents | `apps/agents/data/thandi_memory.sqlite` | Thandi memory file (Render: `/var/data/...` on the attached disk) |
| `RAG_INDEX_DIR` | agents | `apps/agents/vector_db/dcaps` | Persisted DCAPS index |
| `RAG_EMBEDDING_MODEL` | agents | `all-MiniLM-L6-v2` | Embedding model |
| `RAG_WARM_ON_START` | agents | `true` | Load the index in the background at startup |
| `RESPONSE_CACHE_TTL` | agents | `21600` | Seconds to cache tool results (0 disables) |
| `ALLOW_DEMO_SEED` | backend | unset | Must be `true` for `npm run db:seed-demo` |

## Before the final

1. Set `GEMINI_API_KEY` and `GROQ_API_KEY` and click through the planner, visual support, class pack, support plan and Thandi once.
2. Run `python -m app.agents.rag_agent build` with internet access (downloads the embedding model).
3. Verify the 16 NGO records by phone or on their own sites and add more provinces.
4. Ask native speakers to translate the interface strings for the remaining languages.
