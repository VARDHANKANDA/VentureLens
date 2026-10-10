# Requirements Document

## Introduction

VentureLens is a fundraising readiness and due diligence workspace for startup founders and investors. Founders use it to organize and present their business information and supporting evidence before fundraising. Investors use it to browse authorized business profiles, identify missing supporting evidence, and ask structured questions. The application is a full-stack MERN web application served via Express, with server-managed sessions and role-based access control.

## Glossary

- **System**: The VentureLens web application as a whole
- **Server**: The Express.js/Node.js backend that handles API requests, session management, and business logic
- **Client**: The React.js frontend rendered and served by the Server
- **Founder**: A registered user with the Founder role who creates and manages business profiles
- **Investor**: A registered user with the Investor role who browses profiles and submits questions
- **Business_Profile**: A structured document created by a Founder containing business details and funding information
- **Evidence_Record**: A record created by a Founder that references supporting documentation for a section of a Business_Profile
- **Question**: A structured inquiry submitted by an Investor tied to a specific Business_Profile and optional section
- **Readiness_Dashboard**: A computed view showing a Founder's profile completeness percentage and actionable guidance
- **Evidence_Coverage_Map**: A view showing the status of all Evidence_Records for a Business_Profile
- **Session**: A server-managed authentication state stored in a secure HTTP-only cookie
- **Role**: A classification assigned at registration — either Founder or Investor
- **Ownership**: The relationship between a Founder and the Business_Profile or Evidence_Record they created
- **Publication_Status**: A flag on a Business_Profile indicating whether it is visible to Investors — either Published or Unpublished

---

## Requirements

### Requirement 1: User Registration

**User Story:** As a visitor, I want to register an account with a name, email, password, and role, so that I can access the features appropriate to my role.

#### Acceptance Criteria

1. THE System SHALL provide a registration endpoint that accepts name, email, password, and role.
2. WHEN a registration request is received, THE Server SHALL validate that name, email, password, and role are all present and non-empty.
3. WHEN a registration request is received, THE Server SHALL validate that the email address conforms to a valid email format containing exactly one "@" symbol, a non-empty local part, and a non-empty domain part with at least one "." separator.
4. WHEN a registration request is received, THE Server SHALL validate that the role value is either "Founder" or "Investor".
5. WHEN a registration request is received, THE Server SHALL validate that the password is at least 8 characters long and no more than 128 characters long.
6. WHEN a registration request is received, THE Server SHALL validate that the name is no more than 100 characters long.
7. IF a registration request contains an email address already associated with an existing account, THEN THE Server SHALL return a 409 error response with a descriptive message.
8. WHEN a valid registration request is received, THE Server SHALL hash the password using bcrypt before storing it.
9. WHEN a valid registration request is received, THE Server SHALL store the user record with the hashed password and never store the plain-text password.
10. WHEN a valid registration request is received, THE Server SHALL create a new Session for the registered user and return a success response within 3 seconds.
11. IF a registration request fails validation for any field, THEN THE Server SHALL return an error response indicating which field failed validation and the reason for rejection.
12. THE Client SHALL display a registration form with fields for name, email, password, and role selection.
13. IF a registration request fails validation, THEN THE Client SHALL display the Server's error message adjacent to the relevant field.

---

### Requirement 2: User Authentication

**User Story:** As a registered user, I want to log in with my email and password, so that I can access my account securely.

#### Acceptance Criteria

1. THE System SHALL provide a login endpoint that accepts email and password.
2. WHEN a login request is received, THE Server SHALL validate that the email field is present, non-empty, and conforms to a valid email format (local-part@domain), and that the password field is present and non-empty.
3. IF the email field is absent, empty, or not a valid email format, OR the password field is absent or empty, THEN THE Server SHALL return an error response indicating which fields failed validation without processing the login.
4. WHEN a login request is received with both fields valid, THE Server SHALL look up the user by email and compare the provided password against the stored bcrypt hash.
5. IF the email is not found or the password does not match, THEN THE Server SHALL return a 401 error response with a generic message that does not distinguish between the two failure modes.
6. WHEN a valid login request is received, THE Server SHALL create a new Session for the user and set a secure, HTTP-only cookie containing the session identifier with a maximum age of 24 hours.
7. WHEN a valid login request is received, THE Server SHALL return the authenticated user's name, email, and role without returning the password hash.
8. THE System SHALL provide a logout endpoint that destroys the current Session and clears the session cookie.
9. WHILE a user is not authenticated, THE Client SHALL restrict access to authenticated-only routes and redirect the user to the login page.
10. THE Client SHALL display a login form with fields for email and password, where the email field accepts up to 254 characters and the password field accepts up to 128 characters and masks input.
11. IF a login request fails, THEN THE Client SHALL display the Server's error message within 100 milliseconds of receiving the response.
12. IF a user submits the login form more than 5 times with failed credentials within a 15-minute window, THEN THE Server SHALL reject further login attempts from that account for 15 minutes and return an error response indicating the account is temporarily locked.

---

### Requirement 3: Role-Based Access Control

**User Story:** As a system administrator, I want role-based access enforced on the server, so that Founders and Investors can only perform actions permitted by their role.

#### Acceptance Criteria

1. WHILE a request is not authenticated with a valid Session carrying a verified user identity and an assigned Role of either "Founder" or "Investor", THE Server SHALL return a 401 response for any protected endpoint.
2. WHEN an authenticated request is received for a Founder-only endpoint, THE Server SHALL allow the request to proceed only if the requesting user holds the "Founder" role.
3. IF an authenticated Investor attempts to access a Founder-only endpoint, THEN THE Server SHALL return a 403 response.
4. WHEN an authenticated request is received for an Investor-only endpoint, THE Server SHALL allow the request to proceed only if the requesting user holds the "Investor" role.
5. IF an authenticated Founder attempts to access an Investor-only endpoint, THEN THE Server SHALL return a 403 response.
6. IF an authenticated user's session carries a role value that is neither "Founder" nor "Investor", THEN THE Server SHALL return a 403 response for any protected endpoint.
7. WHILE an authenticated Founder is using the Client, THE Client SHALL render navigation links and action controls specific to the Founder role and SHALL NOT render navigation links or action controls specific to the Investor role.
8. WHILE an authenticated Investor is using the Client, THE Client SHALL render navigation links and action controls specific to the Investor role and SHALL NOT render navigation links or action controls specific to the Founder role.
9. WHEN the Client receives a 403 response from the Server, THE Client SHALL display a dedicated Unauthorized page.

---

### Requirement 4: Business Profile Management

**User Story:** As a Founder, I want to create and update my business profile, so that I can present my startup's information to potential investors.

#### Acceptance Criteria

1. THE System SHALL provide endpoints to create, read, update, and delete a Business_Profile.
2. WHEN a Founder submits a profile creation request, THE Server SHALL validate that business name (1–200 characters) and description (1–2000 characters) are present and non-empty.
3. IF a profile creation request is missing business name or description, or either field exceeds its character limit, THEN THE Server SHALL reject the request with an error response indicating which fields failed validation, and no Business_Profile SHALL be created.
4. WHEN a valid profile creation request is received, THE Server SHALL associate the new Business_Profile with the requesting Founder's user ID as its owner.
5. WHEN a profile update request is received, THE Server SHALL verify that the requesting user is the Founder who owns the Business_Profile before applying any changes.
6. IF a profile update request is submitted by a user who does not own the Business_Profile, THEN THE Server SHALL return a 403 response and no fields of the Business_Profile SHALL be modified.
7. THE Business_Profile SHALL contain the following fields: business name, description, industry, stage, business model, problem statement, solution statement, target customers, revenue context, funding goal, use of funds, milestones, and Publication_Status.
8. WHEN a Founder submits a profile update request with a funding goal value, THE Server SHALL validate that the funding goal is a numeric value in the range 0.01 to 999,999,999.99.
9. IF a profile update request contains a funding goal outside the range 0.01 to 999,999,999.99, THEN THE Server SHALL reject the request with an error response indicating the invalid field, and no fields of the Business_Profile SHALL be modified.
10. WHEN a profile deletion request is received, THE Server SHALL verify that the requesting Founder owns the Business_Profile before deleting it.
11. IF a profile deletion request is submitted by a user who does not own the Business_Profile, THEN THE Server SHALL return a 403 response and the Business_Profile SHALL not be deleted.
12. THE Client SHALL provide a profile creation and editing form with fields for all Business_Profile attributes listed in criterion 7.
13. THE Client SHALL display validation errors returned by the Server inline within the form field that caused the error within 500 milliseconds of receiving the Server response.

---

### Requirement 5: Profile Publication and Investor Discovery

**User Story:** As a Founder, I want to control whether my profile is visible to investors, so that I can publish it only when I am ready.

#### Acceptance Criteria

1. WHEN a Business_Profile is created, THE Server SHALL set its Publication_Status to "Unpublished" by default.
2. WHEN a Founder submits a toggle request for the Publication_Status of their own Business_Profile, THE Server SHALL update the Publication_Status to "Published" if currently "Unpublished", or to "Unpublished" if currently "Published", and return the new Publication_Status in the response.
3. WHEN an Investor requests the list of available Business_Profiles, THE Server SHALL return only Business_Profiles with a Publication_Status of "Published".
4. WHEN an Investor requests the details of a specific Business_Profile that exists and has a Publication_Status of "Published", THE Server SHALL return the full Business_Profile data.
5. IF an Investor requests a Business_Profile that exists but has a Publication_Status of "Unpublished", THEN THE Server SHALL return a 403 response.
6. IF an Investor requests a Business_Profile that does not exist, THEN THE Server SHALL return a 404 response.
7. WHILE a Founder is authenticated, THE Server SHALL allow the Founder to retrieve the Business_Profile associated with their own account regardless of its Publication_Status.
8. THE Client SHALL display the current Publication_Status on the Founder's profile editing view with a control that submits a toggle request to the Server when activated.
9. THE Client SHALL display a business discovery page for Investors listing all Published Business_Profiles with name, industry, and funding stage as defined in the Business_Profile.

---

### Requirement 6: Readiness Dashboard

**User Story:** As a Founder, I want to see a completeness score and actionable guidance for my profile, so that I know what information is missing before approaching investors.

#### Acceptance Criteria

1. THE Readiness_Dashboard SHALL compute a completeness percentage based on the presence of the following Business_Profile fields: business name, description, industry, stage, business model, problem statement, solution statement, target customers, revenue context, funding goal, use of funds, and milestones; and the presence of at least one Evidence_Record per defined evidence category, where a field is considered present if it contains a non-empty, non-whitespace-only value.
2. THE Server SHALL expose a readiness endpoint that returns the completeness percentage and a list of incomplete items for a Business_Profile owned by the requesting Founder, and IF the requesting Founder does not own the specified Business_Profile, THEN THE Server SHALL reject the request with an error response indicating unauthorised access.
3. WHEN the readiness endpoint is called, THE Server SHALL evaluate each of the following 13 sections as complete or incomplete: business name, description, industry, stage, business model, problem statement, solution statement, target customers, revenue context, funding goal, use of funds, milestones, and at least one Evidence_Record per defined evidence category.
4. THE Server SHALL compute the completeness percentage as (count of completed sections ÷ 13) × 100, rounded to the nearest integer, where each of the 13 sections defined in criterion 3 counts as exactly one unit regardless of sub-field count.
5. WHEN an incomplete section is identified, THE Server SHALL include a guidance message of no more than 280 characters for that section in the readiness response, describing what information is required to complete that section.
6. THE Client SHALL display the completeness percentage as a numeric value between 0 and 100 followed by the "%" symbol in a visually distinct element on the Founder Dashboard, updated within 5 seconds of the readiness endpoint response being received.
7. THE Client SHALL display each incomplete item alongside its guidance message as a distinct list entry on the Founder Dashboard, with entries ordered from first to last by the section sequence defined in criterion 3.
8. THE Client SHALL display a description of the completeness formula — stating that the score equals the number of completed sections out of 13, expressed as a percentage — on the Founder Dashboard in a location visible without scrolling on viewports of 1280 × 720 pixels or larger.
9. IF the readiness endpoint returns an error or is unreachable, THEN THE Client SHALL display an error message indicating that the readiness score could not be loaded and retain any previously displayed completeness percentage and incomplete items until a successful response is received.

---

### Requirement 7: Evidence Records Management

**User Story:** As a Founder, I want to create and manage evidence records tied to my business profile sections, so that I can track and provide supporting documentation.

#### Acceptance Criteria

1. THE System SHALL provide endpoints to create, read, update, and delete Evidence_Records associated with a Business_Profile.
2. WHEN an Evidence_Record creation request is received, THE Server SHALL validate that title, category, related_section, and status are present, non-empty, and that title does not exceed 200 characters.
3. THE Evidence_Record status SHALL be one of the following values: "Missing", "Provided", "Awaiting Review", or "Outdated".
4. WHEN an Evidence_Record creation request is received, THE Server SHALL verify that the requesting Founder owns the Business_Profile to which the record is being added.
5. IF an Evidence_Record creation request references a Business_Profile not owned by the requesting Founder, THEN THE Server SHALL return an authorization error response indicating the Founder does not have permission to add records to that Business_Profile.
6. WHEN an Evidence_Record update request is received, THE Server SHALL verify that the requesting Founder owns the Evidence_Record before applying changes.
7. IF an Evidence_Record update request is submitted by a Founder who does not own the Evidence_Record, THEN THE Server SHALL return an authorization error response indicating the Founder does not have permission to modify that Evidence_Record, and no changes SHALL be applied.
8. WHEN an Evidence_Record deletion request is received, THE Server SHALL verify that the requesting Founder owns the Evidence_Record before deleting it.
9. IF an Evidence_Record deletion request is submitted by a Founder who does not own the Evidence_Record, THEN THE Server SHALL return an authorization error response indicating the Founder does not have permission to delete that Evidence_Record, and the record SHALL remain unchanged.
10. WHEN an Evidence_Record creation request fails validation, THE Server SHALL return a validation error response indicating which fields are missing or invalid, and no record SHALL be created.
11. THE Client SHALL display an Evidence_Coverage_Map view listing all Evidence_Records for a Business_Profile grouped by category.
12. THE Client SHALL display each Evidence_Record's title, category, related_section, description, document_reference, and status.
13. THE Client SHALL provide controls on the Evidence_Coverage_Map to add, edit, and delete Evidence_Records.
14. WHEN a Founder submits a request to read all Evidence_Records for a Business_Profile they do not own, THE Server SHALL return only Evidence_Records belonging to Business_Profiles owned by the requesting Founder.

---

### Requirement 8: Investor Question Room

**User Story:** As an Investor, I want to submit structured questions tied to a business profile, so that I can gather information needed for my due diligence.

#### Acceptance Criteria

1. THE System SHALL provide an endpoint for an Investor to submit a Question tied to a specific Business_Profile.
2. WHEN a Question submission request is received, THE Server SHALL validate that the question text is present, non-empty, and does not exceed 1000 characters.
3. WHEN a Question submission request is received, THE Server SHALL verify that the referenced Business_Profile has a Publication_Status of "Published".
4. IF a Question submission request is received from a user who is not authenticated or does not hold the Investor role, THEN THE Server SHALL return an error response indicating insufficient permissions and SHALL NOT persist the Question.
5. IF an Investor submits a Question for a Business_Profile whose Publication_Status is not "Published", THEN THE Server SHALL return an error response indicating the Business_Profile is unavailable and SHALL NOT persist the Question.
6. WHEN a valid Question is submitted, THE Server SHALL associate the Question with the submitting Investor's user ID, the target Business_Profile ID, and an optional section reference of no more than 100 characters identifying a named section of the Business_Profile.
7. WHEN a Question is created, THE Server SHALL set its initial status to "Open".
8. THE Question status SHALL be exactly one of the following values: "Open", "Answered", or "Closed", where "Answered" is set when the Founder submits a response to the Question, and "Closed" is set when either the Investor or the Founder explicitly closes the Question.
9. WHEN an Investor navigates to the Business Detail page for a Published Business_Profile, THE Client SHALL display a question submission form containing a required question text field (maximum 1000 characters) and an optional section reference field (maximum 100 characters).

---

### Requirement 9: Founder Question Response

**User Story:** As a Founder, I want to view and respond to investor questions on my profile, so that I can address investor concerns and advance the fundraising conversation.

#### Acceptance Criteria

1. THE Server SHALL expose an endpoint to retrieve all Questions associated with a Business_Profile owned by the requesting Founder.
2. WHEN a Founder requests the Questions for their Business_Profile, THE Server SHALL return each Question's text, section reference, status, the Investor's name, and any existing response.
3. THE Server SHALL expose an endpoint for a Founder to submit a response to a specific Question.
4. WHEN a response submission request is received, THE Server SHALL verify that the requesting Founder owns the Business_Profile to which the Question is attached.
5. IF a response submission request is made by a user who does not own the associated Business_Profile, THEN THE Server SHALL return a 403 response.
6. WHEN a Founder submits a response to a Question whose status is "Open", THE Server SHALL store the response text (maximum 2000 characters) and update the Question status to "Answered".
7. IF a Founder attempts to submit a response to a Question whose status is "Answered" or "Closed", THEN THE Server SHALL return an error response indicating the Question is no longer open for response, and the existing response SHALL remain unchanged.
8. THE Server SHALL expose an endpoint for a Founder to close a Question by updating its status to "Closed".
9. WHEN a Question close request is received, THE Server SHALL verify that the requesting Founder owns the Business_Profile to which the Question is attached.
10. IF a Question close request is made by a user who does not own the associated Business_Profile, THEN THE Server SHALL return a 403 response and the Question status SHALL remain unchanged.
11. THE Client SHALL display a Question Inbox on the Founder Dashboard listing all Questions with their status, submitting Investor's name, and question text.
12. THE Client SHALL provide a response form within the Question Inbox for the Founder to write and submit a response, with a maximum character count of 2000 characters enforced in the form.

---

### Requirement 10: Question Visibility Restrictions

**User Story:** As a user, I want questions and responses to be visible only to the relevant parties, so that confidential due diligence conversations remain private.

#### Acceptance Criteria

1. WHEN an Investor requests their Questions, THE Server SHALL return only Questions submitted by that Investor, regardless of any user identifier supplied in the request.
2. WHEN a Founder requests Questions for their Business_Profile, THE Server SHALL return only Questions attached to Business_Profiles owned by that Founder, regardless of any Business_Profile identifier supplied in the request.
3. IF a user attempts to retrieve or list Questions for a resource they neither submitted nor own the associated Business_Profile for, THEN THE Server SHALL return a 403 response without returning any Question data.
4. WHILE an authenticated Investor is viewing their question history, THE Client SHALL display only the Questions that Investor has submitted, each shown with the associated Founder response if one exists or with a visible indication that no response has been provided yet.

---

### Requirement 11: Frontend UI and Navigation

**User Story:** As a user, I want a professional, responsive interface with clear navigation, so that I can use the application comfortably on any device.

#### Acceptance Criteria

1. THE Client SHALL be served entirely by the Server as browser-compatible JavaScript without requiring a separate bundler, build step, or JSX compilation.
2. THE Client SHALL display the following distinct screens: Login, Registration, Founder Dashboard, Profile Create/Edit, Evidence Coverage Map, Founder Question Inbox, Investor Business Discovery, Investor Business Detail, Investor Question History, 404 Not Found, and Unauthorized.
3. WHEN an authenticated user navigates between screens, THE Client SHALL transition to the target screen without a full page reload.
4. THE Client SHALL use dark navy or white surface colors and teal or blue accent colors, where dark navy is defined as a hue between 210° and 240° with lightness below 25%, teal as a hue between 170° and 200° with saturation above 40%, and blue as a hue between 200° and 240° with saturation above 40%.
5. THE Client SHALL use system fonts for all text rendering.
6. THE Client SHALL use ordinary CSS for all styling without CSS preprocessors or CSS-in-JS libraries.
7. WHILE viewing the application on a viewport narrower than 768 pixels, THE Client SHALL reflow layout elements into a single-column layout appropriate for mobile screens.
8. THE Client SHALL use semantic HTML elements including nav, main, section, article, header, footer, and button where appropriate.
9. THE Client SHALL ensure all interactive controls are keyboard accessible and operable via keyboard navigation, such that every focusable element is reachable by Tab key and activatable by Enter or Space key.
10. THE Client SHALL maintain a minimum contrast ratio of 4.5:1 between text and background colors for normal text and a minimum contrast ratio of 3:1 for large text, where large text is defined as 18pt or 14pt bold or larger.
11. THE Client SHALL display a 404 Not Found page for any route that does not match a defined application route.
12. IF a user who is not authenticated attempts to access a route that requires authentication, THEN THE Client SHALL redirect the user to the Login screen and display a message indicating that authentication is required.
13. IF a user who is authenticated attempts to access a route that is not permitted for their role, THEN THE Client SHALL display the Unauthorized screen without redirecting.

---

### Requirement 12: Backend Automated Testing

**User Story:** As a developer, I want automated backend tests covering all core behaviors, so that I can verify correctness and prevent regressions.

#### Acceptance Criteria

1. THE System SHALL include automated backend tests covering user registration and login, including the success path and the failure paths for duplicate registration and invalid credentials.
2. THE System SHALL include automated backend tests covering Business_Profile creation, retrieval, update, and deletion, including the success path for each operation and the failure paths for not-found (non-existent resource) and unauthorized access attempts.
3. THE System SHALL include automated backend tests covering the Readiness_Dashboard completeness calculation, including the cases where zero fields are populated (expected result: 0%), all fields are populated (expected result: 100%), and a partial subset of fields is populated (expected result: the count of non-empty populated fields divided by the total evaluated field count multiplied by 100, rounded to the nearest integer).
4. THE System SHALL include automated backend tests covering Evidence_Record creation, retrieval, update, and deletion, including the success path for each operation and the failure paths for not-found (non-existent resource) and unauthorized access attempts.
5. THE System SHALL include automated backend tests covering Question submission, response, and the following status transitions: Open → Answered (when Founder submits response), and Open/Answered → Closed (when Investor or Founder closes the Question).
6. THE System SHALL include automated backend tests verifying that role enforcement returns an HTTP 403 response for each endpoint requiring a role that the requesting user does not hold.
7. THE System SHALL include automated backend tests verifying that ownership checks return an HTTP 403 response when a user who is not the resource owner attempts to modify or delete that resource.
8. WHEN the test suite is executed, THE System SHALL run all tests against an isolated test database that is seeded fresh and fully reset to an empty state before each individual test case, ensuring no shared state between test cases and no writes to production or development databases.
9. THE System SHALL compute the Business_Profile readiness completeness percentage as the count of evaluated fields whose value is neither null nor an empty string nor a whitespace-only string divided by the total count of evaluated fields multiplied by 100, rounded to the nearest integer, such that a profile with all evaluated fields populated with non-whitespace values yields 100 percent and a profile with no evaluated fields populated yields 0 percent.
