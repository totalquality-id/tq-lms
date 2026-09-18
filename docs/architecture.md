# Total Quality Learning

## Architecture

Next.js 16 App Router and TypeScript. Server Components read through services; Server Actions validate Zod input and authorize every mutation. Prisma connects to PostgreSQL (local Prisma Postgres for development, Supabase for production). Auth.js manages signed, HTTP-only sessions; Supabase Auth owns production passwords. Development-only credentials are unavailable when `NODE_ENV=production`. User identity and role are reloaded from the database for every protected request.

Course is reusable content. TrainingBatch is an organization-specific delivery. OrganizationMember scopes corporate access; TrainingBatchTrainer scopes trainers; Enrollment scopes participants. Neither client-supplied roles nor hidden navigation constitute authorization. Deactivation and soft deletion retain historical records. Critical mutations are recorded in AuditLog in the same transaction.

Business rules that are pure functions live in `src/lib` and carry no database or server-runtime imports: learning progress and sequential locking, objective grading, certificate eligibility, spreadsheet export, and calendar-date handling. Services in `src/services` own the queries, transactions, and authorization around them. That split is what makes the rules testable without a database and keeps one definition of each rule for every page that shows it.

## Directory map

- `src/app` — layouts, routes, server actions, API routes
- `src/components/ui` — design system primitives
- `src/components/layout` — brand, header, navigation, page headers
- `src/features` — learning, training management, administration UI
- `src/services` — authorization, queries, transactions
- `src/lib` — pure domain rules, Prisma client, auth, formatting
- `src/repositories` — shared query scopes
- `src/schemas` — validated input contracts
- `prisma` — schema, migrations, development seed
- `tests` — domain rules; `scripts/smoke.mjs` — authorization and route integration

## RBAC matrix

| Capability                        | Super admin / Admin | Trainer               | Participant           | Corporate PIC         |
| --------------------------------- | ------------------- | --------------------- | --------------------- | --------------------- |
| Organizations, users, courses     | Manage              | Read assigned content | Read enrolled content | Read own organization |
| Training batches                  | Manage all          | Assigned only         | Enrolled only         | Own organization only |
| Enrollment and trainer assignment | Manage              | Read assigned         | Read self             | Read own employees    |
| Modules and lessons               | Manage / reorder    | Read assigned         | Read enrolled         | None                  |
| Question bank                     | Manage              | None                  | None                  | None                  |
| Assessments and assignments       | Manage all          | Manage assigned       | Attempt / submit      | None                  |
| Attendance                        | Manage all          | Manage assigned       | Read own              | Read own employees    |
| Training evaluation               | Open / close / read | Open / close / read   | Submit once           | None                  |
| Certificates                      | Issue / revoke      | Issue on assigned     | Read / download own   | Read own employees    |
| Reports and export                | All training        | Assigned training     | **None**              | Own organization      |
| Profile                           | Self                | Self                  | Self                  | Self                  |

Reports are withheld from participants deliberately: a training they attend also contains their classmates, so an export scoped by batch would disclose other people's names, emails, and scores. A participant's own record lives on the training-history page instead.

## Routes

Public: `/login`, `/verify/[number]`.

Participant: `/dashboard`, `/my-training`, `/my-training/[id]` with `learn`, `learn/[lessonId]`, `assessment`, `assessment/[assessmentId]`, `assessment/[assessmentId]/[attemptId]`, `assignment`, `assignment/[assignmentId]`, `resources`, `evaluation`, `certificate`; `/certificates`, `/history`, `/profile`.

Trainer: `/trainer`, `/trainer/training`, `/trainer/reviews`, and `/trainer/training/[id]` with `participants`, `attendance`, `assessments`, `assignments`, `resources`, `evaluation`, `certificates`.

Admin: `/admin`, `/admin/courses`, `/admin/courses/[id]`, `/admin/training`, `/admin/training/[id]` with the same management tabs as the trainer view, `/admin/participants`, `/admin/trainers`, `/admin/organizations`, `/admin/users`, `/admin/question-bank`, `/admin/certificates`, `/admin/evaluations`, `/admin/reports`.

Corporate PIC: `/organization`, `/organization/training`, `/organization/training/[id]`, `/organization/employees`, `/organization/certificates`.

API: `/api/certificates/[number]/pdf`, `/api/files/[kind]/[id]`, `/api/reports`, `/api/auth/[...nextauth]`.

## Assessment engine

An attempt freezes its questions into `AssessmentAttempt.questionSnapshot` when it starts, including the answer key. Editing or archiving a question afterwards changes neither a running exam nor a recorded score. Randomisation and the question limit are applied server-side, so two participants receive genuinely different papers.

Where those questions come from is stated by `Assessment.selection`, not inferred from whether a manual list happens to exist. `ALL` draws from the course bank and honours `questionLimit`; `MANUAL` uses only the questions a trainer picked, in the order they set; `RULES` takes a given count per topic from `selectionRules`. An enum rather than inference matters because a trainer who configures per-topic rules and later attaches one question manually must not silently change how the exam is built. `questionLimit` applies to `ALL` alone — under `RULES` the rules already state the count, and applying both would make the total unpredictable.

Per-topic rules are validated against the bank when saved, and a shortfall is refused there. A trainer composing an assessment can fix it; a participant who has already pressed "start" cannot. If the bank shrinks afterwards, the attempt still runs with whatever the topics can supply rather than refusing to open — the selector reports the shortfall so it stays visible. Questions are shuffled once more after the rules are applied, so the topic structure is not handed to participants as a pattern in the ordering.

Timing is anchored to `expiresAt` on the attempt row. The countdown in the browser is a reading aid only; a tampered clock does not extend an exam, and a sleeping tab does not shorten one. Submission carries a 30-second grace for network latency, then saves nothing further and grades what was stored.

Starting and submitting both run in `Serializable` transactions, so two tabs cannot open two attempts or submit twice. Objective questions grade immediately; multiple choice is graded whole, so selecting every option never scores. Essays return no score, which leaves the attempt's grade empty until a trainer reviews it — a provisional number would misrepresent the result.

## Certification

Certificates are issued per enrollment once every requirement is met: minimum attendance, a passed final exam, required assignments reviewed, and the evaluation submitted. A requirement that does not apply to a training is reported as met with an explanation, so a class that uses no assignments is not impossible to finish.

Numbering is `TQI-<course code>-<year>-<six digits>`, drawn from `CertificateSequence`, which only ever increments. Counting certificate rows would recycle a number after a revocation. What is printed is frozen into `Certificate.snapshot`, so a renamed course does not alter a document already handed to a participant.

The PDF is generated with `pdf-lib` and carries a QR code to `/verify/<number>`. The verification page is the proof, not the sheet: a PDF can always be forged, a database record cannot. That page shows only what identifies the certificate — name, training, organization, dates, number — and never email, scores, or attendance. The PDF itself is restricted to the participant, the trainers of that class, the organization's PIC, and administrators.

## Account provisioning

Accounts are provisioned by invitation, not by an administrator typing a password. `AuthToken` holds single-use links for two purposes: `INVITE` (7 days) and `RESET` (1 hour). Only a SHA-256 digest of the token is stored — the raw value exists solely inside the link, so a leaked database copy cannot be used to take over an account.

Inviting a user provisions the Supabase Auth identity first, then issues the token. That order means a failure to provision leaves no token pointing at an account that does not exist. Issuing a token invalidates any outstanding token for the same purpose, so a resent link revokes the previous one rather than leaving two live doors.

Setting a password claims the token inside a conditional update, so two concurrent submissions cannot spend one link twice. The password is written to Supabase Auth afterwards; if that call fails the token is released again, because otherwise a provider outage would burn the only way in that the owner has.

The link is emailed when mail is configured, and returned to the administrator either way. It is returned even on a successful send because mail is caught by spam filters, and an administrator who already holds the link should not have to issue a new one — which revokes the old one — just to help one person who never received it. Where mail is not configured, the dialog says so and the link is the only delivery: a "send invitation" button that sends nothing is worse than a link the administrator can plainly see they must pass along.

The self-service reset form answers identically for registered and unregistered addresses — a form that answers differently becomes a way to confirm who attends which training. With mail configured the link reaches its owner directly; without it, outstanding requests are surfaced on the admin dashboard's pending-actions list, which is the inbox standing in for email.

## File storage

Resources and assignment submissions are files in a private Supabase Storage bucket, or links where a file cannot leave the company's own drive. Both are kept because neither alone covers the room: not every client permits work files to move, and not every participant has a drive they can share.

The browser uploads straight to Supabase against a signed key, and the bytes never pass through a server function. A 25 MB file would exceed the platform's request body limit, and copying the same bytes twice only adds latency and one more thing that can fail. The signature is bound to a single object key, so it cannot be used to write anywhere else.

Size and type are checked before signing and again against the object that actually landed. The size a browser reports before uploading is a claim, not evidence, so the database row is only written once the stored object is confirmed to exist and to be within the limit; a file that breaks the rule is deleted rather than left unreferenced. The allowlist is by extension rather than the browser's Content-Type, because the extension is what decides how the file opens for whoever receives it, and Content-Type is written by the sender.

Nothing is served from a fixed file address. `/api/files/[kind]/[id]` re-checks authorisation on every request and redirects to a signed URL that expires in a minute — so an address copied into a chat thread still meets the same check as the first time, rather than becoming a permanent hole. Resources are readable by anyone who may open the training; submissions only by the participant who wrote them, that class's trainers, and administrators. A corporate PIC is not on that list: their claim is to their employees' completion status, not to the work those employees handed in.

Keys embed the original file name as the last segment under a server-generated directory, so a download returns the name its owner recognises without a database column for it. The name is reduced to one safe path segment first, which is why two people uploading "tugas-akhir.pdf" cannot collide and no input can escape its prefix.

## Notifications

`Notification` rows are written inside the transaction that causes them, so a certificate that fails to save never leaves word that it was issued. They surface in a bell on the workspace header, read server-side on each request rather than polled — this news trails a mutation someone else has already made, and waiting until the next page load is an acceptable delay where a request every few seconds from every open tab is not. Read items stay in the panel; a list that empties itself on opening loses the thing a reader just glimpsed.

Email accompanies only the few that would otherwise be missed: a certificate issued, an assignment reviewed or sent back for revision, an exam finished grading, an enrolment someone else made on your behalf. New resources, new assignments, and submissions arriving for a trainer wait at the bell. Mailing all of them would turn notifications into something people switch off entirely.

Sending never blocks and never throws. It runs after the response through `after`, and a provider outage cannot undo a mutation that already succeeded — email reports work that is already done. Where `RESEND_API_KEY` and `MAIL_FROM` are unset, nothing is sent and the interface says so rather than claiming delivery.

## Calendar dates

`Attendance.date` is a PostgreSQL `DATE`, which has no time zone, and Prisma reads the UTC part of whatever it is given. Writing midnight Jakarta therefore stores the previous day. Every calendar date in the application is built and read at UTC midnight through `calendarDate` and `calendarKey`; display timestamps continue to use Asia/Jakarta.

## Delivery status

Implemented: authentication and role routing; organizations, users, courses, modules and lessons with reordering; training batches, trainer assignment and enrollment; the participant learning interface with lesson completion, progress, and optional sequential locking; the question bank; assessments with attempts, server-side timing, automatic scoring and essay review; attendance; assignments with file upload or link submission and review; training evaluation with aggregate reporting; certificate issuance, PDF with QR, public verification and revocation; private file storage for resources and submissions; in-app notifications with a header bell, and email for the ones worth interrupting someone over; the corporate dashboard and employee records; participant competency history; and filtered reports with CSV export.

Not implemented: QR attendance, and automatic account provisioning from an HR system. Storage and email are both optional at runtime rather than absent — where they are unconfigured the interface says so and falls back to links and the bell, instead of offering buttons that do nothing.

## Deployment topology

The Supabase project hosts two unrelated applications. The company website owns the `public` schema; this LMS owns a separate `lms` schema with its own Postgres role (`tq_lms_app`) granted only on that schema. Neither the website's tables nor its database password were touched. Two Prisma applications cannot share one `public` schema — each maintains its own `_prisma_migrations` table, and both define a `User` table with incompatible shapes.

Vercel functions run in `sin1`, the same region as the database. Prisma issues many round trips for a single page because of nested includes; with functions in the United States each of those crossed the Pacific and a training page exceeded the function timeout. For the same reason the pooled connection string does not set `connection_limit=1`: a single connection serialises those sub-queries.

Each management tab states its own reads in `services/batch.ts`. A single loader used to fetch the whole object graph for a training — every enrollment with its attendance, attempts, submissions, lesson completions, and evaluations — so the resources tab paid for exam attempts it never showed. The tab layout now reads counts only, because it re-renders on every tab; the participant, attendance, score, and certificate tables are paged; and the assignments tab loads submissions without dragging each participant's whole record behind them.

Authorisation did not move: every loader composes the same `batchScope` clause, so adding a tab is never an occasion to forget who may read it. Totals that sit above a paged table — how many participants have attempted an exam, how many are enrolled — are counted in their own query rather than from the rows on screen, which would report "3 of 40 attempted" purely because the reader is on the first page.

## Design

Indonesian interface, Plus Jakarta Sans. The palette is taken from the TQ logo: blue `#0201FE` and yellow `#FACC01`, both sampled from the artwork itself. Neither is used at full strength across large surfaces — the logo blue is intense enough that a button-sized field of it reads as loud rather than serious. Buttons and headings use a deepened step of the same hue (`#2A2EB0`); the exact logo blue appears only where a line is thin enough to carry it: the active navigation marker and the focus ring. The yellow is rarer still — a short rule under the workspace title, on the sign-in page, and above empty states. Everything else is neutral grey on white. Text-first sidebar without decorative icons, responsive drawer below `lg`, link-based tabs so every section has its own URL, understated status badges, and one filter bar per list. Participant pages are built for phones; administrative tables scroll horizontally inside their card rather than the page.
