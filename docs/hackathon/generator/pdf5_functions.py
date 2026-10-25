from common import *
from matplotlib.patches import Circle, FancyBboxPatch


# ─────────────────────────────── figures ────────────────────────────────────
def fig_decision_grid():
    cols = ["Fixed rule /\nformula", "Regex /\nkeyword", "LLM", "Database\nquery", "External\nAPI"]
    feats = [
        ("Login / sign-up", ["rule", "db"], "W"), ("OAuth sign-in", ["rule", "db", "api"], "W"),
        ("Dashboard (history, tasks)", ["rule", "db"], "W"), ("Learner upload (CSV/XLSX)", ["rule", "db"], "P"),
        ("Progress + sensory logs", ["rule", "db"], "P"), ("Learner analytics", ["rule"], "B"),
        ("Support request", ["llm"], "B"), ("Assessment planner", ["regex", "llm", "api"], "W"),
        ("Visual support", ["regex", "llm", "api"], "W"), ("Parent letters", ["regex", "llm", "db"], "W"),
        ("Schedule tracking", ["rule", "db", "api"], "P"), ("Thandi chat", ["regex", "llm", "api"], "W"),
        ("Calendar via chat", ["regex", "llm", "api"], "P"), ("Community forum", ["regex", "db"], "P"),
        ("Strategy library / NGO reviews", ["db"], "N"), ("Training resources", [], "P"),
        ("NGO finder", ["rule", "db"], "P"), ("Settings (profile, theme, language)", ["rule", "db"], "W"),
    ]
    keys = ["rule", "regex", "llm", "db", "api"]
    stat = {"W": ("#3C8A3A", "Working"), "P": ("#E0A030", "Partial"), "B": ("#B23B3B", "Not working"),
            "N": ("#888888", "No UI")}
    fig, ax = plt.subplots(figsize=(10, 8))
    ax.set_xlim(0, 10)
    ax.set_ylim(-0.6, len(feats) + 1.4)
    ax.axis("off")
    ax.text(0.1, len(feats) + 0.55, "Feature", fontweight="bold", fontsize=9)
    for j, c in enumerate(cols):
        ax.text(4.2 + j * 1.0, len(feats) + 0.35, c, ha="center", va="center", fontweight="bold", fontsize=8)
    ax.text(9.35, len(feats) + 0.55, "Status", ha="center", fontweight="bold", fontsize=9)
    colr = {"rule": "#2F6FB3", "regex": "#B7791F", "llm": "#8A3FA0", "db": "#3C8A3A", "api": "#555555"}
    for i, (name, mech, st) in enumerate(feats):
        y = len(feats) - i - 0.5
        if i % 2 == 0:
            ax.add_patch(plt.Rectangle((0, y - 0.5), 10, 1, color="#F3F6FA", zorder=0))
        ax.text(0.1, y, name, va="center", fontsize=8.6)
        for j, k in enumerate(keys):
            if k in mech:
                ax.add_patch(Circle((4.2 + j * 1.0, y), 0.22, color=colr[k]))
        c, lab = stat[st]
        ax.add_patch(FancyBboxPatch((8.7, y - 0.28), 1.25, 0.56, boxstyle="round,pad=0.02,rounding_size=0.25", fc=c, ec=c))
        ax.text(9.325, y, lab, color="white", ha="center", va="center", fontsize=7.4, fontweight="bold")
    ax.set_title("Who makes the decision in each feature, and does it work today?", fontsize=11, fontweight="bold")
    return save(fig, "fn_decisions.png")


def fig_ngo():
    fig, ax = canvas(7.4, 8.4)
    ax.text(1, 98, "TODAY  (professional-development page + ngoController)", fontsize=9, fontweight="bold", color=C["fe_e"])
    steps = [("1 Click 'Enable\nLocation Services'", "fe"), ("2 Browser location\n10 s timeout,\ncached 5 min", "fe"),
             ("3 GET /api/ngos\nverified only,\nbest rating first,\nmax 100", "be"), ("4 Keep rows that\nhave latitude\nand longitude", "fe"),
             ("5 Haversine\ndistance in km", "fe"), ("6 Sort nearest first,\nkeep 6", "fe"),
             ("7 Optional filter:\nservice contains\ntyped text", "fe"), ("8 Card: km, phone,\nGoogle Maps link", "fe")]
    for i, (t, k) in enumerate(steps):
        r, c = divmod(i, 4)
        x = 1 + c * 24.6
        y = 80 - r * 17
        box(ax, x, y, 22, 14, t, k, fs=8, bold_first=False)
        if c:
            arrow(ax, (x - 1.7, y + 7), (x - 0.1, y + 7))
    box(ax, 1, 40, 47, 21, "What the data contains\n3 seeded organisations in 3 provinces.\nAddresses and phones look like\nplaceholders ('12 Support Street').\nRatings and reviews are never shown.", "warn", fs=8)
    box(ax, 52, 40, 47, 21, "Gaps in the decision\nNo manual province, city or need search\n(API supports it). No fallback if location\nis denied. Tab says 'Health Facilities'\nbut lists autism NGOs.", "warn", fs=8)
    ax.text(1, 34, "RECOMMENDED  (wins the 'real-world impact' criterion)", fontsize=9, fontweight="bold", color=C["be_e"])
    rec = [("Verified directory\n40-60 SA orgs with\nsource + date", "db"), ("Search by province,\ncity, service;\nlocation optional", "be"),
           ("Rank = 0.5 distance\n+ 0.3 need match\n+ 0.2 rating", "be"), ("Map, call,\nWhatsApp,\ndirections", "be"),
           ("AI match: 'speech\ntherapy in Soweto'\n-> best 3 + why", "ai"), ("Report wrong info;\nreview and\nrating UI", "be")]
    for i, (t, k) in enumerate(rec):
        r, c = divmod(i, 3)
        x = 1 + c * 33
        y = 17 - r * 16
        box(ax, x, y, 31, 14, t, k, fs=8, bold_first=False)
        if c:
            arrow(ax, (x - 1.6, y + 7), (x - 0.1, y + 7))
    return save(fig, "fn_ngo.png", "NGO finder: how it decides today and how to make it win")


def fig_analytics_gap():
    fig, ax = canvas(7.4, 7.0)
    items = [("1 Progress modal\nTeacher enters area,\nlevel, achievements,\nnotes", "fe"),
             ("2 Saved to database\nengagementLevel: ''\nattendance: ''\ntaskCompletionLevel: ''", "warn"),
             ("3 Analytics page\nempty values filtered out\nscore = 0, band 'Low'\nKPIs show 0, 0, 0 %", "warn"),
             ("4 'Analyse with agent'\nmark = 0 x 20 = 0\nemotional_reg fixed at 3\n-> every learner flagged", "warn")]
    for i, (t, k) in enumerate(items):
        r, c = divmod(i, 2)
        x = 1 + c * 50
        y = 74 - r * 24
        box(ax, x, y, 47, 20, t, k, fs=8.6)
    arrow(ax, (48.5, 84), (50.5, 84)); arrow(ax, (75, 73.5), (75, 69.5)); arrow(ax, (50.5, 60), (48.5, 60))
    box(ax, 1, 26, 98, 20, "Why it matters\nAnalytics is the headline 'data-driven' feature. With data captured by the\napp's own form it shows zeros and 'Low' for every learner, while the agent\nsays 'Academic performance needs additional support' for all of them.", "warn", fs=8.6)
    box(ax, 1, 1, 98, 21, "Fix (about 3 hours)\nAdd 1-5 engagement and task-completion selectors and Present/Absent to the modal.\nShow 'Not enough data yet' under 3 records. Stop hard-coding emotional regulation.\nShip a demo classroom with 8 weeks of realistic records.", "be", fs=8.6)
    return save(fig, "fn_analytics.png", "Learner analytics: where the data is lost")


def fig_support():
    fig, ax = canvas(7.4, 7.2)
    steps = [("UI payload", "request_type, urgency,\ngoal, request_context\n(profile, strengths,\nneeds, analytics)", "fe"),
             ("Next route +\nExpress proxy", "forward the body\nunchanged", "be"),
             ("FastAPI ChatRequest", "unknown fields ignored:\ncontext, urgency and\ntype are LOST", "warn"),
             ("Analytics agent", "uses records only;\nignores the message\ntext entirely", "warn"),
             ("Response", "numeric summary\nreturned", "ai"),
             ("UI", "result discarded; says\n'Review the AI response\nin the assistant panel'", "warn")]
    for i, (a, b, k) in enumerate(steps):
        r, c = divmod(i, 3)
        x = 1 + c * 33
        y = 62 - r * 32
        box(ax, x, y, 30, 28, f"{a}\n{b}", k, fs=8.2)
        if c:
            arrow(ax, (x - 2.6, y + 14), (x - 0.1, y + 14))
    arrow(ax, (84, 61.5), (84, 59.5)) if False else None
    box(ax, 1, 1, 98, 24, "Result: the support-request form cannot produce an answer.\nFix: add the fields to ChatRequest, route by request_type (lesson adaptation -> lesson agent,\nbehaviour -> general agent), put the context in the prompt, render the reply on the page.", "be", fs=8.4)
    return save(fig, "fn_support.png", "Support request: the dead end")


def fig_calendar():
    fig, ax = canvas(7.4, 7.4)
    box(ax, 1, 78, 22, 18, "Message\n'schedule maths\ntomorrow at 9am'", "fe", fs=8)
    box(ax, 27, 78, 22, 18, "Supervisor\nGroq -> 'schedule'", "ai", fs=8)
    box(ax, 53, 78, 22, 18, "Phrase lists\nlist or create?", "db", fs=8)
    box(ax, 79, 86, 20, 10, "list next 5", "ai", fs=8, bold_first=False)
    box(ax, 79, 72, 20, 10, "create event", "ai", fs=8, bold_first=False)
    arrow(ax, (23.5, 87), (26.5, 87)); arrow(ax, (49.5, 87), (52.5, 87))
    arrow(ax, (75.5, 90), (78.5, 91)); arrow(ax, (75.5, 84), (78.5, 77))
    box(ax, 1, 38, 47, 34, "How a time is chosen\n1 default = next full hour\n2 'tomorrow' = 09:00 tomorrow\n3 FIRST number in the text\n   is taken as the hour\n4 'for N hours' sets duration\nNo weekday, date, recurrence", "db", fs=8)
    box(ax, 52, 38, 47, 34, "Where it goes wrong\n'Grade 3 maths tomorrow'\n  -> 03:00 (the 3 is the hour)\nTitle keeps time words\n'on Friday' is ignored\nNo confirmation before create", "warn", fs=8)
    box(ax, 1, 1, 98, 30, "Fix\nLet Gemini extract {title, start, end} as structured output (or use dateparser),\nshow a confirmation chip with the parsed date and time, then create the event.\nAdd a date and weekday picker to the schedule page.", "be", fs=8.4)
    return save(fig, "fn_calendar.png", "Calendar by chat: how the decision is made")


def fig_plan():
    fig, ax = canvas(7.4, 5.6)
    cols = [("48 hours: stop the bleeding", "warn", ["W1 progress capture", "W2 support request", "W3 forum filter", "W6 error states",
                                                    "R1 migration", "R2 profile names", "W5 demo classroom"]),
            ("Days 3-5: credibility", "db", ["W4 NGO data + search", "W7 calendar parsing", "W8 analytics output", "W9 progress steps",
                                           "W10 honest AI labels", "W11 real courses"]),
            ("Days 6-7: wow factor", "ai", ["X1 impact dashboard", "X2 AI NGO matcher", "X3 'needs attention'", "X4 class pack",
                                          "R3 non-blocking agents", "R4 warm RAG index"]),
            ("Before judging", "be", ["Dry run on clean DB", "Rehearse 5-min script", "Pre-warm services", "Record backup video",
                                    "Freeze changes"])]
    for i, (t, k, items) in enumerate(cols):
        x = 1 + (i % 2) * 50
        y = 52 - (i // 2) * 49
        box(ax, x, y, 47, 44, t + "\n" + "\n".join("- " + s for s in items), k, fs=8.6, align="left")
    return save(fig, "fn_plan.png", "Suggested plan to get hackathon-ready")


# ─────────────────────────────── content ────────────────────────────────────
COMPONENTS = [
    ("Landing, login, sign-up, OAuth", "Public pages; e-mail/password or Google/Microsoft/Apple.",
     "Fixed rules: password length, bcrypt compare, one-time OAuth code.", "Working",
     "Single-word OAuth names can fail (profile NOT NULL)."),
    ("Dashboard", "Six cards (learners, plans, letters, activity, tasks, scheduled work), search, task board.",
     "Counts and filters computed in the browser; tasks sorted by due date; status advances pending -> in progress -> completed.",
     "Working", "Load errors are swallowed and shown as 'nothing yet'."),
    ("Learner profiles (upload)", "Import CSV/XLSX class lists (max 5 MB, 1000 rows), list, export.",
     "Header normalisation; ID columns recognised by name; everything else becomes JSON profile_data.",
     "Partial", "No PII warning; export has IDs and dates only."),
    ("Progress and sensory logs", "Per-learner records of learning area, level, achievements, behaviour, triggers.",
     "Teacher input; 'AI suggestions' are two fixed template sentences.", "Partial",
     "Engagement, attendance and task completion are never collected."),
    ("Learner analytics", "KPIs, bars and AI narrative per learner.",
     "Support priority = mean(100 - engagement%, 100 - completion%, 100 - attendance%); High >= 70, Moderate >= 40.",
     "Not working", "Inputs are empty, so every learner shows zeros / Low."),
    ("Support request", "Send a goal + context to the AI for a learner.", "Intended: LLM; actual: analytics agent, which ignores the text.",
     "Not working", "Context dropped, reply discarded."),
    ("Assessment planner", "Lesson plan / worksheet / test / homework with videos and images; save and PDF.",
     "tool_hint 'lesson'; keyword test triggers DCAPS retrieval; Gemini 2.5 Pro writes; YouTube + image threads.",
     "Working", "25-90 s with only a spinner."),
    ("Visual support", "Visual supports, interactive idea, quick-make tip.",
     "tool_hint 'visual'; output validated for 4 headings, one retry.", "Working", "Same wait as the planner."),
    ("Parent communication", "AI drafts progress or concern letters, edit, save, export.",
     "Type chosen by the teacher; latest progress and sensory entry added to the prompt.", "Working",
     ".doc export does not escape HTML."),
    ("Schedule tracking", "Per-learner daily timeline; optional Google Calendar copy.",
     "Time must match HH:MM; unique per learner and time; calendar copy created for today.", "Partial",
     "A list, not a visual schedule; no day or recurrence."),
    ("Thandi chat (floating)", "Ask anything, in any SA language.", "No hint, so Groq Llama-3.3-70B picks one of 8 agents; keyword fallback.",
     "Working", "No memory, no learner context, no streaming."),
    ("Calendar via chat", "'Schedule...' / 'what's on my calendar'.", "Phrase lists, then regex time parsing.",
     "Partial", "First number becomes the time; no confirmation."),
    ("Community forum", "Posts and comments.", "Browser blocks posts containing name, address, phone, email or student.",
     "Partial", "Blocks ordinary posts (substring match)."),
    ("Strategy library and NGO reviews", "Teacher-shared strategies, votes, ratings.", "Backend and tables exist.", "No UI",
     "Nothing in the frontend calls them."),
    ("Training resources", "Six course cards.", "Hard-coded list.", "Partial", "Links go to provider home pages."),
    ("NGO finder", "Nearest support organisations.", "Haversine distance, nearest 6, optional service text filter.", "Partial",
     "3 placeholder-looking records; location-only."),
    ("Settings", "Profile, language, theme, high contrast, Google Calendar connect.", "Stored in users/teacher_profiles and localStorage.",
     "Working", "UI language list is complete but only 56 UI strings exist, and most are untranslated per language."),
]

REG = [  # id, priority, area, issue, evidence, fix, effort
    ("W1", "P0", "Analytics", "Progress form never captures engagement, attendance or task completion (hard-coded empty strings), so analytics shows zeros and 'Low', and the AI agent flags every learner as struggling.",
     "LearnerProgressModal.tsx handleSaveProgress; learnerAnalytics getProgressAnalytics", "Add 1-5 selectors and Present/Absent; 'not enough data' state under 3 records; map sensory logs to emotional regulation.", "3 h"),
    ("W2", "P0", "Analytics", "'Create support request' cannot work: unknown fields are dropped by ChatRequest, the analytics agent ignores the message, and the response is thrown away while the UI says to review it elsewhere.",
     "learnerAnalytics handleCreateSupportRequest; api/index.py ChatRequest", "Add fields to ChatRequest, route by request_type, put context in the prompt, show the reply inline.", "4 h"),
    ("W3", "P0", "Forum", "Post filter rejects any text containing 'name', 'student', 'phone', 'email' or 'address' (substring), including 'students', 'username', 'renamed'. Most real posts fail.",
     "community/forum/page.tsx createPost", "Detect real PII (SA ID, phone, e-mail, capitalised full names) with regexes, share the guardrail with the agents, enforce on the server.", "1 h"),
    ("W4", "P0", "NGO finder", "Only 3 seeded organisations with placeholder-looking contact details, found only through browser location; no manual search, no fallback if location is denied, ratings and reviews hidden.",
     "professional-development/page.tsx; ngoController.js; schema seed", "Curate 40-60 verified SA organisations with source and date, add province/city/service search, map, call/WhatsApp, rating UI, and the ranking described in section 4.1.", "1 day"),
    ("W5", "P0", "Demo", "A new account is empty on every page, and the demo user's password hash is committed in the baseline schema (also seeded into any production database).",
     "docs/database schema seed users", "'Load demo classroom' button that creates 10 learners with 8 weeks of records, plans and letters; remove the seeded user outside development.", "4 h"),
    ("W6", "P0", "UX", "Failed API calls are only logged to the console, so pages show friendly empty states ('No learner profiles yet') instead of an error.",
     "dashboard, forum, parent-communication, learner-profiles load functions", "Error banner with Retry, skeleton loaders, shared useApi hook.", "2 h"),
    ("W7", "P0", "Calendar", "Chat calendar parser reads the first number as the time ('Grade 3' becomes 03:00), keeps time words in the title, has no weekday or date support and creates events without confirmation. The schedule page copies items to today only.",
     "google_calendar_automation.py parse_event_time; schedule-tracking addScheduleItem", "Gemini structured extraction or dateparser, confirm chip before create, date and weekday fields on the schedule page.", "4 h"),
    ("W8", "P0", "Analytics", "Agent computes narrative, risk flags and chart data but returns only a one-line summary; mark is engagement x 20 and emotional regulation is hard-coded to 3.",
     "analytics_automation.py; router.py; mapProgressToAgentRecords", "Return structured JSON, remove invented constants, render narrative and flags in the UI.", "3 h"),
    ("W9", "P0", "Latency", "Planner and visual tool take 25-90 s with a plain spinner; two judges at once can stall the agent service (blocking handler).",
     "assessment-planner, visual-support; api/index.py", "Staged progress text, cached sample outputs for the demo topics, non-blocking endpoint (see R3).", "4 h"),
    ("W10", "P1", "Honesty", "'AI suggestions' in the progress modal are two fixed template sentences stored as aiSuggestions.", "LearnerProgressModal generateAiSuggestions",
     "Call the general agent with the record, or relabel as 'Tips'.", "1 h"),
    ("W11", "P1", "Training", "Courses are a hard-coded list linking to provider home pages; titles may not match real courses.", "professional-development trainingResources",
     "Link to verified course pages and South African DBE/inclusive-education resources; store in the database.", "2 h"),
    ("W12", "P1", "Community", "Strategy library with votes and NGO reviews exist in the API and database but have no screens.", "api.ts methods unused",
     "Build a simple strategy library (filter by challenge, vote) and NGO review form, or remove from the pitch.", "1 day"),
    ("W13", "P1", "Privacy", "Imported CSV columns are stored as-is (could hold real names or ID numbers) although the UI says learners are anonymous; export contains IDs and dates only and is not CSV-escaped.",
     "learner-profiles page", "Import preview with PII detection and column mapping, template download, proper export.", "4 h"),
    ("W14", "P1", "i18n", "Language picker lists 11 languages but the UI has 56 strings and the non-English tables are partial. AI replies are multilingual; the interface mostly is not.",
     "lib/i18n/translations.ts", "Say 'AI answers in 11 languages' in the pitch, translate the top 60 strings, fall back gracefully.", "1 day"),
    ("W15", "P1", "Security", "Downloaded .doc letters inject letter text into HTML without escaping.", "parent-communication buildLetterMarkup", "Escape HTML or build a real docx.", "30 min"),
    ("W16", "P1", "Schedule", "Schedule is a time list. Neurodivergent learners need a visual, now/next timeline they can see and print.", "schedule-tracking page",
     "Timeline cards with icons, now/next banner, print view, 'generate visual schedule' via the visual agent.", "5 h"),
    ("W17", "P1", "Thandi", "No memory, no learner context, no streaming, conversation lost on reload.", "AgentChat.tsx; memory_tools.py", "Wire the SQLite/LangGraph memory (see dependencies), pass selected learner, stream tokens.", "1 day"),
    ("R1", "P0", "Release", "Migration 20260629 uses ADD CONSTRAINT IF NOT EXISTS (invalid in PostgreSQL) and blocks the deploy step.", "see Production Readiness PDF D1", "DO $$ block checking pg_constraint.", "30 min"),
    ("R2", "P0", "Sign-in", "teacher_profiles name/surname NOT NULL vs NULL inserts (single-word names).", "see PDF D2", "Make nullable or default ''.", "30 min"),
    ("R3", "P0", "Agents", "Blocking LLM calls inside the async handler: one 60 s lesson stalls health checks and other users.", "see PDF A1", "def endpoint / threadpool, 2+ workers.", "1 h"),
    ("R4", "P0", "Agents", "RAG index rebuilt at first use: 30-120 s first answer and duplicate vectors.", "see PDF A2", "Prebuild the index, load on startup, warm in /health.", "3 h"),
    ("X1", "P2", "Wow", "Impact dashboard for judges: plans generated, hours saved, learners supported, languages used.", "-", "Count rows already in activities/lesson_plans; add one card row.", "3 h"),
    ("X2", "P2", "Wow", "AI NGO matcher: 'my learner needs speech therapy in Soweto' returns the 3 best organisations with reasons.", "-", "RAG over the directory with the agents' existing pattern.", "5 h"),
    ("X3", "P2", "Wow", "'Who needs attention today' ranked list from the support-priority score and recent logs.", "-", "Reuse getProgressAnalytics across learners once W1 is fixed.", "3 h"),
    ("X4", "P2", "Wow", "One-click class pack: lesson plan + visual support + parent letter bundled as one PDF.", "-", "jsPDF already present; call three agents in parallel.", "5 h"),
    ("X5", "P2", "Wow", "Voice in / read aloud for Thandi (Web Speech API) and streaming replies.", "-", "Browser APIs; SSE from FastAPI.", "5 h"),
    ("X6", "P2", "Wow", "Source citations (DCAPS page numbers) on curriculum-grounded answers.", "rag_agent.py", "Return chunk metadata page numbers and render them as chips.", "2 h"),
]


def issue_table(d, rows, cap):
    d.table([["ID", "Pri", "Area", "Issue", "Suggested fix", "Effort"]] +
            [[r[0], r[1], r[2], r[3], r[5], r[6]] for r in rows], [1.1, 0.9, 1.8, 7.0, 5.2, 1.4], cap)


def build():
    d = Doc("AllMinds_5_Functional_Components_and_Win_Readiness.pdf", "Functional Components & Win-Readiness",
            "How each feature makes its decisions, what works today, and the fixes that make AllMinds hackathon-winning")
    d.h1("1. Summary")
    n_w = sum(1 for c in COMPONENTS if c[3] == "Working")
    n_p = sum(1 for c in COMPONENTS if c[3] == "Partial")
    n_b = sum(1 for c in COMPONENTS if c[3] == "Not working")
    n_n = sum(1 for c in COMPONENTS if c[3] == "No UI")
    p0 = sum(1 for r in REG if r[1] == "P0")
    d.p(f"I read the code behind all {len(COMPONENTS)} user-facing functions of AllMinds and traced how each one reaches "
        f"its result. <b>{n_w} work as intended, {n_p} work partially, {n_b} do not work with the data the app itself "
        f"captures, and {n_n} exists only in the API.</b> The idea, the architecture and the AI agents are strong; what "
        f"would cost points in front of judges is a small number of concrete defects at the seams between screens, "
        f"APIs and agents. <b>{p0} items are rated P0</b> (fix before the final). Most are an hour or two each.")
    d.note("<b>How this was produced.</b> Static reading of the frontend, backend and agents source. Nothing was run "
           "against live services, so statements describe what the code does when executed as written. Status labels: "
           "Working = does what it claims; Partial = works with a visible gap; Not working = cannot produce a correct "
           "result from data the app itself collects; No UI = backend only.")
    d.h2("The five things judges are most likely to hit")
    d.bullets([
        "<b>Analytics shows zeros</b> after adding a progress record (W1), and the AI says every learner needs support (W8).",
        "<b>Support request does nothing</b> yet reports success (W2).",
        "<b>The NGO finder</b> returns three placeholder-looking organisations and only after granting location (W4).",
        "<b>A natural forum post is rejected</b> because it contains the word 'student' (W3).",
        "<b>An empty new account</b> and long AI waits make the first impression weak (W5, W9).",
    ])

    d.h1("2. How the app makes decisions")
    d.p("Every feature decides in one of five ways. Knowing which one lets you explain the product honestly and tells "
        "you where it can fail. <b>Fixed rules and formulas</b> are predictable and explainable (support-priority "
        "score, task ordering). <b>Regex and keyword checks</b> are fast but brittle (guardrails, forum filter, "
        "calendar phrases, RAG trigger). <b>LLMs</b> (Groq routing, Gemini writing) handle language but need "
        "guardrails. <b>Database queries</b> decide what a user may see (everything filtered by teacher id). "
        "<b>External APIs</b> add reach and failure modes (YouTube, Google Calendar, image generation).")
    d.fig(fig_decision_grid(), "Decision mechanism and current status for every feature (from code reading).", width=15.5)

    d.h2("2.1 The decisions, one by one")
    d.table([["Decision", "How it is made", "Where"],
             ["Which agent answers", "tool_hint from the page; otherwise Groq Llama-3.3-70B returns one word (temperature 0, 10 tokens) from a prompt with ~25 examples; regex extracts it; defaults to 'general'. No Groq key: keyword table, first match wins.", "core/router.py, supervisor.py"],
             ["Use curriculum context?", "Lesson requests only, if the text contains grade, phase, curriculum, dcaps, caps, foundation, numeracy, literacy, life skills, home language or fal. Then the RAG agent retrieves 3 chunks of DCAPS.pdf.", "router.py _needs_rag_enrichment"],
             ["Block a message?", "Regex checks: length > 2000, prompt-injection phrases, self-harm/abuse/weapons phrases, off-topic abuse. Otherwise PII (13-digit IDs, e-mails, SA phones) is replaced with [REDACTED].", "core/guardrails.py"],
             ["Which material type", "Page sends material_type (lesson_plan, worksheet, test, homework); a dict picks the system prompt.", "lesson_planer_agent.py"],
             ["Progress or concern letter", "Teacher's choice; if missing, 'concern' in the text means concern, otherwise progress.", "parent_comm_agent.py _resolve_type"],
             ["Learner risk band", "Mean of three gaps: 100 - engagement%, 100 - task-completion%, 100 - attendance%. >= 70 High, >= 40 Moderate, else Low. Only available dimensions are averaged.", "learnerAnalytics getProgressAnalytics"],
             ["Trend and risk flags (agent)", "Last value minus first: > +5 improving, < -5 declining. Flags: average mark < 50, average behaviour < 50, declining overall. Progress score = 0.7 x mark + 0.3 x behaviour.", "analytics_automation.py"],
             ["Is a visual output valid", "Must contain 4 headings; otherwise the model is called once more.", "visual_support_agent.py"],
             ["Which image model", "IMAGE_MODEL first, then a cached winner, then 3 fallbacks; stops on billing or quota errors.", "visual_media.py"],
             ["Nearest NGOs", "Haversine distance to every NGO with coordinates, sort ascending, top 6, optional service substring filter.", "professional-development page"],
             ["Task status", "pending -> in_progress -> completed on each click; open tasks sorted by due date, undated last.", "dashboard page"],
             ["Forum post allowed?", "Rejected if title+text contains name, address, phone, email or student (substring, lowercase).", "forum page"],
             ["Calendar action", "Phrase lists decide list vs create; first number in the text is the time; 'tomorrow'/'today' set the day.", "google_calendar_automation.py"],
             ["Learner display name", "First non-empty of pseudonym, preferred_name, learner_name, student_name, display_name, full_name, name; else first + surname; else anonymous id.", "lib/learners.ts"]],
            [3.2, 10.4, 3.4], "Decision rules extracted from the code")

    d.br()
    d.h1("3. Feature catalogue")
    d.table([["Feature", "What it does", "How it decides", "Status", "Main gap"]] +
            [[c[0], c[1], c[2], c[3], c[4]] for c in COMPONENTS], [2.6, 3.8, 5.0, 1.5, 4.1], "All functional components")

    d.br()
    d.h1("4. Deep dives")
    d.h2("4.1 NGO finder")
    d.p("This is the feature most likely to be judged on real-world impact, so it needs to feel trustworthy. Today it is a "
        "client-side nearest-six lookup. The organisations table has the right fields (services, province, city, "
        "coordinates, rating, verified) and the API already supports province, city, service and text search, but the "
        "page does not use them.")
    d.fig(fig_ngo(), "The finder's decision chain and the recommended version.", width=16)
    d.p("<b>Recommended ranking</b> (simple, explainable, easy to defend): score = 0.5 x (1 - distance / 100 km, floored "
        "at 0) + 0.3 x (service matches the learner's need) + 0.2 x (rating / 5). Show why a result ranked high "
        "('12 km away - speech therapy - 4.5 stars'). Verify every record against the organisation's own website or "
        "by a call, store the source URL and last-checked date, and show it. Candidate national bodies to research "
        "(confirm each before listing): Autism South Africa, ADHD South Africa, the Dyslexia Association of South "
        "Africa, and the South African Federation for Mental Health, plus provincial branches and public clinics.")

    d.h2("4.2 Learner analytics")
    d.fig(fig_analytics_gap(), "The analytics inputs are never collected by the UI, so the output is always zero.", width=16)
    d.p("The scoring itself is sound and explainable. The problem is purely data capture and a few invented constants. "
        "Once W1 and W8 are fixed this becomes one of the strongest demo screens: a ranked class view, trends, and a "
        "plain-language narrative.")

    d.h2("4.3 Support request")
    d.fig(fig_support(), "Every hop forwards the request but nothing uses it.", width=16)

    d.h2("4.4 Calendar and schedule")
    d.fig(fig_calendar(), "Decision flow for 'schedule ...' in the chat, and its failure modes.", width=16)

    d.h2("4.5 Other decisions worth knowing")
    d.bullets([
        "<b>Forum PII filter:</b> the intent is right (protect children) but the implementation blocks the word "
        "'student'. A regex for IDs, phone numbers, e-mails and capitalised name pairs, reused from guardrails.py "
        "and enforced in the backend, fixes it.",
        "<b>Parent letters:</b> the page builds the prompt from the latest progress and sensory entries, which is good. "
        "Because all context travels as text in the message, long data hits the 2000-character guardrail limit; "
        "pass learner context as structured fields instead.",
        "<b>Planner:</b> the curriculum is chosen on the page but 'curriculum' is dropped by ChatRequest; it only "
        "reaches the model because it is also written into the prompt text.",
        "<b>Dashboard:</b> everything is computed in the browser from five parallel calls; good for speed, but it "
        "needs error states and could show an AI 'today's priorities' card (X3).",
    ])

    d.br()
    d.h1("5. Issues to fix so AllMinds can win")
    d.p("P0 = fix before the final (breaks or undermines a headline feature). P1 = credibility and polish. "
        "P2 = optional features that differentiate you. Items R1-R4 come from the Production Readiness review because "
        "they can fail live. Effort is a rough estimate for one developer.")
    d.h2("5.1 P0: fix before the final")
    issue_table(d, [r for r in REG if r[1] == "P0"], "P0 issues")
    d.h2("5.2 P1: credibility and polish")
    issue_table(d, [r for r in REG if r[1] == "P1"], "P1 issues")
    d.h2("5.3 P2: wow factor")
    issue_table(d, [r for r in REG if r[1] == "P2"], "P2 ideas")
    d.fig(fig_plan(), "A one-week plan that fits the time left.", width=16)

    d.h1("6. Five-minute demo script")
    d.table([["Time", "Show", "Say"],
             ["0:00", "Landing page, sign in with the demo classroom loaded (W5).", "Teachers have neurodivergent learners and no specialist support."],
             ["0:45", "Dashboard: learners, recent plans, tasks.", "Everything is scoped to the teacher; learners are pseudonymised."],
             ["1:15", "Assessment planner: Grade 3 maths, fractions, dyscalculia, isiZulu. Show a cached result, then the live progress steps.", "Supervisor-worker agents, Gemini Pro, DCAPS retrieval, parallel videos and images."],
             ["2:15", "Learner analytics: ranked class view, one learner's trend, narrative.", "Transparent formula, not a black box."],
             ["3:00", "Parent letter drafted in the learner's home language, export PDF.", "Hours of admin saved per week."],
             ["3:45", "NGO finder: search by need and province; AI match.", "Closing the loop from classroom to community support."],
             ["4:30", "Thandi answers a curriculum question (spoken input and citations if X5/X6 are built).", "Safe guardrails, AI replies in 11 languages."]],
            [1.4, 8.2, 7.4], "Demo script")

    d.br()
    d.h1("7. Judging questions and model answers")
    d.note("These answers assume the P0 and listed P1/P2 fixes are done. Do not claim a capability in the room until it is built and tested.")
    d.qa([
        ("How does the NGO finder decide what to show?",
         "Today it takes the teacher's location, fetches verified organisations, computes great-circle distance, and shows "
         "the nearest six with an optional service filter. The next version ranks by distance, match to the learner's "
         "need and rating, shows why, and works without location through province and city search."),
        ("How does the support-priority score work, and can you trust it?",
         "It averages how far engagement, task completion and attendance fall short of 100%, and bands it at 40 and 70. "
         "It is a screening aid built from teacher-entered ratings, not a diagnosis, and the UI should state that next to the score. It is "
         "explainable: every point of the score can be traced to a logged value."),
        ("Where is AI actually deciding, and where is it deliberately not?",
         "AI decides routing (Groq), writes lesson content, letters and visual supports (Gemini) and answers "
         "curriculum questions from retrieved text. Risk scoring, trends and task ordering are deterministic rules on "
         "purpose, so teachers can audit them."),
        ("What stops the AI giving harmful advice?",
         "Input guardrails (injection, harm, abuse, PII), prompts that forbid diagnosis and medication advice, output "
         "filtering, and signposting to specialists. For safeguarding disclosures (to be added) it routes to a vetted script instead of a refusal."),
        ("Is the data real?",
         "The demo classroom is synthetic and labelled so. The NGO directory is curated from verified public sources "
         "with the source and last-checked date shown on each card."),
        ("What did you learn from reviewing your own product?",
         "That the risky parts are the seams: forms that do not collect what analytics needs, payload fields that "
         "drop between services. We are closing them with end-to-end tests that follow one learner from data entry to insight."),
        ("What would you add with another month?",
         "Memory for Thandi, offline mode for low-connectivity schools, a school-level dashboard for principals, and "
         "an evaluation set that measures quality per agent."),
    ])
    return d.build()


if __name__ == "__main__":
    print(build())
