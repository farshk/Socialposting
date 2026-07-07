// =============================================
// VIRALIFY — PLATFORMS.JS
// Platform configurations and validation rules
// =============================================

const PLATFORMS = {
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    icon: '▶️',
    emoji: '▶️',
    color: '#FF0000',
    bgColor: 'rgba(255,0,0,0.12)',
    gradient: 'linear-gradient(135deg, #FF0000, #cc0000)',
    maxTitleLen: 100,
    maxDescLen: 5000,
    maxHashtags: 15,
    maxDuration: '12 hours',
    formats: ['MP4', 'MOV', 'AVI', 'WMV', 'FLV', 'WebM'],
    bestAspectRatio: '16:9',
    bestResolution: '1080p or 4K',
    bestTime: { time: '12–4pm', days: 'Thu–Sat' },
    features: ['Title', 'Description', 'Tags', 'Category', 'Thumbnails', 'Chapters'],
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    icon: '📷',
    emoji: '📷',
    color: '#E1306C',
    bgColor: 'rgba(225,48,108,0.12)',
    gradient: 'linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
    maxTitleLen: 0,
    maxDescLen: 2200,
    maxHashtags: 30,
    maxDuration: '60 min (Reels: 90s)',
    formats: ['MP4', 'MOV'],
    bestAspectRatio: '9:16',
    bestResolution: '1080p',
    bestTime: { time: '9–11am', days: 'Tue–Fri' },
    features: ['Caption', 'Hashtags', 'Location', 'Reels', 'Stories'],
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    icon: '🎵',
    emoji: '🎵',
    color: '#69C9D0',
    bgColor: 'rgba(105,201,208,0.12)',
    gradient: 'linear-gradient(135deg, #010101, #69C9D0)',
    maxTitleLen: 150,
    maxDescLen: 2200,
    maxHashtags: 20,
    maxDuration: '10 min',
    formats: ['MP4', 'MOV', 'WebM'],
    bestAspectRatio: '9:16',
    bestResolution: '1080p',
    bestTime: { time: '6–9pm', days: 'Tue, Thu, Fri' },
    features: ['Caption', 'Hashtags', 'Sounds', 'Effects', 'Duet'],
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    icon: '👤',
    emoji: '👤',
    color: '#1877F2',
    bgColor: 'rgba(24,119,242,0.12)',
    gradient: 'linear-gradient(135deg, #1877F2, #0e5ab5)',
    maxTitleLen: 255,
    maxDescLen: 63206,
    maxHashtags: 30,
    maxDuration: '240 min',
    formats: ['MP4', 'MOV', 'AVI'],
    bestAspectRatio: '16:9 or 9:16',
    bestResolution: '1080p',
    bestTime: { time: '1–4pm', days: 'Mon, Wed, Thu' },
    features: ['Caption', 'Hashtags', 'Audience targeting', 'Stories', 'Reels'],
  },
  x: {
    id: 'x',
    name: 'X (Twitter)',
    icon: '𝕏',
    emoji: '🐦',
    color: '#000000',
    bgColor: 'rgba(255,255,255,0.08)',
    gradient: 'linear-gradient(135deg, #1a1a1a, #333)',
    maxTitleLen: 0,
    maxDescLen: 280,
    maxHashtags: 5,
    maxDuration: '2 min 20s',
    formats: ['MP4', 'MOV'],
    bestAspectRatio: '16:9 or 1:1',
    bestResolution: '1080p',
    bestTime: { time: '9am–5pm', days: 'Mon–Fri' },
    features: ['Tweet text', 'Hashtags', 'Alt text', 'Spaces'],
  },
  pinterest: {
    id: 'pinterest',
    name: 'Pinterest',
    icon: '📌',
    emoji: '📌',
    color: '#E60023',
    bgColor: 'rgba(230,0,35,0.12)',
    gradient: 'linear-gradient(135deg, #E60023, #a8001a)',
    maxTitleLen: 100,
    maxDescLen: 500,
    maxHashtags: 20,
    maxDuration: '15 min',
    formats: ['MP4', 'MOV'],
    bestAspectRatio: '2:3 or 9:16',
    bestResolution: '1080p',
    bestTime: { time: '8–11pm', days: 'Sat, Sun' },
    features: ['Pin title', 'Description', 'Board', 'Destination URL'],
  },
  threads: {
    id: 'threads',
    name: 'Threads',
    icon: '🧵',
    emoji: '🧵',
    color: '#000000',
    bgColor: 'rgba(255,255,255,0.06)',
    gradient: 'linear-gradient(135deg, #1a1a1a, #444)',
    maxTitleLen: 0,
    maxDescLen: 500,
    maxHashtags: 10,
    maxDuration: '5 min',
    formats: ['MP4', 'MOV'],
    bestAspectRatio: '9:16 or 1:1',
    bestResolution: '1080p',
    bestTime: { time: '9am–1pm', days: 'Mon–Fri' },
    features: ['Thread text', 'Hashtags', 'Reply controls'],
  },
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: '💼',
    emoji: '💼',
    color: '#0A66C2',
    bgColor: 'rgba(10,102,194,0.12)',
    gradient: 'linear-gradient(135deg, #0A66C2, #064999)',
    maxTitleLen: 255,
    maxDescLen: 3000,
    maxHashtags: 5,
    maxDuration: '10 min',
    formats: ['MP4', 'MOV', 'AVI'],
    bestAspectRatio: '16:9 or 1:1',
    bestResolution: '1080p',
    bestTime: { time: '8–10am', days: 'Tue–Thu' },
    features: ['Post text', 'Hashtags', 'Articles', 'Documents'],
  },
  snapchat: {
    id: 'snapchat',
    name: 'Snapchat',
    icon: '👻',
    emoji: '👻',
    color: '#FFFC00',
    bgColor: 'rgba(255,252,0,0.10)',
    gradient: 'linear-gradient(135deg, #FFFC00, #d4d100)',
    maxTitleLen: 100,
    maxDescLen: 250,
    maxHashtags: 15,
    maxDuration: '60s',
    formats: ['MP4', 'MOV'],
    bestAspectRatio: '9:16',
    bestResolution: '1080p',
    bestTime: { time: '10pm–1am', days: 'Sat, Sun' },
    features: ['Caption', 'Filters', 'Lenses', 'Spotlight'],
  },
};

const PLATFORM_ORDER = ['youtube','instagram','tiktok','facebook','x','pinterest','threads','linkedin','snapchat'];

function getPlatform(id) {
  return PLATFORMS[id] || null;
}

function getActivePlatforms() {
  return PLATFORM_ORDER.map(id => PLATFORMS[id]);
}

function validatePost(platformId, title, description, hashtags) {
  const p = PLATFORMS[platformId];
  if (!p) return { valid: false, errors: ['Unknown platform'] };

  const errors = [];

  if (p.maxTitleLen > 0 && title && title.length > p.maxTitleLen) {
    errors.push(`Title exceeds ${p.maxTitleLen} characters for ${p.name}`);
  }

  if (description && description.length > p.maxDescLen) {
    errors.push(`Description exceeds ${p.maxDescLen} characters for ${p.name}`);
  }

  if (hashtags && hashtags.length > p.maxHashtags) {
    errors.push(`Too many hashtags for ${p.name} (max ${p.maxHashtags})`);
  }

  return { valid: errors.length === 0, errors };
}

function getPlatformIcon(id, size = 22) {
  const p = PLATFORMS[id];
  if (!p) return '';
  return `<span style="font-size:${size}px; line-height:1;" title="${p.name}">${p.emoji}</span>`;
}

function getPlatformBadge(id) {
  const p = PLATFORMS[id];
  if (!p) return '';
  return `<span class="post-platform-dot" style="background:${p.bgColor}; font-size:13px;" title="${p.name}">${p.emoji}</span>`;
}
