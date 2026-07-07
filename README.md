# Viralify — Social Video Publisher

> Schedule and publish video content across 9 social media platforms with AI-powered content generation.

![Viralify](https://img.shields.io/badge/Viralify-Social%20Video%20Publisher-7c3aed?style=for-the-badge)
![HTML](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

## ✨ Features

- **Multi-Platform Publishing** — Post to YouTube, Instagram, TikTok, Facebook, X (Twitter), Pinterest, Threads, LinkedIn, and Snapchat
- **AI Content Generator** — Instantly generate titles, descriptions, and hashtags from a topic + keywords
- **Post Scheduler** — Schedule posts with date/time/timezone picker; calendar view of all scheduled posts
- **5-Step Composer Wizard** — Upload → Select Platforms → Generate Content → Schedule → Review & Publish
- **AI Studio** — Standalone content generator with tone control (Engaging, Professional, Funny, Inspirational, Educational)
- **Accounts Manager** — Connect/disconnect platforms via simulated OAuth flow
- **Best Time to Post** — Per-platform suggestions based on peak engagement times

## 🚀 Getting Started

Just open `index.html` in your browser — no build step needed.

```bash
open index.html
```

## 📁 Project Structure

```
socialposting/
├── index.html           — App shell & all page templates
├── css/
│   ├── main.css         — Design system (dark theme, typography, layout)
│   ├── components.css   — UI components (buttons, cards, forms, modals)
│   └── pages.css        — Page-specific layouts
└── js/
    ├── platforms.js     — 9 platform configs, limits & validation
    ├── data.js          — LocalStorage data layer + mock posts/accounts
    ├── ai-generator.js  — Smart content generation engine
    ├── scheduler.js     — Calendar rendering & scheduling logic
    └── app.js           — Router, Dashboard, Composer, AI Studio, Accounts
```

## 📱 Supported Platforms

| Platform | Max Duration | Best Aspect Ratio |
|---|---|---|
| ▶️ YouTube | 12 hours | 16:9 |
| 📷 Instagram | 60 min (Reels: 90s) | 9:16 |
| 🎵 TikTok | 10 min | 9:16 |
| 👤 Facebook | 240 min | 16:9 or 9:16 |
| 𝕏 X (Twitter) | 2 min 20s | 16:9 or 1:1 |
| 📌 Pinterest | 15 min | 2:3 or 9:16 |
| 🧵 Threads | 5 min | 9:16 or 1:1 |
| 💼 LinkedIn | 10 min | 16:9 or 1:1 |
| 👻 Snapchat | 60s | 9:16 |

## 🎨 Design

- Dark glassmorphism theme with purple/pink gradient accents
- Responsive layout (desktop + mobile)
- Micro-animations and hover effects
- Toast notifications and modal overlays

## 🔮 Roadmap

- [ ] Real OAuth API integrations (YouTube Data API, Meta Graph API, TikTok API)
- [ ] Backend server (Node.js + Express) for token management
- [ ] Analytics dashboard with real engagement metrics
- [ ] Bulk scheduling from CSV
- [ ] AI thumbnail generator
- [ ] Video trimming / aspect ratio converter

## 📄 License

MIT © Farrukh Sheikh
