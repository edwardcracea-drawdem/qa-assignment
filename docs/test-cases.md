# Test Cases — DEMOQA Book Store Application

These are my Part 1 structured test cases for the Book Store Application at https://demoqa.com (entry point /books), tested black-box through the public UI and its REST API (Swagger at /swagger). The backend is public and shared — other visitors mutate the same data, and the registration UI sits behind reCAPTCHA — so every case that needs an account assumes a dedicated per-test user provisioned via `POST /Account/v1/User` and deleted in teardown via `DELETE /Account/v1/User/{uuid}` (the search cases need none); no case relies on a pre-existing account or collection state. Priorities: P1 covers the flows a real user cannot live without (login, search, adding a book); P2 covers negative and edge paths around them; P3 is policy verification. The mix is deliberate: four positive (TC-01, 05, 07, 09), four negative (TC-02, 03, 08, 10) and two edge/boundary (TC-04 unauthenticated access, TC-06 boundary search inputs). Six cases are automated through the UI with Playwright (TypeScript) — the 4–6 the assignment asks for — and the optional API suite additionally covers TC-08 and the backend half of TC-10. For the cases left manual, the reason is stated inline. Element ids in the steps (`#userName`, `#password`, `#searchBox`, `#delete-record-<isbn>`) are the application's real DOM ids and match the page-object selectors.

**Grid note (applies to TC-05, TC-06, TC-09):** the book grid on /books and /profile renders one plain `tbody tr` per real result and nothing else — an empty result set means an empty table body, with no placeholder rows and, notably, no "no results" message (flagged as a UX gap in TC-06). Search filters as you type, case-insensitively, across title, author *and* publisher.

| ID | Title | Priority | Automated |
|---|---|---|---|
| TC-01 | Login with valid credentials lands on profile | P1 | UI — tests/ui/login.spec.ts |
| TC-02 | Login with wrong password shows "Invalid username or password!" | P1 | UI — tests/ui/login.spec.ts |
| TC-03 | Login with empty fields triggers client-side validation, no request | P2 | No |
| TC-04 | Direct /profile access when not logged in prompts to login | P2 | No |
| TC-05 | Search by partial, case-insensitive title filters the list | P1 | UI — tests/ui/search.spec.ts |
| TC-06 | Search handles no-match and boundary inputs, staying empty and functional | P2 | UI — tests/ui/search.spec.ts |
| TC-07 | Logged-in user adds a book to collection; it appears in profile | P1 | UI — tests/ui/collection.spec.ts |
| TC-08 | Adding the same book twice is rejected | P2 | API — tests/api/bookstore-api.spec.ts |
| TC-09 | Deleting a book from profile collection removes it | P2 | UI — tests/ui/collection.spec.ts |
| TC-10 | Registration rejects weak password per policy | P3 | API level — tests/api/bookstore-api.spec.ts; UI path manual (reCAPTCHA) |

### TC-01 — Login with valid credentials lands on profile

- **Priority:** P1 | **Type:** positive
- **Automated:** yes — tests/ui/login.spec.ts
- **Preconditions:** A registered test user exists (created for this test via `POST /Account/v1/User`; password satisfies the policy). Browser has no active session.

**Steps**
1. Open https://demoqa.com/login.
2. Type the username into `#userName` and the password into `#password`.
3. Click the **Login** button.

**Expected results**
- The browser is redirected to https://demoqa.com/profile.
- The logged-in username is displayed on the profile page (`#userName-value`) and a **Logout** button is visible.
- The collection grid for a fresh account renders zero rows.

### TC-02 — Login with wrong password shows "Invalid username or password!"

- **Priority:** P1 | **Type:** negative
- **Automated:** yes — tests/ui/login.spec.ts
- **Preconditions:** Same per-test user as TC-01 exists.

**Steps**
1. Open https://demoqa.com/login.
2. Enter the valid username into `#userName` and a deliberately wrong password (valid password with one character changed) into `#password`.
3. Click **Login**.

**Expected results**
- The message **"Invalid username or password!"** appears below the form.
- The URL stays on /login; no redirect to /profile.
- No session is established: navigating to /profile afterwards shows the not-logged-in notice in place of a username or collection grid.

### TC-03 — Login with empty fields triggers client-side validation, no request

- **Priority:** P2 | **Type:** negative
- **Automated:** no — low ROI: this is a pure client-side check, trivially covered in exploratory testing; automating it adds maintenance without catching any regression the P1 login specs would miss.
- **Preconditions:** None (no account needed).

**Steps**
1. Open https://demoqa.com/login.
2. Leave both `#userName` and `#password` empty.
3. Click **Login**.
4. Watch the network panel while clicking.

**Expected results**
- Both fields are flagged invalid client-side (red border / `is-invalid` styling).
- No authentication request is sent to the backend — in particular, no call to `POST /Account/v1/GenerateToken`.
- No error message from the server is displayed; the page state is otherwise unchanged.

### TC-04 — Direct /profile access when not logged in prompts to login

- **Priority:** P2 | **Type:** negative/edge
- **Automated:** no — the guard page is a static state with no user data behind it: one notice, two links, no backend interaction. Regression risk is minimal and the check takes seconds in the exploratory pass. If the automation scope grew, this would be the first addition — a one-assertion spec.
- **Preconditions:** No active session (fresh browser context, no stored token/cookies).

**Steps**
1. Navigate directly to https://demoqa.com/profile by URL.

**Expected results**
- Instead of profile data, the page shows the notice **"Currently you are not logged into the Book Store application, please visit the login page to enter or register page to register yourself."**, with **login** and **register** as inline links.
- No username and no collection rows are rendered.
- Following the **login** link navigates to /login.

### TC-05 — Search by partial, case-insensitive title filters the list

- **Priority:** P1 | **Type:** positive
- **Automated:** yes — tests/ui/search.spec.ts
- **Preconditions:** None (search works logged out).

**Steps**
1. Open https://demoqa.com/books and wait for the 8-book catalog to render.
2. Type the uppercase partial term `GIT` into `#searchBox` (no Enter needed; the grid filters as you type).

**Expected results**
- The grid is reduced to exactly the catalog entries matching "git" case-insensitively — against the current stable catalog, the single row *Git Pocket Guide*.
- The oracle is derived from `GET /BookStore/v1/Books` at run time, not hard-coded, since the backend is shared: the displayed titles must equal the catalog entries whose title, author or publisher contains the term. (The filter's cross-field scope is real: `Addy` matches *Learning JavaScript Design Patterns* by author, `No Starch` matches two books by publisher.)

### TC-06 — Search handles no-match and boundary inputs, staying empty and functional

- **Priority:** P2 | **Type:** edge / boundary
- **Automated:** yes — tests/ui/search.spec.ts
- **Preconditions:** None.

**Steps**
1. Open https://demoqa.com/books and wait for the catalog to render.
2. Type a plain non-matching term (e.g. `no such book 0000`) into `#searchBox`.
3. Replace it with a markup/injection-shaped term (`<script>alert(1)</script>`).
4. Replace it with a whitespace-only term (`   `).
5. Clear `#searchBox`.

**Expected results**
- Steps 2–4: the table body renders zero rows for every one of these boundary inputs — no book data, no placeholder rows — and the search box stays enabled and usable throughout (the markup term is treated as literal text, not executed or broken on).
- **Two observations for the product team, reported in docs/findings.md:** no "no results" empty-state message is ever shown (BUG-02) — the user is left with bare column headers; and the whitespace-only term is not trimmed, so `"   "` yields nothing rather than the full catalog (UX-01). The automated assertions pin the zero-row-and-functional behavior; the messaging/trimming gaps are noted, not asserted as correct.
- Step 5: clearing the box restores the full 8-book catalog.

### TC-07 — Logged-in user adds a book to collection; it appears in profile

- **Priority:** P1 | **Type:** positive
- **Automated:** yes — tests/ui/collection.spec.ts
- **Preconditions:** Logged in as the per-test user; the user's collection does not contain the target book (guaranteed by using a freshly provisioned account).

**Steps**
1. Open https://demoqa.com/books and click the title of the first catalog book — currently *Git Pocket Guide*; the automation derives it from `GET /BookStore/v1/Books` rather than hard-coding it. The click lands on the detail page (https://demoqa.com/books?search=9781449325862).
2. Click the **Add To Your Collection** button.
3. Accept the JS alert that fires.
4. Navigate to https://demoqa.com/profile.

**Expected results**
- Step 3: a native browser alert (not an in-page toast) fires with the exact text **"Book added to your collection."**.
- On /profile, *Git Pocket Guide* is listed in the collection, and the grid contains exactly one row.

### TC-08 — Adding the same book twice is rejected

- **Priority:** P2 | **Type:** negative
- **Automated:** yes, at API level — tests/api/bookstore-api.spec.ts. The duplicate is deterministic and message-assertable over REST; the UI equivalent only surfaces a JS alert, so the API is the stronger oracle.
- **Preconditions:** Per-test user with a valid Bearer token (`POST /Account/v1/GenerateToken`); collection is empty.

**Steps**
1. `POST /BookStore/v1/Books` with the user's userId and ISBN 9781449325862, Bearer token attached.
2. Repeat the identical request.

**Expected results**
- Step 1 returns **201 Created** and the collection contains the ISBN once.
- Step 2 returns **400 Bad Request** with the message **"ISBN already present in the User's Collection!"**.
- The collection still contains the book exactly once — no duplicate entry.

**Manual UI cross-check (not part of the automated procedure):** on https://demoqa.com/books?search=9781449325862, clicking **Add To Your Collection** a second time fires a JS alert with the exact text **"Book already present in the your collection!"** (verbatim — the grammar slip is the application's own, and exact-text assertions must reproduce it).

### TC-09 — Deleting a book from profile collection removes it

- **Priority:** P2 | **Type:** positive
- **Automated:** yes — tests/ui/collection.spec.ts
- **Preconditions:** Logged in as the per-test user with exactly one book in the collection — the first catalog entry (currently *Git Pocket Guide*, ISBN 9781449325862), seeded via API for determinism.

**Steps**
1. Open https://demoqa.com/profile.
2. In the book's row, click the delete (trash) icon — `#delete-record-9781449325862`.
3. Confirm in the modal that appears (**OK**, `#closeSmallModal-ok`).
4. Accept the JS alert that follows.

**Expected results**
- Step 3: a confirmation modal titled **Delete Book** appears with the message **"Do you want to delete this book?"** and **OK**/**Cancel** buttons; clicking **OK** proceeds.
- Step 4: a JS alert fires with the exact text **"Book deleted."**.
- The row is removed from the grid; zero rows remain.
- Deleting affects only this account — the book remains in the public catalog on /books.

### TC-10 — Registration rejects weak password per policy

- **Priority:** P3 | **Type:** negative
- **Automated:** at API level — tests/api/bookstore-api.spec.ts asserts that `POST /Account/v1/User` with a weak password returns **400** with the policy message. The UI path stays manual: the /register form is gated by reCAPTCHA, which cannot be scripted honestly.
- **Preconditions:** None. Policy under test: minimum 8 characters including uppercase, lowercase, digit, and special character.

**Steps (manual UI path)**
1. Open https://demoqa.com/register.
2. Fill First Name, Last Name, a unique UserName, and a weak password such as `abcd1234` (no uppercase, no special character).
3. Solve the reCAPTCHA manually and click **Register**.

**Expected results**
- Registration is rejected and no user is created.
- The error shown is the backend policy message, verbatim: **"Passwords must have at least one non alphanumeric character, one digit ('0'-'9'), one uppercase ('A'-'Z'), one lowercase ('a'-'z'), one special character and Password must be eight characters or longer."**
