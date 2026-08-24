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
| Extra — findings & bug reports (security / a11y / perf / UX) | [docs/findings.md](docs/findings.md) |

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

No credentials or `.env` needed: every test that needs an account provisions its own throwaway user through the public Account API (the registration UI is behind reCAPTCHA) and deletes it in teardown; the search and read-only catalog tests run accountless.

CI ([.github/workflows/tests.yml](.github/workflows/tests.yml)) runs the suite on every push to main, every pull request, and nightly — the SUT is a live third-party site, so the scheduled run doubles as a drift check. See the repository's Actions tab for run history.

## Design notes

- **Six UI tests, deliberately** (TC-01, 02, 05, 06, 07, 09 — two of them negative): the assignment values well-built over many. TC-08 and the backend half of TC-10 live in the API suite, where the oracle is stronger; TC-03/TC-04 stay manual with reasons documented in the test cases.
- **Stability on an ad-heavy public site**: ad/analytics requests are aborted at the network layer (`context.route`), waits are event-based (no sleeps), and the config allows 1 retry locally / 2 on CI with a trace captured on first retry.
- **Shared public backend**: expected search results are derived from the catalog API at run time instead of hard-coded; tests only assert on state owned by their own per-test user.
- **SUT quirks discovered while exploring** (and worked around, see code comments): a UI login invalidates previously issued API tokens; several profile buttons share `id="submit"`; a zero-result search shows no empty-state message at all.
- **A broader bug sweep** beyond the automated scope is written up in [docs/findings.md](docs/findings.md): 15 findings across security, accessibility (axe-core verified), performance and UX — including a **High-severity** one where the auth JWT embeds the user's plaintext password and is stored in a JS-readable cookie.
- **Fast feedback**: the full 13-test suite completes in about 30 seconds in my local runs (4 parallel workers; network-level ad-blocking removes most of the dead time an ad-heavy public site otherwise costs).

## AI usage statement (Part 4)

- I used Claude (Anthropic's Claude Code) extensively across all four parts, as this policy invites. The decisions were mine: the Book Store as SUT, the six-case scope, API-provisioned users over reCAPTCHA, what stayed manual, what became a bug report.
- Claude generated under that direction: the three document drafts, the Playwright project, this README, and the scripted live SUT exploration.
- Corrected: first drafts assumed demoqa's pre-redesign UI (filler rows, `/books?book=` URLs) — selectors, waits and expected results were rewritten from live behavior.
- Also corrected: a TC-09 race (navigating before the post-login redirect settled), fixed from the failing run's trace.
- Rejected: a drafted "No rows found" assertion for TC-06 — the site shows no such message; it became bug report BUG-02.
- Everything was validated live: the suite ran green repeatedly, including from a fresh clone following this README.
