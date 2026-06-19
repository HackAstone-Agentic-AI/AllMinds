# AllMinds Improvements And Fixes

## What We Improved

- Replaced Supabase-dependent frontend flows with the custom backend API in the learner, dashboard, sensory, progress, profile, and communication flows.
- Added missing dashboard tool routes for visual support, assessment planner, and schedule tracking.
- Fixed the dashboard layout hook dependency warning and cleaned up related React effect patterns.
- Fixed textbox and textarea visibility issues by enforcing readable text and placeholder styles.
- Wired browser geolocation into the professional development page and surfaced nearby NGOs with better filtering and map links.
- Added social sign-in plumbing for Google, Microsoft, and Apple, plus clearer failure handling when providers are not configured.
- Added backend environment validation and setup documentation so missing auth or mail config fails clearly.
- Upgraded forum posting validation and feedback so empty, oversized, or confusing posts are handled better.
- Improved parent communication exports so Word and text downloads are real files and PDF export now creates an actual PDF document.
- Added true Excel learner import support for `.xlsx`, `.xls`, and `.csv`.
- Added a database-backed task system and connected it to the dashboard alongside recent activity history.

## What Was Wrong And How It Was Fixed

- Supabase calls were still present in frontend files even though the project had moved to a custom Express/PostgreSQL backend.
  We replaced them with `lib/api.ts` calls and JWT-based auth from `localStorage`.

- Some dashboard sections were placeholders with no backing data.
  We added task endpoints, a `teacher_tasks` table, and connected the dashboard to real activities and tasks.

- Parent communication "PDF" export only opened a print window instead of downloading a PDF file.
  We added real PDF generation with `jspdf`.

- Learner upload claimed to support spreadsheets but only handled CSV safely.
  We added workbook parsing with `xlsx` and normalized spreadsheet rows into the learner bulk-upload format.

- Signup and social auth setup were incomplete.
  We added backend OAuth route handling, provider-aware redirects, teacher profile creation, and provider env validation.

- Some UI text inputs became unreadable depending on theme and browser defaults.
  We updated global styles so text fields always render visible text and placeholders.

- Sample SQL data referenced users that did not exist yet.
  We refreshed the schema script so the demo data inserts in a valid order with working references.

## Files And Areas Touched

- Frontend app routes under `Front-End-main/app/dashboard/...`
- Frontend API client in `Front-End-main/lib/api.ts`
- Frontend shared types in `Front-End-main/types/database.ts`
- Backend auth, learner, forum, activity, parent communication, and OAuth routes/controllers
- Backend environment and startup config

## Useful Next Improvements

- Add editing and deletion for dashboard tasks, not only creation and status progression.
- Add richer learner import validation reports with row-by-row error downloads.
- Add branded PDF templates with school headers and signature blocks.
- Add database migrations as a formal versioned migration system instead of SQL snapshots plus manual apply.
- Add automated tests for auth flows, learner imports, forum posting, and dashboard task routes.
- Add role-based admin dashboards backed by school-level aggregates.
