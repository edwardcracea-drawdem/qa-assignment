# Test Plan — DEMOQA Book Store Application

## Scope and rationale

I picked the Book Store application on demoqa.com because it is the one part of the site that behaves like a real product: authentication, a searchable catalog, per-user state (a personal book collection), and a documented REST API behind it (Swagger at /swagger). That lets me test complete user journeys through the UI and verify the same rules below the UI where the browser gets in the way. Testing is black box — I have no source access, so everything here is derived from observed behavior and the API docs.

In scope: login and access control on /profile, catalog search on /books, and collection management — adding a book from its detail page (/books?search=&lt;isbn&gt;), viewing it in the profile, deleting it. Registration rules are in scope at the API level only: the registration UI sits behind reCAPTCHA, which I won't automate against (see Risks).

## Risks

**Product risks.** Authentication is the gate to everything, so a broken login is the worst failure available — TC-01 and TC-02 defend it and run on every push. Unauthenticated access to /profile matters too, but the exposure is bounded: without a session the page renders only a login prompt, and the data behind it is guarded by the API's Bearer-token requirement. So I put the automated weight on the token requirement itself (asserted in the API suite, see traceability) and treat the UI-level prompt as a P2 check (TC-04). Search filters as you type across title, author and publisher, and a no-match query leaves the grid completely empty — no "no results" message at all, which I flag as a UX gap; TC-05 and TC-06 pin down the filtering itself. Collection state is the only data a user owns; silent duplicate adds or failed deletes would break trust in it (TC-07, TC-08, TC-09). Finally, a registration endpoint accepting weak passwords would weaken every account on the site (TC-10).

**Testing-process risks.** The backend is public and shared — other visitors mutate the same data while my tests run. I mitigate by provisioning a fresh user per test through POST /Account/v1/User, asserting only on state that user owns, and deleting the user in teardown. The site carries third-party ads (Google ad frames and analytics on every page) that slow loading, plus occasional 502s; I block ad requests at the network layer via Playwright's `context.route`, and run with retries (1 local, 2 in CI) with a trace captured on first retry so real failures stay diagnosable. The registration UI sits behind reCAPTCHA, which I will not try to defeat — that path stays manual. Two quirks surfaced while exploring the SUT and shaped the design: logging in through the UI invalidates previously issued API tokens, so fixtures regenerate tokens before authorized teardown calls; and several profile buttons share `id="submit"` (Logout, Delete Account, Delete All Books) — a defect worth reporting in itself — so selectors go by accessible name instead of id there. Finally, the 8-book catalog belongs to the demo site, not to me: it is effectively stable, but I treat titles and ISBNs as test data derived from the API at run time, not truths scattered across specs.

## Prioritization

P1 is the shortest path a real user needs, plus the failure message that guards its front door: log in (TC-01), get rejected cleanly with a wrong password (TC-02), find a book (TC-05), put it in the collection (TC-07). If any link in that chain breaks, the application has no purpose, so those flows get automated first and run on every push. P2 defends the P1 paths at the edges: empty-field validation (TC-03), unauthenticated /profile access (TC-04), zero-result search (TC-06), duplicate adds (TC-08), deletion (TC-09). P3 is registration password policy (TC-10): real risk, but reachable only through the API without manual captcha solving.

## What will be tested

Ten test cases, TC-01 through TC-10 (full versions in docs/test-cases.md). Traceability, in numeric order with priorities:

- TC-01 (P1) Login with valid credentials lands on profile — automated, tests/ui/login.spec.ts
- TC-02 (P1) Login with wrong password shows "Invalid username or password!" — automated, tests/ui/login.spec.ts
- TC-03 (P2) Login with empty fields triggers client-side validation, no request — manual; a pure client-side check with low automation ROI
- TC-04 (P2) Direct /profile access when not logged in prompts to login — manual in this 6-test scope; first candidate if the automated scope grows. The server-side guarantee behind it is covered by the API suite's token assertions below
- TC-05 (P1) Search by partial, case-insensitive title filters the list — automated, tests/ui/search.spec.ts
- TC-06 (P2) Search with no matching book shows an empty list — automated, tests/ui/search.spec.ts
- TC-07 (P1) Logged-in user adds a book to collection; it appears in profile — automated, tests/ui/collection.spec.ts
- TC-08 (P2) Adding the same book twice is rejected — automated at API level, tests/api/bookstore-api.spec.ts (duplicate POST returns 400 "ISBN already present in the User's Collection!"). The UI alert path is listed as reference steps in docs/test-cases.md and exercised only ad hoc; it does not make TC-08 a manual case
- TC-09 (P2) Deleting a book from profile collection removes it — automated, tests/ui/collection.spec.ts
- TC-10 (P3) Registration rejects weak password per policy — the backend policy is automated at API level in the bonus suite (400 plus the verbatim policy message); the UI path stays manual behind reCAPTCHA

Supporting assertion, not a numbered case: tests/api/bookstore-api.spec.ts also asserts that BookStore requests without a valid Bearer token are rejected — listed here so the access-control claim above stays traceable.

Stack: TypeScript + @playwright/test, Page Object Model, custom fixtures for ad-blocking and API-provisioned users, GitHub Actions CI, Chromium only.

## What will not be tested, and why

Cross-browser: deliberately Chromium-only. The risks here are functional, not rendering-specific; a second engine doubles runtime and flake surface for almost no new signal. Performance/load: this is a shared public demo — load testing it would degrade it for everyone else and measure nothing about a real deployment. Security beyond access control (which is in scope and traced above): no vulnerability probing, injection, or rate-limit testing — I will not attack infrastructure I don't own. The registration UI path: reCAPTCHA exists precisely to block automation, and bypassing it would be dishonest testing. Visual regression: third-party ads change the page on every load, so screenshots could never stabilize. Catalog content and column sorting: the book data is third-party owned — I assert behavior against it, not its correctness — and the sortable column headers are a nice-to-have I would cover next, after the core journeys.

## Entry and exit criteria

Entry is a hand-run preflight, not the suite itself: /books responds, POST /Account/v1/User creates a throwaway user, and GenerateToken succeeds for that user. Exit: all P1 cases (TC-01, TC-02, TC-05, TC-07) pass, and every P1/P2 failure has a written bug report. A P3 failure is documented but does not block. Deleting per-test users is teardown housekeeping owned by the fixtures, not an exit gate.
