# VentureLens — Startup Due Diligence & Fundraising-Readiness Workspace

VentureLens is a full-stack MERN application designed for early-stage startup founders and angel/seed investors. It provides founders with a structured workspace to build their business profiles, track documentary evidence coverage across key operational categories, and measure their fundraising-readiness using an objective, deterministic 13-point scoring model. Investors can discover published startup profiles, review readiness metrics, and conduct private, structured due diligence Q&A directly with founders.

---

## 1. Project Overview

Early-stage fundraising is often slowed by disorganized due diligence materials and unclear investor expectations. Founders struggle to know whether their documentation is complete, while investors waste time requesting standard information that should already be organized.

**VentureLens** addresses this gap by providing:
- A standardized **13-Point Startup Profile** covering essential diligence categories.
- An objective **Readiness Score** indicating profile completeness with actionable guidance for missing items.
- An **Evidence Coverage Map** tracking documentary support status across key operational domains.
- A **Private Diligence Q&A Room** facilitating structured inquiries between investors and founders without public exposure.

---

## 2. Key Features

### Founder Workspace & Dashboard
- **Business Profile Management**: Comprehensive 13-point startup data model covering problem statement, solution, business model, target customers, financials, funding goals, and milestones.
- **Deterministic Readiness Scoring**: Real-time evaluation of profile completeness against a 13-section checklist with specific, actionable guidance for incomplete items.
- **Evidence Coverage Map**: Category-based tracking of supporting documentation (Missing, Provided, Awaiting Review, Outdated) without file upload attack vectors.
- **Founder Q&A Inbox**: Review and respond to due-diligence inquiries submitted by prospective investors.
- **Publication Control**: Founders have full control over when their profile is made visible to investors (Published vs Unpublished).

### Investor Portal & Diligence Room
- **Startup Discovery**: Directory of published startup profiles filtered by industry, stage, and funding goals.
- **Deep-Dive Profile Detail**: Structured views of startup claims and funding context.
- **Targeted Diligence Questions**: Submit structured questions tied to specific business sections.
- **Question History**: Track responses and status of all diligence inquiries across portfolio prospects.

### Enterprise-Grade Security & Access Control
- **Role-Based Access Control (RBAC)**: Strict server-side enforcement separating Founder and Investor capabilities.
- **Resource Ownership Isolation**: Founders can only access and modify their own profiles, evidence records, and question responses.
- **Credential Protection**: Passwords hashed with bcrypt (cost 12 in production), secure HTTP-only cookies, and session regeneration on authentication.
- **Brute-Force Rate Limiting**: Automatic account lockout for 15 minutes after 5 consecutive failed login attempts (HTTP 423).

---

## 3. Technologies Used

### Core Stack (Strict MERN)
- **MongoDB**: Persistent NoSQL document database.
- **Express.js (v5.x)**: Backend web framework and RESTful API router.
- **React.js (v18.x)**: Component-based frontend user interface, loaded via browser CDN with Babel Standalone for in-browser JSX compilation (zero bundlers, zero build steps, single-process architecture).
- **Node.js (v18+)**: JavaScript server-side runtime environment.

### Supporting Libraries & Tools
- **Mongoose (v9.x)**: Schema modeling, validation, and safe query construction.
- **express-session & connect-mongo**: Secure server-side session management with MongoDB persistence.
- **bcrypt (v6.x)**: Password hashing with cost factor 12 (cost factor 4 in test mode for performance).
- **dotenv**: Environment variable management.
- **fast-check (v4.x)**: Property-based testing framework for invariant validation.
- **supertest**: HTTP endpoint integration testing.
- **mongodb-memory-server**: Isolated in-memory MongoDB instance for automated testing.
- **Vanilla CSS**: Custom CSS design system, responsive flex/grid layouts, contrast-compliant typography, and SaaS aesthetics without third-party CSS frameworks.

---

## 4. Architecture & Project Structure

VentureLens operates as a cohesive single-process application: the Express server exposes RESTful API endpoints under `/api/*`, serves static assets from `/public`, and delivers the React SPA through an HTML shell for all client routes.

```text
VentureLens/
├── .kiro/
│   └── specs/venture-lens/
│       ├── requirements.md      # Formal system requirements (13 core requirements)
│       ├── design.md            # Architectural design, security model, and API spec
│       └── tasks.md             # Implementation tracking and dependency graph
├── public/
│   ├── index.html               # Single-page application entry point & CDN scripts
│   ├── app.jsx                  # React SPA root, contexts, router, and UI components
│   └── styles/
│       ├── global.css           # Design tokens, CSS reset, typography, and badges
│       ├── layout.css           # Navigation, grid layout, cards, toasts, responsive breakpoints
│       ├── forms.css            # Form inputs, labels, validation states, buttons
│       ├── dashboard.css        # Readiness widget, progress bars, metric cards
│       ├── evidence.css         # Category headers, coverage cards, status badges
│       └── questions.css        # Question cards, response forms, conversation views
├── server/
│   ├── index.js                 # Express server configuration, session store, route mounting
│   ├── db.js                    # MongoDB connection lifecycle management
│   ├── middleware/
│   │   ├── requireAuth.js       # Session authentication verification middleware
│   │   └── requireRole.js       # Role-based authorization middleware (Founder/Investor)
│   ├── models/
│   │   ├── User.js              # User schema, bcrypt password hashing, lockout fields
│   │   ├── BusinessProfile.js   # 13-field startup business profile schema
│   │   ├── EvidenceRecord.js    # Documentary evidence metadata tracking schema
│   │   └── Question.js          # Due diligence question and response schema
│   ├── routes/
│   │   ├── auth.js              # Registration, login, logout, session verification
│   │   ├── profiles.js          # Profile CRUD, publication toggle, investor discovery
│   │   ├── readiness.js         # Deterministic readiness calculation API
│   │   ├── evidence.js          # Evidence record CRUD and ownership verification
│   │   └── questions.js         # Investor submission, founder response, question closing
│   └── utils/
│       └── readiness.js         # Pure readiness calculation logic & guidance lookup
├── tests/
│   ├── runner.js                # Full unit, integration, and property test runner
│   ├── test-helper.js           # In-memory MongoDB setup, supertest agent fixtures
│   ├── auth.test.js             # Auth integration & Property 3/4 tests
│   ├── profiles.test.js         # Profile CRUD & Property 5/6/9 tests
│   ├── readiness.test.js        # Readiness calculation & Property 1/2 tests
│   ├── evidence.test.js         # Evidence CRUD & Property 7 isolation tests
│   ├── questions.test.js        # Question lifecycle & Property 8/10 tests
│   └── rbac.test.js             # Full matrix RBAC & route protection tests
├── .env.example                 # Example environment variables template
├── .gitignore                   # Git ignore rules for node_modules, .env, and logs
├── package.json                 # Project scripts and dependencies
└── README.md                    # Project documentation and submission report
```

---

## 5. Prerequisites

- **Node.js**: Version 18.0.0 or higher.
- **npm**: Version 9.0.0 or higher.
- **MongoDB**: A running MongoDB server on `mongodb://localhost:27017` (or MongoDB Atlas URI) for local execution.
  *(Note: Automated tests use an in-memory database and run without an external MongoDB server).*

---

## 6. Setup & Installation Instructions

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd VentureLens
   ```

2. **Install project dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory (or copy from `.env.example`):
   ```env
   # MongoDB Connection URI
   MONGO_URI=mongodb://localhost:27017/venturelens

   # Express Session Secret - use a long random string in production
   SESSION_SECRET=venturelens-dev-secret-key-32chars

   # Environment Mode (development | production)
   NODE_ENV=development

   # HTTP Server Port
   PORT=3000
   ```

---

## 7. Running the Application

### Start the Local Server
```bash
npm start
```
The server will start on `http://localhost:3000`.

Open your browser to [http://localhost:3000](http://localhost:3000) to access the VentureLens interface:
- **Register as a Founder**: Create a startup business profile, view your readiness score, and track documentary evidence.
- **Register as an Investor**: Browse published startups, view business details, and submit due diligence questions.

---

## 8. Automated Testing

VentureLens includes an automated test suite comprising 34 unit, integration, and fast-check property-based tests.

### Run All Tests
```bash
npm test
```

### Test Suite Breakdown (34/34 Passing):
- **Suite 1: Authentication & User Lifecycle** (6 tests): User registration, duplicate email rejection (409), password hashing, 5-attempt rate-limiting lockout (423), and session logout.
- **Suite 2: Business Profiles & Discovery** (5 tests): Profile CRUD, ownership isolation, publication toggling, and investor discovery filtering.
- **Suite 3: Readiness Scoring & Guidance** (2 tests): Pure calculation verification (0%, 100%, partial subsets) and the `/api/readiness/:profileId` endpoint.
- **Suite 4: Evidence Records & Coverage Map** (4 tests): Evidence record creation, status tracking, category grouping, and cross-founder isolation.
- **Suite 5: Investor Q&A & Due Diligence** (4 tests): Question submission on published profiles, founder response workflow (Open -> Answered -> Closed), and duplicate response rejection (409).
- **Suite 6: Role-Based Access Control (RBAC)** (3 tests): Full matrix testing ensuring unauthenticated access returns 401, and cross-role requests return 403.
- **Suite 7: Fast-Check Property-Based Tests** (10 properties, 100 runs each):
  - **Property 1**: Completeness formula is $(completed / 13) \times 100$ rounded.
  - **Property 2**: Whitespace-only fields are treated as incomplete.
  - **Property 3**: Email validation rejects structurally invalid addresses.
  - **Property 4**: Password length bounds ($<8$ or $>128$) are enforced universally.
  - **Property 5**: Funding goal range ($<0.01$ or $>999,999,999.99$) is rejected universally.
  - **Property 6**: Ownership isolation for Business Profiles.
  - **Property 7**: Ownership isolation for Evidence Records.
  - **Property 8**: Question visibility isolation across multiple investors.
  - **Property 9**: Publication toggle round-trip invariance.
  - **Property 10**: Questions cannot be submitted to unpublished profiles.

---

## 9. API Reference

| Method | Endpoint | Auth Required | Role | Description |
|---|---|---|---|---|
| POST | `/api/auth/register` | No | Public | Register a new Founder or Investor account |
| POST | `/api/auth/login` | No | Public | Authenticate with credentials and establish session |
| POST | `/api/auth/logout` | Yes | All | Destroy active session and clear cookie |
| GET | `/api/auth/me` | Yes | All | Retrieve current authenticated user profile |
| POST | `/api/profiles` | Yes | Founder | Create a new Business Profile |
| GET | `/api/profiles/mine` | Yes | Founder | Retrieve requesting Founder's profile |
| PUT | `/api/profiles/:id` | Yes | Founder | Update profile details (ownership verified) |
| DELETE | `/api/profiles/:id` | Yes | Founder | Delete profile (ownership verified) |
| PUT | `/api/profiles/:id/toggle-publication` | Yes | Founder | Toggle Published / Unpublished visibility |
| GET | `/api/profiles` | Yes | Investor | Discover published profiles |
| GET | `/api/profiles/:id` | Yes | Investor | View published profile details |
| GET | `/api/readiness/:profileId` | Yes | Founder | Retrieve 13-point readiness score & guidance |
| POST | `/api/evidence` | Yes | Founder | Create documentary evidence record |
| GET | `/api/evidence/:profileId` | Yes | Founder | List all evidence records for profile |
| PUT | `/api/evidence/:id` | Yes | Founder | Update evidence record (ownership verified) |
| DELETE | `/api/evidence/:id` | Yes | Founder | Delete evidence record (ownership verified) |
| POST | `/api/questions` | Yes | Investor | Submit due diligence question on published profile |
| GET | `/api/questions/mine` | Yes | Investor | List questions submitted by requesting Investor |
| GET | `/api/questions/profile/:profileId` | Yes | Founder | List questions received for Founder's profile |
| POST | `/api/questions/:id/respond` | Yes | Founder | Respond to an open diligence question |
| POST | `/api/questions/:id/close` | Yes | Both | Close a question (investor or profile owner only) |

---

## 10. AI Development Tool: Kiro Specification-Driven Workflow

### Tool Selection
**Kiro** ([https://app.kiro.de/](https://app.kiro.de/)) was used as the primary AI development platform for architecting, designing, and generating VentureLens.

### Specification-Driven Development Workflow
Development strictly followed Kiro's specification-driven methodology across three formal phases preserved in `.kiro/specs/venture-lens/`:

1. **Requirements Phase (`requirements.md`)**:
   - Authored 13 formal user stories with 70+ unambiguous acceptance criteria using EARS (Easy Approach to Requirements Syntax).
   - Defined strict data boundaries (e.g., funding goal limits, 13 required readiness categories, 5-attempt login lockout).

2. **Design Phase (`design.md`)**:
   - Established the single-process MERN architecture, session management with Connect-Mongo, and Mongoose schema definitions.
   - Formalized 10 mathematical correctness properties for property-based testing.
   - Formulated the exact deterministic readiness algorithm and guidance message mapping.

3. **Tasks & Implementation Phase (`tasks.md`)**:
   - Decomposed the design into 17 sequenced tasks organized into dependency waves.
   - Generated the Express backend APIs, Vanilla CSS SaaS design system, and React SPA components.
   - When usage limits were reached in the Kiro web IDE, development was continued in Antigravity IDE, preserving all existing specifications, architecture decisions, and task tracking.

---

## 11. AI Development Experience & Problem Solving

Working with Kiro and AI coding agents demonstrated significant productivity benefits while highlighting the critical need for experienced human engineering oversight:

### 5 Specific Tasks Performed Using the AI Tool
1. **Requirements & Domain Modeling**: Generating the formal `.kiro/specs/venture-lens/requirements.md` and `.kiro/specs/venture-lens/design.md` specifications, establishing clean separation between Founder and Investor roles.
2. **Mongoose Schema & Route Generation**: Scaffolding Mongoose schemas (`User`, `BusinessProfile`, `EvidenceRecord`, `Question`) and the Express RESTful routes with role-based middleware.
3. **Vanilla CSS Design System Creation**: Authoring responsive CSS stylesheets (`global.css`, `layout.css`, `dashboard.css`, `evidence.css`, `questions.css`) utilizing dark navy (`hsl(225,35%,15%)`) surfaces and teal (`hsl(185,55%,45%))`) accents with contrast compliance.
4. **React Component Architecture**: Implementing the React SPA application shell in `public/app.jsx`, custom client router, toast notification system, and interactive modals.
5. **Fast-Check Property-Based Testing**: Designing property tests with `fast-check` to verify mathematical readiness invariants, email validation, and cross-user ownership isolation.

### Human Engineering Corrections Applied to AI-Generated Code
1. **Mongoose 9 Pre-Save Hook Incompatibility**: AI generated Mongoose `pre('save', function(next) { ... next(); })` hooks. In Mongoose 8/9, synchronous pre-save hooks no longer pass a `next` callback, causing unhandled `TypeError: next is not a function` exceptions during document creation. This was diagnosed and corrected to `schema.pre('save', function() { this.updatedAt = Date.now(); })`.
2. **Test Environment Session Store Hang**: The AI-generated Express server initialized `connect-mongo` directly with production MongoDB URIs upon file import, causing test suites to hang when attempting background connections to unavailable local databases. This was resolved by dynamically configuring an in-memory session store during test runs (`NODE_ENV=test`).
3. **Bcrypt Test Performance Bottleneck**: AI configured bcrypt with a constant salt round of 12 across all environments. In property tests with 200 iterations, this created an unneeded 50-second CPU delay. An environment check was added to use 4 rounds during tests, speeding test execution by 250x without compromising production security.
4. **JSON Serialization of Infinity in Property Tests**: Fast-check generated `Number.POSITIVE_INFINITY` for numeric funding goals, which `JSON.stringify` silently converted to `null`. The property generator was refined to test finite numbers within realistic boundaries.

---

## 12. Security & Privacy Model

- **Password Security**: Passwords hashed using bcrypt with salt factor 12 (never stored in plaintext).
- **Session Protection**: HTTP-only, SameSite=Strict session cookies with 24-hour expiration.
- **Session Fixation Defense**: Session identifiers are regenerated upon registration and login.
- **Brute-Force Rate Limiting**: Automatic account lockout for 15 minutes after 5 consecutive failed login attempts (HTTP 423).
- **Server-Side Authorization**: Every state-changing API validates user role and resource ownership on the backend.
- **No File Upload Attack Vectors**: Evidence records track metadata and document references without storing binary files on the server.

---

## 13. Limitations & Future Roadmap

- **Evidence Attachments**: Version 1.0 stores evidence metadata (`documentReference`) to eliminate file upload risks. Future iterations will support direct Amazon S3 pre-signed URL uploads.
- **Real-Time Updates**: Question inbox currently updates on navigation and user actions. Future versions will incorporate WebSockets or SSE for live question notifications.

---

## 14. License

ISC License. Built for the VentureLens Due Diligence Platform.
