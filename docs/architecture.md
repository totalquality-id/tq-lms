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

| Capability                        | Super admin / Admin | Trainer                | Participant             | Corporate PIC          |
| --------------------------------- | ------------------- | ---------------------- | ----------------------- | ---------------------- |
| Organizations, users, courses      | Manage              | Read assigned content  | Read enrolled content   | Read own organization  |
| Training batches                   | Manage all          | Assigned only          | Enrolled only           | Own organization only  |
| Enrollment and trainer assignment  | Manage              | Read assigned          | Read self               | Read own employees     |
| Modules and lessons                | Manage / reorder    | Read assigned          | Read enrolled           | None                   |
| Question bank                      | Manage              | None                   | None                    | None                   |
| Assessments and assignments        | Manage all          | Manage assigned        | Attempt / submit        | None                   |
| Attendance                         | Manage all          | Manage assigned        | Read own                | Read own employees     |
| Training evaluation                | Open / close / read | Open / close / read    | Submit once             | None                   |
| Certificates                       | Issue / revoke      | Issue on assigned      | Read / download own     | Read own employees     |
| Reports and export                 | All training        | Assigned training      | **None**                | Own organization       |
| Profile                            | Self                | Self                   | Self                    | Self                   |

Reports are withheld from participants deliberately: a training they attend also contains their classmates, so an export scoped by batch would disclose other people's names, emails, and scores. A participant's own record lives on the training-history page instead.

## Routes

Public: `/login`, `/verify/[number]`.

Participant: `/dashboard`, `/my-training`, `/my-training/[id]` with `learn`, `learn/[lessonId]`, `assessment`, `assessment/[assessmentId]`, `assessment/[assessmentId]/[attemptId]`, `assignment`, `assignment/[assignmentId]`, `resources`, `evaluation`, `certificate`; `/certificates`, `/history`, `/profile`.

Trainer: `/trainer`, `/trainer/training`, `/trainer/reviews`, and `/trainer/training/[id]` with `participants`, `attendance`, `assessments`, `assignments`, `resources`, `evaluation`, `certificates`.

Admin: `/admin`, `/admin/courses`, `/admin/courses/[id]`, `/admin/training`, `/admin/training/[id]` with the same management tabs as the trainer view, `/admin/participants`, `/admin/trainers`, `/admin/organizations`, `/admin/users`, `/admin/question-bank`, `/admin/certificates`, `/admin/evaluations`, `/admin/reports`.

Corporate PIC: `/organization`, `/organization/training`, `/organization/training/[id]`, `/organization/employees`, `/organization/certificates`.

API: `/api/certificates/[number]/pdf`, `/api/reports`, `/api/auth/[...nextauth]`.

## Assessment engine

An attempt freezes its questions into `AssessmentAttempt.questionSnapshot` when it starts, including the answer key. Editing or archiving a question afterwards changes neither a running exam nor a recorded score. Randomisation and the question limit are applied server-side, so two participants receive genuinely different papers.

Timing is anchored to `expiresAt` on the attempt row. The countdown in the browser is a reading aid only; a tampered clock does not extend an exam, and a sleeping tab does not shorten one. Submission carries a 30-second grace for network latency, then saves nothing further and grades what was stored.

Starting and submitting both run in `Serializable` transactions, so two tabs cannot open two attempts or submit twice. Objective questions grade immediately; multiple choice is graded whole, so selecting every option never scores. Essays return no score, which leaves the attempt's grade empty until a trainer reviews it — a provisional number would misrepresent the result.

## Certification

Certificates are issued per enrollment once every requirement is met: minimum attendance, a passed final exam, required assignments reviewed, and the evaluation submitted. A requirement that does not apply to a training is reported as met with an explanation, so a class that uses no assignments is not impossible to finish.

Numbering is `TQI-<course code>-<year>-<six digits>`, drawn from `CertificateSequence`, which only ever increments. Counting certificate rows would recycle a number after a revocation. What is printed is frozen into `Certificate.snapshot`, so a renamed course does not alter a document already handed to a participant.

The PDF is generated with `pdf-lib` and carries a QR code to `/verify/<number>`. The verification page is the proof, not the sheet: a PDF can always be forged, a database record cannot. That page shows only what identifies the certificate — name, training, organization, dates, number — and never email, scores, or attendance. The PDF itself is restricted to the participant, the trainers of that class, the organization's PIC, and administrators.

## Calendar dates

`Attendance.date` is a PostgreSQL `DATE`, which has no time zone, and Prisma reads the UTC part of whatever it is given. Writing midnight Jakarta therefore stores the previous day. Every calendar date in the application is built and read at UTC midnight through `calendarDate` and `calendarKey`; display timestamps continue to use Asia/Jakarta.

## Delivery status

Implemented: authentication and role routing; organizations, users, courses, modules and lessons with reordering; training batches, trainer assignment and enrollment; the participant learning interface with lesson completion, progress, and optional sequential locking; the question bank; assessments with attempts, server-side timing, automatic scoring and essay review; attendance; assignments with submission and review; training evaluation with aggregate reporting; certificate issuance, PDF with QR, public verification and revocation; the corporate dashboard and employee records; participant competency history; and filtered reports with CSV export.

Not implemented: private file upload (resources and assignment submissions are links; `TrainingResource.storageKey` and `AssignmentSubmission.storageKey` are reserved for Supabase Storage), QR attendance, email invitations and notification delivery, and automatic account provisioning. `Notification` rows are written on certificate issuance but are not yet surfaced in the interface.

## Deployment topology

The Supabase project hosts two unrelated applications. The company website owns the `public` schema; this LMS owns a separate `lms` schema with its own Postgres role (`tq_lms_app`) granted only on that schema. Neither the website's tables nor its database password were touched. Two Prisma applications cannot share one `public` schema — each maintains its own `_prisma_migrations` table, and both define a `User` table with incompatible shapes.

Vercel functions run in `sin1`, the same region as the database. Prisma issues many round trips for a single page because of nested includes; with functions in the United States each of those crossed the Pacific and a training page exceeded the function timeout. For the same reason the pooled connection string does not set `connection_limit=1`: a single connection serialises those sub-queries.

`accessibleBatch` currently loads the whole object graph for a training — every enrollment with its attendance, attempts, submissions, lesson completions, and evaluations — and every management tab pays for it. It is fast enough for classes of this size, but narrowing the include per tab is the obvious next optimisation as cohorts grow.

## Design

Indonesian interface, Plus Jakarta Sans. The palette is taken from the TQ logo: blue `#0201FE` and yellow `#FACC01`, both sampled from the artwork itself. Neither is used at full strength across large surfaces — the logo blue is intense enough that a button-sized field of it reads as loud rather than serious. Buttons and headings use a deepened step of the same hue (`#2A2EB0`); the exact logo blue appears only where a line is thin enough to carry it: the active navigation marker and the focus ring. The yellow is rarer still — a short rule under the workspace title, on the sign-in page, and above empty states. Everything else is neutral grey on white. Text-first sidebar without decorative icons, responsive drawer below `lg`, link-based tabs so every section has its own URL, understated status badges, and one filter bar per list. Participant pages are built for phones; administrative tables scroll horizontally inside their card rather than the page.
