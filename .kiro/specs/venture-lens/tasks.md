# Implementation Plan: VentureLens

## Overview

VentureLens is a MERN single-process web application: one Express.js server handles all API routes, session management, and static file delivery. The React SPA is loaded via CDN scripts with Babel Standalone for in-browser JSX — no build step, no bundler, no separate dev server. MongoDB is the sole data store. Implementation follows this phase order: Setup → Models → Auth → Profiles → Readiness → Evidence → Questions → Frontend → Tests → README.

---

## Tasks

- [x] 1. Project Setup and Configuration
  - [x] 1.1 Initialise Node.js project and install all server-side dependencies
    - Run `npm init -y` in the workspace root
    - Install production dependencies: `express`, `mongoose`, `express-session`, `connect-mongo`, `bcrypt`, `dotenv`
    - Install dev dependencies: `jest`, `supertest`, `fast-check`, `mongodb-memory-server`
    - Set `"scripts": { "start": "node server/index.js", "test": "jest --runInBand" }` in `package.json`
    - Set Jest config in `package.json`: `"testEnvironment": "node"`, `"testTimeout": 30000`
    - _Requirements: 11.1, 12.1_

  - [x] 1.2 Create the full directory structure
    - Create all directories: `server/models/`, `server/routes/`, `server/middleware/`, `server/utils/`, `public/components/Auth/`, `public/components/Dashboard/`, `public/components/Profile/`, `public/components/Evidence/`, `public/components/Questions/`, `public/components/Investor/`, `public/components/Shared/`, `public/styles/`, `tests/`
    - Create placeholder `index.js` stubs so the tree is navigable
    - _Requirements: 11.1_

  - [x] 1.3 Create `.env` file with required environment variable keys
    - Add variables: `MONGO_URI`, `SESSION_SECRET`, `NODE_ENV`, `PORT`
    - Document each variable with an inline comment
    - Do NOT commit real secrets; add `.env` to `.gitignore`
    - _Requirements: 2.6_

  - [x] 1.4 Create `server/db.js` — MongoDB connection module
    - Export an async `connectDB()` function using `mongoose.connect(process.env.MONGO_URI)`
    - Log connection success/failure; do not swallow errors
    - _Requirements: 4.1, 7.1, 8.1_

  - [x] 1.5 Create `server/index.js` — Express entry point
    - Import and call `connectDB()`
    - Wire `express.json()`, session middleware (express-session + connect-mongo), static middleware (`/public`)
    - Mount all API routers under `/api`
    - Add SPA catch-all: every unmatched GET serves `public/index.html`
    - Add global error handler: `(err, req, res, next) => res.status(500).json({ error: 'Internal server error' })`
    - _Requirements: 11.1, 11.3_

- [x] 2. Data Models
  - [x] 2.1 Implement `server/models/User.js`
    - Define schema: `name` (String, required, maxlength 100), `email` (String, required, unique, lowercase), `passwordHash` (String, required), `role` (enum Founder/Investor, required), `loginAttempts` (Number, default 0), `lockUntil` (Date, default null), `createdAt` (Date, default Date.now)
    - Export the Mongoose model
    - _Requirements: 1.1, 1.4, 1.6, 2.12_

  - [x] 2.2 Implement `server/models/BusinessProfile.js`
    - Define schema: `owner` (ObjectId ref User, required, indexed), `businessName` (String, required, maxlength 200), `description` (String, required, maxlength 2000), plus optional text fields (`industry`, `stage`, `businessModel`, `problemStatement`, `solutionStatement`, `targetCustomers`, `revenueContext`, `useOfFunds`, `milestones` — all String default ''), `fundingGoal` (Number, default null), `publicationStatus` (enum Published/Unpublished, default Unpublished), `createdAt`, `updatedAt`
    - Export the Mongoose model
    - _Requirements: 4.7, 5.1_

  - [x] 2.3 Implement `server/models/EvidenceRecord.js`
    - Define schema: `profile` (ObjectId ref BusinessProfile, required, indexed), `owner` (ObjectId ref User, required, indexed), `title` (String, required, maxlength 200), `category` (String, required), `relatedSection` (String, required), `description` (String, default ''), `documentReference` (String, default ''), `status` (enum Missing/Provided/Awaiting Review/Outdated, required), `createdAt`, `updatedAt`
    - Export the Mongoose model
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 2.4 Implement `server/models/Question.js`
    - Define schema: `profile` (ObjectId ref BusinessProfile, required, indexed), `investor` (ObjectId ref User, required, indexed), `text` (String, required, maxlength 1000), `sectionReference` (String, default '', maxlength 100), `status` (enum Open/Answered/Closed, default Open, required), `responseText` (String, default null, maxlength 2000), `createdAt`, `updatedAt`
    - Export the Mongoose model
    - _Requirements: 8.1, 8.7, 8.8_

- [x] 3. Middleware
  - [x] 3.1 Implement `server/middleware/requireAuth.js`
    - If `req.session.userId` is absent return `res.status(401).json({ error: 'Authentication required' })`
    - Otherwise call `next()`
    - _Requirements: 3.1_

  - [x] 3.2 Implement `server/middleware/requireRole.js`
    - Accept a `role` parameter
    - If `req.session.role !== role` or role is not in `['Founder', 'Investor']` return `res.status(403).json({ error: 'Insufficient permissions' })`
    - Otherwise call `next()`
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 4. Auth Routes
  - [x] 4.1 Implement `server/routes/auth.js` — registration endpoint
    - `POST /api/auth/register`: validate name, email, password, role (presence, length, format, enum); return 400 with `{ error, field }` on failure; check duplicate email → 409; hash password with bcrypt (cost 12); save User; call `req.session.regenerate` then set `userId`, `role`, `name`; return `{ user: { _id, name, email, role } }`
    - _Requirements: 1.1–1.11_

  - [x] 4.2 Implement `server/routes/auth.js` — login endpoint
    - `POST /api/auth/login`: validate email and password presence/format; look up user by email; if `lockUntil` is in the future return 423; compare bcrypt; on failure increment `loginAttempts`, set `lockUntil` if reaching 5; on success reset counters, call `req.session.regenerate`, set session, return `{ user }`
    - _Requirements: 2.1–2.12_

  - [x] 4.3 Implement `server/routes/auth.js` — logout and me endpoints
    - `POST /api/auth/logout`: call `req.session.destroy()`, clear cookie, return 200
    - `GET /api/auth/me`: behind `requireAuth`; return `{ user: { _id, name, email, role } }` from session
    - Mount router at `/api/auth` in `server/index.js`
    - _Requirements: 2.8_

- [x] 5. Business Profile Routes
  - [x] 5.1 Implement `server/routes/profiles.js` — Founder CRUD
    - `POST /api/profiles`: requireAuth + requireRole('Founder'); validate businessName (1–200) and description (1–2000); create and return profile with owner set to `req.session.userId`
    - `GET /api/profiles/mine`: requireAuth + requireRole('Founder'); return the profile whose owner is `req.session.userId`
    - `PUT /api/profiles/:id`: requireAuth + requireRole('Founder'); verify ownership → 403 if mismatch; validate fundingGoal range if provided; apply updates; return updated profile
    - `DELETE /api/profiles/:id`: requireAuth + requireRole('Founder'); verify ownership → 403; delete and return 200
    - _Requirements: 4.1–4.11_

  - [x] 5.2 Implement `server/routes/profiles.js` — publication toggle and Investor discovery
    - `PUT /api/profiles/:id/toggle-publication`: requireAuth + requireRole('Founder'); verify ownership; flip `publicationStatus`; save and return `{ publicationStatus }`
    - `GET /api/profiles`: requireAuth + requireRole('Investor'); return all profiles where `publicationStatus === 'Published'`
    - `GET /api/profiles/:id`: requireAuth + requireRole('Investor'); if profile not found → 404; if Unpublished → 403; return profile
    - Mount router at `/api/profiles` in `server/index.js`
    - _Requirements: 5.1–5.9_

- [x] 6. Readiness Calculation
  - [x] 6.1 Implement `server/utils/readiness.js` — pure calculation function
    - Export `computeReadiness(profile, hasEvidenceRecords)` matching the exact algorithm in the design: iterate 11 text fields, check `fundingGoal`, check `hasEvidenceRecords`; return `{ completed, total: 13, percentage: Math.round((completed/13)*100) }`
    - Text field completeness: `val && typeof val === 'string' && val.trim().length > 0`
    - fundingGoal completeness: `fundingGoal !== null && fundingGoal !== undefined && fundingGoal > 0`
    - _Requirements: 6.1, 6.3, 6.4, 12.9_

  - [x] 6.2 Implement `server/routes/readiness.js` — readiness endpoint
    - `GET /api/readiness/:profileId`: requireAuth + requireRole('Founder'); load profile; verify ownership → 403; count evidence records for profile (`EvidenceRecord.exists({ profile: profileId })`); call `computeReadiness`; build `incompleteItems` array from the fixed guidance table in the design; return `{ completenessPercentage, completedCount, totalSections, incompleteItems }`
    - Mount router at `/api/readiness` in `server/index.js`
    - _Requirements: 6.1–6.9_

- [x] 7. Evidence Record Routes
  - [x] 7.1 Implement `server/routes/evidence.js`
    - `POST /api/evidence`: requireAuth + requireRole('Founder'); validate title (1–200), category, relatedSection, status (enum check); verify requesting Founder owns the referenced profile → authorization error; create and return record
    - `GET /api/evidence/:profileId`: requireAuth + requireRole('Founder'); verify requesting Founder owns the profile; return all EvidenceRecords for that profile
    - `PUT /api/evidence/:id`: requireAuth + requireRole('Founder'); find record; verify `record.owner` equals `req.session.userId` → authorization error; apply updates; return updated record
    - `DELETE /api/evidence/:id`: requireAuth + requireRole('Founder'); find record; verify ownership → authorization error; delete and return 200
    - Mount router at `/api/evidence` in `server/index.js`
    - _Requirements: 7.1–7.14_

- [x] 8. Question Routes
  - [x] 8.1 Implement `server/routes/questions.js` — Investor submission and history
    - `POST /api/questions`: requireAuth + requireRole('Investor'); validate text (1–1000) and optional sectionReference (≤100); load profile; if not Published → error; create Question with `status: 'Open'`, `investor: req.session.userId`; return question
    - `GET /api/questions/mine`: requireAuth + requireRole('Investor'); return all Questions where `investor === req.session.userId`
    - _Requirements: 8.1–8.9, 10.1_

  - [x] 8.2 Implement `server/routes/questions.js` — Founder inbox, respond, and close
    - `GET /api/questions/profile/:profileId`: requireAuth + requireRole('Founder'); verify Founder owns the profile → 403; return all Questions for that profile with investor name, text, status, response
    - `POST /api/questions/:id/respond`: requireAuth + requireRole('Founder'); find question; verify Founder owns the associated profile → 403; if question status is not 'Open' → 409; store responseText; update status to 'Answered'; return updated question
    - `POST /api/questions/:id/close`: requireAuth; find question; allow if requester is the investor who submitted it OR a Founder who owns the associated profile; otherwise → 403; set status to 'Closed'; return updated question
    - Mount router at `/api/questions` in `server/index.js`
    - _Requirements: 9.1–9.11, 10.2, 10.3_

- [x] 9. Frontend Shell
  - [x] 9.1 Create `public/index.html`
    - Load React 18 and ReactDOM from CDN (production builds)
    - Load Babel Standalone from CDN
    - Link all CSS files from `public/styles/`
    - Include `<script type="text/babel" src="/app.jsx"></script>` as the final script tag
    - Add a `<div id="root"></div>` mount point
    - _Requirements: 11.1_

  - [x] 9.2 Create all CSS files under `public/styles/`
    - `global.css`: CSS reset, base typography (system fonts), color variables (dark navy background `hsl(225,35%,15%)`, teal accent `hsl(185,55%,45%)`), contrast-compliant text/background pairs (≥4.5:1 normal text, ≥3:1 large text)
    - `layout.css`: flex/grid page layout, nav bar, main content area, single-column reflow at `max-width: 767px`
    - `forms.css`: input fields, labels, buttons, inline error messages
    - `dashboard.css`: readiness widget, incomplete items list, question inbox summary
    - `evidence.css`: coverage map grid, category group headers, status badge colors (Missing → red, Provided → green, Awaiting Review → amber, Outdated → grey)
    - `questions.css`: question card, response form, status labels
    - _Requirements: 11.4–11.10_

  - [x] 9.3 Create `public/app.jsx` — application root with AuthContext and Router
    - Define `AuthContext` with `{ user, login, logout, loading }` via `React.createContext`
    - `AuthProvider` component: on mount call `GET /api/auth/me`; store user in state; expose `login(userData)` and `logout()` helpers (logout calls `POST /api/auth/logout` then clears state)
    - Minimal custom `Router`: listen to `popstate`, keep `currentPath` in state, expose a `navigate(path)` function via context
    - Export `apiFetch(path, options)` utility: wrapper around `fetch` that sets `credentials: 'include'`, parses JSON, and throws structured `{ error, field }` on non-2xx responses
    - Render `<AuthProvider><Router>…</Router></AuthProvider>` mounted on `#root`
    - _Requirements: 11.1, 11.3_

- [x] 10. Frontend Auth Screens
  - [x] 10.1 Implement `public/components/Auth/RegisterScreen.jsx`
    - Form with fields: name, email, password (masked), role (select: Founder / Investor)
    - On submit call `POST /api/auth/register` via `apiFetch`; on success call `login(user)` and navigate to dashboard; on error display field-level messages adjacent to the failing field
    - _Requirements: 1.12, 1.13_

  - [x] 10.2 Implement `public/components/Auth/LoginScreen.jsx`
    - Form with email (max 254 chars) and password (max 128 chars, masked)
    - On submit call `POST /api/auth/login` via `apiFetch`; on success navigate to role-appropriate dashboard; on error display message within 100 ms of response
    - Handle 423 (locked) with a distinct lockout message
    - _Requirements: 2.10, 2.11_

  - [x] 10.3 Implement `public/components/Shared/NavBar.jsx` and route guards
    - `NavBar`: render Founder links (Dashboard, Profile, Evidence, Questions) or Investor links (Discover, My Questions) based on `user.role`; show Logout button
    - Route guard logic: if `loading` render nothing; if unauthenticated and route requires auth → navigate to `/login` with message; if authenticated but wrong role → navigate to `/unauthorized`
    - _Requirements: 3.7, 3.8, 11.9, 11.12, 11.13_

  - [x] 10.4 Implement `public/components/Shared/ToastNotification.jsx`, `NotFoundScreen.jsx`, and `UnauthorizedScreen.jsx`
    - `ToastNotification`: global ephemeral message component; expose via context so any component can trigger a toast; auto-dismiss after 4 s
    - `NotFoundScreen`: 404 page for unmatched routes
    - `UnauthorizedScreen`: 403 page shown when role check fails client-side
    - _Requirements: 11.11, 11.13, 3.9_

- [x] 11. Founder Dashboard and Profile
  - [x] 11.1 Implement `public/components/Dashboard/FounderDashboard.jsx`
    - On mount: call `GET /api/readiness/:profileId` (if profile exists); display completeness percentage in a visually distinct element followed by `%`; display formula description ("Score = completed sections out of 13, as a percentage") in a location visible without scrolling at 1280×720
    - Render `<ReadinessWidget>`, `<IncompleteItemsList>` (ordered per design section sequence), and `<QuestionInboxSummary>`
    - If readiness endpoint errors: show error banner, retain last value
    - _Requirements: 6.6, 6.7, 6.8, 6.9_

  - [x] 11.2 Implement `public/components/Profile/ProfileForm.jsx`
    - Renders for both create (`/profile/new`) and edit (`/profile/edit`) modes
    - Fields for all 13 Business_Profile attributes (businessName, description, industry, stage, businessModel, problemStatement, solutionStatement, targetCustomers, revenueContext, fundingGoal, useOfFunds, milestones, publicationStatus)
    - `PublicationToggle`: button that calls `PUT /api/profiles/:id/toggle-publication`; display current status; update in UI on success
    - Inline validation errors displayed within 500 ms of server response
    - _Requirements: 4.12, 4.13, 5.8_

- [x] 12. Evidence Coverage Map
  - [x] 12.1 Implement `public/components/Evidence/EvidenceCoverageMap.jsx` and sub-components
    - On mount: call `GET /api/evidence/:profileId`; render one `<EvidenceCategoryGroup>` per defined category
    - Each group: category header + count badge, list of `<EvidenceRecordCard>` components showing title, relatedSection, description, documentReference, status (color-coded badge), Edit and Delete buttons; an "Add Record" button per group
    - `EvidenceModal`: inline form dialog (no separate page) for add/edit; fields: title, category, relatedSection, description, documentReference, status (select); on submit call POST or PUT; close modal on success
    - Delete: show confirmation dialog; on confirm call `DELETE /api/evidence/:id`; remove card from UI
    - _Requirements: 7.11–7.14_

- [x] 13. Question Screens
  - [x] 13.1 Implement `public/components/Questions/FounderQuestionInbox.jsx`
    - On mount: call `GET /api/questions/profile/:profileId`; render a `<QuestionCard>` per question showing status, investor name, question text, response (if any)
    - For Open questions: render `<ResponseForm>` (textarea max 2000 chars with character counter, Submit button); on submit call `POST /api/questions/:id/respond`; update card on success
    - Close button on each Open or Answered question: calls `POST /api/questions/:id/close`
    - _Requirements: 9.1, 9.2, 9.3–9.12_

  - [x] 13.2 Implement `public/components/Investor/InvestorDiscovery.jsx` and `InvestorProfileDetail.jsx`
    - `InvestorDiscovery`: on mount call `GET /api/profiles`; render a `<ProfileSummaryCard>` per profile showing businessName, industry, stage; clicking a card navigates to `/profiles/:id`
    - `InvestorProfileDetail`: on mount call `GET /api/profiles/:id`; render full profile fields; render `<QuestionSubmitForm>` (textarea max 1000 chars, optional sectionReference max 100 chars); on submit call `POST /api/questions`; show success/error via toast
    - _Requirements: 5.9, 8.9_

  - [x] 13.3 Implement `public/components/Investor/InvestorQuestionHistory.jsx`
    - On mount call `GET /api/questions/mine`; render a `<MyQuestionCard>` per question showing question text, profile name, status, response text or "No response yet" indicator
    - Close button: calls `POST /api/questions/:id/close`; updates card status
    - _Requirements: 10.4_

- [x] 14. Backend Unit and Integration Tests

  - [x] 14.1 Implement `tests/auth.test.js`
    - Set up mongodb-memory-server; start Express app; `beforeEach` clears all collections
    - Test registration: success path (201 + user object), duplicate email → 409, missing name → 400, invalid email → 400, invalid role → 400, password too short → 400, password too long → 400
    - Test login: success path (200 + session cookie), wrong password → 401, unknown email → 401, lockout after 5 failures → 423, locked account returns 423 immediately
    - Test logout: destroys session; subsequent `GET /api/auth/me` returns 401
    - _Requirements: 12.1, 2.12_

  - [x] 14.2 Implement `tests/profiles.test.js`
    - Test create: success (201), missing businessName → 400, description exceeds 2000 chars → 400, Investor role → 403
    - Test read own profile: success, Investor role → 403
    - Test update: success, wrong owner → 403, fundingGoal out of range → 400
    - Test delete: success, wrong owner → 403
    - Test publication toggle: Unpublished → Published → Unpublished (round-trip)
    - Test Investor discovery: only Published profiles returned; Unpublished profile → 403 on direct GET
    - _Requirements: 12.2, 4.1–4.13, 5.1–5.9_

  - [x] 14.3 Implement `tests/readiness.test.js` — unit tests for `computeReadiness`
    - 0% (all fields empty/null, no evidence)
    - 100% (all 13 sections complete)
    - Partial: N fields complete → `Math.round((N/13)*100)`
    - Whitespace-only field ("   ") treated as incomplete (same score as "")
    - fundingGoal = 0 treated as incomplete; fundingGoal = 0.01 treated as complete
    - _Requirements: 12.3, 12.9_

  - [x] 14.4 Implement `tests/evidence.test.js`
    - Test create: success (201), missing title → 400, invalid status → 400, profile not owned → 403
    - Test read: returns only records for that profile owned by requesting Founder
    - Test update: success, wrong owner → 403
    - Test delete: success, wrong owner → 403
    - _Requirements: 12.4_

  - [x] 14.5 Implement `tests/questions.test.js`
    - Test submit: success (Open status set), unpublished profile → error, non-Investor → 403, text > 1000 chars → 400
    - Test Founder retrieval: returns only questions for owned profile
    - Test response: success (status → Answered), not owner → 403, already Answered → 409, Closed → 409
    - Test close: Founder can close, Investor can close own question, wrong user → 403
    - Test status transitions: Open→Answered→Closed, Open→Closed
    - _Requirements: 12.5_

  - [x] 14.6 Implement `tests/rbac.test.js`
    - For each Founder-only endpoint (POST /api/profiles, PUT /api/profiles/:id, DELETE /api/profiles/:id, GET /api/profiles/mine, POST /api/evidence, GET /api/evidence/:profileId, PUT /api/evidence/:id, DELETE /api/evidence/:id, GET /api/readiness/:profileId, GET /api/questions/profile/:profileId, POST /api/questions/:id/respond): assert 403 when called by an Investor
    - For each Investor-only endpoint (GET /api/profiles, GET /api/profiles/:id, POST /api/questions, GET /api/questions/mine): assert 403 when called by a Founder
    - For every protected endpoint: assert 401 when called with no session
    - _Requirements: 12.6, 3.1–3.6_

- [x] 15. Property-Based Tests

  - [x] 15.1 Implement property tests for readiness formula (Properties 1 and 2)
    - File: `tests/readiness.test.js` (extend existing)
    - `// Feature: venture-lens, Property 1: Completeness formula is (completed / 13) × 100 rounded`
    - Generate arbitrary combinations of 12 optional text fields (empty / whitespace-only / non-empty), fundingGoal (null / positive number), and `hasEvidenceRecords` (boolean); assert `result.percentage === Math.round((result.completed / 13) * 100)` and result is in `[0, 100]`; 100 runs
    - `// Feature: venture-lens, Property 2: Whitespace-only fields are treated as incomplete`
    - Generate profile where one text field is arbitrary whitespace (`fc.stringOf(fc.constantFrom(' ', '\t', '\n'))`) and all others are empty; assert score matches a profile where that field is ''; 100 runs
    - **Validates: Requirements 6.1, 6.4, 12.3, 12.9**

  - [x]* 15.2 Implement property test for email validation (Property 3)
    - File: `tests/auth.test.js` (extend)
    - `// Feature: venture-lens, Property 3: Email validation rejects structurally invalid addresses`
    - Generate strings that fail at least one of: exactly one @, non-empty local part, non-empty domain with "." (use `fc.string()` filtered or manually constructed invalid forms); POST to `/api/auth/register`; assert 400 and no User document created; 100 runs
    - **Validates: Requirements 1.3**

  - [x]* 15.3 Implement property test for password length bounds (Property 4)
    - File: `tests/auth.test.js` (extend)
    - `// Feature: venture-lens, Property 4: Password length bounds are enforced universally`
    - Generate passwords with `length < 8` using `fc.string({ maxLength: 7 })` and `length > 128` using `fc.string({ minLength: 129, maxLength: 200 })`; assert 400 and no User created; 100 runs each
    - **Validates: Requirements 1.5**

  - [x]* 15.4 Implement property test for funding goal range (Property 5)
    - File: `tests/profiles.test.js` (extend)
    - `// Feature: venture-lens, Property 5: Funding goal range is enforced universally`
    - Generate `fundingGoal` values below 0.01 (using `fc.float({ max: 0.009 })`) and above 999999999.99 (using `fc.float({ min: 1000000000 })`); PUT to `/api/profiles/:id`; assert 400 and profile unchanged; 100 runs
    - **Validates: Requirements 4.8, 4.9**

  - [x]* 15.5 Implement property test for Business Profile ownership isolation (Property 6)
    - File: `tests/profiles.test.js` (extend)
    - `// Feature: venture-lens, Property 6: Ownership isolation for Business Profiles`
    - Create two Founders with distinct profiles; generate arbitrary valid update payloads; assert PUT and DELETE by Founder 2 on Founder 1's profile returns 403 and profile remains unchanged; 100 runs
    - **Validates: Requirements 4.5, 4.6, 4.10, 4.11**

  - [x]* 15.6 Implement property test for Evidence Record ownership isolation (Property 7)
    - File: `tests/evidence.test.js` (extend)
    - `// Feature: venture-lens, Property 7: Ownership isolation for Evidence Records`
    - Create two Founders each with an evidence record; generate arbitrary update payloads; assert PUT and DELETE by Founder 2 on Founder 1's record returns authorization error and record unchanged; 100 runs
    - **Validates: Requirements 7.6, 7.7, 7.8, 7.9**

  - [x]* 15.7 Implement property test for question visibility isolation (Property 8)
    - File: `tests/questions.test.js` (extend)
    - `// Feature: venture-lens, Property 8: Question visibility isolation`
    - Create N Investors (generate N from `fc.integer({ min: 2, max: 5 })`), each submit M questions; for each Investor call `GET /api/questions/mine`; assert response contains only that investor's questions; 100 runs
    - **Validates: Requirements 10.1, 10.2, 10.3**

  - [x]* 15.8 Implement property test for publication toggle round-trip (Property 9)
    - File: `tests/profiles.test.js` (extend)
    - `// Feature: venture-lens, Property 9: Publication toggle round-trip`
    - For any profile with an arbitrary initial Publication_Status S: toggle once, assert status is opposite of S; toggle again, assert status equals S; 100 runs
    - **Validates: Requirements 5.2**

  - [x]* 15.9 Implement property test for questions rejected on unpublished profiles (Property 10)
    - File: `tests/questions.test.js` (extend)
    - `// Feature: venture-lens, Property 10: Questions cannot be submitted to unpublished profiles`
    - Generate arbitrary valid question payloads for profiles where `publicationStatus === 'Unpublished'`; assert POST `/api/questions` returns error and no Question document is created; 100 runs
    - **Validates: Requirements 8.3, 8.5**

- [x] 16. Checkpoint — Run Full Test Suite
  - Run `npm test` and confirm all tests pass. Fix any failures before proceeding. Ask the user if any test behavior is ambiguous.

- [x] 17. README
  - [x] 17.1 Write `README.md` in the workspace root
    - Include all sections listed in the task requirements: project description, features, tech stack, project structure, prerequisites, setup/installation commands (`npm install`, configure `.env`, `npm start`), how to run, user roles (Founder / Investor), environment variables table, API overview (table of all 20 endpoints with method, path, auth, role), data model overview (4 collections with key fields), testing instructions (`npm test`), security notes (bcrypt cost 12, HTTP-only cookies, session regeneration, RBAC, no file uploads), limitations (evidence metadata only — no file uploads in v1; Babel Standalone in-browser JSX compilation adds load overhead; no real-time updates), Kiro/AI usage section (fill in honestly after implementation: describe which tasks were AI-assisted), future improvements (file upload support, real-time notifications, AI readiness scoring, email verification, OAuth), project status (v1.0 complete)
    - Document that document_reference in EvidenceRecord is a plain text field — no file uploads in this version
    - _Requirements: all_

---

## Notes

- Tasks marked with `*` are optional property-based tests that can be skipped for a faster MVP; all 10 properties are represented
- All test tasks (14.x) MUST be run before claiming the feature is complete
- Property-based tests (15.x) use fast-check with a minimum of 100 iterations each
- Babel Standalone is the in-browser JSX approach — no build step, no bundler, acceptable per technology constraints
- Rate limiting is implemented via `loginAttempts` / `lockUntil` fields on the User document — no external rate-limit library
- No file uploads: `documentReference` on EvidenceRecord is a plain text field in v1
- Session cookies: `httpOnly: true`, `secure: true` in production (`NODE_ENV=production`), `sameSite: 'strict'`, `maxAge: 86400000`
- All server validation is manual (no schema-validation library) per the no-extra-dependency spirit of the project
- The MongoDB connection URI and session secret are loaded from `.env` — never hardcoded

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4", "2.1", "2.2", "2.3", "2.4"] },
    { "id": 2, "tasks": ["1.5", "3.1", "3.2"] },
    { "id": 3, "tasks": ["4.1", "4.2", "4.3"] },
    { "id": 4, "tasks": ["5.1", "5.2", "6.1", "7.1", "8.1", "8.2"] },
    { "id": 5, "tasks": ["6.2", "9.1", "9.2"] },
    { "id": 6, "tasks": ["9.3", "10.1", "10.2"] },
    { "id": 7, "tasks": ["10.3", "10.4", "11.1", "11.2"] },
    { "id": 8, "tasks": ["12.1", "13.1", "13.2", "13.3"] },
    { "id": 9, "tasks": ["14.1", "14.2", "14.3", "14.4", "14.5", "14.6"] },
    { "id": 10, "tasks": ["15.1", "15.2", "15.3", "15.4", "15.5", "15.6", "15.7", "15.8", "15.9"] },
    { "id": 11, "tasks": ["17.1"] }
  ]
}
```
