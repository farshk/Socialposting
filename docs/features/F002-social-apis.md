# F002 — Real Social Media API Integrations
## Business Requirements Document (BRD)

> **Feature ID:** F002
> **Status:** 🔵 In Requirements
> **Author:** BA Agent
> **Sprint:** Sprint 3
> **Parent Doc:** [MASTER.md](../MASTER.md)
> **Last Updated:** 2026-07-19

---

## 1. Overview

Currently, Viralify uses mock data to simulate platform connections and post publishing. This feature replaces those mocks with real social media API integrations for 7 major platforms: YouTube, Instagram, TikTok, Facebook, X (Twitter), Pinterest, and LinkedIn. 

This enables the core business value of Viralify: allowing content creators to securely connect their social media accounts and seamlessly publish or schedule video content across multiple platforms simultaneously from a single interface. 

Why these 7 platforms matter:
- **YouTube:** The primary long-form and short-form (Shorts) video destination.
- **Instagram:** Critical for Reels and influencer reach.
- **TikTok:** The leading short-form vertical video platform.
- **Facebook:** Massive legacy audience with strong video and page engagement.
- **X (Twitter):** Real-time engagement and news-cycle relevance.
- **Pinterest:** High-intent visual discovery and long-tail traffic for video pins.
- **LinkedIn:** B2B networking and professional content distribution.

---

## 2. Scope

### 2.1 In Scope
- OAuth 2.0 connection flows for the 7 target platforms.
- Secure token storage and management (refreshing tokens, detecting expiry).
- Platform disconnection and token revocation.
- Temporary video hosting via Firebase Storage to generate public URLs (required for YouTube, TikTok, Pinterest).
- Video upload APIs (chunked uploads, resumable uploads where supported).
- Publishing posts (titles, descriptions, hashtags, video media) to the connected platforms.
- Post status tracking (success, failed, rate-limited) and error handling.
- Node.js + Express backend to act as an OAuth proxy and securely hold `client_secret` credentials.

### 2.2 Out of Scope
- Paid analytics APIs or deep historical performance metrics.
- Algorithmic scheduling or AI best-time-to-post prediction APIs (using static rules for now).
- Integrations for Snapchat and Threads (deferred to future sprints).
- Managing comments, replies, or direct messages through Viralify.
- Account-level automated interactions (auto-like, auto-follow).

---

## 3. User Stories

### 3.1 YouTube
| ID | As a... | I want to... | So that... |
|---|---|---|---|
| US-001 | Creator | Connect my YouTube channel via OAuth | Viralify can publish videos on my behalf |
| US-002 | Creator | Upload and publish a video as a YouTube Short | I can reach mobile viewers with vertical content |

### 3.2 Instagram
| ID | As a... | I want to... | So that... |
|---|---|---|---|
| US-003 | Creator | Connect my Instagram Professional/Creator account | I can manage my Instagram presence from Viralify |
| US-004 | Creator | Publish a video as an Instagram Reel | I can engage my followers with short-form video |

### 3.3 TikTok
| ID | As a... | I want to... | So that... |
|---|---|---|---|
| US-005 | Creator | Authorize Viralify to access my TikTok account | I can bypass manual uploads on the TikTok app |
| US-006 | Creator | Publish vertical videos directly to my TikTok feed | I can capitalize on TikTok trends efficiently |

### 3.4 Facebook
| ID | As a... | I want to... | So that... |
|---|---|---|---|
| US-007 | Social Media Manager | Connect a specific Facebook Page I manage | I can post official content for my brand |
| US-008 | Social Media Manager | Upload video posts to my Facebook Page | My Page followers see new video content |

### 3.5 X (Twitter)
| ID | As a... | I want to... | So that... |
|---|---|---|---|
| US-009 | Creator | Connect my X (Twitter) account | I can share video snippets with my followers |
| US-010 | Creator | Publish media tweets with text and video | I can participate in real-time conversations |

### 3.6 Pinterest
| ID | As a... | I want to... | So that... |
|---|---|---|---|
| US-011 | Creator | Connect my Pinterest Business account | I can create video pins |
| US-012 | Creator | Select a Pinterest Board and publish a video pin | I can drive long-term traffic to my content |

### 3.7 LinkedIn
| ID | As a... | I want to... | So that... |
|---|---|---|---|
| US-013 | Professional | Connect my LinkedIn profile or company page | I can share thought leadership content |
| US-014 | Professional | Publish native video posts to my LinkedIn feed | I can engage my professional network |

---

## 4. Functional Requirements

### 4.1 Platform OAuth Connection
| ID | Requirement | Priority |
|---|---|---|
| FR-001 | System must implement YouTube (Google) OAuth 2.0 flow, requesting YouTube Data API v3 upload scopes. | Must Have |
| FR-002 | System must implement Instagram Graph API OAuth flow for Professional/Creator accounts. | Must Have |
| FR-003 | System must implement TikTok Direct Post API OAuth flow. | Must Have |
| FR-004 | System must implement Facebook Graph API OAuth flow to retrieve Page Access Tokens, requesting `pages_manage_posts`, `pages_read_engagement`, and `pages_show_list` scopes. | Must Have |
| FR-005 | System must implement X (Twitter) OAuth 2.0 (PKCE) flow. | Must Have |
| FR-006 | System must implement Pinterest API v5 OAuth flow. | Must Have |
| FR-007 | System must implement LinkedIn API v2 OAuth flow with both `w_member_social` (personal profiles) and `w_organization_social` (company pages) scopes. | Must Have |

### 4.2 Token Management
| ID | Requirement | Priority |
|---|---|---|
| FR-008 | Node.js backend must handle all token exchanges; `client_secret` must never be exposed to the frontend. | Critical |
| FR-009 | Access tokens and refresh tokens must be stored securely (encrypted if in database, or secure HTTP-only sessions). | Critical |
| FR-010 | Backend must automatically use refresh tokens to obtain new access tokens before API calls if the current token is expired. | Must Have |
| FR-011 | If a refresh token is invalid or expired (e.g. revoked by user), the system must prompt the user to re-authenticate the platform. | Must Have |
| FR-012 | Users must be able to disconnect a platform, which deletes the tokens from the backend and revokes them on the platform. | Must Have |
| FR-013 | The frontend Accounts view must show real connection status based on token validity, replacing mock state. | Must Have |
| FR-014 | Backend must associate OAuth tokens with the authenticated Firebase User ID. | Must Have |

### 4.3 Media Upload Flows
| ID | Requirement | Priority |
|---|---|---|
| FR-015 | For platforms requiring public video URLs (YouTube, TikTok, Pinterest), the frontend must first upload the video to Firebase Storage. | Must Have |
| FR-016 | System must generate a temporary signed/public URL from Firebase Storage to pass to platform APIs. | Must Have |
| FR-017 | Regardless of publish success or failure, the system must automatically clean up the temporary video file from Firebase Storage. A maximum 24-hour Time-to-Live (TTL) or daily clean up script must guarantee no stray files persist. | Should Have |
| FR-018 | For platforms requiring direct upload (X, Facebook, LinkedIn, Instagram), the backend must support streaming or chunked uploads from the client to the platform API. | Must Have |
| FR-019 | System must validate video MIME types (e.g., `video/mp4`, `video/quicktime`) before upload. | Must Have |
| FR-020 | System must enforce platform-specific maximum file size limits during the upload phase. | Must Have |
| FR-021 | The frontend must display an overall upload progress bar when transferring media. | Must Have |

### 4.4 Post Publishing & Status Tracking
| ID | Requirement | Priority |
|---|---|---|
| FR-022 | Backend must accept a uniform payload (video URL/buffer, title, description, platforms) and orchestrate API calls to all selected platforms. | Must Have |
| FR-023 | System must capture the platform-specific post ID returned by each API upon successful publication. | Must Have |
| FR-024 | If a post fails on one platform but succeeds on others, the system must record partial success and clearly show which platform failed with the error message. | Must Have |
| FR-025 | Published posts in the Dashboard must link directly to the live post on the respective platform using the returned post ID. | Should Have |
| FR-026 | Backend must implement retry policies with exponential backoff for transient errors (5xx, timeouts) up to 3 retries, distinguishing rate-limited (retryable) from quota-exceeded (fatal) states. | Must Have |
| FR-027 | Backend must handle long-running uploads asynchronously (e.g. respond with a job ID and run execution in a worker queue) to avoid HTTP timeout limits on serverless environments. | Must Have |

### 4.5 Channel Metrics & Viewer
| ID | Requirement | Priority |
|---|---|---|
| FR-028 | System must fetch real channel statistics (subscriber count, video count, channel name, avatar) via YouTube Data API v3 and display them on the Accounts card instead of mock data. | Must Have |
| FR-029 | The "View Posts" modal must fetch recent uploaded videos from YouTube API (or Firestore) displaying titles, published dates, view counts, and direct video links. | Must Have |
| FR-030 | System must cache channel metrics in Firestore with a 1-hour TTL to prevent unnecessary YouTube API quota consumption on page refresh. | Must Have |

### 4.6 New Post Publishing & Video Upload
| ID | Requirement | Priority |
|---|---|---|
| FR-031 | **Composer Real Post Submission:** System must wire the Composer "Publish Now" button to collect video file, title, description, tags, privacy setting (public/unlisted/private), and selected target platforms (e.g. YouTube), triggering real publishing instead of mock timers. | Must Have |
| FR-032 | **Firebase Storage Media Bridge & Progress:** System must upload the selected video file from browser to Firebase Storage (`temp_uploads/{uid}/{timestamp}_{filename}`), track percentage upload progress, and obtain a download URL for API ingestion. | Must Have |
| FR-033 | **YouTube Resumable Video Upload:** Backend must route video URL + metadata to YouTube Data API v3 resumable upload protocol (`uploadType=resumable`), handle 3-step initiation, stream piping, and return `videoId` and `videoUrl`. | Must Have |
| FR-034 | **Post History Persistence & Dashboard Sync:** System must store successful post records in Firestore & LocalStorage with returned platform post IDs, update the Dashboard post table, and display direct Watch links. | Must Have |
| FR-035 | **Post-Publication Storage Cleanup:** System must automatically delete the temporary video file from Firebase Storage once API ingestion succeeds or after a 24-hour cleanup window. | Must Have |

### 4.7 Meta Integration (Facebook & Instagram)
| ID | Requirement | Priority |
|---|---|---|
| FR-036 | **Meta OAuth:** Implement Short-to-Long-Lived Exchange (`fb_exchange_token`) & Page Enumeration (`GET /me/accounts`). | Must Have |
| FR-037 | **Facebook Token:** Persist Page Access Token and implement Selection state management in Firestore (`users/{uid}/platforms/facebook`). | Must Have |
| FR-038 | **Instagram Linking:** Implement Instagram Creator/Business Account Linking via `GET /{page_id}?fields=instagram_business_account`. | Must Have |
| FR-039 | **IG Reels:** Implement Instagram Reel 3-Step Pipeline: Container Creation, Status Polling, and Media Publishing. | Must Have |
| FR-040 | **FB Video:** Implement Facebook Page Video Publishing, Resumable/Chunked Upload, and extract permalink URL. | Must Have |

### 4.8 TikTok Integration
| ID | Requirement | Priority |
|---|---|---|
| FR-041 | **TikTok OAuth:** Implement TikTok PKCE OAuth flow and Refresh Token Rotation. | Must Have |
| FR-042 | **TikTok Video:** Implement TikTok Direct Video Post 4-Step Publishing Pipeline (Init, Upload, Settings, Polling). | Must Have |
| FR-043 | **TikTok Content Controls:** Implement Privacy Settings & Content Control Toggles (`privacy_level`, `disable_comment`, `disable_duet`, `disable_stitch`, `brand_content_toggle`). | Must Have |

### 4.9 Meta & TikTok Channel Metrics & Recent Posts
| ID | Requirement | Priority |
|---|---|---|
| FR-044 | **Metrics Caching:** Meta Graph API & TikTok API Channel Metrics Caching (1-hour TTL in Firestore). | Must Have |
| FR-045 | **Recent Posts:** Meta & TikTok Recent Posts Listing Modal integration. | Must Have |

---

## 5. Acceptance Criteria

| ID | Criteria (Given/When/Then) | Validates |
|---|---|---|
| AC-001 | GIVEN a user wants to connect YouTube, WHEN they click Connect, THEN they are redirected to Google OAuth and return with a connected status. | FR-001 |
| AC-002 | GIVEN a user connects Instagram, WHEN they complete OAuth, THEN their Professional account is linked. | FR-002 |
| AC-003 | GIVEN a user connects TikTok, WHEN authorized, THEN Viralify receives publishing scopes. | FR-003 |
| AC-004 | GIVEN a user connects Facebook, WHEN authorized, THEN they can select which Page to connect from the page list. | FR-004 |
| AC-005 | GIVEN a user connects X, WHEN authorized via PKCE, THEN their connection is saved. | FR-005 |
| AC-006 | GIVEN a user connects Pinterest, WHEN authorized, THEN they can fetch their boards. | FR-006 |
| AC-007 | GIVEN a user connects LinkedIn Company Page, WHEN authorized, THEN their profile is ready for organization publishing. | FR-007 |
| AC-008 | GIVEN an expired access token, WHEN a publish request is made, THEN the backend transparently refreshes the token. | FR-010 |
| AC-009 | GIVEN a revoked access token, WHEN a publish request fails, THEN the UI shows a "Reconnect Required" state. | FR-011 |
| AC-010 | GIVEN a user clicks Disconnect for a platform, WHEN confirmed, THEN the tokens are deleted from the backend. | FR-012 |
| AC-011 | GIVEN a user publishes to YouTube, WHEN the flow starts, THEN the video is uploaded to Firebase Storage and a public URL is generated. | FR-015, FR-016 |
| AC-012 | GIVEN the Firebase upload completes, WHEN the publish job finishes (success or failure), THEN the video is deleted from Firebase within 24 hours. | FR-017 |
| AC-013 | GIVEN a user publishes to X, WHEN uploading, THEN the backend uses X's chunked media upload API. | FR-018 |
| AC-014 | GIVEN a user selects a `.pdf` file, WHEN uploading, THEN the system rejects it as an invalid MIME type. | FR-019 |
| AC-015 | GIVEN a 2GB file for TikTok (limit 500MB), WHEN selected, THEN the UI rejects the file before upload begins. | FR-020 |
| AC-016 | GIVEN a multi-platform post is triggered, WHEN uploading, THEN a progress bar reflects the upload status to the backend/Firebase. | FR-021 |
| AC-017 | GIVEN a user submits a post for 3 platforms, WHEN processed, THEN the backend routes the payload to all 3 APIs. | FR-022 |
| AC-018 | GIVEN a successful post to Facebook, WHEN the response is received, THEN the Facebook Post ID is stored in the database. | FR-023 |
| AC-019 | GIVEN a post succeeds on X but fails on LinkedIn due to rate limits, WHEN completed, THEN the UI shows X as Success and LinkedIn as Failed. | FR-024 |
| AC-020 | GIVEN a published post on the dashboard, WHEN the user clicks the platform icon, THEN it opens the live post in a new tab. | FR-025 |
| AC-021 | GIVEN a transient 503 platform error, WHEN the backend publishes, THEN it retries up to 3 times before failing. | FR-026 |
| AC-022 | GIVEN a video file upload, WHEN processed by the backend proxy, THEN the server responds immediately with a job ID and runs the upload asynchronously. | FR-027 |
| AC-023 | GIVEN a connected YouTube account, WHEN the user views the Accounts page, THEN real subscriber and video counts are displayed instead of zeros. | FR-028 |
| AC-024 | GIVEN the user opens the "View Posts" modal for YouTube, WHEN the data loads, THEN it displays real uploaded videos with direct watch links. | FR-029 |
| AC-025 | GIVEN the user refreshes the Accounts page within 1 hour, WHEN channel stats load, THEN they are served from Firestore cache instead of hitting the YouTube API. | FR-030 |
| AC-026 | GIVEN the Composer is filled out, WHEN the user clicks "Publish Now", THEN real publishing is triggered using collected metadata (title, description, tags, privacy) and video file. | FR-031 |
| AC-027 | GIVEN a real publish is initiated, WHEN the video uploads to Firebase, THEN the progress bar updates accurately and a `temp_uploads` URL is generated. | FR-032 |
| AC-028 | GIVEN a YouTube publish job, WHEN the backend processes it, THEN the YouTube Data API v3 resumable upload protocol is used and returns a valid `videoId`. | FR-033 |
| AC-029 | GIVEN a successful post, WHEN the dashboard updates, THEN the new post record is stored in Firestore and LocalStorage and displayed in the post table with a Watch link. | FR-034 |
| AC-030 | GIVEN a completed API ingestion or 24-hour expiration, WHEN the cleanup process runs, THEN the temporary video file is deleted from Firebase Storage. | FR-035 |
| AC-036 | GIVEN a user connects Meta, WHEN they complete OAuth, THEN the backend exchanges the short-lived token for a long-lived one and enumerates Pages. | FR-036 |
| AC-037 | GIVEN multiple Facebook Pages, WHEN the user selects one, THEN the specific Page Access Token is stored in Firestore. | FR-037 |
| AC-038 | GIVEN a selected Facebook Page, WHEN linked, THEN the backend retrieves and links the associated Instagram Business/Creator Account. | FR-038 |
| AC-039 | GIVEN an Instagram Reel publish request, WHEN processing, THEN the backend creates a container, polls status until FINISHED, and publishes. | FR-039 |
| AC-040 | GIVEN a Facebook Video publish request, WHEN processing, THEN the video uploads and the permalink URL is saved to Firestore. | FR-040 |
| AC-041 | GIVEN a TikTok OAuth login, WHEN exchanging codes, THEN the backend uses PKCE and stores refresh tokens for rotation. | FR-041 |
| AC-042 | GIVEN a TikTok Direct Post publish request, WHEN processing, THEN the backend executes the 4-step init, chunk upload, and publish flow. | FR-042 |
| AC-043 | GIVEN TikTok content controls are set, WHEN publishing, THEN privacy level, comment, duet, and stitch toggles are applied to the payload. | FR-043 |
| AC-044 | GIVEN Meta or TikTok metrics are requested, WHEN loaded, THEN they are served from Firestore cache within a 1-hour TTL. | FR-044 |
| AC-045 | GIVEN the user views recent posts for Meta or TikTok, WHEN opened, THEN the modal lists the most recently published items. | FR-045 |

---

## 6. Non-Functional Requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-001 | **Security:** The frontend MUST NOT contain any platform API `client_secret` strings. | Strict Compliance |
| NFR-002 | **Performance:** Media uploads to Firebase/Backend must not timeout for files up to 1GB on standard broadband (allow up to 10 minutes timeout). | < 10 mins |
| NFR-003 | **Reliability:** Backend APIs must implement retry logic with exponential backoff for rate limit (HTTP 429) responses. | Max 3 retries |
| NFR-004 | **Storage Security:** OAuth tokens stored in the backend database must be encrypted at rest. | AES-256 |
| NFR-005 | **Scalability:** The Express backend must be stateless to allow horizontal scaling (no in-memory token storage). | Stateless |

---

## 7. Technical Architecture

### 7.1 Component Roles
- **Frontend (Vanilla JS):** Handles UI, Firebase Auth, Firebase Storage uploads (for public URLs), and calls the Node.js API to trigger publishing.
- **Node.js + Express Backend:** Serves as a secure proxy. Holds API Client Secrets. Executes OAuth token exchanges. Makes the actual publishing calls to social platforms.
- **Firebase Auth:** Manages user identity. Backend verifies Firebase ID tokens to authenticate requests.
- **Firebase Storage:** Acts as a temporary CDN for videos when platforms require a hosted URL (YouTube, TikTok, Pinterest).
- **Database (Firestore or Postgres):** Stores the encrypted OAuth tokens mapped to the user's Firebase UID.

### 7.2 OAuth 2.0 Flow Diagram
```mermaid
sequenceDiagram
    participant User as Frontend (Browser)
    participant Node as Express Backend
    participant Social as Social Platform API
    
    User->>Node: Request OAuth URL for Platform X
    Node->>User: Returns Auth URL (with client_id)
    User->>Social: User authorizes app
    Social->>Node: Redirects to backend callback with Auth Code
    Node->>Social: Exchanges Auth Code + client_secret for Tokens
    Social->>Node: Returns Access & Refresh Tokens
    Node->>Node: Encrypts and saves tokens against User UID
    Node->>User: Redirects to Frontend with Success Status
```

### 7.3 Publishing Flow Diagram
```mermaid
sequenceDiagram
    participant User as Frontend
    participant FB as Firebase Storage
    participant Node as Express Backend
    participant Social as Social Platform API
    
    User->>FB: Uploads Video File
    FB->>User: Returns Public Download URL
    User->>Node: POST /publish { platforms, videoUrl, text }
    Node->>Social: Calls specific platform API with videoUrl
    Social->>Node: Asynchronously ingests video / returns Post ID
    Node->>User: Returns Success + Post ID
    Node->>FB: Deletes temporary video file
```

---

## 8. Platform-Specific API Details

### 8.1 YouTube (Google API v3)
- **Auth Endpoint:** `https://accounts.google.com/o/oauth2/v2/auth`
- **Scopes:** `https://www.googleapis.com/auth/youtube.upload`, `https://www.googleapis.com/auth/youtube.readonly`
- **Endpoints:**
  - **Upload:** `POST https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`
  - **Channel Stats:** `GET https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true` (Requires fields: `statistics.subscriberCount`, `statistics.videoCount`, `snippet.thumbnails`. Quota cost: 1 unit)
  - **Recent Posts:** `GET https://www.googleapis.com/youtube/v3/playlistItems?part=snippet` (using uploads playlist ID)
- **Method:** Resumable upload or direct upload with Firebase URL.
- **Headers:** `X-Upload-Content-Type: video/*`
- **Payload Schema:** JSON object containing `snippet` (title, description, tags, categoryId) and `status` (privacyStatus: public/unlisted/private).
- **Response Format:** JSON containing `id` (videoId) and published metadata.
- **Constraints:** Max 256GB / 12 hours. Shorts must be <60s and vertical.
- **Dev Requirements:** Google Cloud Console project, YouTube Data API v3 enabled.

### 8.2 Instagram (Graph API)
- **Auth Endpoint:** `https://www.facebook.com/v17.0/dialog/oauth`
- **Scopes:** `instagram_basic, instagram_content_publish, pages_read_engagement`
- **Upload Endpoint:** Container creation via `POST /{ig-user-id}/media`, then `POST /{ig-user-id}/media_publish`
- **Method:** Requires public video URL (Firebase).
- **Constraints:** Max 1GB, 60 minutes for Reels. Aspect ratio 9:16.
- **Dev Requirements:** Meta App with Instagram Graph API enabled, Advanced Access required for public use.
- **Token Lifecycle Pipeline:** 
  - Detailed short-to-long-lived user access token exchange (`/oauth/access_token?grant_type=fb_exchange_token`).
  - Page Access Token retrieval (`GET /me/accounts`) and infinite non-expiring Page tokens storage.
  - Instagram Business / Creator Account mapping (`GET /{page_id}?fields=instagram_business_account`).
  - Multi-page/multi-account selection state management in Firestore (`users/{uid}/platforms/facebook` and `users/{uid}/platforms/instagram`).
- **Reels 3-Step Publishing Pipeline:**
  - **Step 1:** Create Reel Container (`POST /{ig_user_id}/media` with `media_type=REELS`, `video_url`, `caption`).
  - **Step 2:** Poll Container Status (`GET /{container_id}?fields=status_code`) until `FINISHED` (handling `IN_PROGRESS`, `ERROR`, `EXPIRED`).
  - **Step 3:** Publish Media (`POST /{ig_user_id}/media_publish` with `creation_id`).

### 8.3 TikTok (Direct Post API)
- **Auth Endpoint:** `https://www.tiktok.com/v2/auth/authorize/`
- **Scopes:** `video.upload`
- **Upload Endpoint:** `POST https://open.tiktokapis.com/v2/post/publish/video/init/` (Init, Upload, Complete flow)
- **Method:** Chunked direct upload or Pull-from-URL.
- **Constraints:** Max 500MB, 10 minutes. Titles max 150 chars.
- **Dev Requirements:** TikTok for Developers App, approved for Direct Post API.
- **Direct Post 4-Step Pipeline:**
  - **Step 1:** Init post (`POST /v2/post/publish/video/init/` with `source_info`, `post_info`).
  - **Step 2:** Chunked upload / URL pull.
  - **Step 3:** Privacy & controls payload (`privacy_level`, `disable_comment`, `disable_duet`, `disable_stitch`, `brand_content_toggle`).
  - **Step 4:** Status polling (`POST /v2/post/publish/status/fetch/` with `publish_id`).

### 8.4 Facebook (Graph API)
- **Auth Endpoint:** `https://www.facebook.com/v17.0/dialog/oauth`
- **Scopes:** `pages_manage_posts, pages_read_engagement`
- **Upload Endpoint:** `POST /{page-id}/videos`
- **Method:** Chunked upload or direct with URL.
- **Constraints:** Max 10GB, 240 minutes.
- **Dev Requirements:** Meta App with Page publishing permissions.
- **Video Publishing Pipeline:**
  - Page Video Upload (`POST /{page_id}/videos` with `title`, `description`, `file_url` or resumable upload).
  - Extract permalink URL (`https://facebook.com/{video_id}`) and save post record to Firestore (`users/{uid}/posts/fb_{video_id}`).

### 8.5 X (Twitter) (API v2)
- **Auth Endpoint:** `https://twitter.com/i/oauth2/authorize`
- **Scopes:** `tweet.read, tweet.write, offline.access`
- **Upload Endpoint:** `POST https://upload.twitter.com/1.1/media/upload.json` (INIT, APPEND, FINALIZE)
- **Method:** Chunked direct upload required.
- **Constraints:** Max 512MB, 2m 20s. Tweet text 280 chars.
- **Dev Requirements:** Twitter Developer Portal App with elevated access.

### 8.6 Pinterest (API v5)
- **Auth Endpoint:** `https://www.pinterest.com/oauth/`
- **Scopes:** `boards:read, pins:write`
- **Upload Endpoint:** `POST https://api.pinterest.com/v5/media`
- **Method:** Register media, then upload, then create Pin.
- **Constraints:** Max 2GB, 15 minutes.
- **Dev Requirements:** Pinterest Developer App.

### 8.7 LinkedIn (API v2)
- **Auth Endpoint:** `https://www.linkedin.com/oauth/v2/authorization`
- **Scopes:** `w_member_social, r_liteprofile`
- **Upload Endpoint:** `POST https://api.linkedin.com/v2/assets?action=registerUpload`
- **Method:** Register, Upload (PUT), Create `ugcPost`.
- **Constraints:** Max 5GB, 10 minutes.
- **Dev Requirements:** LinkedIn Developer App with Share on LinkedIn product added.

---

## 9. Open Questions

| # | Question | Owner | Status | Decision |
|---|---|---|---|---|
| OQ-1 | Which database will the Node.js backend use to store the encrypted OAuth tokens? | User | Open | TBD (Firestore recommended since Firebase Auth is used) |
| OQ-2 | For platforms requiring chunked upload (X, TikTok), will the frontend send chunks to the backend, or will the backend download from Firebase Storage and chunk it to the API? | User | Open | TBD (Backend downloading from Firebase is more reliable) |
| OQ-3 | Will we implement polling or webhooks for platforms that process videos asynchronously (e.g., YouTube, Instagram)? | User | Open | TBD |

---

## 10. Dependencies

| Dependency | Type | Notes |
|---|---|---|
| `express` | npm | Web server for proxy |
| `cors` | npm | Cross-origin handling |
| `axios` | npm | Outbound API requests |
| `firebase-admin` | npm | Verifying frontend Auth tokens & Storage access |
| `multer` | npm | Handling multipart/form-data for direct uploads |
| `dotenv` | npm | Environment variable management |
| Developer Accounts | External | Approved apps for all 7 platforms |

---

## 11. Definition of Done
- Node.js backend deployed and securely managing OAuth flows.
- Tokens encrypted and safely stored.
- All 7 platforms can be successfully connected and disconnected from the frontend.
- A user can select a video, add a title/description, and successfully publish it to all 7 platforms simultaneously.
- Temporary Firebase Storage videos are reliably deleted post-publish.
- Documentation updated and APIs cataloged.

---

## 12. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| API Deprecation / Policy Changes | High | Abstract platform logic into isolated service classes in the backend. Monitor developer changelogs. |
| Rate Limiting | Medium | Implement queueing and exponential backoff in the Node.js backend for high-volume users. |
| Large Video Upload Failures | High | Use Firebase Storage for reliable client-side resumable uploads, then backend pulls from Firebase. |
| Token Expiry / Revocation | Medium | Implement robust refresh logic and clear UI indicators for users to reconnect accounts. |

---

## 13. BA Review Checklist

> Completed by: BA Agent | Date: 2026-07-19

- [x] All user stories have clear acceptance criteria - Yes, effectively mapped to FRs.
- [~] Functional requirements are complete and unambiguous - Missing upload retries for 5xx errors, explicit error state mapping for quota exhaustion, and handling storage cleanup on publish failure.
- [x] Non-functional requirements are measurable - Yes, timeouts and max retries specified.
- [x] UI/UX requirements match existing design system - Fits into the F000 dashboard architecture.
- [~] Technical approach is feasible within current stack - Yes, but Node.js proxying large video uploads may hit standard HTTP timeouts (e.g., 30s-60s) on many hosting platforms.
- [x] All dependencies identified - Identified successfully.
- [~] All risks documented with mitigations - Missing risk of temporary storage cost explosion on failed posts and refresh token expiration during scheduled runs.
- [x] Open questions flagged for stakeholder input - Yes, 3 open questions documented.
- [x] No conflicting requirements detected - Consistent.
- [x] Feature is achievable within Sprint 3 scope - Achievable, though aggressive for 7 platform integrations.

---

## 14. BA Review
**Date:** 2026-07-19
**Reviewer:** Senior BA Agent

**Executive Summary:**
The F002 BRD provides a comprehensive and well-structured plan for implementing real OAuth and publishing flows for the 7 target social media platforms. While the foundational architecture using a Node.js proxy and Firebase Storage is solid, there are critical gaps concerning token rotation edge cases, transient network failures, and storage cleanup.

**Findings by Section:**
- **4.1 OAuth & Scopes:** For Facebook (FR-004), the `pages_show_list` scope is missing to allow users to fetch and select which page to connect (AC-004). For LinkedIn (FR-007), `w_organization_social` or similar is missing for Company Pages mentioned in US-013.
- **4.2 Token Management:** FR-010 and AC-008 cover token refresh, but lack behavior definitions for when refresh tokens themselves expire or are revoked during background/scheduled processing.
- **4.3 Media Uploads:** FR-017 specifies deleting Firebase temporary videos upon successful ingestion, but fails to account for deletion when publish jobs permanently fail, risking unbounded storage costs.
- **4.4 Status Tracking:** Doesn't clearly define how API Quota Exceeded errors (e.g., YouTube) are surfaced to the user versus standard rate limits (NFR-003 / TC-025).

**Gap Analysis:**
1. **Scope Deficit:** Missing scopes for Facebook page selection and LinkedIn Company Page publishing.
2. **Storage Cleanup Risk:** No requirement dictates cleaning up Firebase Storage if a post permanently fails.
3. **Resilience Missing:** Missing functional requirements for general upload retries on 5xx platform errors or network timeouts (only 429s are currently covered).
4. **Proxy Timeout:** Express backend proxying huge video uploads may hit platform proxy timeout limits if not handled asynchronously.

**Recommendations:**
1. **Update Scopes:** Add `pages_show_list` to Facebook scopes and confirm LinkedIn Company Page scopes (`w_organization_social`).
2. **Enhance Cleanup Logic:** Update FR-017 to mandate a 24-hour TTL/cron job on Firebase Storage to purge ALL temporary videos automatically, regardless of publish success or failure.
3. **Define Quota/Error States:** Add an FR defining distinct UI/Backend handling for "Rate Limited" (retryable) vs "Quota Exceeded" (fatal, prompt user).
4. **Async Proxy Design:** Ensure the technical architecture explicitly notes handling long uploads asynchronously (or chunked via the frontend where possible) to avoid standard HTTP timeouts.

**Verdict:** **Approved with Changes**
