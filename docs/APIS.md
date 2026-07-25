# Viralify — API Directory & Interface Catalog

> **Maintained by:** Antigravity AI Agents
> **Last Updated:** 2026-07-19
> **Parent Doc:** [MASTER.md](./MASTER.md)

This directory serves as the catalog of all modules, APIs, and data interfaces available in the Viralify project. Before implementing any new feature, **always consult this document** to check if a helper, service, or interface already exists to avoid redundant code.

---

## 1. Directory Map

```
/Users/farrukhsheikh/Projects/socialposting/js/
├── platforms.js     — Platform rules, limits, and configurations
├── data.js          — LocalStorage persistent state CRUD API
├── auth.js          — Firebase Authentication operations
├── ai-generator.js  — Smart title, description, and hashtag templates
└── scheduler.js     — Calendar, scheduling, and best posting times
```

---

## 2. Authentication API (`js/auth.js`)

Manages Firebase authentication sessions and user identity state.

### `signUpWithEmail(name, email, password)`
* **Description:** Registers a new user account with Firebase, sets their display name, sends a verification email, and clears any previous anonymous session data.
* **Arguments:**
  * `name` (string) — Full name of the user
  * `email` (string) — Target email address
  * `password` (string) — Password (must meet minimum complexity rules)
* **Returns:** `Promise<{ success: boolean, user?: firebase.User, error?: string }>`

### `signInWithEmail(email, password)`
* **Description:** Authenticates an existing user using email/password.
* **Arguments:**
  * `email` (string) — User account email
  * `password` (string) — User account password
* **Returns:** `Promise<{ success: boolean, user?: firebase.User, error?: string }>`

### `signInWithGoogle()`
* **Description:** Starts a Google OAuth popup login flow. Clears anonymous session data on first sign-in.
* **Returns:** `Promise<{ success: boolean, user?: firebase.User, error?: string }>`

### `sendPasswordReset(email)`
* **Description:** Sends a password recovery email.
* **Arguments:**
  * `email` (string)
* **Returns:** `Promise<{ success: boolean, error?: string }>`

### `resendVerification()`
* **Description:** Re-sends the verification email to the currently registered (but unverified) user.
* **Returns:** `Promise<{ success: boolean, error?: string }>`

### `doSignOut()`
* **Description:** Ends the active Firebase user session and reloads the current page (triggering redirect to login).

---

## 3. Data & Storage API (`js/data.js` -> `Data`)

Handles LocalStorage operations, CRUD for posts, and Mock Social Media account connections.

### `Data.init()`
* **Description:** Initializes default mock posts and accounts in the browser's LocalStorage if none exist.
* **Returns:** `void`

### `Data.getPosts(filterStatus)`
* **Description:** Retrieves posts from LocalStorage, optionally filtered by status.
* **Arguments:**
  * `filterStatus` (string | null) — `'published'`, `'scheduled'`, `'draft'`, or `null` (returns all)
* **Returns:** `Array<Post>`

### `Data.getPostById(id)`
* **Description:** Retrieves a single post matching the provided ID.
* **Arguments:**
  * `id` (string) — The post ID (e.g. `'p1'`)
* **Returns:** `Post | null`

### `Data.savePost(postData)`
* **Description:** Saves a new post or updates an existing post in LocalStorage.
* **Arguments:**
  * `postData` (object) — Full post properties (must include `title`, `description`, `platforms`, etc.)
* **Returns:** `Post` (the saved post object containing a generated unique `id` if new)

### `Data.deletePost(id)`
* **Description:** Deletes a post matching the provided ID.
* **Arguments:**
  * `id` (string)
* **Returns:** `boolean` (true if deleted, false if not found)

### `Data.getAccounts()`
* **Description:** Retrieves connection state, follower counts, and username metadata for all 9 social media platforms.
* **Returns:** `Array<Account>`

### `Data.connectAccount(platformId, username)`
* **Description:** Connects (mocks OAuth link for) a social media platform.
* **Arguments:**
  * `platformId` (string) — e.g. `'youtube'`, `'tiktok'`
  * `username` (string) — Account handle (e.g. `'@mychannel'`)
* **Returns:** `Account`

### `Data.disconnectAccount(platformId)`
* **Description:** Disconnects a platform and resets connection statistics.
* **Arguments:**
  * `platformId` (string)
* **Returns:** `Account`

### `Data.getPostHistoryByPlatform(platformId)`
* **Description:** Gets all posts (any status) associated with a specific platform.
* **Arguments:**
  * `platformId` (string)
* **Returns:** `Array<Post>`

---

## 4. AI Content Generator API (`js/ai-generator.js` -> `AIGenerator`)

Local rule-based generator for titles, descriptions, and hashtags. Designed to support instant suggestions without API latency or key requirements.

### `AIGenerator.generateTitle(topic, keywords)`
* **Description:** Generates 4 catchy video title suggestions matching a topic and keywords.
* **Arguments:**
  * `topic` (string)
  * `keywords` (string)
* **Returns:** `Array<string>` (4 title suggestions)

### `AIGenerator.generateDescription(topic, keywords, tone)`
* **Description:** Generates a structured multi-paragraph description.
* **Arguments:**
  * `topic` (string)
  * `keywords` (string)
  * `tone` (string) — `'engaging'`, `'professional'`, `'funny'`, `'inspirational'`, `'educational'`
* **Returns:** `string`

### `AIGenerator.generateHashtags(topic, keywords, count)`
* **Description:** Generates an array of platform-optimized hashtags.
* **Arguments:**
  * `topic` (string)
  * `keywords` (string)
  * `count` (number) — Target count of hashtags (clamped 5–30)
* **Returns:** `Array<string>`

### `AIGenerator.generateContent(topic, keywords, tone, platform, options)`
* **Description:** Combines titles, description, and hashtags generation optimized for a specific social media platform's limits and format.
* **Arguments:**
  * `topic` (string)
  * `keywords` (string)
  * `tone` (string)
  * `platform` (string)
  * `options` (object) — e.g. `{ titleCount, hashtagCount }`
* **Returns:** `{ titles: Array<string>, description: string, hashtags: Array<string>, tips: Array<string> }`

---

## 5. Platforms & Rule Verification API (`js/platforms.js` -> `Platforms`)

A configuration catalog defining limitations (character count, video duration, and media layout rules) for the 9 platforms.

### `Platforms.get(platformId)`
* **Description:** Retrieves rules metadata for a specific platform.
* **Arguments:**
  * `platformId` (string) — e.g. `'youtube'`
* **Returns:** `PlatformConfig`

### Platform Configuration Schema Reference
```json
{
  "id": "youtube",
  "name": "YouTube",
  "icon": "fab fa-youtube",
  "color": "#ff0000",
  "maxDuration": 43200,      // in seconds (12 hours)
  "bestAspectRatio": "16:9",
  "maxTitleLength": 100,
  "maxDescLength": 5000,
  "maxHashtags": 15,
  "bestTime": "15:00"        // local peak engagement time
}
```

---

## 6. Scheduler & Calendar API (`js/scheduler.js` -> `Calendar`)

Controls frontend calendar rendering, monthly date tracking, and optimal posting times.

### `Calendar.init()`
* **Description:** Renders the main scheduler layout, sets up date navigation event click handlers, and draws the default month grid.
* **Returns:** `void`

### `Calendar.renderMonth(year, month)`
* **Description:** Renders the grid block of a specific month. Dots indicating posts are overlaid on corresponding dates.
* **Arguments:**
  * `year` (number)
  * `month` (number) — 0-indexed (0 = Jan, 11 = Dec)
* **Returns:** `void`

### `Calendar.getPostsForDate(dateString)`
* **Description:** Gets posts scheduled on a specific local date string (`YYYY-MM-DD`).
* **Arguments:**
  * `dateString` (string)
* **Returns:** `Array<Post>`

---

## 7. App Controller & Router (`js/app.js` -> `App`)

The central app execution shell, controls UI page routing and global modal triggers.

### `App.init()`
* **Description:** Entry point of the application shell. Triggers Firebase Auth checks, initializes data store, renders the sidebar, and navigates to the default view.
* **Returns:** `Promise<void>`

### `App.navigate(page)`
* **Description:** Hides current views and displays the requested layout page.
* **Arguments:**
  * `page` (string) — `'dashboard'`, `'composer'`, `'scheduler'`, `'ai-studio'`, `'accounts'`
* **Returns:** `void`

### `App.toast(message, type, duration)`
* **Description:** Renders a floating visual toast notification.
* **Arguments:**
  * `message` (string)
  * `type` (string) — `'success'`, `'error'`, `'info'`
  * `duration` (number) — Display time in milliseconds (defaults to 3500)
* **Returns:** `void`

---

## 8. YouTube Backend API (`server/routes/youtube.js`)

Provides OAuth 2.0 and upload capabilities for YouTube via a Node.js Express server.

### `GET /api/youtube/auth`
* **Description:** Generates Google OAuth 2.0 authorization URL.
* **Auth Requirement:** Requires Firebase ID Token in `Authorization: Bearer <token>` header.
* **Returns:** `{ success: true, authUrl: string }`

### `GET /api/youtube/callback`
* **Description:** OAuth callback endpoint. Exchanges authorization code for tokens and saves them to Firestore. Redirects to frontend.
* **Auth Requirement:** None (Google redirects here).
* **Returns:** `Redirects to ${FRONTEND_URL}/index.html?platform=youtube&status=connected|error`

### `GET /api/youtube/status`
* **Description:** Checks if the user is connected to YouTube. Returns channel info and scopes if connected.
* **Auth Requirement:** Requires Firebase ID Token.
* **Returns:** `{ success: true, connected: boolean, channelName?: string, channelId?: string, scope?: string }`

### `POST /api/youtube/refresh`
* **Description:** Explicitly refreshes the YouTube access token using the refresh token stored in Firestore.
* **Auth Requirement:** Requires Firebase ID Token.
* **Returns:** `{ success: true }`

### `DELETE /api/youtube/disconnect`
* **Description:** Revokes the Google OAuth token and deletes tokens from Firestore.
* **Auth Requirement:** Requires Firebase ID Token.
* **Returns:** `{ success: true }`

### `POST /api/youtube/upload`
* **Description:** Initiates a resumable upload from a Firebase Storage URL to YouTube Data API v3.
* **Auth Requirement:** Requires Firebase ID Token.
* **Request Body:** `{ firebaseStorageUrl: string, title: string, description: string, tags: string[], privacyStatus: string }`
* **Returns:** `{ success: true, videoId: string, videoUrl: string }`

### `GET /api/youtube/metrics`
* **Description:** Fetches real channel statistics (subscribers, videos, views). Caches results in Firestore with 1-hour TTL.
* **Auth Requirement:** Requires Firebase ID Token.
* **Returns:** `{ success: true, subscriberCount: number, videoCount: number, viewCount: number, channelName: string, avatarUrl: string, cached: boolean }`

### `GET /api/youtube/posts`
* **Description:** Fetches recent uploaded videos directly from the user's YouTube uploads playlist.
* **Auth Requirement:** Requires Firebase ID Token.
* **Returns:** `{ success: true, posts: Array<{ id: string, title: string, description: string, publishedAt: string, thumbnail: string, videoUrl: string, platformId: string }> }`

### `GET /api/jobs/:jobId/status`
* **Description:** Stub endpoint for future async processing tracking.
* **Auth Requirement:** Requires Firebase ID Token.
* **Returns:** `{ success: true, jobId: string, status: string, platform: string }`
