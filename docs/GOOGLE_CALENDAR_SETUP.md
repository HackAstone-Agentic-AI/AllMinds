# Google Calendar Setup (Per‑User Connections)

AllMinds lets **each teacher connect their own Google account**. Every connection is
stored separately, keyed by the teacher's `user_id`, and events are always written to
that teacher's own primary calendar.

There is **one** thing that is shared across the whole app and **one** thing that is
per‑user — it's important not to confuse them:

| Thing | Scope | Where it lives |
|-------|-------|----------------|
| OAuth **client** (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`) | **One per app.** Identifies *AllMinds* to Google. Not a calendar, not an account. | `.env` |
| OAuth **tokens** (access / refresh token, Gmail address) | **One per teacher.** Captured when the teacher consents with their own Google account. | `google_calendar_tokens` table, `user_id` PRIMARY KEY |

You only ever create **one** OAuth client. You do **not** need (and cannot have) a
separate client ID per user — that's not how Google OAuth works. The per‑user behavior
comes entirely from each teacher signing in to *their own* Google account on the consent
screen.

---

## 1. Create the OAuth client (one time)

1. Go to <https://console.cloud.google.com/> and create or select a project.
2. **APIs & Services → Library →** enable the **Google Calendar API**.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID.**
   - Application type: **Web application**
   - Name: `AllMinds`
4. Under **Authorized redirect URIs**, add **both** of these (the same client is reused
   for Google login *and* for calendar access):

   ```text
   http://localhost:5000/api/auth/google/callback
   http://localhost:5000/api/calendar/callback
   ```

   For production, also add your deployed backend equivalents, e.g.:

   ```text
   https://api.yourdomain.com/api/auth/google/callback
   https://api.yourdomain.com/api/calendar/callback
   ```

5. Click **Create** and copy the **Client ID** and **Client secret**.

## 2. Put the credentials in `.env`

Replace the placeholders in the repo‑root `.env`:

```env
GOOGLE_CLIENT_ID=<your real client id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your real client secret>
BACKEND_URL=http://localhost:5000      # used to build the calendar callback URL
FRONTEND_URL=http://localhost:3000     # where users land after connecting
```

Restart the backend after editing `.env`.

## 3. Configure the OAuth consent screen

**APIs & Services → OAuth consent screen.**

- **User type: External** (so any teacher's Google account can connect).
- Fill in app name, support email, and developer contact email.
- **Scopes:** add the calendar scope the app requests:

  ```text
  https://www.googleapis.com/auth/calendar
  https://www.googleapis.com/auth/userinfo.email
  ```

### While building / testing
- Leave the app in **Testing** mode.
- Add each teacher's Google email under **Test users** (up to 100).
- Only those listed accounts can connect until you publish.

### For real / public use
- Click **Publish app**.
- Because `auth/calendar` is a **sensitive/restricted** scope, Google requires
  **verification** before unlimited external users can connect (see step 4).

## 4. Verification (only needed for public production use)

Google review is triggered by the sensitive `calendar` scope. To submit:

1. OAuth consent screen → **Prepare for verification**.
2. Provide:
   - An **authorized domain** you own and a **privacy policy URL** hosted on it.
   - A **YouTube demo video** showing the OAuth consent flow and how AllMinds uses
     calendar access (creating/reading the signed‑in teacher's events).
   - A written **scope justification**, e.g.:
     > "AllMinds is a teacher workspace for neurodivergent learners. Teachers connect
     > their own Google Calendar so the app can add classroom schedule items and read
     > their upcoming events on their behalf. Calendar data is only ever accessed for
     > the individual signed‑in teacher and is never shared between accounts."
3. Submit and respond to any follow‑up from the Trust & Safety team.

Verification can take a few days to a few weeks. **Until it's approved you can still run
fully in Testing mode** with up to 100 explicitly listed test users — enough for a pilot.

---

## How a teacher connects (what they see)

1. Sign in to AllMinds.
2. **Schedule Tracking** tool → **Connect**, or **Settings → Integrations → Connect**.
3. They're sent to Google, pick **their own** Google account, and approve calendar access.
4. They're redirected back; the connected Gmail address is shown so they can confirm it's
   theirs.
5. New schedule items (and AI chat requests like "schedule a math lesson tomorrow at 9am")
   are written to **their** calendar.

To switch accounts: **Settings → Integrations → Disconnect**, then connect again.

## Isolation guarantees (already enforced in code)

- Token rows use `user_id` as the **primary key** — one row per teacher.
- The OAuth callback derives the user from an **HMAC‑signed `state`**, not from client input.
- The event endpoint uses `getValidAccessToken(req.user.id)` — always the signed‑in user.
- The AI chat service derives the user from the JWT and **ignores** any client‑supplied
  `thread_id`, so one teacher can never reach another's calendar.
