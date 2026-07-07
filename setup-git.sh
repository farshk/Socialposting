#!/bin/bash
# Run this script after Xcode Command Line Tools are installed
# Usage: bash /Users/farrukhsheikh/Projects/socialposting/setup-git.sh

set -e

cd /Users/farrukhsheikh/Projects/socialposting

echo "🔧 Initializing git..."
git init

echo "⚙️  Configuring git user..."
git config user.name "Farrukh Sheikh"
git config user.email "farrukhsheikh@users.noreply.github.com"

echo "📦 Staging all files..."
git add .

echo "💾 Creating initial commit..."
git commit -m "🚀 Initial commit: Viralify Social Video Publisher

- Dashboard with stats, upcoming posts, platform overview
- 5-step New Post wizard (Upload → Platforms → AI Content → Schedule → Review)
- AI Studio: generate titles, descriptions & hashtags with tone control
- Calendar/Schedule view with month navigation and platform filters
- Accounts page: connect/disconnect 9 platforms
- 9 platforms: YouTube, Instagram, TikTok, Facebook, X, Pinterest, Threads, LinkedIn, Snapchat
- LocalStorage-based data persistence
- Dark glassmorphism design with purple/pink gradient theme"

echo "🌿 Renaming branch to main..."
git branch -M main

echo "🔗 Adding GitHub remote..."
git remote add origin https://github.com/farshk/Socialposting.git

echo "🚀 Pushing to GitHub..."
git push -u origin main

echo ""
echo "✅ Done! Your code is now on GitHub:"
echo "   https://github.com/farshk/Socialposting"
