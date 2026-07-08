# F001 — User Authentication
## Business Requirements Document (BRD)

> **Feature ID:** F001
> **Status:** 🔵 In Review
> **Author:** Antigravity Main Agent
> **Reviewer:** BA Agent
> **Sprint:** Sprint 2
> **Parent Doc:** [MASTER.md](../MASTER.md)
> **Last Updated:** 2026-07-07

---

## 1. Executive Summary

Currently, Viralify operates as a single-user app with no login — all data is stored in the browser's LocalStorage and tied to one anonymous session. This means users cannot access their posts from a different device, cannot have separate accounts, and the platform cannot scale to multiple users.

This feature introduces a **full authentication system** allowing users to:
- Create an account using their **email address and password**
- Sign in using their **Google account** (OAuth 2.0)
- Have their data persisted and associated with their unique identity
- Log out and switch accounts

---

## 2. Business Objectives

| # | Objective |
|---|---|
| BO-1 | Enable multi-user support on the Viralify platform |
| BO-2 | Provide a frictionless sign-in experience via Google OAuth |
| BO-3 | Allow users to access their content from any device/browser |
| BO-4 | Lay the foundation for future paid plans and user-specific data |
| BO-5 | Meet baseline security standards for user credential management |

---

## 3. Scope

### 3.1 In Scope
- Sign Up page (email + password)
- Sign In page (email + password)
- Google OAuth 2.0 Sign In / Sign Up
- Email verification after sign-up
- Password reset via email link
- Persistent login session (remember me)
- Sign Out
- Authenticated route protection (redirect to login if not signed in)
- User profile display (name + avatar) in sidebar

### 3.2 Out of Scope
- Social logins other than Google (Facebook, Apple, Twitter — future)
- Two-factor authentication (future F008)
- Username/handle system (future)
- Account deletion (future)
- Profile editing page (future)
- Subscription / billing (future)

---

## 4. User Stories

### 4.1 Sign Up — Email
| ID | As a... | I want to... | So that... | Priority |
|---|---|---|---|---|
| US-001 | New visitor | Sign up with my email and a password | I can create my Viralify account | Must Have |
| US-002 | New visitor | See a password strength indicator | I know my password is secure | Should Have |
| US-003 | New visitor | Receive a verification email after sign-up | My account is confirmed as mine | Must Have |
| US-004 | New visitor | Be redirected to the dashboard after successful sign-up | I can start using the app immediately | Must Have |
| US-005 | New visitor | See clear validation errors (e.g. email already taken) | I understand what to fix | Must Have |

### 4.2 Sign In — Email
| ID | As a... | I want to... | So that... | Priority |
|---|---|---|---|---|
| US-006 | Returning user | Sign in with my email and password | I can access my account | Must Have |
| US-007 | Returning user | Have my session remembered across browser restarts | I don't need to log in every time | Should Have |
| US-008 | Returning user | See an error if my credentials are wrong | I know what went wrong | Must Have |

### 4.3 Google OAuth
| ID | As a... | I want to... | So that... | Priority |
|---|---|---|---|---|
| US-009 | New visitor | Sign up with my Google account in one click | I don't need to create a separate password | Must Have |
| US-010 | Returning user | Sign in with my Google account | It's faster than typing credentials | Must Have |
| US-011 | Returning user | Have my Google profile picture shown in the app sidebar | I can see I'm signed in correctly | Should Have |

### 4.4 Password Reset
| ID | As a... | I want to... | So that... | Priority |
|---|---|---|---|---|
| US-012 | Returning user | Request a password reset email | I can recover my account if I forget my password | Must Have |
| US-013 | Returning user | Set a new password via the reset link | I can regain access to my account | Must Have |

### 4.5 Session & Security
| ID | As a... | I want to... | So that... | Priority |
|---|---|---|---|---|
| US-014 | Signed-in user | Sign out of my account | My session is ended on shared devices | Must Have |
| US-015 | Visitor | Be redirected to Sign In if I try to access a protected page | I can't see other people's data | Must Have |
| US-016 | Signed-in user | See my name and avatar in the sidebar | I know which account I'm logged into | Should Have |

---

## 5. Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-001 | Sign Up form: fields for Full Name, Email, Password, Confirm Password | Must Have |
| FR-002 | Password validation: min 8 chars, at least 1 uppercase, 1 number, 1 special character | Must Have |
| FR-003 | Real-time password strength meter (Weak / Fair / Strong / Very Strong) | Should Have |
| FR-004 | Duplicate email detection with clear error message | Must Have |
| FR-005 | Post sign-up: send verification email; show "check your inbox" screen | Must Have |
| FR-006 | Sign In form: Email and Password fields | Must Have |
| FR-007 | "Forgot Password?" link on sign-in form triggering email reset flow | Must Have |
| FR-008 | "Continue with Google" button on both Sign Up and Sign In screens | Must Have |
| FR-009 | Google OAuth popup / redirect using standard OAuth 2.0 flow | Must Have |
| FR-010 | On successful auth: store session token; redirect to Dashboard | Must Have |
| FR-011 | Persistent session: user remains logged in after browser restart | Should Have |
| FR-012 | Sign Out button in sidebar clears session and redirects to Sign In | Must Have |
| FR-013 | All app pages (Dashboard, Composer, Scheduler, AI Studio, Accounts) require authentication | Must Have |
| FR-014 | Unauthenticated users are redirected to Sign In page | Must Have |
| FR-015 | Signed-in user's name and avatar displayed in sidebar (replaces "FK" static avatar) | Should Have |
| FR-016 | On first successful authentication, any existing anonymous LocalStorage data (posts, accounts) is silently cleared. Authenticated users always begin with an empty, clean dashboard. | Must Have |
| FR-017 | Firebase config object stored in `js/firebase-config.js` (gitignored). A `js/firebase-config.example.js` template with placeholder values is committed to the repo for developer onboarding. | Must Have |
| FR-018 | Email/password sign-up triggers a verification email. User lands on a holding screen ("Check your inbox") and cannot navigate to the dashboard until email is verified. Holding screen includes a "Resend verification email" button. | Must Have |
| FR-019 | If a user attempts OAuth or email sign-up with an email already registered via the other method, display inline error: "An account already exists with this email. Please sign in using [method] instead." Auto-linking not supported in MVP. | Should Have |

---

## 6. Non-Functional Requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-001 | Auth pages load time | < 1 second |
| NFR-002 | Google OAuth redirect response | < 3 seconds |
| NFR-003 | Passwords must never be stored in plain text | Hashed (bcrypt or provider-managed) |
| NFR-004 | Session persistence managed by Firebase SDK internally (IndexedDB/localStorage). No custom token storage implemented. HttpOnly cookies deferred to Phase 2 when Node.js backend is introduced. | Firebase SDK default |
| NFR-005 | All auth communication over HTTPS | Required |
| NFR-006 | No sensitive data in URL query params | Required |

---

## 7. UI / UX Requirements

### 7.1 Sign In Page
- Centered card layout (matches app's dark glassmorphism design)
- Viralify logo + brand name at top
- "Continue with Google" button (primary, with Google icon) — at the top
- Divider: "or continue with email"
- Email input
- Password input (with show/hide toggle)
- "Forgot Password?" link (right-aligned)
- "Sign In" button (full width, purple gradient)
- Footer: "Don't have an account? Sign up"

### 7.2 Sign Up Page
- Same card layout as Sign In
- "Continue with Google" button — at the top
- Divider: "or sign up with email"
- Full Name input
- Email input
- Password input with strength meter
- Confirm Password input
- "Create Account" button (full width, purple gradient)
- Terms of Service checkbox (e.g. "I agree to the Terms of Service")
- Footer: "Already have an account? Sign in"

### 7.3 Forgot Password Page
- Email input
- "Send Reset Link" button
- Success state: "Check your inbox" message with email address shown
- Back to Sign In link

### 7.4 General UX Rules
- All inputs show real-time validation feedback
- Loading spinner on buttons while async operations run
- Error messages appear inline below relevant fields (not toasts)
- Auto-redirect to dashboard if already signed in
- Consistent with existing dark theme (no separate light-mode auth pages)

---

## 8. Technical Design Notes

### 8.1 Recommended Auth Provider
**Firebase Authentication** (recommended for this stage):
- Free tier covers up to 10,000 auth operations/month
- Built-in support for Google OAuth, Email/Password, Email Verification, Password Reset
- JavaScript SDK works with vanilla JS (no framework needed)
- No backend server required for auth
- Tokens managed automatically by Firebase SDK

**Alternative:** Supabase Auth (PostgreSQL-backed, open-source)

### 8.2 Implementation Approach
- Add Firebase SDK via CDN to `index.html`
- Create `js/auth.js` for all auth logic
- Create `auth.html` as a standalone auth page (sign in / sign up / forgot password)
- On app load in `app.js`: check Firebase auth state — if no user, redirect to `auth.html`
- On successful auth: store user in memory + update sidebar UI
- Replace static "FK" avatar in sidebar with real user name + Google photo

### 8.3 Files to Create / Modify
| Action | File | Description |
|---|---|---|
| CREATE | `auth.html` | Standalone auth page (Sign In / Sign Up / Forgot Password views) |
| CREATE | `css/auth.css` | Auth page styles |
| CREATE | `js/auth.js` | Firebase auth logic, form validation, routing |
| MODIFY | `index.html` | Add Firebase SDK script tags |
| MODIFY | `js/app.js` | Add auth state check on init; update sidebar user info |
| MODIFY | `docs/MASTER.md` | Update feature log and change log |

---

## 9. Acceptance Criteria

| ID | Criteria | Test Method |
|---|---|---|
| AC-001 | User can sign up with a valid email and password and is redirected to dashboard | Manual |
| AC-002 | Duplicate email shows error "An account with this email already exists" | Manual |
| AC-003 | Weak password (< 8 chars) blocked with inline error | Manual |
| AC-004 | Verification email sent after sign-up | Manual |
| AC-005 | User can sign in with Google and is redirected to dashboard | Manual |
| AC-006 | User's Google display name and photo appear in sidebar | Manual |
| AC-007 | User can reset password via email link | Manual |
| AC-008 | Unauthenticated user visiting dashboard is redirected to auth page | Manual |
| AC-009 | Signed-in user visiting auth page is redirected to dashboard | Manual |
| AC-010 | Sign Out clears session and redirects to Sign In | Manual |
| AC-011 | Session persists after browser tab is closed and reopened | Manual |
| AC-012 | Password strength meter updates in real-time as the user types (Weak / Fair / Strong / Very Strong) | Manual |
| AC-013 | User's Google display name and photo appear in the sidebar within 2 seconds of successful login | Manual |
| AC-014 | Unverified email user sees the "Check your inbox" holding screen only — cannot navigate to any app page | Manual |
| AC-015 | "Resend verification email" button on holding screen triggers a new email and shows a success toast | Manual |
| AC-016 | First-time sign-in always shows an empty dashboard regardless of any prior anonymous LocalStorage data | Manual |
| AC-017 | `js/firebase-config.js` does not appear in `git status` after creation (confirmed gitignored) | Manual |
| AC-018 | `js/firebase-config.example.js` is present in the committed repo with placeholder values only | Manual |

---

## 10. Dependencies

| Dependency | Type | Notes |
|---|---|---|
| Firebase project setup | External | Needs Firebase Console project with Auth enabled |
| Google Cloud OAuth credentials | External | Created via Firebase Console automatically |
| Internet connection | Runtime | Firebase Auth requires network access |

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Firebase SDK adds page weight | Low | Loaded async; ~80KB gzipped |
| Google OAuth popup blocked by browser | Medium | Fallback to redirect-based flow |
| Users without Google account | Low | Email/Password always available as alternative |
| Firebase free tier limits | Low | 10K ops/month is sufficient for MVP |

---

## 12. Open Questions

| # | Question | Owner | Status | Decision |
|---|---|---|---|---|
| OQ-1 | Should we use Firebase or Supabase as the auth provider? | Farrukh Sheikh | ✅ Closed | **Firebase** — SDK via CDN, works with vanilla JS, free tier sufficient |
| OQ-2 | Should "Remember Me" be on by default or opt-in? | Farrukh Sheikh | ✅ Closed | **Default ON** — persistent session by default, no checkbox needed for MVP |
| OQ-3 | Is email verification mandatory before accessing the app, or optional? | Farrukh Sheikh | ✅ Closed | **Hard gate** — user must verify email before accessing the dashboard. Unverified users see a "Check your inbox" holding screen only. |
| OQ-4 | What happens to existing LocalStorage posts on first sign-in? | Farrukh Sheikh | ✅ Closed | **Fresh start** — authenticated users always begin with an empty dashboard. Anonymous LocalStorage data is not migrated. |
| OQ-5 | How should the Firebase config/API key be handled in a public repo? | Farrukh Sheikh | ✅ Closed | **Gitignored config file** — `js/firebase-config.js` holds real keys (gitignored); `js/firebase-config.example.js` committed as a safe template. |

---

## 13. BA Review Checklist

> Completed by: BA Agent | Date: 2026-07-07

- [~] All user stories have clear acceptance criteria — US-001–016 present; however US-002 (password strength indicator), US-007 (remember me), US-011 (avatar in sidebar), US-016 (name/avatar) lack 1-to-1 mapped ACs in Section 9
- [~] Functional requirements are complete and unambiguous — FR-001–015 are well-formed; FR-010 ambiguously states "store session token" without specifying storage mechanism (contradicts NFR-004 which lists two options)
- [~] Non-functional requirements are measurable — NFR-001/002 have clear targets; NFR-003/004 specify approach but NFR-004 lists two contradictory options (HttpOnly cookies vs localStorage) without resolution
- [x] UI/UX requirements match existing design system — dark glassmorphism, purple gradient CTA, Inter font, inline validation all consistent with MASTER.md §7
- [x] Technical approach is feasible within current stack — Firebase SDK via CDN works with vanilla JS; no framework change required; approach aligns with MASTER.md §2 and §3
- [~] All dependencies identified — Firebase project and OAuth credentials listed; missing: Firebase API key / config object management (where stored? how version-controlled safely?), CORS/authorised domain setup in Firebase Console
- [~] All risks documented with mitigations — 4 risks listed; missing risks: LocalStorage data migration for existing anonymous users, account linking (user tries Google OAuth but already registered with email), rate-limiting / brute-force on email login
- [x] Open questions flagged for stakeholder input — OQ-1, OQ-2, OQ-3 are relevant and correctly owned
- [~] No conflicting requirements detected — Minor conflict: Section 3.1 lists "email verification after sign-up" as in-scope but OQ-3 leaves this as unresolved; FR-005 treats it as Must Have while OQ-3 questions whether it is mandatory — this is a blocking inconsistency
- [~] Feature is achievable within Sprint 2 scope — Core auth is achievable; however OQ-1 (provider selection) and OQ-3 (email verification enforcement) must be resolved before sprint start to avoid mid-sprint rework

---

## 14. BA Review

> **Reviewer Role:** Business Analyst (BA Agent)
> **Review Date:** 2026-07-07
> **BRD Version Reviewed:** Last Updated 2026-07-07
> **Verdict:** ⚠️ **Approved with Changes**

---

### 14.1 Executive Summary

F001 is a well-structured BRD that covers the core authentication use cases (email/password, Google OAuth, password reset, session management, and route protection) with sufficient detail to begin implementation. The user story coverage is solid and the technical approach — Firebase Authentication via CDN — is appropriate for the current vanilla-JS stack. However, three blocking issues must be resolved before sprint start: an open-question–vs–requirement conflict around email verification enforcement (OQ-3 vs FR-005), an unresolved contradiction in session token storage (NFR-004), and the absence of a data migration strategy for existing anonymous LocalStorage users.

---

### 14.2 Findings by Section

#### Section 4 — User Stories

| Finding | Severity | Detail |
|---|---|---|
| GAP-001 | Medium | US-002, US-007, US-011, US-016 have no corresponding Acceptance Criteria in §9. Stories are defined but untestable without ACs. |
| GAP-002 | Low | No user story covers the **account-linking edge case**: a user who first signs up via email and later clicks "Continue with Google" with the same address (or vice versa). Firebase handles this at the SDK level but the UX response (error vs. auto-link) is undefined. |
| GAP-003 | Low | No user story addresses what happens when a user attempts sign-up with an **already-verified Google email** that was previously used for email/password sign-up (and vice versa). |

#### Section 5 — Functional Requirements

| Finding | Severity | Detail |
|---|---|---|
| CONF-001 | High | **FR-010** says "store session token" but does not specify *where*. This creates ambiguity for the implementer and directly conflicts with **NFR-004** which lists two options (HttpOnly cookies OR secure localStorage) without resolution. Firebase Auth with CDN uses `indexedDB`/`localStorage` internally — this must be explicitly acknowledged or NFR-004 must be updated. |
| GAP-004 | Medium | No functional requirement covers **rate-limiting / brute-force protection** on the email sign-in form (e.g., lock after N failed attempts). Even if Firebase handles this server-side, the UI behaviour (error message, lock duration) is unspecified. |
| GAP-005 | Medium | No functional requirement covers **LocalStorage data migration**: the existing app writes posts and account data to localStorage under an anonymous session. When a user authenticates for the first time, what happens to that data? Silently lost? Migrated to their account? This is a user-experience breaking gap. |
| GAP-006 | Low | FR-002 specifies password rules (8 chars, 1 uppercase, 1 number, 1 special char) but the **error messages for each failing rule** are not specified. Acceptance Criteria AC-003 only checks the 8-char case. |

#### Section 6 — Non-Functional Requirements

| Finding | Severity | Detail |
|---|---|---|
| CONF-002 | High | **NFR-004** lists two mutually exclusive storage approaches: HttpOnly cookies and secure localStorage. These have fundamentally different security profiles. Since the app uses vanilla JS with Firebase CDN (no server-side for Phase 1), HttpOnly cookies are **not implementable** without a backend. The correct answer is secure localStorage (Firebase SDK default). NFR-004 must be resolved. |
| GAP-007 | Medium | No NFR for **session expiry timeout**. How long does a persistent session last? 7 days? 30 days? Indefinitely? Firebase default is ~1 hour for ID tokens with auto-refresh. This must be specified, especially given OQ-2 (Remember Me). |
| GAP-008 | Low | No NFR covers **accessibility (a11y)** — WCAG compliance level is unspecified. Auth pages (forms, error messages) are a common a11y failure point. |

#### Section 7 — UI/UX Requirements

| Finding | Severity | Detail |
|---|---|---|
| GAP-009 | Low | **Terms of Service checkbox** is mentioned in §7.2 but there is no corresponding FR, no AC, and no reference to where the ToS document lives. If the checkbox is a legal requirement, it must have an FR (Must Have) and an AC. |
| GAP-010 | Low | The **"Check your inbox" screen** after sign-up (§7 / FR-005) has no defined **resend verification email** affordance. Users who don't receive the email have no self-service recovery path described. |
| NOTE | Info | §7.4 correctly specifies inline error messages (not toasts) — this is consistent with the existing app's toast notification pattern and avoids conflict. ✅ |

#### Section 8 — Technical Design

| Finding | Severity | Detail |
|---|---|---|
| GAP-011 | High | **Firebase config object** (API key, authDomain, projectId, etc.) is not addressed. Hardcoding it in `auth.js` risks committing secrets to the public GitHub repo. The BRD must specify the secret management approach (e.g., `.env` not committed, config file in `.gitignore`, or environment variable injection). |
| GAP-012 | Medium | **Firebase Authorised Domains** in the Firebase Console must include the app's deployed domain (Vercel/Netlify URL) AND `localhost` for dev. This is a one-time setup step with no documentation — a developer doing this blind will hit an OAuth blocked-domain error. It should be in §10 Dependencies. |
| GAP-013 | Low | The approach mentions `auth.html` as standalone but §8.2 adds the Firebase SDK to `index.html`. If `auth.html` is a *separate* HTML file, it needs its **own Firebase SDK inclusion** — this is not noted and could lead to a broken auth page on first implementation. |

#### Section 9 — Acceptance Criteria

| Finding | Severity | Detail |
|---|---|---|
| GAP-014 | Medium | All 11 ACs use **"Manual"** test method. For a production auth feature, at least the core flows (AC-001, AC-008, AC-010) should specify automation-ready criteria (e.g., Playwright/Cypress script names) or explicitly note the test automation plan for Sprint 3+. |
| GAP-015 | Medium | **AC-003** only tests the 8-char rule. The other password rules from FR-002 (uppercase, number, special char) have no corresponding ACs — these requirements are functionally untestable as written. |
| GAP-016 | Low | **AC-004** (verification email sent) has no way to validate receipt without a test email account setup. The test method should reference a test email environment (e.g., Mailtrap, Firebase Emulator). |
| MISS-001 | Medium | No AC for the **Terms of Service checkbox** (referenced in §7.2) — no test that sign-up is blocked if ToS is not accepted. |
| MISS-002 | Low | No AC for the **password strength meter** (FR-003 / US-002). |
| MISS-003 | Low | No AC for **resend verification email**. |

#### Section 10 — Dependencies

| Finding | Severity | Detail |
|---|---|---|
| GAP-017 | High | Missing dependency: **Firebase config secrets management** — no `.gitignore` entry, no environment variable strategy. |
| GAP-018 | Medium | Missing dependency: **Firebase Authorised Domains** configuration in Firebase Console. |
| GAP-019 | Low | Missing dependency: **Firebase Emulator Suite** or equivalent test email service (for local development and verifying email flows without spamming real inboxes). |

#### Section 11 — Risks

| Finding | Severity | Detail |
|---|---|---|
| RISK-GAP-001 | High | Missing risk: **LocalStorage data loss on first auth**. Existing anonymous users' posts/accounts will be inaccessible post-login. No mitigation strategy exists. |
| RISK-GAP-002 | Medium | Missing risk: **Account linking conflict** (same email registered via two methods). Firebase throws a specific error (`auth/account-exists-with-different-credential`). No UX response defined. |
| RISK-GAP-003 | Medium | Missing risk: **Brute-force / credential stuffing** on email sign-in. Mitigation (Firebase's built-in protection + UI lockout UX) should be specified. |

#### Section 12 — Open Questions

| Finding | Severity | Detail |
|---|---|---|
| CONF-003 | High | **OQ-3** (is email verification mandatory?) directly contradicts **FR-005** which is marked Must Have and **§3.1** which lists it as In Scope. If OQ-3 is still open, FR-005's priority must be downgraded to TBD, or OQ-3 must be closed before sprint start. This is the most critical blocking inconsistency. |
| NOTE | Info | OQ-1 (Firebase vs Supabase) should be resolved by sprint planning. The BRD is written assuming Firebase — if Supabase is chosen, §8 must be rewritten substantially. |

---

### 14.3 Gap Analysis

| # | Gap | Severity | Blocking? |
|---|---|---|---|
| GAP-001 | US-002/007/011/016 have no mapped Acceptance Criteria | Medium | No |
| GAP-002 | Account-linking edge case undefined | Low | No |
| GAP-003 | Duplicate identity (OAuth + email same address) UX undefined | Low | No |
| GAP-004 | No FR for brute-force / rate-limit UI behaviour | Medium | No |
| GAP-005 | No LocalStorage data migration strategy for existing anonymous users | **High** | **Yes** |
| GAP-006 | Individual password rule error messages not specified | Low | No |
| GAP-007 | Session expiry/timeout duration not specified | Medium | No |
| GAP-008 | Accessibility (a11y / WCAG) level not specified | Low | No |
| GAP-009 | ToS checkbox has no FR, no AC, no document link | Low | No |
| GAP-010 | No resend verification email affordance specified | Low | No |
| GAP-011 | Firebase config secret management not addressed | **High** | **Yes** |
| GAP-012 | Firebase Authorised Domains setup not documented | Medium | **Yes** |
| GAP-013 | `auth.html` needs its own Firebase SDK inclusion — not noted | Low | No |
| GAP-014 | All ACs are manual-only; no automation plan | Medium | No |
| GAP-015 | AC-003 covers only 1 of 4 password rules from FR-002 | Medium | No |
| GAP-016 | AC-004 lacks test email environment reference | Low | No |
| CONF-001 | FR-010 vs NFR-004: session storage mechanism conflict | **High** | **Yes** |
| CONF-002 | NFR-004: HttpOnly cookies not implementable without backend | **High** | **Yes** |
| CONF-003 | OQ-3 open but FR-005 is Must Have — blocking inconsistency | **High** | **Yes** |

**Blocking gaps: 5 | High severity: 5 | Medium: 6 | Low: 8**

---

### 14.4 Recommendations

#### REC-001 ✅ (Critical) — Resolve CONF-003 before sprint start
Close OQ-3 by deciding whether email verification is mandatory. If mandatory: FR-005 stays Must Have, and a **verification gate** must be added (user cannot access dashboard until verified). If optional: downgrade FR-005 to Should Have and add a soft reminder banner post-login. Either way, update Section 3.1, Section 5, and Section 9 accordingly.

#### REC-002 ✅ (Critical) — Define Firebase config secret management strategy
Add a new §8.4 specifying: (a) `js/firebase-config.js` created from a `.env`-style template, (b) `firebase-config.js` added to `.gitignore`, (c) a `firebase-config.example.js` committed as documentation. Without this, the Firebase API key will be committed to the public GitHub repo (`https://github.com/farshk/Socialposting`), creating a security vulnerability.

#### REC-003 ✅ (Critical) — Add LocalStorage migration strategy
Add FR-016: "On first successful authentication, the system must detect any existing LocalStorage data (posts, connected accounts) and either (a) migrate it to the authenticated user's session, or (b) present the user with a choice to import or discard it." This prevents the existing user base (even if small/test) from losing all their data on upgrade, and prevents a confusing empty-dashboard experience.

#### REC-004 (High) — Resolve NFR-004 storage conflict
Update NFR-004 to: "Session persistence managed by Firebase SDK (uses IndexedDB/localStorage internally). No custom session token storage will be implemented. HttpOnly cookies are deferred to Phase 2 when a Node.js backend is introduced (per MASTER.md §2 roadmap)." This removes the contradiction and aligns with the technical reality.

#### REC-005 (High) — Add missing Acceptance Criteria for US-002/007/011/016
Add the following ACs to Section 9:
- **AC-012:** Password strength meter updates in real-time as the user types (Weak → Strong progression)
- **AC-013:** "Remember Me" behaviour is consistent with OQ-2 resolution
- **AC-014:** User's name and avatar from Google profile appear in sidebar within 2 seconds of login
- **AC-015:** Form submission blocked if ToS checkbox is unchecked (with inline error)

#### REC-006 (Medium) — Add Firebase Authorised Domains to §10 Dependencies
Add dependency: "Firebase Console → Authentication → Settings → Authorised Domains must include `localhost` (for dev) and the production domain (Vercel/Netlify URL, to be confirmed). Missing this will cause OAuth flows to fail silently in production." This prevents a common first-deployment failure.

#### REC-007 (Medium) — Specify account-linking UX
Add FR-016 (or update §11 Risks): When `auth/account-exists-with-different-credential` is returned by Firebase, the UI must display: "An account already exists with this email. Please sign in using [original method] to link your accounts." Define whether account auto-linking is supported.

#### REC-008 (Low) — Add session expiry NFR
Add **NFR-007:** "Persistent sessions (when Remember Me is enabled) shall expire after [X] days. Non-persistent sessions shall expire when the browser tab is closed." Resolve this alongside OQ-2.

---

### 14.5 Verdict

## ⚠️ Approved with Changes

F001 demonstrates strong intent, clear scope, and a technically sound approach. The core auth flows are well-documented and the proposed Firebase implementation is the right choice for the current vanilla-JS stack. However, **5 blocking issues** must be resolved before implementation begins:

1. **CONF-003** — OQ-3 vs FR-005 conflict on email verification must be closed
2. **GAP-011** — Firebase config secret management must be specified to protect the public GitHub repo
3. **GAP-005** — LocalStorage data migration strategy must be defined to prevent data loss
4. **CONF-001/CONF-002** — NFR-004 session storage conflict must be resolved
5. **GAP-012** — Firebase Authorised Domains dependency must be documented

Once these 5 items are addressed (estimated: 1–2 hours of BRD updates), the feature is **ready for implementation**. The remaining medium/low gaps (AC coverage, a11y, account linking UX) are acceptable as post-sprint backlog items provided they are tracked.
