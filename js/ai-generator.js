// =============================================
// VIRALIFY — AI-GENERATOR.JS
// Smart template-based content generation engine
// =============================================

const AIGenerator = (() => {

  // ---- Title template patterns ----
  const TITLE_PATTERNS = [
    (topic, kw) => `${capitalize(topic)}: Everything You Need to Know in 2026`,
    (topic, kw) => `I Tried ${capitalize(topic)} for 30 Days — Here's What Happened`,
    (topic, kw) => `The ULTIMATE ${capitalize(topic)} Guide (No One Talks About This)`,
    (topic, kw) => `How to ${capitalize(topic)} Like a Pro (Step-by-Step)`,
    (topic, kw) => `${capitalize(topic)} Changed My Life — Here's Why`,
    (topic, kw) => `Stop Doing ${capitalize(topic)} Wrong (Do This Instead)`,
    (topic, kw) => `${capitalize(topic)}: The Truth They Don't Tell You`,
    (topic, kw) => `I Spent $0 on ${capitalize(topic)} and This Happened...`,
    (topic, kw) => `The BEST ${capitalize(topic)} Tips for Beginners (2026)`,
    (topic, kw) => `Why Everyone is Obsessed with ${capitalize(topic)} Right Now 🔥`,
    (topic, kw) => `${capitalize(topic)} 101: A Complete Beginner's Guide`,
    (topic, kw) => `My Honest Review of ${capitalize(topic)} After 6 Months`,
    (topic, kw) => `${capitalize(topic)} Hacks Nobody Told You About ✨`,
    (topic, kw) => `I Went Viral Doing ${capitalize(topic)} — Here's How`,
    (topic, kw) => `5 ${capitalize(topic)} Mistakes You're Probably Making`,
    (topic, kw) => `${capitalize(topic)}: Before vs After (The Results Will Shock You)`,
    (topic, kw) => `How ${capitalize(topic)} Made Me [${kw[0] || 'Incredible'} Results]`,
    (topic, kw) => `Day in My Life: ${capitalize(topic)} Edition`,
    (topic, kw) => `The ${capitalize(topic)} Method That Actually Works in 2026`,
    (topic, kw) => `Reacting to ${capitalize(topic)} for the First Time... 😱`,
  ];

  // ---- Description templates ----
  const DESCRIPTION_TEMPLATES = {
    engaging: (topic, keywords, platform) => {
      const cta = platform === 'youtube'
        ? '👇 DROP A COMMENT below — I read every single one!\n\n🔔 SUBSCRIBE & hit the bell for new videos every week!'
        : '❤️ Like and share if this helped you!';
      return `Hey guys! 🔥 Welcome back (or if you're new here, HI — I'm so glad you found this video!)

In today's video, I'm diving deep into ${topic}. This is something I've been wanting to cover for MONTHS and I finally did it. Whether you're just starting out or you've been into ${topic} for a while, I promise there's something in here for you.

What you'll learn:
✅ The basics of ${topic} and why it matters
✅ My personal experience and honest take
✅ Practical tips you can use TODAY
✅ Common mistakes to avoid

${keywords.length > 0 ? `We'll also be talking about ${keywords.slice(0, 3).join(', ')} and how they connect to ${topic}.` : ''}

Timestamps:
0:00 - Intro
1:30 - What is ${topic}?
4:00 - My Experience
8:00 - Top Tips
12:00 - Common Mistakes
15:00 - Final Thoughts

${cta}

📱 Follow me on social media for daily content!

#${topic.replace(/\s+/g, '')} ${keywords.map(k => `#${k.replace(/\s+/g, '')}`).join(' ')}`;
    },

    professional: (topic, keywords, platform) => {
      return `In this video, I share a comprehensive overview of ${topic} — covering key principles, practical applications, and insights based on my experience.

Whether you're a professional or just getting started, this content will give you actionable knowledge to apply immediately.

Key Topics Covered:
• Understanding the fundamentals of ${topic}
• Real-world applications and case studies
• Best practices and strategies that work
• Common pitfalls and how to avoid them

${keywords.length > 0 ? `This video draws on insights from the fields of ${keywords.slice(0,3).join(', ')}.` : ''}

If you found this valuable, please share it with someone who could benefit.

Connect with me professionally on LinkedIn for more insights.`;
    },

    funny: (topic, keywords, platform) => {
      return `Okay so I tried ${topic} and things got... interesting 😅

I had NO idea what I was doing at first. Like, NONE. Zero. The audacity of me thinking this would be easy...

But honestly? I'm not even mad. Because what happened next was actually kind of amazing? 

Stick around to the end — there's a plot twist I didn't see coming 👀

Also, fair warning: I may have embarrassed myself multiple times making this video. You're welcome.

${keywords.length > 0 ? `(Featuring appearances from: ${keywords.slice(0,2).join(', ')} and my complete lack of coordination)` : ''}

Drop your reaction in the comments — I promise to respond with something equally chaotic 😂`;
    },

    inspirational: (topic, keywords, platform) => {
      return `This video is about more than just ${topic} — it's about what's possible when you commit to something.

I wasn't always good at this. In fact, I struggled with ${topic} for a long time. But something shifted when I changed my mindset and my approach.

Today, I want to share what I've learned, hoping it inspires at least one person watching this to take that first step.

Remember: every expert was once a beginner. Every success story started with someone deciding to try.

${keywords.length > 0 ? `The journey through ${keywords.slice(0,2).join(' and ')} taught me that growth is rarely linear — but it's always worth it.` : ''}

If this resonates with you, save this video. Come back to it on the days when you need a reminder of why you started. 💙`;
    },

    educational: (topic, keywords, platform) => {
      return `Welcome to this educational breakdown of ${topic}.

In this lesson, I'll walk you through everything you need to understand the subject clearly and confidently. No fluff, no filler — just solid, actionable knowledge.

📚 Learning Objectives:
By the end of this video, you will understand:
1. The core concepts behind ${topic}
2. How these concepts apply in practice
3. Key terminology and frameworks
4. Next steps for deeper learning

${keywords.length > 0 ? `We'll reference key concepts from ${keywords.slice(0,3).join(', ')} to build a complete picture.` : ''}

📖 Recommended Resources:
Check the description for links to further reading and tools.

If you have questions, leave them in the comments — I'll answer in the next video!`;
    }
  };

  // ---- Hashtag database ----
  const HASHTAG_DATABASE = {
    travel: ['travel', 'travelgram', 'wanderlust', 'adventure', 'explore', 'travelphotography', 'travellife', 'instatravel', 'traveler', 'vacation', 'trip', 'backpacking', 'worldtravel', 'traveltheworld', 'solotravel', 'travelblog', 'globetrotter', 'landscape', 'nature', 'travelvlog'],
    food: ['food', 'foodie', 'foodphotography', 'instafood', 'foodblogger', 'delicious', 'yummy', 'cooking', 'recipe', 'homemade', 'foodlover', 'foodstagram', 'chef', 'eat', 'healthyfood', 'streetfood', 'foodvlog', 'kitchen', 'dinner', 'lunch'],
    fitness: ['fitness', 'workout', 'gym', 'fitlife', 'health', 'exercise', 'training', 'bodybuilding', 'motivation', 'fitnessmotivation', 'healthylifestyle', 'fitfam', 'gains', 'cardio', 'strength', 'wellness', 'yoga', 'running', 'crossfit', 'personaltrainer'],
    lifestyle: ['lifestyle', 'life', 'love', 'happy', 'daily', 'dayinmylife', 'vlog', 'lifestyleblogger', 'living', 'routine', 'selfcare', 'mindset', 'positivity', 'goals', 'morningroutine', 'productivity', 'growth', 'selflove', 'mentalhealth', 'aesthetic'],
    tech: ['tech', 'technology', 'gadgets', 'innovation', 'ai', 'programming', 'coding', 'software', 'developer', 'startup', 'digital', 'future', 'apple', 'android', 'gaming', 'cybersecurity', 'machinelearning', 'blockchain', 'cloud', 'techreview'],
    beauty: ['beauty', 'makeup', 'skincare', 'fashion', 'style', 'ootd', 'glam', 'cosmetics', 'skincareroutine', 'makeuptutorial', 'beautytips', 'haircare', 'beautyinfluencer', 'instafashion', 'model', 'grwm', 'selfcare', 'nails', 'lipstick', 'foundation'],
    business: ['business', 'entrepreneur', 'startup', 'success', 'money', 'marketing', 'branding', 'growth', 'leadership', 'hustle', 'mindset', 'digitalmarketing', 'socialmedia', 'contentcreator', 'onlinebusiness', 'invest', 'passive income', 'finance', 'strategy', 'networking'],
    gaming: ['gaming', 'gamer', 'videogames', 'twitch', 'playstation', 'xbox', 'pcgaming', 'esports', 'gameplay', 'stream', 'gamerlife', 'fps', 'rpg', 'minecraft', 'fortnite', 'callofduty', 'moba', 'gamingcommunity', 'gamingsetup', 'gamedev'],
    education: ['education', 'learning', 'study', 'school', 'knowledge', 'tutorial', 'howto', 'tips', 'diy', 'selfimprovement', 'growthmindset', 'skills', 'training', 'teaching', 'studymotivation', 'learneveryday', 'educational', 'course', 'online learning', 'growth'],
    music: ['music', 'musician', 'song', 'singer', 'rap', 'hiphop', 'pop', 'rnb', 'beat', 'producer', 'studio', 'recordingartist', 'musicvideo', 'newmusic', 'indie', 'playlist', 'guitar', 'piano', 'drums', 'musically'],
    general: ['viral', 'trending', 'fyp', 'foryou', 'foryoupage', 'reels', 'shorts', 'video', 'content', 'creator', 'youtube', 'instagram', 'tiktok', 'new', 'follow', 'like', 'share', 'comment', 'subscribe', '2026'],
  };

  const ENGAGEMENT_TIPS = {
    youtube: [
      { icon: '🎯', text: 'Use pattern interrupts in the first 30 seconds to hook viewers immediately.' },
      { icon: '📊', text: 'Aim for a 50%+ retention rate — YouTube\'s algorithm rewards watch time heavily.' },
      { icon: '🔖', text: 'Add chapters to your video description to improve navigation and SEO.' },
      { icon: '🖼️', text: 'A custom thumbnail with faces and bold text gets 38% higher CTR.' },
      { icon: '💬', text: 'Ask a question in the first comment to boost engagement signals.' },
    ],
    instagram: [
      { icon: '⏱️', text: 'Keep Reels under 30 seconds for maximum completion rate.' },
      { icon: '📝', text: 'Add 3–5 lines of caption before the "more" cutoff to drive tap-throughs.' },
      { icon: '#️⃣', text: 'Mix high-volume (1M+) and niche hashtags for the best reach.' },
      { icon: '🎵', text: 'Use trending audio to get boosted by the Reels algorithm.' },
      { icon: '📍', text: 'Tag your location to appear in local discovery feeds.' },
    ],
    tiktok: [
      { icon: '🎬', text: 'Start with a bold hook in the first 1–2 seconds — no intros.' },
      { icon: '🔄', text: 'Design videos with a "loop" ending to maximize replay count.' },
      { icon: '💬', text: 'Reply to comments with video replies to generate bonus content.' },
      { icon: '📅', text: 'Post consistently — TikTok rewards creators who post 1–3x per day.' },
      { icon: '🔊', text: 'Use trending sounds to tap into the For You Page algorithm.' },
    ],
    general: [
      { icon: '⏰', text: 'Post during peak hours for your specific audience timezone.' },
      { icon: '📣', text: 'Cross-promote your content on other platforms for maximum reach.' },
      { icon: '🤝', text: 'Engage with similar creators to grow your network organically.' },
      { icon: '📈', text: 'Repurpose content: one long video → 5 short clips → 20 tweets.' },
      { icon: '🎯', text: 'Niche down: specific content outperforms broad content every time.' },
    ]
  };

  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function extractCategory(topic, keywords) {
    const combined = (topic + ' ' + keywords.join(' ')).toLowerCase();
    const categories = Object.keys(HASHTAG_DATABASE).filter(c => c !== 'general');
    for (const cat of categories) {
      if (combined.includes(cat)) return cat;
    }
    // Fuzzy match
    if (combined.match(/gym|workout|exercise|run|yoga/)) return 'fitness';
    if (combined.match(/cook|recipe|eat|drink|restaurant/)) return 'food';
    if (combined.match(/travel|tour|trip|explore|vlog|country/)) return 'travel';
    if (combined.match(/makeup|skin|beauty|fashion|style/)) return 'beauty';
    if (combined.match(/business|money|invest|entrepreneur|startup/)) return 'business';
    if (combined.match(/game|gaming|play|stream/)) return 'gaming';
    if (combined.match(/music|song|sing|rap|beat/)) return 'music';
    if (combined.match(/code|program|tech|app|software|ai/)) return 'tech';
    if (combined.match(/learn|teach|study|tutorial|how to|guide/)) return 'education';
    return 'lifestyle';
  }

  function generateHashtags(topic, keywords, count = 15, platformId = 'general') {
    const category = extractCategory(topic, keywords);
    const categoryTags = HASHTAG_DATABASE[category] || [];
    const generalTags = HASHTAG_DATABASE.general;

    // Build from keywords
    const keywordTags = keywords.map(k => k.replace(/\s+/g, '').toLowerCase()).filter(Boolean);

    // Topic-based tags
    const topicWords = topic.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const topicTags = topicWords.map(w => w.replace(/[^a-z0-9]/g, ''));

    const allTags = [...new Set([
      ...keywordTags,
      ...topicTags,
      ...categoryTags.slice(0, 12),
      ...generalTags.slice(0, 8),
    ])].filter(t => t.length > 1);

    // Shuffle and take count
    const shuffled = allTags.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(count, allTags.length));

    // Add platform-specific tags
    if (platformId === 'tiktok') selected.push('fyp', 'foryoupage');
    if (platformId === 'instagram') selected.push('reels', 'instagram');
    if (platformId === 'youtube') selected.push('shorts', 'youtuber');

    return [...new Set(selected)].slice(0, count);
  }

  function generateTitles(topic, keywords, count = 5) {
    const shuffled = [...TITLE_PATTERNS].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count).map(fn => fn(topic, keywords));
  }

  function generateDescription(topic, keywords, tone = 'engaging', platform = 'youtube') {
    const template = DESCRIPTION_TEMPLATES[tone] || DESCRIPTION_TEMPLATES.engaging;
    return template(topic, keywords, platform);
  }

  function getEngagementTips(platformId) {
    return ENGAGEMENT_TIPS[platformId] || ENGAGEMENT_TIPS.general;
  }

  // Public API
  return {
    generateTitles,
    generateDescription,
    generateHashtags,
    getEngagementTips,
    extractCategory,

    // Regenerate just titles
    regenerateTitles(topic, keywords, count = 5) {
      return generateTitles(topic, keywords, count);
    },

    // Regenerate just description
    regenerateDescription(topic, keywords, tone, platform) {
      return generateDescription(topic, keywords, tone, platform);
    },

    // Regenerate just hashtags
    regenerateHashtags(topic, keywords, count, platform) {
      return generateHashtags(topic, keywords, count, platform);
    },

    // Full generation
    generateAll(topic, keywords, options = {}) {
      const {
        titleCount = 5,
        hashtagCount = 15,
        tone = 'engaging',
        platform = 'youtube'
      } = options;

      return {
        titles: generateTitles(topic, keywords, titleCount),
        description: generateDescription(topic, keywords, tone, platform),
        hashtags: generateHashtags(topic, keywords, hashtagCount, platform),
        tips: getEngagementTips(platform),
      };
    }
  };

})();
