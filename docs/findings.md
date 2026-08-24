# Exploration Findings & Bug Reports

Everything below was found during the scripted exploration that preceded test design, and each item is reproducible on demand. Environment for all reports: demoqa.com (live), Chromium via Playwright, August 2026. None of these block the assignment's flows — that is exactly why they are reported separately instead of failing tests: a test suite asserts agreed behavior; a bug report argues for better behavior.

## BUG-01 — UI login silently invalidates previously issued API tokens

**Severity:** Medium (for API consumers) | **Area:** Account API / session handling

**Steps to reproduce**
1. Create a user via `POST /Account/v1/User`, then obtain a token via `POST /Account/v1/GenerateToken` — the response advertises a 7-day `expires`.
2. Prove the token works: `POST /BookStore/v1/Books` with it → **201**.
3. Log in through the UI at /login with the same user.
4. Repeat step 2 with the *same* token.

**Expected:** an unexpired token keeps working, or the rotation is a documented behavior.
**Actual:** **401** `{"code":"1200","message":"User not authorized!"}`. A freshly generated token works again — the UI login rotated the token server-side while the old one was still well within its advertised expiry.

**Impact:** any integration holding a token breaks the moment the user opens the web app. In this suite, the workaround is codified: `deleteUser()` regenerates its token before every authorized teardown call (`src/api/bookstore-api.ts`).

## BUG-02 — Zero-result search shows no empty-state message

**Severity:** Low (UX) | **Area:** /books search

**Steps to reproduce:** open /books, type any non-matching term (e.g. `no such book 0000`) into `#searchBox`.

**Expected:** an explicit "no results" indication.
**Actual:** the table body simply empties — the user is left staring at bare column headers with no feedback that the search worked and found nothing.

**Impact:** indistinguishable from a rendering failure from the user's point of view. Automated coverage: TC-06 pins the zero-row behavior; this report covers the missing message.

## BUG-03 — Three profile buttons share `id="submit"`

**Severity:** Low (correctness/maintainability) | **Area:** /profile markup

**Steps to reproduce:** log in, open /profile, inspect the **Logout**, **Delete Account** and **Delete All Books** buttons.

**Expected:** unique element ids — the HTML spec requires it.
**Actual:** all three carry `id="submit"`. `getElementById` returns only the first; anything keyed on that id (scripts, analytics, assistive-tech references, test selectors) silently targets Logout regardless of intent.

**Impact:** invalid HTML and a genuine automation/accessibility trap. This suite deliberately addresses these buttons by accessible name instead of id (`src/pages/profile-page.ts`).

## BUG-04 — Duplicate-add alert text has a grammar error

**Severity:** Trivial (cosmetic) | **Area:** book detail page

**Steps to reproduce:** logged in, on a book's detail page, click **Add To Your Collection** twice.

**Expected:** something like "Book already present in your collection!"
**Actual:** the alert reads **"Book already present in the your collection!"** — "the your" verbatim.

**Impact:** cosmetic, but user-facing copy in a security company's product would not survive review with this in it. Noted also because exact-text assertions must reproduce the typo faithfully (TC-08's manual cross-check does).

## Non-bug observations that shaped the suite

- The site was redesigned recently: the old react-table grid (10 padded filler rows) is gone in favor of a plain table, and book deep links moved from `/books?book=<isbn>` to `/books?search=<isbn>`. Any tutorial-era selectors are dead — everything here was derived from the live DOM.
- Search filters as you type across title, author *and* publisher, case-insensitively (`Addy` matches by author, `No Starch` by publisher).
- Ads/analytics load from a dozen third-party hosts on every page; blocking them at the network layer cut typical page readiness visibly and removed the main flakiness source.
- Registration UI is gated by reCAPTCHA (by design, not a bug) — hence API-provisioned test users.
