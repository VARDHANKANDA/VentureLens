# Design Document: VentureLens

## Overview

VentureLens is a fundraising readiness and due diligence workspace delivered as a MERN stack single-process web application. A single Express.js server handles all API routes, session management, and static file serving. The React frontend is loaded in the browser via CDN scripts with Babel Standalone for in-browser JSX transformation — no build step, no bundler, no separate dev server.

**Two actor roles:**
- **Founder** — creates and manages business profiles, evidence records, and responds to investor questions.
- **Investor** — browses published profiles and submits structured questions.

All authentication state is maintained in server-side sessions (express-session + connect-mongo), stored in a secure HTTP-only cookie. MongoDB is the sole data store. All business logic and access control live on the server; the client enforces role-based UI rendering as a convenience layer only.

---

## Architecture

### High-Level Architecture

```
Browser
  └── index.html (served by Express static middleware)
        ├── react.production.min.js     (CDN)
        ├── react-dom.production.min.js (CDN)
        ├── babel.min.js                (CDN — Babel Standalone for in-browser JSX)
        └── app.jsx (type="text/babel") → compiled in-browser at runtime
              └── React components (SPA, client-side routing)

Express Server (Node.js)
  ├── Static Middleware          → serves /public (HTML, CSS, client JS)
  ├── Session Middleware         → express-session + connect-mongo
  ├── API Router (/api/*)
  │     ├── /api/auth            → registration, login, logout
  │     ├── /api/profiles        → Business Profile CRUD
  │     ├── /api/readiness       → readiness calculation
  │     ├── /api/evidence        → Evidence Record CRUD
  │     └── /api/questions       → Question submission, responses, close
  └── Catch-all                  → serves index.html (SPA fallback)

MongoDB
  ├── users
  ├── businessprofiles
  ├── evidencerecords
  └── questions
```

### Request / Response Flow

1. The browser requests any URL — Express serves `public/index.html`.
2. The browser loads React + Babel from CDN, then `app.jsx` via `<script type="text/babel">`.
3. Babel Standalone compiles JSX in the browser; the React app mounts and handles all screen transitions client-side.
4. All data operations go through `fetch()` calls to `/api/*` endpoints.
5. The session cookie is attached automatically on every request (same origin, HTTP-only).

### Directory Structure

```
venture-lens/
├── server/
│   ├── index.js                  ← Express entry point
│   ├── db.js                     ← MongoDB connection
│   ├── models/
│   │   ├── User.js
│   │   ├── BusinessProfile.js
│   │   ├── EvidenceRecord.js
│   │   └── Question.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── profiles.js
│   │   ├── readiness.js
│   │   ├── evidence.js
│   │   └── questions.js
│   ├── middleware/
│   │   ├── requireAuth.js        ← 401 if no session
│   │   ├── requireRole.js        ← 403 if wrong role
│   │   └── rateLimiter.js        ← login rate limiter
│   └── utils/
│       └── readiness.js          ← completeness calculation
├── public/
│   ├── index.html
│   ├── app.jsx                   ← React SPA entry (type="text/babel")
│   ├── components/
│   │   ├── Auth/
│   │   ├── Dashboard/
│   │   ├── Profile/
│   │   ├── Evidence/
│   │   ├── Questions/
│   │   ├── Investor/
│   │   └── Shared/
│   └── styles/
│       ├── global.css
│       ├── layout.css
│       ├── forms.css
│       ├── dashboard.css
│       ├── evidence.css
│       └── questions.css
├── tests/
│   ├── auth.test.js
│   ├── profiles.test.js
│   ├── readiness.test.js
│   ├── evidence.test.js
│   └── questions.test.js
├── package.json
└── .env
```

---

## Components and Interfaces

### Middleware Chain

```
Request
  → express.json()
  → express-session (reads/writes session cookie)
  → requireAuth     (returns 401 if req.session.userId is absent)
  → requireRole(role) (returns 403 if req.session.role !== role)
  → Route Handler
  → Ownership Check (inline in handler or extracted helper)
  → Response
```

### API Route Structure

All protected endpoints sit behind `requireAuth`. Role-specific endpoints additionally use `requireRole('Founder')` or `requireRole('Investor')`.

#### Auth Routes (`/api/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | None | Register new user |
| POST | `/api/auth/login` | None | Login + create session |
| POST | `/api/auth/logout` | Required | Destroy session |
| GET | `/api/auth/me` | Required | Return current user info |

#### Profile Routes (`/api/profiles`)

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/api/profiles` | Yes | Founder | Create Business Profile |
| GET | `/api/profiles/mine` | Yes | Founder | Get own profile |
| PUT | `/api/profiles/:id` | Yes | Founder | Update own profile |
| DELETE | `/api/profiles/:id` | Yes | Founder | Delete own profile |
| GET | `/api/profiles` | Yes | Investor | List published profiles |
| GET | `/api/profiles/:id` | Yes | Investor | Get published profile by ID |

#### Readiness Routes (`/api/readiness`)

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/readiness/:profileId` | Yes | Founder | Get readiness score + guidance |

#### Evidence Routes (`/api/evidence`)

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/api/evidence` | Yes | Founder | Create Evidence Record |
| GET | `/api/evidence/:profileId` | Yes | Founder | Get all records for profile |
| PUT | `/api/evidence/:id` | Yes | Founder | Update Evidence Record |
| DELETE | `/api/evidence/:id` | Yes | Founder | Delete Evidence Record |

#### Question Routes (`/api/questions`)

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/api/questions` | Yes | Investor | Submit a question |
| GET | `/api/questions/mine` | Yes | Investor | Get own submitted questions |
| GET | `/api/questions/profile/:profileId` | Yes | Founder | Get questions on own profile |
| POST | `/api/questions/:id/respond` | Yes | Founder | Submit response to question |
| POST | `/api/questions/:id/close` | Yes | Founder or Investor | Close a question |

### Request / Response Shapes

#### POST `/api/auth/register`
```json
Request:  { "name": "string", "email": "string", "password": "string", "role": "Founder|Investor" }
Response: { "user": { "_id": "...", "name": "...", "email": "...", "role": "..." } }
Errors:   400 (validation), 409 (duplicate email)
```

#### POST `/api/auth/login`
```json
Request:  { "email": "string", "password": "string" }
Response: { "user": { "_id": "...", "name": "...", "email": "...", "role": "..." } }
Errors:   400 (validation), 401 (invalid credentials), 423 (locked out)
```

#### POST `/api/profiles`
```json
Request:  { "businessName": "string", "description": "string", ...other optional fields }
Response: { "profile": { "_id": "...", "businessName": "...", ... } }
Errors:   400 (validation), 403 (not Founder)
```

#### GET `/api/readiness/:profileId`
```json
Response: {
  "completenessPercentage": 46,
  "completedCount": 6,
  "totalSections": 13,
  "incompleteItems": [
    { "section": "industry", "guidance": "Add your industry to help investors..." },
    ...
  ]
}
Errors: 403 (not owner), 404 (profile not found)
```

#### POST `/api/questions`
```json
Request:  { "profileId": "string", "text": "string", "sectionReference": "optional string" }
Response: { "question": { "_id": "...", "text": "...", "status": "Open", ... } }
Errors:   400 (validation), 403 (not Investor, or profile unpublished)
```

#### POST `/api/questions/:id/respond`
```json
Request:  { "responseText": "string" }
Response: { "question": { "_id": "...", "status": "Answered", "response": "..." } }
Errors:   403 (not owner of profile), 409 (question not Open)
```

### Frontend Component Hierarchy

The entire frontend is a single React SPA. Client-side routing is implemented using the browser's `history` API (pushState / popstate) wrapped in a minimal custom router — no external routing library.

```
<App>
  ├── <Router>                        ← custom hash-less history router
  │     ├── <NavBar>                  ← role-aware navigation
  │     │
  │     ├── /login                → <LoginScreen>
  │     ├── /register             → <RegisterScreen>
  │     │
  │     ├── /dashboard            → <FounderDashboard>
  │     │     ├── <ReadinessWidget>
  │     │     ├── <IncompleteItemsList>
  │     │     └── <QuestionInboxSummary>
  │     │
  │     ├── /profile/new          → <ProfileForm> (create)
  │     ├── /profile/edit         → <ProfileForm> (edit)
  │     │     ├── <ProfileFieldSet>
  │     │     └── <PublicationToggle>
  │     │
  │     ├── /evidence             → <EvidenceCoverageMap>
  │     │     ├── <EvidenceCategoryGroup> (per category)
  │     │     │     └── <EvidenceRecordCard>
  │     │     └── <EvidenceModal> (add/edit form)
  │     │
  │     ├── /questions            → <FounderQuestionInbox>
  │     │     └── <QuestionCard>
  │     │           └── <ResponseForm>
  │     │
  │     ├── /discover             → <InvestorDiscovery>
  │     │     └── <ProfileSummaryCard>
  │     │
  │     ├── /profiles/:id         → <InvestorProfileDetail>
  │     │     └── <QuestionSubmitForm>
  │     │
  │     ├── /my-questions         → <InvestorQuestionHistory>
  │     │     └── <MyQuestionCard>
  │     │
  │     ├── /unauthorized         → <UnauthorizedScreen>
  │     └── *                     → <NotFoundScreen>
  │
  └── <ToastNotification>           ← global ephemeral messages
```

**Custom Router Implementation:**
```javascript
// Minimal history-API router (no external library)
// Listens to popstate, provides navigate(path) helper
// Guards routes by checking session state in React context
```

**AuthContext** — a React context providing `{ user, login, logout, loading }`, populated by a `GET /api/auth/me` call on app mount. All route guards read from this context.

---

## Data Models

### User

```javascript
// models/User.js
{
  _id: ObjectId,
  name: { type: String, required: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['Founder', 'Investor'], required: true },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
}
```

### BusinessProfile

```javascript
// models/BusinessProfile.js
{
  _id: ObjectId,
  owner: { type: ObjectId, ref: 'User', required: true, index: true },
  businessName: { type: String, required: true, maxlength: 200 },
  description: { type: String, required: true, maxlength: 2000 },
  industry: { type: String, default: '' },
  stage: { type: String, default: '' },
  businessModel: { type: String, default: '' },
  problemStatement: { type: String, default: '' },
  solutionStatement: { type: String, default: '' },
  targetCustomers: { type: String, default: '' },
  revenueContext: { type: String, default: '' },
  fundingGoal: { type: Number, default: null },   // 0.01 – 999,999,999.99
  useOfFunds: { type: String, default: '' },
  milestones: { type: String, default: '' },
  publicationStatus: { type: String, enum: ['Published', 'Unpublished'], default: 'Unpublished' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}
```

The 13 readiness sections correspond to: `businessName`, `description`, `industry`, `stage`, `businessModel`, `problemStatement`, `solutionStatement`, `targetCustomers`, `revenueContext`, `fundingGoal`, `useOfFunds`, `milestones`, and *at least one EvidenceRecord per defined evidence category*.

### EvidenceRecord

```javascript
// models/EvidenceRecord.js
{
  _id: ObjectId,
  profile: { type: ObjectId, ref: 'BusinessProfile', required: true, index: true },
  owner: { type: ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, maxlength: 200 },
  category: { type: String, required: true },
  relatedSection: { type: String, required: true },
  description: { type: String, default: '' },
  documentReference: { type: String, default: '' },
  status: {
    type: String,
    enum: ['Missing', 'Provided', 'Awaiting Review', 'Outdated'],
    required: true
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}
```

### Question

```javascript
// models/Question.js
{
  _id: ObjectId,
  profile: { type: ObjectId, ref: 'BusinessProfile', required: true, index: true },
  investor: { type: ObjectId, ref: 'User', required: true, index: true },
  text: { type: String, required: true, maxlength: 1000 },
  sectionReference: { type: String, default: '', maxlength: 100 },
  status: {
    type: String,
    enum: ['Open', 'Answered', 'Closed'],
    default: 'Open',
    required: true
  },
  responseText: { type: String, default: null, maxlength: 2000 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Completeness formula is (completed / 13) × 100 rounded

*For any* combination of states for the 13 readiness sections (each text field either empty/whitespace-only or containing at least one non-whitespace character; fundingGoal either null or a positive number; evidence coverage either present or absent), the computed completeness percentage SHALL equal `Math.round((completedSectionCount / 13) * 100)`, where `completedSectionCount` is the count of sections that satisfy their respective completion rule. The result SHALL always be an integer in the range [0, 100] inclusive.

**Validates: Requirements 6.1, 6.4, 12.3, 12.9**

### Property 2: Whitespace-only fields are treated as incomplete

*For any* Business Profile field whose string value is composed entirely of whitespace characters (spaces, tabs, newlines, or any combination), the readiness calculation SHALL treat that field as incomplete — yielding the same completeness score as if the field were null or an empty string.

**Validates: Requirements 6.1, 12.9**

### Property 3: Email validation rejects structurally invalid addresses

*For any* string that does not contain exactly one "@" symbol, or has an empty local part, or has an empty domain part, or has a domain part without at least one "." separator, the registration endpoint SHALL reject the request with a 400 validation error and no User record SHALL be created.

**Validates: Requirements 1.3**

### Property 4: Password length bounds are enforced universally

*For any* string whose length is strictly less than 8 characters or strictly greater than 128 characters, the registration endpoint SHALL reject the request with a 400 validation error and no User record SHALL be created.

**Validates: Requirements 1.5**

### Property 5: Funding goal range is enforced universally

*For any* profile update request where the funding goal value is a number outside the closed range [0.01, 999,999,999.99], the Server SHALL reject the request with a 400 validation error and no field of the Business Profile SHALL be modified.

**Validates: Requirements 4.8, 4.9**

### Property 6: Ownership isolation for Business Profiles

*For any* two distinct authenticated Founders F1 and F2, every update or delete request made by F1 targeting a Business Profile owned by F2 SHALL return a 403 response and the Business Profile SHALL remain unmodified.

**Validates: Requirements 4.5, 4.6, 4.10, 4.11**

### Property 7: Ownership isolation for Evidence Records

*For any* two distinct authenticated Founders F1 and F2, every update or delete request made by F1 targeting an Evidence Record owned by F2 SHALL return an authorization error response and the Evidence Record SHALL remain unmodified.

**Validates: Requirements 7.6, 7.7, 7.8, 7.9**

### Property 8: Question visibility isolation

*For any* set of Investors each with any number of submitted Questions, a question-list request by Investor I SHALL return only the Questions submitted by I, regardless of what profile or user identifier is supplied in the request body. No Questions from any other Investor SHALL appear in the response.

**Validates: Requirements 10.1, 10.2, 10.3**

### Property 9: Publication toggle round-trip

*For any* Business Profile with any initial Publication_Status S, submitting two consecutive toggle requests SHALL restore the Publication_Status to S. The intermediate state after the first toggle SHALL be the opposite of S.

**Validates: Requirements 5.2**

### Property 10: Questions cannot be submitted to unpublished profiles

*For any* authenticated Investor and any Business Profile whose Publication_Status is "Unpublished", a question submission request SHALL return an error response and no Question document SHALL be persisted to the database.

**Validates: Requirements 8.3, 8.5**

---

## Error Handling

### Server-Side Error Strategy

All route handlers follow a consistent error response shape:

```json
{ "error": "Human-readable message", "field": "fieldName (optional, for validation errors)" }
```

**HTTP status mapping:**

| Condition | Status |
|-----------|--------|
| Validation failure (missing/invalid field) | 400 |
| Not authenticated | 401 |
| Account locked (rate limit) | 423 |
| Invalid credentials | 401 |
| Forbidden (wrong role, not owner) | 403 |
| Resource not found | 404 |
| Duplicate resource (email) | 409 |
| Unexpected server error | 500 |

**Ownership check pattern (inline in route handler):**
```javascript
const resource = await Model.findById(req.params.id);
if (!resource) return res.status(404).json({ error: 'Not found' });
if (resource.owner.toString() !== req.session.userId) {
  return res.status(403).json({ error: 'Forbidden' });
}
```

**Global error handler** (Express catch-all):
```javascript
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});
```

### Client-Side Error Handling

- API calls use a shared `apiFetch(path, options)` utility that normalises responses and throws structured errors.
- Form components display field-level errors returned in `{ error, field }` responses inline, adjacent to the relevant input.
- A global `<ToastNotification>` component handles non-field errors (network failures, 500s).
- If the readiness endpoint errors, the dashboard retains the last successful value and shows a banner (Requirement 6.9).

---

## Security Design

### Session Management

- `express-session` with `connect-mongo` store.
- Cookie flags: `httpOnly: true`, `secure: true` (in production, set via `NODE_ENV`), `sameSite: 'strict'`, `maxAge: 86400000` (24 hours).
- On login, the session is regenerated (`req.session.regenerate`) to prevent session fixation.
- On logout, `req.session.destroy()` + `res.clearCookie('connect.sid')`.

### RBAC Middleware

```javascript
// middleware/requireAuth.js
module.exports = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// middleware/requireRole.js
module.exports = (role) => (req, res, next) => {
  const validRoles = ['Founder', 'Investor'];
  if (!validRoles.includes(req.session.role) || req.session.role !== role) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};
```

### Password Security

- Passwords are hashed with `bcrypt` at cost factor 12 before storage.
- Plain-text passwords are never logged or stored.
- Login responses never include `passwordHash`.

### Rate Limiting (Login)

Implemented directly in the auth route using fields on the `User` document:

```
loginAttempts: Number   (incremented on each failed attempt)
lockUntil: Date         (set to now + 15 minutes after 5th failure)
```

On each login attempt:
1. If `lockUntil` is set and is in the future → return 423 with lockout message.
2. If credentials are valid → reset `loginAttempts` to 0, `lockUntil` to null, create session.
3. If credentials are invalid → increment `loginAttempts`; if it reaches 5, set `lockUntil = Date.now() + 15 * 60 * 1000`.

This approach keeps the rate-limiting state persistent in MongoDB (survives server restarts) and is per-account rather than per-IP.

### Input Validation

All server-side validation is manual (no schema validation library), matching the no-extra-dependency spirit of the project:
- Presence checks: `!value || value.trim().length === 0`
- Length checks: `value.length > maxLength`
- Email regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` (verifies one `@`, non-empty local part, domain with `.`)
- Role enum: `['Founder', 'Investor'].includes(role)`
- Funding goal: `typeof value === 'number' && value >= 0.01 && value <= 999999999.99`

---

## Readiness Calculation Algorithm

The readiness score is calculated server-side in `server/utils/readiness.js` and called by the `GET /api/readiness/:profileId` handler.

### Evaluated Sections (13 total, in order)

```
1.  businessName
2.  description
3.  industry
4.  stage
5.  businessModel
6.  problemStatement
7.  solutionStatement
8.  targetCustomers
9.  revenueContext
10. fundingGoal
11. useOfFunds
12. milestones
13. evidenceCoverage  (≥1 EvidenceRecord per defined evidence category exists)
```

### Completeness Check Rules

- **Text fields (1–12):** A field is *complete* if its value is non-null, non-empty string, and `value.trim().length > 0`.
- **`fundingGoal` (field 10):** Complete if `fundingGoal !== null && fundingGoal > 0`.
- **`evidenceCoverage` (section 13):** Complete if at least one `EvidenceRecord` document exists where `profile === profileId`.

### Formula

```javascript
function computeReadiness(profile, hasEvidenceRecords) {
  const TEXT_FIELDS = [
    'businessName', 'description', 'industry', 'stage', 'businessModel',
    'problemStatement', 'solutionStatement', 'targetCustomers',
    'revenueContext', 'useOfFunds', 'milestones'
  ];
  const TOTAL_SECTIONS = 13;

  let completed = 0;

  for (const field of TEXT_FIELDS) {
    const val = profile[field];
    if (val && typeof val === 'string' && val.trim().length > 0) completed++;
  }

  // fundingGoal
  if (profile.fundingGoal !== null && profile.fundingGoal !== undefined && profile.fundingGoal > 0) {
    completed++;
  }

  // evidenceCoverage
  if (hasEvidenceRecords) completed++;

  const percentage = Math.round((completed / TOTAL_SECTIONS) * 100);
  return { completed, total: TOTAL_SECTIONS, percentage };
}
```

### Guidance Messages

Each of the 13 sections has a fixed guidance message (≤280 characters) returned in the `incompleteItems` array when incomplete:

| Section | Guidance |
|---------|----------|
| businessName | "Add your business name so investors can identify your company." |
| description | "Write a brief description of your business and what it does." |
| industry | "Specify your industry so investors can find profiles matching their focus." |
| stage | "Indicate your current business stage (e.g., Idea, MVP, Growth)." |
| businessModel | "Describe how your business generates revenue." |
| problemStatement | "Explain the problem your business solves for customers." |
| solutionStatement | "Describe the solution your business provides." |
| targetCustomers | "Define who your target customers are." |
| revenueContext | "Provide context about your current or projected revenue." |
| fundingGoal | "Set a funding goal amount to show investors what you are seeking." |
| useOfFunds | "Explain how you plan to use the funds raised." |
| milestones | "List key milestones you plan to achieve with this funding." |
| evidenceCoverage | "Add at least one evidence record to support your profile claims." |

---

## Evidence Coverage Map Design

### Evidence Categories

The application defines a fixed set of evidence categories that Founders may associate records with. These are rendered as groups on the Evidence Coverage Map. Suggested categories (can be extended):

- Financial Documents
- Legal & Compliance
- Product & Technology
- Market Research
- Team & Operations
- Customer & Traction
- Investor Materials

### Display Layout

The `EvidenceCoverageMap` screen renders one `EvidenceCategoryGroup` per category. Each group shows:
- Category header with a count badge (e.g., "3 records").
- A list of `EvidenceRecordCard` components, each displaying: title, related_section, description, document_reference, and status (color-coded badge).
- An "Add Record" button per category group.

**Status badge colors:**
- `Missing` → red / warning
- `Provided` → green / success
- `Awaiting Review` → amber / caution
- `Outdated` → grey / muted

### CRUD Interaction Pattern

Add/Edit operations open an inline `EvidenceModal` (a form dialog rendered in the same React tree). Delete triggers a confirmation dialog before sending `DELETE /api/evidence/:id`.

---

## Question Room Workflow

### Lifecycle State Machine

```
[Investor submits question]
          │
          ▼
       [ Open ]
          │
    ┌─────┴──────────────────────┐
    │ Founder submits response   │ Investor or Founder closes
    ▼                            ▼
 [ Answered ]               [ Closed ]
    │
    │ Investor or Founder closes
    ▼
 [ Closed ]
```

### Question Submission Flow (Investor)

1. Investor navigates to a Published profile's detail page.
2. Submits a question (text ≤1000 chars, optional section reference ≤100 chars).
3. Server validates: authenticated, Investor role, profile is Published.
4. Question created with status `Open`, associated to investor ID + profile ID.
5. Client updates question history immediately optimistically.

### Question Response Flow (Founder)

1. Founder opens Question Inbox on Dashboard.
2. For each `Open` question, a response form is shown.
3. Founder submits response (≤2000 chars).
4. Server verifies Founder owns the profile; question status must be `Open`.
5. Response stored, status updated to `Answered`.
6. If question is `Answered` or `Closed`, response submission returns an error.

### Close Flow

Either the Investor or the Founder may close any question in `Open` or `Answered` state by calling `POST /api/questions/:id/close`. The server verifies the requester either submitted the question (Investor) or owns the associated profile (Founder).

---

## Testing Strategy

### Test Framework

- **Jest** — test runner and assertion library (standard Node.js choice, no browser environment needed).
- **Supertest** — HTTP layer testing for Express routes.
- **fast-check** — property-based testing library for JavaScript/Node.js.

### Test Database Isolation

Each test file connects to a dedicated in-memory or isolated MongoDB instance using **mongodb-memory-server**. Before each individual test case, the relevant collection(s) are dropped and re-seeded:

```javascript
beforeEach(async () => {
  await User.deleteMany({});
  await BusinessProfile.deleteMany({});
  await EvidenceRecord.deleteMany({});
  await Question.deleteMany({});
});
```

No writes reach the development or production database.

### Test Coverage Plan

| Test File | Covers |
|-----------|--------|
| `auth.test.js` | Registration (success, duplicate email, invalid fields), Login (success, bad credentials, lockout after 5 attempts), Logout |
| `profiles.test.js` | Create (success, missing fields, field length), Read (own profile, published list, investor access to unpublished → 403), Update (ownership check → 403, funding goal range), Delete (ownership → 403) |
| `readiness.test.js` | 0% (empty profile), 100% (all fields), partial counts, whitespace-only fields count as incomplete, formula correctness |
| `evidence.test.js` | Create (success, missing fields, ownership on foreign profile → 403), Read, Update (ownership → 403), Delete (ownership → 403) |
| `questions.test.js` | Submit (success, unpublished profile → 403, non-Investor → 403), Founder retrieves questions, Response (success, already Answered → 409, not owner → 403), Close (Founder, Investor, wrong user → 403), status transitions |
| `rbac.test.js` | Every Founder-only endpoint returns 403 for Investor, every Investor-only endpoint returns 403 for Founder |

### Property-Based Tests

Using **fast-check**, minimum 100 iterations per property test. Each test is tagged with a comment in the format:

`// Feature: venture-lens, Property N: <property text>`

**Property tests to implement:**

| Property | Test Description |
|----------|-----------------|
| Property 1 | For any combination of 0–13 completed sections, readiness = Math.round((completed/13)*100), always in [0,100] |
| Property 2 | For any string of only whitespace chars, readiness treats it as incomplete (same score as empty string) |
| Property 3 | For any structurally invalid email string, registration rejects with 400 and no user is created |
| Property 4 | For any password outside [8, 128] chars length, registration rejects with 400 |
| Property 5 | For any funding goal outside [0.01, 999999999.99], profile update rejects with 400 |
| Property 6 | For any two distinct Founders, Founder A cannot modify Founder B's profile |
| Property 7 | For any two distinct Founders, Founder A cannot modify Founder B's evidence records |
| Property 8 | For any set of investors, question list always returns only that investor's questions |
| Property 9 | For any profile, toggling publication status twice returns to original status |
| Property 10 | For any unpublished profile, question submission always returns an error and persists nothing |

**Example property test structure (fast-check):**
```javascript
// Feature: venture-lens, Property 1: Completeness formula is (completed / 13) × 100 rounded
test('readiness percentage equals (completed/13)*100 rounded for any profile state', () => {
  fc.assert(
    fc.property(
      fc.record({
        businessName:       fc.oneof(fc.constant(''), fc.constant('  '), fc.string({ minLength: 1 })),
        description:        fc.oneof(fc.constant(''), fc.constant('  '), fc.string({ minLength: 1 })),
        industry:           fc.oneof(fc.constant(''), fc.constant('  '), fc.string({ minLength: 1 })),
        stage:              fc.oneof(fc.constant(''), fc.constant('  '), fc.string({ minLength: 1 })),
        businessModel:      fc.oneof(fc.constant(''), fc.constant('  '), fc.string({ minLength: 1 })),
        problemStatement:   fc.oneof(fc.constant(''), fc.constant('  '), fc.string({ minLength: 1 })),
        solutionStatement:  fc.oneof(fc.constant(''), fc.constant('  '), fc.string({ minLength: 1 })),
        targetCustomers:    fc.oneof(fc.constant(''), fc.constant('  '), fc.string({ minLength: 1 })),
        revenueContext:     fc.oneof(fc.constant(''), fc.constant('  '), fc.string({ minLength: 1 })),
        useOfFunds:         fc.oneof(fc.constant(''), fc.constant('  '), fc.string({ minLength: 1 })),
        milestones:         fc.oneof(fc.constant(''), fc.constant('  '), fc.string({ minLength: 1 })),
        fundingGoal:        fc.oneof(fc.constant(null), fc.float({ min: 0.01, max: 999999999.99 })),
      }),
      fc.boolean(), // hasEvidenceRecords
      (profile, hasEvidence) => {
        const result = computeReadiness(profile, hasEvidence);
        const expected = Math.round((result.completed / 13) * 100);
        expect(result.percentage).toBe(expected);
        expect(result.percentage).toBeGreaterThanOrEqual(0);
        expect(result.percentage).toBeLessThanOrEqual(100);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Unit Test Balance

Unit tests cover:
- Specific success paths with concrete examples (e.g., "create profile returns 201 with correct fields").
- All error conditions (400, 401, 403, 404, 409, 423).
- Status transition edge cases (respond to Closed question → 409).

Property tests cover:
- The readiness calculation across the full input space.
- Input validation boundaries (email, password length, funding goal).
- Ownership isolation across arbitrary user/resource combinations.
- Publication toggle round-trips.

Integration tests are used for:
- Full request → response → database state verification for each CRUD flow.
- Session creation and destruction.
