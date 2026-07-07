// =============================================
// VIRALIFY — DATA.JS
// Mock data, localStorage helpers, state
// =============================================

const DB_KEY = 'viralify_posts';
const ACCOUNTS_KEY = 'viralify_accounts';

// ---- Default mock accounts ----
const DEFAULT_ACCOUNTS = [
  { platformId: 'youtube',   connected: true,  username: '@farrukhcreates', followers: 24800, posts: 142 },
  { platformId: 'instagram', connected: true,  username: '@farrukh.life',   followers: 18400, posts: 287 },
  { platformId: 'tiktok',    connected: true,  username: '@farrukhfk',      followers: 52300, posts: 94  },
  { platformId: 'facebook',  connected: false, username: '',                followers: 0,     posts: 0   },
  { platformId: 'x',         connected: true,  username: '@farrukhsheikh',  followers: 3200,  posts: 512 },
  { platformId: 'pinterest',  connected: false, username: '',               followers: 0,     posts: 0   },
  { platformId: 'threads',   connected: true,  username: '@farrukh.life',   followers: 1700,  posts: 43  },
  { platformId: 'linkedin',  connected: false, username: '',                followers: 0,     posts: 0   },
  { platformId: 'snapchat',  connected: false, username: '',                followers: 0,     posts: 0   },
];

// ---- Default mock posts ----
const DEFAULT_POSTS = [
  {
    id: 'p1',
    title: 'Morning Routine That Changed My Life 🌅',
    description: 'In this video, I share my 6am morning routine that helped me become more productive and focused. From cold showers to journaling, these habits transformed my life.',
    hashtags: ['#morningroutine', '#productivity', '#lifestyle', '#motivation', '#selfimprovement'],
    platforms: ['youtube', 'instagram', 'tiktok'],
    status: 'published',
    scheduledAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    thumbnail: '🌅',
  },
  {
    id: 'p2',
    title: 'Exploring Lahore\'s Street Food Scene 🍜',
    description: 'Join me as I explore the best street food spots in Lahore, Pakistan. From Gawalmandi to Anarkali, we\'re trying it all!',
    hashtags: ['#streetfood', '#lahore', '#pakistan', '#foodvlog', '#travel'],
    platforms: ['youtube', 'instagram', 'facebook'],
    status: 'published',
    scheduledAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    thumbnail: '🍜',
  },
  {
    id: 'p3',
    title: 'How I Edited My Videos to 1M Views (Secrets Revealed)',
    description: 'I\'m finally revealing my editing workflow and the exact plugins I use to create cinematic-looking YouTube videos on a budget.',
    hashtags: ['#videoediting', '#youtube', '#contentcreator', '#tutorial', '#filmmaking'],
    platforms: ['youtube', 'x', 'linkedin'],
    status: 'scheduled',
    scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    thumbnail: '🎬',
  },
  {
    id: 'p4',
    title: 'Pakistan\'s Best Hiking Trail (Hidden Gem) 🏔️',
    description: 'We discovered a hidden trail in Northern Pakistan that not many tourists know about. The views are absolutely breathtaking.',
    hashtags: ['#hiking', '#pakistan', '#travel', '#adventure', '#nature'],
    platforms: ['youtube', 'instagram', 'tiktok', 'pinterest'],
    status: 'scheduled',
    scheduledAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    thumbnail: '🏔️',
  },
  {
    id: 'p5',
    title: 'My Gear Setup for Traveling Content Creator 2026',
    description: 'Here\'s everything in my travel camera bag for 2026. Compact, powerful, and budget-friendly gear for content creators on the go.',
    hashtags: ['#cameragear', '#contentcreator', '#travelvlog', '#photography', '#videography'],
    platforms: ['youtube'],
    status: 'draft',
    scheduledAt: null,
    thumbnail: '🎥',
  },
  {
    id: 'p6',
    title: 'POV: Living in Islamabad as a Content Creator',
    description: 'What\'s it really like to be a full-time content creator in Islamabad? I share the highs, lows, and everything in between.',
    hashtags: ['#islamabad', '#contentcreator', '#pakistan', '#pov', '#dayinthelife'],
    platforms: ['tiktok', 'instagram', 'threads'],
    status: 'scheduled',
    scheduledAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    thumbnail: '🏙️',
  },
];

// ---- LocalStorage Helpers ----
const Data = {
  init() {
    if (!localStorage.getItem(DB_KEY)) {
      localStorage.setItem(DB_KEY, JSON.stringify(DEFAULT_POSTS));
    }
    if (!localStorage.getItem(ACCOUNTS_KEY)) {
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(DEFAULT_ACCOUNTS));
    }
  },

  getPosts(filterStatus = null) {
    const posts = JSON.parse(localStorage.getItem(DB_KEY) || '[]');
    if (filterStatus && filterStatus !== 'all') {
      return posts.filter(p => p.status === filterStatus);
    }
    return posts;
  },

  getPost(id) {
    return this.getPosts().find(p => p.id === id) || null;
  },

  savePost(post) {
    const posts = this.getPosts();
    const existing = posts.findIndex(p => p.id === post.id);
    if (existing >= 0) {
      posts[existing] = post;
    } else {
      posts.unshift(post);
    }
    localStorage.setItem(DB_KEY, JSON.stringify(posts));
    return post;
  },

  deletePost(id) {
    const posts = this.getPosts().filter(p => p.id !== id);
    localStorage.setItem(DB_KEY, JSON.stringify(posts));
  },

  getAccounts() {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
  },

  getAccount(platformId) {
    return this.getAccounts().find(a => a.platformId === platformId) || null;
  },

  saveAccount(account) {
    const accounts = this.getAccounts();
    const idx = accounts.findIndex(a => a.platformId === account.platformId);
    if (idx >= 0) accounts[idx] = account;
    else accounts.push(account);
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  },

  getConnectedPlatforms() {
    return this.getAccounts().filter(a => a.connected).map(a => a.platformId);
  },

  getStats() {
    const posts = this.getPosts();
    return {
      total: posts.length,
      published: posts.filter(p => p.status === 'published').length,
      scheduled: posts.filter(p => p.status === 'scheduled').length,
      drafts: posts.filter(p => p.status === 'draft').length,
      platforms: this.getConnectedPlatforms().length,
    };
  },

  generateId() {
    return 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  },
};
