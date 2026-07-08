# Viralify — Master Project Document

> **Maintained by:** Antigravity AI Agents
> **Last Updated:** 2026-07-07
> **Project Path:** `/Users/farrukhsheikh/Projects/socialposting/`
> **GitHub:** https://github.com/farshk/Socialposting

---

## 1. Project Overview

**Viralify** is a web-based social media video publishing platform that allows content creators to:
- Upload video content once and publish/schedule it across multiple social media platforms simultaneously
- Generate AI-powered titles, descriptions, and hashtags for their content
- Manage all their connected social media accounts from a single dashboard
- Schedule posts at optimal times for maximum engagement

### 1.1 Vision
A single command center for video content creators to manage their entire social media publishing workflow — from upload to scheduling to analytics.

### 1.2 Target Users
- Independent content creators (YouTube, TikTok, Instagram)
- Social media managers
- Small businesses managing their own content
- Digital marketing agencies

---

## 2. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | HTML5, Vanilla CSS, Vanilla JavaScript | No framework; SPA with page routing |
| Data (Phase 1) | LocalStorage | Browser-side persistence |
| AI Content | Smart template engine | Pattern-based generation, no API key required |
| Auth (Phase 2) | Google OAuth 2.0 + Email/Password | Firebase Auth or Supabase |
| Backend (Planned) | Node.js + Express | For real API integrations |
| Hosting (Planned) | Vercel / Netlify | Static hosting for frontend |
| Database (Planned) | PostgreSQL / Supabase | For multi-user data persistence |

---

## 3. Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Single Page App | Yes | Smooth UX without page reloads |
| No build step | Vanilla JS | Zero setup, opens directly in browser |
| LocalStorage | Phase 1 data layer | Works offline, no backend needed initially |
| 9 Platforms | YouTube, Instagram, TikTok, Facebook, X, Pinterest, Threads, LinkedIn, Snapchat | Covers all major video platforms |
| AI content | Template engine | No API key friction for users |

---

## 4. Feature Log

| ID | Feature | Status | BRD | Sprint |
|---|---|---|---|---|
| F000 | Core App Shell (Dashboard, Composer, Scheduler, AI Studio, Accounts) | ✅ Complete | — | Sprint 1 |
| F001 | User Authentication (Google OAuth + Email/Password) | 🟡 BA Approved — Dev Ready | [F001-auth.md](./features/F001-auth.md) | Sprint 2 |
| F002 | Real Social Media API Integrations | 📋 Planned | — | Sprint 3 |
| F003 | Analytics Dashboard | 📋 Planned | — | Sprint 4 |
| F004 | Bulk Scheduling (CSV Import) | 📋 Planned | — | Sprint 5 |
| F005 | AI Thumbnail Generator | 📋 Planned | — | Sprint 6 |
| F006 | Video Trimming / Aspect Ratio Converter | 📋 Planned | — | Sprint 7 |

---

## 5. Completed Features (F000 — Sprint 1)

### 5.1 Dashboard
- Stats cards: Total Posts, Published, Scheduled, Connected Platforms
- Upcoming scheduled posts list
- Per-platform post count bar chart
- Recent activity table (filterable by status)
- Click-through to post detail modal

### 5.2 New Post Wizard (5-step)
- **Step 1 — Upload:** Drag & drop or browse video; preview with file metadata
- **Step 2 — Platforms:** Toggle cards for 9 platforms; shows max duration per platform
- **Step 3 — Content:** AI generator (topic + keywords → titles + description + hashtags); live per-platform previews with character limit bars; manual entry fallback
- **Step 4 — Schedule:** Publish Now / Schedule / Draft; date+time+timezone picker; best-time-to-post suggestions per platform
- **Step 5 — Review:** Full summary; publish saves to LocalStorage

### 5.3 AI Studio (Standalone)
- Topic + keywords + platform + tone input
- Sliders for title count (3–10) and hashtag count (5–30)
- Tones: Engaging, Professional, Funny, Inspirational, Educational
- Output: numbered titles, formatted description, hashtag chips, engagement tips
- Copy All button per section

### 5.4 Schedule / Calendar
- Month-view calendar with colored dots per post
- Click day → modal showing posts on that date
- Month navigation (prev/next)
- Platform filter sidebar

### 5.5 Accounts Manager
- Cards for all 9 platforms
- Simulated OAuth connect/disconnect flow with confirmation modals
- Connected accounts show followers and post count
- Per-platform post history modal

### 5.6 Supported Platforms (9)

| Platform | Max Duration | Best Aspect Ratio | Char Limits |
|---|---|---|---|
| ▶️ YouTube | 12 hrs | 16:9 | Title: 100, Desc: 5000 |
| 📷 Instagram | 60 min | 9:16 | Desc: 2200, Tags: 30 |
| 🎵 TikTok | 10 min | 9:16 | Desc: 2200, Tags: 20 |
| 👤 Facebook | 240 min | 16:9 or 9:16 | Desc: 63206, Tags: 30 |
| 𝕏 X (Twitter) | 2m 20s | 16:9 or 1:1 | Tweet: 280, Tags: 5 |
| 📌 Pinterest | 15 min | 2:3 or 9:16 | Title: 100, Desc: 500 |
| 🧵 Threads | 5 min | 9:16 or 1:1 | Desc: 500, Tags: 10 |
| 💼 LinkedIn | 10 min | 16:9 or 1:1 | Desc: 3000, Tags: 5 |
| 👻 Snapchat | 60s | 9:16 | Desc: 250, Tags: 15 |

---

## 6. Project File Structure

```
/Users/farrukhsheikh/Projects/socialposting/
├── index.html
├── README.md
├── .gitignore
├── setup-git.sh
├── css/
│   ├── main.css
│   ├── components.css
│   └── pages.css
├── js/
│   ├── platforms.js
│   ├── data.js
│   ├── ai-generator.js
│   ├── scheduler.js
│   └── app.js
└── docs/
    ├── MASTER.md           ← This file
    └── features/
        └── F001-auth.md
```

---

## 7. Design System

### Colors
| Token | Value | Usage |
|---|---|---|
| `--bg-base` | `#07070f` | Page background |
| `--bg-card` | `#13131f` | Card backgrounds |
| `--primary` | `#7c3aed` | Purple brand primary |
| `--secondary` | `#ec4899` | Pink brand accent |
| `--gradient` | `135deg, #7c3aed → #ec4899` | Buttons, active states |
| `--accent-cyan` | `#06b6d4` | AI / info accents |
| `--accent-green` | `#10b981` | Success states |

### Typography
- Font: **Inter** (Google Fonts) — weights 300–900

### Key Design Patterns
- Glassmorphism cards with subtle borders
- Grid mesh background with ambient glow blobs
- Micro-animations on all interactive elements
- Toast notifications (bottom-right, 3.5s auto-dismiss)
- Modal overlays with blur backdrop

---

## 8. Git Workflow

- **Branch:** `main`
- **Remote:** `https://github.com/farshk/Socialposting.git`
- **Auth:** PAT stored in macOS Keychain
- **Sync command:**
  ```bash
  cd /Users/farrukhsheikh/Projects/socialposting
  git add .
  git commit -m "feat: your change description"
  git push
  ```

---

## 9. Agent Handoff Protocol

All agents working on this project MUST:
1. Read `docs/MASTER.md` to understand full project scope and history
2. Read the relevant feature BRD in `docs/features/` before implementing
3. Follow the existing design system (CSS tokens, component patterns in `css/`)
4. Update `docs/MASTER.md` Feature Log status and Change Log after completing work
5. Commit and push all changes after implementation

---

## 10. Change Log

| Date | Agent | Change |
|---|---|---|
| 2026-07-07 | Main Agent | F000 complete — full app built and pushed to GitHub |
| 2026-07-07 | Main Agent | docs/ folder created; MASTER.md authored; F001-auth.md drafted |
| 2026-07-07 | BA Agent | F001-auth.md reviewed — Verdict: Approved with Changes; 19 gaps identified |
| 2026-07-07 | Main Agent | F001-auth.md updated with stakeholder decisions (OQ-1–5 closed); FR-016–019 and AC-012–018 added; NFR-004 resolved; BRD finalized for dev handoff |
