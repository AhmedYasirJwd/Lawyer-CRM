# LexCase — Legal Case Management

A staff-facing case management web app for lawyers: cases, hearings, tasks, and
a dashboard, built to match the provided UI reference (case details + dashboard).
Responsive — sidebar nav on desktop, bottom tab bar on mobile.

## Stack

- **Next.js 16 (App Router) + TypeScript**
- **Tailwind CSS v4** for styling
- **lucide-react** for icons
- **Data storage: a JSON file** (`data/db.json`), read/written by API routes in
  `src/app/api/**`. This is a deliberate placeholder — see "Swapping in a real
  database" below.

## Getting started

```bash
npm install
node scripts/seed.mjs   # (re)generates data/db.json with sample data
npm run dev
```

Open http://localhost:3000.

`node scripts/seed.mjs` can be re-run any time to reset back to sample data —
it overwrites `data/db.json`.

## Project structure

```
data/db.json                     the "database" — cases, hearings, tasks
scripts/seed.mjs                 generates data/db.json
src/lib/types.ts                 shared TypeScript types
src/lib/db.ts                    read/write layer over data/db.json
src/lib/format.ts                date/label formatting helpers
src/app/
  page.tsx                       Dashboard
  cases/page.tsx                 Cases list (search)
  cases/[id]/page.tsx            Case Details
  cases/[id]/edit/page.tsx       Edit Case
  cases/new/page.tsx             New Case
  cases/[id]/hearings/new/       Add Hearing (from a case)
  calendar/page.tsx              Calendar (upcoming/past hearings)
  calendar/new/page.tsx          Schedule Hearing (with case picker)
  tasks/page.tsx                 Tasks (toggle complete, delete)
  tasks/new/page.tsx             New Task
  search/page.tsx                Global search (cases + tasks)
  settings/page.tsx              Profile placeholder
  api/**                         REST-ish route handlers used by client forms
src/components/                  UI building blocks (Sidebar, BottomNav,
                                  StatCard, Timeline, CaseForm, etc.)
```

## Data model

See `src/lib/types.ts`. Summary:

- **LegalCase**: caseNumber, title (e.g. "Ali Khan vs Ahmed & Co."), court,
  filingDate, caseType, judge, stage, lastUpdated, parties[],
  timeline[]
- **Hearing**: caseId, date (ISO datetime), purpose, court, judge
- **Task**: title, caseId? (optional link to a case), dueDate, status

## Swapping in a real database later

Everything data-related is isolated in `src/lib/db.ts` — every page and API
route calls functions like `getCases()`, `createCase()`, `updateTask()`, etc.
from that one file, and none of them know or care that the current
implementation happens to read/write a JSON file. To move to a real database
(Postgres, MSSQL, etc.), you only need to rewrite the internals of
`src/lib/db.ts` to hit that database instead of `data/db.json` — the function
signatures can stay the same, so no page or component needs to change.

Note the current implementation uses an in-process write lock
(`locked()` in `db.ts`) to avoid corrupting the file on concurrent requests.
That's a single-process JSON-file concern and won't be needed once this is a
real database with its own transaction handling.

## Notes

- No auth yet — the dashboard greets a hardcoded "Yasir" and settings shows a
  placeholder profile. Wire up real auth whenever you're ready.
- "Upload Document" in Quick Actions is a placeholder button (no-op) — hook up
  file storage when you get to that.
