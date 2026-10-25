from common import *


def fig_pages():
    fig, ax = canvas(12, 8)
    box(ax, 38, 88, 24, 9, "app/layout.tsx\nLanguageProvider + PreferencesProvider", "fe", fs=8)
    pub = [("/ (landing)", "page.tsx"), ("/login", "email+password, Google"), ("/signup", "register form"),
           ("/forgot-password", "request reset"), ("/reset-password", "token + new pw"),
           ("/verify-email", "token check"), ("/oauth-callback", "code -> JWT")]
    region(ax, 1, 2, 22, 82, "Public (no JWT)", "fe")
    for i, (a, b) in enumerate(pub):
        box(ax, 2.5, 72 - i * 10, 19, 8, f"{a}\n{b}", "fe", fs=7.5)
    region(ax, 26, 2, 73, 82, "Protected - wrapped by DashboardLayout (checks token, loads /profile, mounts AgentChat 'Thandi')", "be")
    box(ax, 28, 66, 21, 11, "/dashboard\nlearners, plans, comms,\nactivities, tasks", "be", fs=7.5)
    box(ax, 28, 52, 21, 11, "/dashboard/tools\ntool launcher grid", "be", fs=7.5)
    box(ax, 28, 38, 21, 11, "/professional-development\nNGO directory (/ngos)", "be", fs=7.5)
    box(ax, 28, 24, 21, 11, "/community\nhub page -> parent letters\nand forum (right column)", "be", fs=7.5)
    box(ax, 28, 5, 21, 15, "Global widgets\nAgentChat (floating)\nSettingsPanel (profile,\ntheme, language, calendar)", "be", fs=7.5)
    tools = [("assessment-planner", "AI: tool_hint=lesson", "ai"), ("visual-support", "AI: tool_hint=visual", "ai"),
             ("learner-profiles", "CSV upload, Excel export", "be"), ("schedule-tracking", "schedule + Google Calendar", "be")]
    for i, (a, b, k) in enumerate(tools):
        box(ax, 53, 66 - i * 14, 21, 11, f"tools/{a}\n{b}", k, fs=7.5)
    box(ax, 77, 66, 21, 11, "/learnerAnalytics\nAI: tool_hint=analytics\n+ local charts", "ai", fs=7.5)
    box(ax, 77, 38, 21, 11, "community/parent-\ncommunication\nAI: tool_hint=parent, jsPDF", "ai", fs=7.5)
    box(ax, 77, 24, 21, 11, "community/forum\nposts + comments", "be", fs=7.5)
    for i in range(4):
        arrow(ax, (49.5, 57.5), (52.5, 71.5 - i * 14))
    arrow(ax, (50, 87.5), (12, 84.5))
    arrow(ax, (50, 87.5), (60, 84.5))
    ax.text(77, 12, "Purple = page calls the AI agents\nGreen = page uses Express REST only", fontsize=8,
            color=C["ink"], bbox=dict(fc="white", ec="#999999"))
    return save(fig, "fe_pages.png", "Frontend route map (Next.js App Router)")


def fig_chat_seq():
    return sequence("fe_chat_seq.png",
                    ["Teacher UI", "lib/api.ts", "Next route\n/api/agent/chat", "Express\n/api/agent/chat", "FastAPI /chat",
                     "LLM providers"],
                    [(0, 1, "chatWithAgent(message, {tool_hint, ...})"),
                     (1, 2, "POST + Authorization: Bearer JWT"),
                     (2, 3, "forward body + JWT (timeout 185 s)"),
                     (3, 3, "authenticateToken + 60 req/15 min per user"),
                     (3, 4, "POST /chat, thread_id = user.id (timeout 180 s)"),
                     (4, 3, "GET /api/auth/profile (re-validate JWT, 30 s)"),
                     (3, 4, "{id, email, ...}", "r"),
                     (4, 4, "guardrails -> supervisor/tool_hint -> worker"),
                     (4, 5, "Groq / Gemini / YouTube calls"),
                     (5, 4, "text, images, links", "r"),
                     (4, 3, "{response, youtube_links, image_aids, media_diagnostics}", "r"),
                     (3, 2, "same JSON (errors mapped to {error})", "r"),
                     (2, 1, "NextResponse.json(data)", "r"),
                     (1, 0, "render markdown, links, images, banners", "r")],
                    title="AI request path: four network hops, three timeouts",
                    kinds=["fe", "fe", "fe", "be", "ai", "ext"])


def fig_auth_seq():
    return sequence("fe_auth_seq.png",
                    ["login/page.tsx", "lib/api.ts", "Express\n/api/auth", "PostgreSQL", "DashboardLayout"],
                    [(0, 1, "api.login(email, pw)"),
                     (1, 2, "POST /auth/login (20 req/15 min/IP)"),
                     (2, 3, "SELECT user WHERE email"),
                     (3, 2, "row + password_hash", "r"),
                     (2, 2, "bcrypt.compare, jwt.sign({id,email,role}, 7d)"),
                     (2, 1, "{token, user}", "r"),
                     (1, 0, "data", "r"),
                     (0, 0, "localStorage.allminds_token / allminds_user"),
                     (0, 4, "router.push('/dashboard')"),
                     (4, 1, "api.getProfile() with Bearer token"),
                     (1, 2, "GET /profile"),
                     (2, 1, "401 -> clear storage + 'allminds:session-expired'", "r"),
                     (1, 4, "event -> redirect /login?error=session_expired", "r")],
                    title="Login, token storage and session-expiry handling",
                    kinds=["fe", "fe", "be", "db", "fe"])


def fig_planner_flow():
    fig, ax = canvas(12, 5.2)
    box(ax, 1, 55, 18, 30, "Planner form\ngrade, subject, topic,\nmaterial type,\nsupport need,\ndifficulty, curriculum", "fe", fs=8)
    box(ax, 23, 55, 18, 30, "Prompt builder\n'Create a complete...\nGrade: 4. Subject: ...\nTopic: ... DCAPS ...'\n+ structured fields", "fe", fs=8)
    box(ax, 45, 55, 18, 30, "chatWithAgent\ntool_hint='lesson'\nmaterial_type=\nlesson_plan | worksheet\n| test | homework", "fe", fs=8)
    box(ax, 67, 55, 14, 30, "Agents\n(see PDF 3)", "ai", fs=8)
    box(ax, 85, 55, 14, 30, "Response\ntext +\nyoutube_links\n+ image_aids\n+ diagnostics", "ai", fs=8)
    box(ax, 23, 5, 18, 30, "Render\nplan text, video\ncards, data-URI\nimages, warnings", "fe", fs=8)
    box(ax, 45, 5, 18, 30, "Save\napi.createLessonPlan\n-> POST /activities/\nlesson-plans", "be", fs=8)
    box(ax, 67, 5, 18, 30, "Export\njsPDF (A4) download\nof the plan", "fe", fs=8)
    arrow(ax, (19.5, 70), (22.5, 70)); arrow(ax, (41.5, 70), (44.5, 70)); arrow(ax, (63.5, 70), (66.5, 70))
    arrow(ax, (81.5, 70), (84.5, 70)); arrow(ax, (92, 54.5), (32, 35.5), rad=-0.15)
    arrow(ax, (41.5, 20), (44.5, 20)); arrow(ax, (63.5, 20), (66.5, 20))
    return save(fig, "fe_planner.png", "Assessment Planner: from form to saved, exportable plan")


def build():
    d = Doc("AllMinds_1_Frontend_and_APIs.pdf", "Frontend, Integrations & APIs",
            "How the Next.js teacher dashboard is built, every API it calls, and how it reaches the "
            "backend and the AI agents")
    ov = system_overview_figure()

    d.h1("1. What AllMinds is trying to achieve")
    d.p("AllMinds is a teacher-facing platform for South African educators who teach neurodivergent children aged "
        "3-10 (autism, ADHD, dyslexia, dyscalculia, sensory processing differences, PDA and twice-exceptional "
        "profiles). <b>The primary goal</b> is to give a non-specialist teacher, in seconds, classroom-ready support "
        "that would otherwise need a specialist: DCAPS-aligned lesson plans and worksheets, visual supports, parent "
        "letters, learner progress analytics, schedules and a 24/7 AI colleague (\"Thandi\") - in any of South "
        "Africa's 11 official languages.")
    d.p("The system is a three-service monorepo: a <b>Next.js frontend</b> (apps/frontend), an <b>Express + "
        "PostgreSQL backend</b> (apps/backend) and a <b>FastAPI multi-agent service</b> (apps/agents). This document "
        "covers the frontend and every API it touches. PDF 2 covers the backend/database and PDF 3 the agents.")
    d.fig(ov, "The whole system. The browser only ever talks to Next.js and Express; it never calls the agents or "
              "the LLM providers directly.")

    d.h2("1.1 Technology stack (apps/frontend/package.json)")
    d.table([["Concern", "Choice", "Why it matters"],
             ["Framework", "Next.js 13.5 App Router, React 18.2, TypeScript 5.2", "File-based routing under app/; "
              "server route handlers (app/api/...) let us proxy AI calls server-side."],
             ["Styling", "Tailwind CSS 3.3 + globals.css", "Utility classes; theme (light/dark/auto) applied by "
              "PreferencesContext."],
             ["Icons", "lucide-react", "Consistent icon set across dashboard and tools."],
             ["Exports", "jsPDF 4.2 (lesson plans, parent letters), ExcelJS 4.4 (learner lists)",
              "Teachers take artefacts offline / print them."],
             ["State", "React hooks + 2 contexts (LanguageContext, PreferencesContext)", "No Redux; server is the "
              "source of truth, local state is per page."],
             ["HTTP client", "lib/api.ts - one fetch wrapper", "Adds JWT, JSON headers, unified ApiError, "
              "401 -> session-expired event."],
             ["Hosting", "Render (render.yaml) or Netlify (netlify.toml + @netlify/plugin-nextjs)",
              "NEXT_PUBLIC_API_URL / BACKEND_API_URL point at the Express service."]],
            [3, 6.2, 7.8], "Frontend stack")

    d.h1("2. Application structure")
    d.fig(fig_pages(), "Every route in apps/frontend/app. Purple pages call the AI agents through "
                       "api.chatWithAgent(); green pages only use the Express REST API.")
    d.h2("2.1 Shell and shared components")
    d.bullets([
        "<b>app/layout.tsx</b> - root layout; wraps everything in <i>LanguageProvider</i> (UI translations from "
        "lib/i18n/translations.ts, code stored in localStorage 'allminds_language') and <i>PreferencesProvider</i> "
        "(theme, font size and accessibility preferences, persisted in localStorage and synced from the server "
        "profile's theme_preference).",
        "<b>components/DashboardLayout.tsx</b> - the auth guard for every /dashboard page. On mount it reads "
        "'allminds_token'; if missing it redirects to /login, otherwise calls <i>api.getProfile()</i>. It listens "
        "for the custom <i>allminds:session-expired</i> event and redirects to /login?error=session_expired. It "
        "renders the sidebar (collapsible, remembered in localStorage) and mounts <b>AgentChat</b>.",
        "<b>components/AgentChat.tsx</b> - the floating 'Thandi' assistant. It sends free text with only "
        "<i>language_pref</i>, so the <b>supervisor LLM decides which agent answers</b> (no tool_hint).",
        "<b>components/SettingsPanel.tsx</b> - edits profile (PUT /profile), theme, language, and connects/"
        "disconnects Google Calendar (GET /calendar/connect?format=json, DELETE /calendar/disconnect).",
        "<b>LearnerCard, LearnerProgressModal, SensoryToolkitModal</b> - learner widgets that read/write "
        "progress records and sensory logs.",
        "<b>AuthShell</b> - the shared visual frame for login, signup and password pages.",
    ])

    d.h2("2.2 Feature pages and the goal each one serves")
    d.table([["Page", "What the teacher does", "Data / AI used"],
             ["/dashboard", "Overview: learner count, saved plans, parent letters, recent activity, to-do tasks "
              "(create + cycle status).", "getLearners, getLessonPlans, getParentCommunications, getActivities, "
              "getTasks, createTask, updateTask"],
             ["tools/assessment-planner", "Generates lesson plan / worksheet / test / homework for grade+subject+"
              "topic, aligned to DCAPS; shows YouTube videos and AI images; save, reopen, delete, export PDF.",
              "chatWithAgent(tool_hint='lesson', material_type, grade, subject, topic, support_need, difficulty); "
              "lesson-plans CRUD"],
             ["tools/visual-support", "Describe a topic/routine and get 2 visual supports, an interactive idea, a "
              "quick-make tip, AI-generated cards and videos.", "chatWithAgent(tool_hint='visual')"],
             ["tools/learner-profiles", "Upload a CSV class list (parsed in the browser), view learners, export "
              "Excel.", "getLearners, bulkUploadLearners (POST /learners/bulk, max 1000 rows)"],
             ["tools/schedule-tracking", "Per-learner daily timeline (time + title + notes); optionally pushes each "
              "item to Google Calendar.", "schedule-items CRUD, getCalendarConnectUrl, createCalendarEvent"],
             ["learnerAnalytics", "Pick a learner; local KPIs (engagement, task completion, attendance, support "
              "priority band) + 'Analyse with agent' narrative.", "getProgress, getSensoryLogs, "
              "chatWithAgent(tool_hint='analytics', records=[...])"],
             ["community/parent-communication", "Choose learner + progress/concern, add notes, AI drafts the "
              "letter; edit, save, download PDF.", "chatWithAgent(tool_hint='parent', communication_type), "
              "createParentCommunication"],
             ["community/forum", "Teacher-to-teacher posts and comments.", "getForumPosts, createForumPost, "
              "getForumComments, createForumComment"],
             ["professional-development", "Directory of support NGOs, filterable.", "getNGOs"]],
            [3.4, 7.2, 6.4], "Feature pages")

    d.h1("3. How the frontend talks to everything else")
    d.h2("3.1 lib/api.ts - the single integration point")
    d.p("Every network call goes through one function, <i>request(endpoint, options)</i>:")
    d.code("const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';\n"
           "headers: { 'Content-Type': 'application/json',       // skipped for FormData\n"
           "           Authorization: `Bearer ${localStorage.allminds_token}` }\n"
           "if (res.status === 401) { clear token+user; dispatch 'allminds:session-expired' }\n"
           "throw new ApiError(message, code, status)   // code = body.error, e.g. 'email_not_verified'")
    d.p("The one exception is <b>chatWithAgent()</b>: it calls the <b>same-origin Next.js route</b> "
        "<i>/api/agent/chat</i>, not Express directly. That route (app/api/agent/chat/route.ts) runs on the Next "
        "server, forwards the body and Authorization header to <i>${BACKEND_API_URL}/agent/chat</i> with a 185 s "
        "timeout, and normalises errors to <i>{error}</i>. Benefits: no CORS preflight for the long AI call, the "
        "agent URL is never exposed to the browser, and timeouts are controlled server-side.")
    d.fig(fig_chat_seq(), "Sequence of one AI request. Note the agent service calls back into Express to verify the "
                          "JWT, so the agent never needs the JWT secret.")
    d.note("<b>Correction to system-design.json:</b> that file says Next.js proxies directly to FastAPI. In the "
           "current code the path is Next.js -> Express /api/agent/chat -> FastAPI /chat. Express adds JWT "
           "verification and a per-user AI rate limit (60 requests / 15 min) before the agents are reached.")

    d.h2("3.2 Complete API catalogue used by the frontend")
    d.table([["lib/api.ts method", "HTTP call (prefix /api)", "Auth", "Used by"],
             ["login", "POST /auth/login", "-", "login"],
             ["register", "POST /auth/register", "-", "signup"],
             ["getOAuthUrl(provider)", "browser redirect GET /auth/{google|microsoft|apple}", "-", "login, signup"],
             ["exchangeOAuthCode", "POST /auth/oauth/exchange {code}", "-", "oauth-callback"],
             ["forgotPassword / resetPassword", "POST /auth/forgot-password, /auth/reset-password", "-",
              "forgot/reset pages"],
             ["verifyEmail / resendVerification", "POST /auth/verify-email, /auth/resend-verification", "-",
              "verify-email, login, signup"],
             ["getProfile / updateProfile", "GET / PUT /profile", "JWT", "DashboardLayout, Settings, tools"],
             ["getCalendarStatus / ConnectUrl / disconnect", "GET /calendar/status, GET /calendar/connect?format=json,"
              " DELETE /calendar/disconnect", "JWT", "SettingsPanel, schedule-tracking"],
             ["createCalendarEvent", "POST /calendar/events", "JWT", "schedule-tracking"],
             ["getLearners / createLearner / bulkUploadLearners", "GET/POST /learners, POST /learners/bulk", "JWT",
              "dashboard, profiles, analytics, letters"],
             ["get/createSensoryLog", "GET/POST /learners/:id/sensory-logs", "JWT", "SensoryToolkitModal, analytics"],
             ["get/createProgress", "GET/POST /learners/:id/progress", "JWT", "LearnerProgressModal, analytics"],
             ["forum methods", "GET/POST /forum, GET/POST /forum/:id/comments", "GET public, POST JWT", "forum"],
             ["parent communications", "GET /parent-communications[?learnerId], POST", "JWT", "letters, dashboard"],
             ["activities / lesson plans / tasks", "GET /activities/activities, CRUD /activities/lesson-plans, "
              "/activities/tasks", "JWT", "dashboard, planner"],
             ["schedule items", "GET ?learnerId, POST, PATCH, DELETE /activities/schedule-items", "JWT",
              "schedule-tracking"],
             ["getNGOs / strategies", "GET /ngos, GET/POST /strategies, POST /strategies/:id/vote", "mixed",
              "professional-development"],
             ["chatWithAgent", "POST /api/agent/chat (Next route) -> Express -> FastAPI", "JWT", "all AI features"]],
            [4.2, 6.4, 1.8, 4.6], "Every call the frontend makes")

    d.h2("3.3 Third-party APIs and how each serves the goal")
    d.table([["External API", "Called from", "Purpose in AllMinds"],
             ["Google OAuth 2.0 / Microsoft identity / Sign in with Apple", "Express (Passport)", "One-click teacher "
              "sign-in; Apple ID tokens verified against Apple JWKS (cached 1 h)."],
             ["Google OAuth (calendar scope) + Calendar API v3 + oauth2 userinfo", "Express calendarController; "
              "Python scheduling agent", "Connect a teacher's calendar, push schedule items as events, let Thandi "
              "list/create events."],
             ["Groq API - llama-3.3-70b-versatile", "Agents: supervisor", "Ultra-fast intent classification "
              "(10 output tokens, temperature 0)."],
             ["Google Gemini API - 2.5 Flash / 2.5 Pro / 2.5 Flash Image", "Agents: all workers", "Text generation, "
              "translation and native image generation of classroom visuals."],
             ["YouTube Data API v3 (search, safeSearch=strict)", "Agents: visual_media.py", "3 curated, embeddable "
              "videos per lesson/visual request (fallback: search-page links)."],
             ["HuggingFace sentence-transformers all-MiniLM-L6-v2 + ChromaDB", "Agents: RAG", "Embeds DCAPS.pdf "
              "locally for curriculum-grounded answers."],
             ["SMTP via Nodemailer", "Express", "Password-reset / verification e-mails (dev mode returns the link "
              "when SMTP is not configured)."]],
            [5.2, 4, 7.8], "External services")

    d.h1("4. Key user journeys on the frontend")
    d.fig(fig_auth_seq(), "Email/password login. OAuth uses the same storage step after /oauth-callback exchanges a "
                          "one-time code for the JWT.")
    d.h2("4.1 OAuth (Google / Microsoft / Apple)")
    d.p("The login button sets <i>window.location</i> to <i>/api/auth/google</i>. After the provider redirects back "
        "to Express, Express does <b>not</b> put the JWT in the URL; it stores a SHA-256 hash of a random 32-byte "
        "code (valid 5 minutes) and redirects to <i>/oauth-callback?code=...</i>. The page calls "
        "<i>api.exchangeOAuthCode(code)</i>; the code is deleted atomically on use and a JWT is returned and stored "
        "like a normal login. This keeps tokens out of browser history and server logs.")
    d.fig(fig_planner_flow(), "The Assessment Planner, the flagship tool, end to end.")
    d.h2("4.2 Analytics page - local maths plus AI narrative")
    d.p("learnerAnalytics computes KPIs in the browser (engagement average, task completion, attendance rate, "
        "support-priority score banded High >= 70, Moderate >= 40, otherwise Low). For the AI narrative it maps each "
        "progress row into the agent's record format: <i>mark = engagementLevel x 20</i> (1-5 scale -> 0-100), "
        "behaviour = {attention, participation, homework_completion, emotional_regulation=3, attendance}, and sends "
        "<i>tool_hint='analytics'</i>.")
    d.h2("4.3 Multilingual experience")
    d.p("The UI language and the AI response language are linked by one value - <i>allminds_language</i> (en, zu, "
        "xh, af, nso, tn, st, ss, ve, ts, nr). Pages pass it as <i>language_pref</i>; each agent appends a "
        "language instruction to its system prompt, and analytics translates its deterministic summary with Gemini.")
    d.h2("4.4 Resilience in the UI")
    d.bullets(["Every AI response may include <i>media_diagnostics</i> - human-readable banners (e.g. 'Tip: add a "
               "YOUTUBE_API_KEY', 'Gemini quota exceeded'). The UI shows them without failing the text result.",
               "Errors from any hop are normalised to <i>{error}</i>, so pages show one consistent message.",
               "Long AI calls show loading states; timeouts surface as 'The AI request timed out. Please try again.'"])

    d.br()
    d.h1("5. Hackathon final - likely questions and model answers")
    d.qa([
        ("Walk us through what happens when a teacher clicks 'Generate' in the Assessment Planner.",
         "The page builds a natural-language prompt plus structured fields and calls api.chatWithAgent with "
         "tool_hint='lesson'. The browser posts to the same-origin Next route /api/agent/chat, which forwards to "
         "Express /api/agent/chat; Express verifies the JWT, applies a 60-per-15-minute per-user limit, overrides "
         "thread_id with the user id and posts to FastAPI /chat. FastAPI validates the token by calling Express "
         "/auth/profile, runs guardrails, skips the supervisor because of the tool hint, optionally enriches with "
         "DCAPS RAG context, and runs the lesson agent (Gemini 2.5 Pro text, YouTube search and Gemini image "
         "generation in parallel). JSON flows back through each hop and the page renders text, videos, images and "
         "diagnostics; the teacher can save it (POST /activities/lesson-plans) or export with jsPDF."),
        ("Why route AI calls through a Next.js API route instead of calling the agent service from the browser?",
         "It removes CORS concerns for long requests, hides internal service URLs, lets us set a server-side "
         "timeout (185 s) slightly longer than Express's (180 s) so the innermost error surfaces cleanly, and "
         "keeps a single auth path through Express where rate-limiting and JWT checks live."),
        ("Where is the JWT stored and what are the trade-offs?",
         "In localStorage ('allminds_token'), sent as a Bearer header. It is simple and works across three "
         "services, but is readable by any injected script (XSS). Mitigations/next steps: strict CSP, httpOnly "
         "secure cookies with CSRF protection, and shorter-lived access tokens with refresh."),
        ("How does the frontend react when a token expires?",
         "Any 401 in lib/api.ts clears token and user from storage and dispatches 'allminds:session-expired'; "
         "DashboardLayout listens and redirects to /login?error=session_expired."),
        ("What is the difference between the floating Thandi chat and the tool pages?",
         "Thandi sends free text with no tool_hint, so the Groq supervisor classifies the intent into one of eight "
         "agents. Tool pages know their purpose and send a tool_hint, skipping classification - lower latency, "
         "deterministic routing and richer structured fields."),
        ("How is learner privacy handled in the UI?",
         "Learners are stored as anonymous_id + JSON profile data; the UI shows a pseudonym/display name derived "
         "in lib/learners.ts. Free text sent to the agents is PII-scrubbed (SA ID numbers, e-mails, phone numbers) "
         "by guardrails before any LLM call."),
        ("Which external APIs does the product depend on, and what happens if one fails?",
         "Groq (routing), Gemini (generation, images, translation), YouTube Data API, Google Calendar, OAuth "
         "providers, SMTP. Failures degrade gracefully: no Groq key -> keyword routing; no YouTube key -> search "
         "links; image failure -> text still returned with a diagnostic banner; missing OAuth config -> the "
         "button redirects with '<provider>_oauth_not_configured'."),
        ("How do you support 11 languages?",
         "The UI uses a translation dictionary keyed by language code; the same code is sent as language_pref and "
         "each agent appends a language instruction (e.g. respond in isiZulu, keeping technical terms in English "
         "in brackets where needed)."),
        ("How would you scale the frontend?",
         "It is stateless; static assets via CDN (Netlify/Render), the proxy route is the only server work. For "
         "AI latency, add streaming responses (SSE) and optimistic UI; cache NGO/forum reads."),
        ("What would you improve next on the frontend?",
         "Streaming AI output, httpOnly cookie auth, a typed API client (api.ts uses 'any' in places), offline "
         "support for low-connectivity schools, and component tests for the tool pages."),
    ])
    d.h2("5.1 Whole-system and pitch questions")
    d.qa([
        ("In one sentence, what problem does AllMinds solve?",
         "Most South African classroom teachers have neurodivergent learners but no specialist support; AllMinds "
         "gives them DCAPS-aligned, neurodivergent-affirming lesson materials, visual supports, parent letters and "
         "progress insight in seconds, in their own language."),
        ("Why is this 'agentic' rather than a chatbot?",
         "A supervisor plans who should act, specialist agents use tools (vector search over DCAPS, YouTube, image "
         "generation, Google Calendar, deterministic analytics) and results are structured artefacts the teacher "
         "saves, exports or schedules - not just chat text."),
        ("How do the three services work together to reach the goal?",
         "Next.js collects structured context and renders results; Express owns identity, learner data and "
         "integrations and gatekeeps every AI call; FastAPI routes to the right specialist and model, grounds "
         "content in the curriculum and returns safe, multilingual output that flows back to be saved in Postgres."),
        ("What is your demo path?",
         "Log in -> upload a CSV class list -> generate a Grade 3 maths worksheet with DCAPS alignment (videos and "
         "images appear) -> save and export PDF -> log progress for a learner -> run the analytics narrative -> "
         "draft a parent progress letter in isiZulu -> ask Thandi a behaviour question."),
        ("How do you measure impact?",
         "Time saved per lesson plan, number of artefacts saved/exported, learner progress trends over time, "
         "teacher satisfaction and language uptake; next we would add an evaluation set for content quality."),
    ])
    return d.build()


if __name__ == "__main__":
    print(build())
