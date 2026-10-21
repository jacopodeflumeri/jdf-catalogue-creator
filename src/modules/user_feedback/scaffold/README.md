# User Feedback — scaffold (copy-in)

The feedback **module** (`src/modules/user_feedback/`) is compiled into the base
template: the submit logic, Notion payload builder, and sanitization. This
`scaffold/` holds the two **UI** pieces you copy into place when you enable the
capability, so nothing renders until you opt in.

Copy these `.example` files (drop the `.example` suffix):

| From (scaffold) | To |
|---|---|
| `components/feedback/FeedbackWidget.tsx.example` | `src/components/feedback/FeedbackWidget.tsx` |
| `app/api/feedback/route.ts.example` | `src/app/api/feedback/route.ts` |

## Steps

1. **Install the Notion SDK** (already declared in the template's `package.json`;
   run install if your fork predates it):

   ```bash
   npm install @notionhq/client
   ```

2. **Copy the two files** above into place.

3. **Mount the widget once** in the root layout, inside your providers so it sits
   on every authenticated page. In `src/app/layout.tsx`:

   ```tsx
   import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
   // …inside <Providers> … {children} …
   <FeedbackWidget />
   ```

   The widget always renders on the client; the `POST /api/feedback` route
   enforces auth, so unauthenticated visitors can't submit.

4. **Configure the shared Notion secrets.** Every Labs app writes to the SAME
   "App Feedback" Notion database, so both values live in a **shared** SSM path,
   not a per-app one:

   - `NOTION_API_KEY` — Notion integration token
   - `NOTION_FEEDBACK_DATABASE_ID` — the shared "App Feedback" database id

   Locally, put them in `.env`. In AWS, read them from
   `/labs-shared/feedback/NOTION_API_KEY` and
   `/labs-shared/feedback/NOTION_FEEDBACK_DATABASE_ID` (SecureStrings) and grant
   the ECS task role `ssm:GetParameter` + `kms:Decrypt` on that path. See
   [docs/template/capabilities/USER_FEEDBACK.md](../../../../docs/template/capabilities/USER_FEEDBACK.md).

5. **Grant the integration access** to the Notion database (share the DB with the
   integration), and make sure `app.config.json` has `createdBy` set — it becomes
   the "Responsible Person" on every row.

6. **Enable the capability** — add `"user_feedback"` to `enabledCapabilities` in
   `app.config.json`.

## What is auto-filled

The user only picks a category, (for general feedback) a rating, and types a
comment. Everything else is filled server-side: App Name, Responsible Person
(`app.config.json.createdBy`), User Name, User Email, Company (for company-context
customers), Submitted At, and Triage Status (`pending`).

## What is NOT here

No triage/digest/LLM code. Categorization, priority/sentiment, and the weekly
digest are handled by a **centralized Notion agent** operating on the shared
database — deliberately out of the app so no app is on the LLM-cost path. See the
capability doc for the division of responsibilities.
