# Exploration Findings & Bug Reports

Everything below was found during scripted black-box exploration of the Book Store application, and each item is reproducible on demand. This goes beyond the assignment's automated scope on purpose: a strong QA pass reports what it sees across security, accessibility, performance, and UX — not only the happy-path functionals it was asked to automate.

**Scope and conduct.** demoqa.com is a public practice target. I kept the exploration read-mostly and polite: no denial-of-service, no floods, no attempts to reach other users' data — the rate-limit probe was a single burst of 8 login attempts, the kind any login form gets tested with. Severities below are framed as *"if this were a production security product"*, which is the lens that matters for the role. Accessibility findings are tool-verified with axe-core 4.13; performance and security facts are from response headers, cookies, decoded tokens, and navigation timing captured live in August 2026 (Chromium).

## Summary

| ID | Category | Severity | Finding |
|---|---|---|---|
| SEC-01 | Security | **High** | Auth JWT embeds the user's password in plaintext |
| SEC-02 | Security | **High** | Auth token cookie is non-HttpOnly and non-Secure |
| SEC-03 | Security | Medium | No security headers (clickjacking, MIME-sniffing, no HSTS) |
| SEC-04 | Security | Medium | No rate limiting or lockout on login |
| BUG-01 | Security / session | Medium | A UI login silently invalidates previously issued API tokens |
| A11Y-01 | Accessibility | Medium | Multiple WCAG violations (critical + serious) on every page |
| SEC-05 | Security | Low | Username enumeration via the registration endpoint |
| SEC-06 | Security | Low | Username not validated server-side (raw markup stored) |
| SEC-07 | Security | Low | Web server version disclosed and outdated |
| PERF-01 | Performance | Low | Third-party ad/tracking dominates page weight and requests |
| BUG-02 | UI/UX | Low | Zero-result search shows no empty-state message |
| BUG-03 | UI/UX / a11y | Low | Three profile buttons share `id="submit"` |
| UX-01 | UI/UX | Low | Search ignores ISBN and untrimmed whitespace |
| UX-02 | UI/UX | Low | `autocomplete="off"` on login blocks password managers |
| BUG-04 | UI/UX | Trivial | Grammar error in the duplicate-add alert |

---

## Security

### SEC-01 — The authentication JWT embeds the user's password in plaintext — **High**

**Steps to reproduce**
1. `POST /Account/v1/GenerateToken` with valid credentials.
2. Take the returned `token`, split on `.`, base64-decode the middle (payload) segment.

**Actual:** the payload is `{"userName":"<user>","password":"<PLAINTEXT PASSWORD>","iat":...}`. The password is right there, recoverable by anyone who ever sees the token — no signature key needed, base64 is not encryption.

**Impact:** a JWT is meant to be a bearer credential, not a container for the secret that minted it. Anyone who captures a token (via the JS-readable cookie in SEC-02, a proxy log, an error report, browser history, an analytics beacon) recovers the account's actual password — and users reuse passwords across sites. For a security vendor this is the kind of finding that stops a release. Fix: never put the password (or any secret) in the token payload; store only a subject id and issue/expiry claims.

### SEC-02 — Auth token cookie is non-HttpOnly and non-Secure — **High**

**Steps to reproduce:** log in through the UI, inspect cookies (or run `document.cookie` in the console).

**Actual:** the `token`, `userID`, `userName` and `expires` cookies are all set with `httpOnly=false`, `secure=false`, `sameSite=Lax`. `document.cookie` returns the token — any script on the page can read it.

**Impact:** `httpOnly=false` means any cross-site-scripting foothold reads the token directly from JS; combined with SEC-01, that is a plaintext-password theft, not just a session hijack. `secure=false` means the cookie can be transmitted over plain HTTP (see SEC-03 — no HSTS), exposing it to network interception. Fix: `HttpOnly; Secure; SameSite=Strict` on the session cookie, and stop mirroring identity into JS-readable cookies.

### SEC-03 — No security headers — Medium

**Steps to reproduce:** `curl -sD - -o /dev/null https://demoqa.com/books` and inspect the response headers.

**Actual:** the only notable header is `Server: nginx`. Absent: `Content-Security-Policy`, `X-Frame-Options` / CSP `frame-ancestors`, `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.

**Impact:** no `X-Frame-Options`/CSP → the app can be framed (clickjacking); no HSTS → the first request before the HTTP→HTTPS 301 is downgradeable (SSL-strip), which is what makes SEC-02's non-Secure cookie exploitable; no `X-Content-Type-Options: nosniff` → MIME-sniffing. Fix: add the standard header set at the edge.

### SEC-04 — No rate limiting or account lockout on login — Medium

**Steps to reproduce:** send 8 rapid `POST /Account/v1/GenerateToken` with a valid username and wrong passwords.

**Actual:** all 8 return `200` with `status:"Failed"` — no throttling, no delay, no lockout, no CAPTCHA on the token endpoint — and the correct password authenticates immediately afterward.

**Impact:** the credential endpoint is open to online brute-force and credential-stuffing. (The UI registration form has reCAPTCHA; the login/token path has none.) Fix: rate-limit by IP and account, add exponential backoff or temporary lockout.

### BUG-01 — A UI login silently invalidates previously issued API tokens — Medium

**Steps to reproduce**
1. Create a user, obtain a token via `POST /Account/v1/GenerateToken` (the response advertises a 7-day `expires`), and prove it works: `POST /BookStore/v1/Books` → **201**.
2. Log in through the UI at /login as the same user.
3. Repeat the API call with the *same* token.

**Actual:** step 3 returns **401** `{"code":"1200","message":"User not authorized!"}`. A freshly generated token works again — the UI login rotated the token server-side while the old one was still well within its advertised expiry.

**Impact:** any integration holding a token breaks the moment the user opens the web app; the advertised expiry is misleading. In this suite the workaround is codified — `deleteUser()` regenerates its token before every authorized teardown call (`src/api/bookstore-api.ts`).

### SEC-05 — Username enumeration via registration — Low

**Steps:** `POST /Account/v1/User` with an existing username.
**Actual:** returns `{"code":"1204","message":"User exists!"}`, confirming which usernames are registered. **Impact:** lets an attacker build a valid-username list to feed SEC-04. (Credit where due: the *token* endpoint does not leak this — it returns the same generic "User authorization failed." for both an unknown user and a wrong password, which is the correct behavior.) Fix: make registration failures generic or gate the endpoint.

### SEC-06 — Username not validated server-side; raw markup stored — Low (latent)

**Steps:** `POST /Account/v1/User` with `userName` = `<img src=x onerror=window.__xss=1>...`.
**Actual:** accepted with **201** and stored verbatim. **Mitigating fact (verified):** the React UI output-encodes it on the profile page — `#userName-value` renders `&lt;img src=x...&gt;` and the payload does **not** execute — so there is no active stored-XSS in the current UI. The finding is defense-in-depth: storing unvalidated markup is a latent risk the day any other consumer (an email, an admin tool, a report) renders it without escaping. Fix: validate/whitelist username characters at the API boundary.

### SEC-07 — Web server version disclosed and outdated — Low

**Actual:** `Server: nginx/1.17.10 (Ubuntu)` — a 2020 build, disclosed on every response. **Impact:** version disclosure aids targeted exploitation and signals an unpatched stack. Fix: suppress the version (`server_tokens off`) and update.

## Accessibility

### A11Y-01 — Multiple WCAG violations on every page (axe-core verified) — Medium

Automated scan with **axe-core 4.13** on /login, /books and /profile. Recurring, tool-confirmed violations:

| Rule | Impact | Where | What it means |
|---|---|---|---|
| `image-alt` | critical | all three pages | Images (book covers, header logo) have no `alt` text |
| `button-name` | critical | /books, /profile | The search magnifier button has no accessible name |
| `link-name` | serious | all three pages | The header logo link has no discernible text |
| `color-contrast` | serious | /books (×4) | Book-title links fail the minimum contrast ratio |
| `page-has-heading-one` | moderate | /books, /profile | No `<h1>` on the page |
| `landmark-one-main` | moderate | all three pages | No `<main>` landmark |
| `region` | moderate | all three (×13–16) | Most content sits outside any landmark |

**Impact:** a screen-reader user cannot identify the book images, the search button, or the site-home link; low-contrast title links fail low-vision users; missing headings and landmarks break the primary navigation mechanisms assistive tech relies on. For a consumer security product these are both a usability and a compliance (WCAG 2.1 AA / EN 301 549) exposure. Fix: add `alt` text, `aria-label` the icon button and logo link, raise link contrast, and introduce a heading + `<main>` landmark structure.

## Performance

### PERF-01 — Third-party ad/tracking dominates page weight and request count — Low

**Measured on /books (ads not blocked, Chromium, warm):** `load` event ~1.9 s, catalog rows visible ~2.7 s, **~1.5 MB transferred across 25 requests**, of which **8 distinct third-party hosts** are Google ad/tracking domains (googlesyndication, doubleclick, adtrafficquality, googletagmanager/services, google-analytics, safeframe).

**Impact:** the application's own payload (an 8-row book list) is tiny; the weight and the request fan-out are almost entirely ads and trackers, which also inject the frames that delay interactivity and cause the flakiness the automated suite has to work around. On a slow connection this pushes time-to-interactive well past the content being ready. This is exactly why the test fixtures block ad hosts at the network layer. Fix (product side): defer/lazy-load ad frames so they never block the catalog render.

## UI / UX & base functionality

### BUG-02 — Zero-result search shows no empty-state message — Low

Open /books, type a non-matching term. The table body simply empties — bare column headers, no "no results" text. Indistinguishable from a rendering failure. Covered functionally by TC-06 (asserts the zero-row behavior); the missing message is this report.

### BUG-03 — Three profile buttons share `id="submit"` — Low

On /profile the **Logout**, **Delete Account** and **Delete All Books** buttons all carry `id="submit"`. Invalid HTML (ids must be unique); `getElementById` returns only the first, so anything keyed on that id — scripts, analytics, assistive tech, test selectors — silently targets Logout. This suite addresses these buttons by accessible name instead (`src/pages/profile-page.ts`).

### UX-01 — Search ignores ISBN and untrimmed whitespace — Low

Searching a book's full ISBN (`9781449325862`) returns **0 rows** — the filter only matches the visible title/author/publisher columns, so a user who pastes an ISBN finds nothing. A whitespace-only query (`"   "`) also returns 0 rather than the full catalog (input isn't trimmed). Minor, but both are plausible real user inputs. Fix: include ISBN in the search index and trim the query.

### UX-02 — `autocomplete="off"` on login fields — Low

Both login inputs set `autocomplete="off"`, which fights password managers and browser autofill. Modern guidance (and most security teams) prefer `autocomplete="username"` / `"current-password"` so managers work correctly. Debatable, but on a security product it pushes users toward weaker password habits.

### BUG-04 — Grammar error in the duplicate-add alert — Trivial

Adding a book already in the collection raises the alert **"Book already present in the your collection!"** ("the your", verbatim). Cosmetic, but user-facing copy in a security product would not survive review — and exact-text assertions must reproduce the typo faithfully (TC-08's manual cross-check does).

## Verified working & positive observations

Not everything is a defect — these were checked and behave correctly, and are recorded so the coverage picture is honest:

- **Column sorting works**: clicking the Title header sorts ascending, then descending.
- **Logout works**: redirects to /login and the profile then shows the not-logged-in guard.
- **Access control holds where it counts**: the "Add To Your Collection" button is hidden when logged out; collection writes without a valid Bearer token return 401; the `GET` user endpoint does not return the password.
- **Output encoding is correct**: React escapes hostile usernames on render (SEC-06), so there is no active XSS in the UI.
- **Transport**: HTTP requests 301-redirect to HTTPS; the password field is `type="password"` (masked).
- **No user-existence leak on login**: the token endpoint returns the same generic failure for an unknown user and a wrong password.

## Non-bug context that shaped the suite

- The site was redesigned recently: the old react-table grid (10 padded filler rows) is gone in favor of a plain table, and book deep links moved from `/books?book=<isbn>` to `/books?search=<isbn>`. Any tutorial-era selectors are dead — everything here was derived from the live DOM.
- Search filters as you type across title, author *and* publisher, case-insensitively (`Addy` matches by author, `No Starch` by publisher).
- Registration UI is gated by reCAPTCHA (by design) — hence API-provisioned test users.
