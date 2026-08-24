# QA Take-Home — demoqa.com Book Store

Solution to the QA Engineer take-home assignment: test design and Playwright automation for the **Book Store Application** on [demoqa.com](https://demoqa.com/books), plus a written test strategy for an AI-powered feature.

## Repository map

| Deliverable | Where |
|---|---|
| Part 1 — Test plan | [docs/test-plan.md](docs/test-plan.md) |
| Part 1 — Test cases (TC-01..TC-10) | [docs/test-cases.md](docs/test-cases.md) |
| Part 2 — UI automation (6 cases) | [tests/ui/](tests/ui) |
| Part 2 bonus — API checks | [tests/api/bookstore-api.spec.ts](tests/api/bookstore-api.spec.ts) |
| Part 2 bonus — CI | [.github/workflows/tests.yml](.github/workflows/tests.yml) |
| Part 3 — AI feature test strategy | [docs/ai-testing-strategy.md](docs/ai-testing-strategy.md) |
| Part 4 — AI usage statement | [below](#ai-usage-statement-part-4) |

Supporting code: [src/pages/](src/pages) (page objects), [src/fixtures/](src/fixtures) (ad-blocking + per-test API-provisioned users), [src/api/](src/api) (typed client for the Account/BookStore endpoints).

## Running the tests

Prerequisites: Node.js 20+ and npm.

```bash
npm ci
npx playwright install chromium   # one-time browser download

npm test              # full suite: 6 UI + 7 API tests
npm run test:ui       # UI specs only
npm run test:api      # API specs only
npm run test:headed   # watch the UI tests in a real browser window
npm run report        # open the HTML report of the last run
```

No credentials or `.env` needed: every test provisions its own throwaway user through the public Account API (the registration UI is behind reCAPTCHA) and deletes it in teardown.

## Design notes

- **Six UI tests, deliberately** (TC-01, 02, 05, 06, 07, 09 — two of them negative): the assignment values well-built over many. TC-08 and the backend half of TC-10 live in the API suite, where the oracle is stronger; TC-03/TC-04 stay manual with reasons documented in the test cases.
- **Stability on an ad-heavy public site**: ad/analytics requests are aborted at the network layer (`context.route`), waits are event-based (no sleeps), and the config allows 1 retry locally / 2 on CI with a trace captured on first retry.
- **Shared public backend**: expected search results are derived from the catalog API at run time instead of hard-coded; tests only assert on state owned by their own per-test user.
- **SUT quirks discovered while exploring** (and worked around, see code comments): a UI login invalidates previously issued API tokens; several profile buttons share `id="submit"`; a zero-result search shows no empty-state message at all.

## AI usage statement (Part 4)

- I used Claude (Anthropic's Claude Code) extensively across all four parts, as this assignment's policy invites.
- It generated: the drafts of all three documents, the Playwright project (config, fixtures, page objects, specs), this README, and the scripted live exploration of the SUT that preceded any test code.
- Corrected: its first drafts assumed demoqa's earlier react-table UI (filler rows, `/books?book=` URLs, a "Log out" label) — the site has been redesigned, so selectors, waits and every documented expected result were rewritten from observed behavior, down to exact alert texts.
- Also corrected: a race in TC-09 (navigating to /profile before the post-login redirect settled), caught in a failed run and diagnosed from the trace.
- Rejected: a drafted TC-06 assertion that a "No rows found" empty-state message appears on zero-result searches — the live site shows no such message, so the assertion became a documented UX-gap observation instead.
- Everything was validated against the live application: the full suite ran green three times, including once from a fresh clone following this README verbatim.
