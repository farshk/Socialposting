// =============================================
// VIRALIFY — APP.JS
// Main app controller: router, state, pages
// =============================================

// ---- Global App State ----
const AppState = {
  currentPage: 'dashboard',
  currentPostFilter: 'all',
};

// ---- Composer State ----
const ComposerState = {
  step: 1,
  videoFile: null,
  videoUrl: null,
  selectedPlatforms: [],
  selectedTitle: '',
  description: '',
  selectedHashtags: [],
  scheduleType: 'now',
  scheduledDate: '',
  scheduledTime: '',
  timezone: 'UTC+5',
  generatedData: null,
  currentTone: 'engaging',
};

// ---- AI Studio State ----
const AIStudioState = {
  lastTopic: '',
  lastKeywords: [],
  lastPlatform: 'youtube',
  lastTone: 'engaging',
  results: null,
};

// ==============================
// APP — Router & Core
// ==============================
const App = {
  async init() {
    // ── F001: Firebase Auth Gate ──────────────────────────────
    // If Firebase is configured, verify user is authenticated before
    // rendering the app. Gracefully degrades if Firebase is not set up.
    if (window.FIREBASE_READY) {
      const canProceed = await checkAuthAndInit();
      if (!canProceed) return; // Redirecting to auth.html
    }
    // ─────────────────────────────────────────────────────────

    Data.init();
    this.renderSidebar();
    this.navigate('dashboard');
    this.setupEventListeners();

    // Wire sign out button
    const signoutBtn = document.getElementById('sidebar-signout-btn');
    if (signoutBtn) signoutBtn.addEventListener('click', () => App.signOut());
  },

  navigate(page) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    // Show target page
    const pageEl = document.getElementById(`page-${page}`);
    if (pageEl) pageEl.classList.add('active');

    const navEl = document.getElementById(`nav-${page}`);
    if (navEl) navEl.classList.add('active');

    AppState.currentPage = page;

    // Page-specific init
    switch (page) {
      case 'dashboard': Dashboard.render(); break;
      case 'composer': Composer.reset(); break;
      case 'scheduler': Calendar.init(); break;
      case 'ai-studio': AIStudio.init(); break;
      case 'accounts': AccountsPage.render(); break;
    }

    // Close sidebar on mobile
    document.getElementById('sidebar').classList.remove('open');
  },

  renderSidebar() {
    const dotsContainer = document.getElementById('sidebar-platform-dots');
    if (!dotsContainer) return;
    const connected = Data.getConnectedPlatforms();
    dotsContainer.innerHTML = connected.map(id => {
      const p = PLATFORMS[id];
      return `<div class="platform-dot" style="background:${p.bgColor};" title="${p.name}">${p.emoji}</div>`;
    }).join('');
  },

  toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
  },

  setupEventListeners() {
    // Nav links
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigate(item.dataset.page);
      });
    });

    // Filter tabs on dashboard
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        AppState.currentPostFilter = tab.dataset.filter;
        Dashboard.renderRecentPosts(AppState.currentPostFilter);
      });
    });

    // Tone buttons in AI Studio
    document.querySelectorAll('.tone-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tone-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        AIStudioState.lastTone = btn.dataset.tone;
      });
    });

    // Upload drag-drop
    const uploadZone = document.getElementById('upload-zone');
    if (uploadZone) {
      uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
      });
      uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
      uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('video/')) {
          Composer.processVideoFile(file);
        } else {
          App.toast('Please drop a valid video file.', 'error');
        }
      });
    }

    // Description char count in composer
    const descEl = document.getElementById('post-description');
    if (descEl) {
      descEl.addEventListener('input', () => {
        document.getElementById('desc-char-count').textContent = descEl.value.length;
      });
    }
  },

  openModal(title, content) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-content').innerHTML = content;
    document.getElementById('modal-overlay').classList.remove('hidden');
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
  },

  toast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle', warning: 'fa-exclamation-triangle' };
    const colors = { success: '#10b981', error: '#ef4444', info: '#06b6d4', warning: '#f59e0b' };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <i class="fas ${icons[type]}" style="color:${colors[type]};font-size:18px;flex-shrink:0;"></i>
      <span style="font-size:13px;font-weight:500;">${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  showPostDetail(postId) {
    const post = Data.getPost(postId);
    if (!post) return;
    const platformsHtml = (post.platforms || []).map(id => {
      const p = PLATFORMS[id];
      return `<span class="review-platform-badge">${p.emoji} ${p.name}</span>`;
    }).join('');
    const date = post.scheduledAt ? new Date(post.scheduledAt).toLocaleString() : 'N/A';
    App.openModal(post.title, `
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div>
          <div class="review-block-title"><i class="fas fa-share-alt"></i> Platforms</div>
          <div class="review-platforms-wrap">${platformsHtml}</div>
        </div>
        <div>
          <div class="review-block-title"><i class="fas fa-clock"></i> Scheduled</div>
          <p style="font-size:14px;color:var(--text-secondary)">${date}</p>
        </div>
        <div>
          <div class="review-block-title"><i class="fas fa-align-left"></i> Description</div>
          <p style="font-size:13px;color:var(--text-secondary);white-space:pre-wrap;max-height:120px;overflow-y:auto;">${post.description || 'No description'}</p>
        </div>
        <div>
          <div class="review-block-title"><i class="fas fa-hashtag"></i> Hashtags</div>
          <div class="hashtag-chips" style="margin-top:0;">${(post.hashtags||[]).map(h=>`<span class="hashtag-chip selected">${h}</span>`).join('')}</div>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="btn btn-ghost btn-sm" onclick="App.deletePost('${postId}')"><i class="fas fa-trash"></i> Delete</button>
          <span class="badge badge-${post.status}" style="margin-left:auto;align-self:center;">${post.status}</span>
        </div>
      </div>
    `);
  },

  deletePost(postId) {
    Data.deletePost(postId);
    App.closeModal();
    App.toast('Post deleted.', 'info');
    if (AppState.currentPage === 'dashboard') Dashboard.render();
    if (AppState.currentPage === 'scheduler') Calendar.refresh();
  }
};

// ==============================
// DASHBOARD
// ==============================
const Dashboard = {
  render() {
    this.renderStats();
    this.renderUpcomingPosts();
    this.renderPlatformOverview();
    this.renderRecentPosts('all');
  },

  renderStats() {
    const stats = Data.getStats();
    const container = document.getElementById('stats-grid');
    if (!container) return;

    const cards = [
      { label: 'Total Posts', value: stats.total, icon: 'fas fa-film', color: '#7c3aed', bg: 'rgba(124,58,237,0.12)', change: '+3 this week', up: true },
      { label: 'Published', value: stats.published, icon: 'fas fa-check-circle', color: '#10b981', bg: 'rgba(16,185,129,0.12)', change: '+2 this week', up: true },
      { label: 'Scheduled', value: stats.scheduled, icon: 'fas fa-calendar-check', color: '#06b6d4', bg: 'rgba(6,182,212,0.12)', change: 'Coming up', up: true },
      { label: 'Platforms', value: stats.platforms, icon: 'fas fa-share-alt', color: '#ec4899', bg: 'rgba(236,72,153,0.12)', change: 'Connected', up: true },
    ];

    container.innerHTML = cards.map(c => `
      <div class="stat-card">
        <div class="stat-icon" style="background:${c.bg}; color:${c.color};">
          <i class="${c.icon}"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value" style="color:${c.color};">${c.value}</div>
          <div class="stat-label">${c.label}</div>
          <div class="stat-change ${c.up ? 'up' : 'down'}">
            <i class="fas fa-arrow-${c.up ? 'up' : 'down'}"></i> ${c.change}
          </div>
        </div>
      </div>
    `).join('');
  },

  renderUpcomingPosts() {
    const container = document.getElementById('upcoming-posts-list');
    if (!container) return;

    const posts = Data.getPosts('scheduled').slice(0, 4);

    if (posts.length === 0) {
      container.innerHTML = `<div class="text-center" style="padding:24px;color:var(--text-muted);">
        <i class="fas fa-calendar-plus" style="font-size:28px;margin-bottom:10px;display:block;"></i>
        <p>No scheduled posts yet.</p>
        <button class="btn btn-primary btn-sm mt-3" onclick="App.navigate('composer')"><i class="fas fa-plus"></i> Create Post</button>
      </div>`;
      return;
    }

    container.innerHTML = posts.map(post => {
      const date = post.scheduledAt ? new Date(post.scheduledAt) : null;
      const dateStr = date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      const timeStr = date ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
      const platformsHtml = (post.platforms || []).slice(0, 3).map(id => getPlatformBadge(id)).join('');

      return `
        <div class="post-item" onclick="App.showPostDetail('${post.id}')">
          <div class="post-thumb">${post.thumbnail || '🎬'}</div>
          <div class="post-info">
            <div class="post-title">${post.title}</div>
            <div class="post-meta">
              <i class="fas fa-clock" style="font-size:10px;"></i> ${dateStr} ${timeStr}
            </div>
          </div>
          <div class="post-platforms">${platformsHtml}</div>
        </div>`;
    }).join('');
  },

  renderPlatformOverview() {
    const container = document.getElementById('platform-overview');
    if (!container) return;

    const accounts = Data.getConnectedPlatforms();
    const posts = Data.getPosts();
    const maxPosts = Math.max(...accounts.map(id => posts.filter(p => p.platforms && p.platforms.includes(id)).length), 1);

    container.innerHTML = accounts.map(id => {
      const p = PLATFORMS[id];
      const count = posts.filter(post => post.platforms && post.platforms.includes(id)).length;
      const pct = Math.round((count / maxPosts) * 100);

      return `
        <div class="platform-overview-row">
          <div class="platform-overview-icon">${p.emoji}</div>
          <div class="platform-overview-info">
            <div class="platform-overview-name">
              <span>${p.name}</span>
              <span style="font-size:12px;color:var(--text-muted);">${count} posts</span>
            </div>
            <div class="platform-overview-bar">
              <div class="platform-overview-fill" style="width:${pct}%;background:${p.gradient};"></div>
            </div>
          </div>
        </div>`;
    }).join('');
  },

  renderRecentPosts(filter = 'all') {
    const container = document.getElementById('recent-posts-table');
    if (!container) return;

    let posts = Data.getPosts(filter === 'all' ? null : filter);
    posts = posts.slice(0, 8);

    if (posts.length === 0) {
      container.innerHTML = `<div class="text-center" style="padding:32px;color:var(--text-muted);">No posts found.</div>`;
      return;
    }

    const rows = posts.map(post => {
      const date = post.scheduledAt ? new Date(post.scheduledAt) : null;
      const dateStr = date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
      const platformsHtml = (post.platforms || []).slice(0, 4).map(id => getPlatformBadge(id)).join('');

      const watchBtn = post.videoUrl ? `<a href="${post.videoUrl}" target="_blank" onclick="event.stopPropagation()" class="btn btn-ghost btn-sm" title="Watch on YouTube" style="margin-left:8px;"><i class="fab fa-youtube"></i></a>` : '';

      return `
        <tr onclick="App.showPostDetail('${post.id}')" style="cursor:pointer;">
          <td>
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="font-size:22px;">${post.thumbnail || '🎬'}</div>
              <span style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${post.title}</span>
            </div>
          </td>
          <td>
            <div style="display:flex;align-items:center;">
              <div class="post-platforms">${platformsHtml}</div>
              ${watchBtn}
            </div>
          </td>
          <td>${dateStr}</td>
          <td><span class="badge badge-${post.status}">${post.status}</span></td>
        </tr>`;
    }).join('');

    container.innerHTML = `
      <table class="posts-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Platforms</th>
            <th>Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }
};

// ==============================
// COMPOSER (New Post Wizard)
// ==============================
const Composer = {
  reset() {
    ComposerState.step = 1;
    ComposerState.videoFile = null;
    ComposerState.videoUrl = null;
    ComposerState.selectedPlatforms = [];
    ComposerState.selectedTitle = '';
    ComposerState.description = '';
    ComposerState.selectedHashtags = [];
    ComposerState.scheduleType = 'now';
    ComposerState.generatedData = null;

    this.updateStepDisplay(1);
    this.renderPlatformSelector();
    this.updateScheduleType({ value: 'now' });

    // Reset video UI
    document.getElementById('upload-zone').classList.remove('hidden');
    document.getElementById('video-preview-wrap').classList.add('hidden');
    const input = document.getElementById('video-file-input');
    if (input) input.value = '';

    // Reset content UI
    document.getElementById('ai-results').classList.add('hidden');

    // Default date/time
    const now = new Date();
    now.setDate(now.getDate() + 1);
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = '09:00';
    const dateEl = document.getElementById('schedule-date');
    const timeEl = document.getElementById('schedule-time');
    if (dateEl) dateEl.value = dateStr;
    if (timeEl) timeEl.value = timeStr;
  },

  updateStepDisplay(step) {
    // Hide all steps
    document.querySelectorAll('.composer-step').forEach((el, i) => {
      el.classList.toggle('active', i + 1 === step);
    });

    // Update stepper indicators
    document.querySelectorAll('.step').forEach((el, i) => {
      const stepNum = i + 1;
      el.classList.remove('active', 'done');
      if (stepNum === step) el.classList.add('active');
      else if (stepNum < step) {
        el.classList.add('done');
        el.querySelector('.step-circle').innerHTML = '<i class="fas fa-check" style="font-size:11px;"></i>';
      } else {
        el.querySelector('.step-circle').textContent = stepNum;
      }
    });

    // Update step lines
    document.querySelectorAll('.step-line').forEach((el, i) => {
      el.classList.toggle('done', i + 1 < step);
    });

    ComposerState.step = step;
  },

  nextStep() {
    if (!this.validateCurrentStep()) return;

    const nextStep = ComposerState.step + 1;
    if (nextStep > 5) return;

    this.updateStepDisplay(nextStep);

    if (nextStep === 3) this.renderPlatformPreviews();
    if (nextStep === 4) Calendar.renderBestTimes(ComposerState.selectedPlatforms);
    if (nextStep === 5) this.renderReview();
  },

  prevStep() {
    const prev = ComposerState.step - 1;
    if (prev < 1) return;
    this.updateStepDisplay(prev);
  },

  validateCurrentStep() {
    const step = ComposerState.step;
    if (step === 2 && ComposerState.selectedPlatforms.length === 0) {
      App.toast('Please select at least one platform.', 'warning');
      return false;
    }
    return true;
  },

  handleFileSelect(input) {
    const file = input.files[0];
    if (!file) return;
    this.processVideoFile(file);
  },

  processVideoFile(file) {
    ComposerState.videoFile = file;
    const url = URL.createObjectURL(file);
    ComposerState.videoUrl = url;

    document.getElementById('video-preview').src = url;
    document.getElementById('upload-zone').classList.add('hidden');
    document.getElementById('video-preview-wrap').classList.remove('hidden');

    // Show file meta
    const size = (file.size / (1024 * 1024)).toFixed(1);
    document.getElementById('video-meta').innerHTML = `
      <span><i class="fas fa-file-video"></i> ${file.name}</span>
      <span><i class="fas fa-weight"></i> ${size} MB</span>
      <span><i class="fas fa-clock"></i> Analyzing...</span>
    `;
    App.toast('Video uploaded successfully!', 'success');
  },

  removeVideo() {
    ComposerState.videoFile = null;
    ComposerState.videoUrl = null;
    document.getElementById('video-preview').src = '';
    document.getElementById('upload-zone').classList.remove('hidden');
    document.getElementById('video-preview-wrap').classList.add('hidden');
  },

  renderPlatformSelector() {
    const container = document.getElementById('platform-selector-grid');
    if (!container) return;

    container.innerHTML = getActivePlatforms().map(p => `
      <div class="platform-card ${ComposerState.selectedPlatforms.includes(p.id) ? 'selected' : ''}"
           id="pcard-${p.id}"
           onclick="Composer.togglePlatform('${p.id}')">
        <div class="platform-card-check"><i class="fas fa-check"></i></div>
        <div class="platform-icon-wrap" style="background:${p.bgColor};">${p.emoji}</div>
        <div class="platform-card-name">${p.name}</div>
        <div class="platform-card-limit">${p.maxDuration}</div>
      </div>
    `).join('');
  },

  togglePlatform(platformId) {
    const idx = ComposerState.selectedPlatforms.indexOf(platformId);
    if (idx >= 0) {
      ComposerState.selectedPlatforms.splice(idx, 1);
    } else {
      ComposerState.selectedPlatforms.push(platformId);
    }
    const card = document.getElementById(`pcard-${platformId}`);
    if (card) card.classList.toggle('selected', ComposerState.selectedPlatforms.includes(platformId));
  },

  generateContent() {
    const topic = document.getElementById('ai-topic').value.trim();
    const keywordsRaw = document.getElementById('ai-keywords').value.trim();

    if (!topic) {
      App.toast('Please enter a video topic first.', 'warning');
      return;
    }

    const keywords = keywordsRaw.split(',').map(k => k.trim()).filter(Boolean);
    const platform = ComposerState.selectedPlatforms[0] || 'youtube';

    const btn = document.getElementById('ai-generate-btn');
    btn.innerHTML = '<i class="fas fa-spinner spinning"></i> Generating...';
    btn.disabled = true;

    setTimeout(() => {
      const results = AIGenerator.generateAll(topic, keywords, {
        titleCount: 4,
        hashtagCount: 20,
        tone: 'engaging',
        platform,
      });
      ComposerState.generatedData = results;

      this.renderTitleOptions(results.titles);
      this.renderHashtags(results.hashtags);

      const descEl = document.getElementById('post-description');
      if (descEl) {
        descEl.value = results.description;
        document.getElementById('desc-char-count').textContent = results.description.length;
      }

      document.getElementById('ai-results').classList.remove('hidden');
      document.getElementById('manual-content').classList.add('hidden');

      btn.innerHTML = '<i class="fas fa-sparkles"></i> Generate';
      btn.disabled = false;

      App.toast('Content generated successfully!', 'success');
    }, 900);
  },

  renderTitleOptions(titles) {
    const container = document.getElementById('title-options');
    if (!container) return;

    container.innerHTML = titles.map((title, i) => `
      <div class="title-option ${i === 0 ? 'selected' : ''}" onclick="Composer.selectTitle(this, '${title.replace(/'/g, "\\'")}')">
        <div class="title-option-text">${title}</div>
        <button class="title-option-copy" onclick="event.stopPropagation(); App.copyText('${title.replace(/'/g, "\\'")}')">
          <i class="fas fa-copy"></i>
        </button>
      </div>
    `).join('');

    // Select first by default
    if (titles.length > 0) ComposerState.selectedTitle = titles[0];
  },

  selectTitle(el, title) {
    document.querySelectorAll('.title-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    ComposerState.selectedTitle = title;
  },

  renderHashtags(hashtags) {
    const container = document.getElementById('hashtag-chips');
    if (!container) return;

    ComposerState.selectedHashtags = hashtags.slice(0, 10);

    container.innerHTML = hashtags.map(tag => `
      <div class="hashtag-chip ${ComposerState.selectedHashtags.includes(tag) ? 'selected' : ''}"
           onclick="Composer.toggleHashtag(this, '${tag}')">
        ${tag}
      </div>
    `).join('');

    this.updateHashtagCount();
  },

  toggleHashtag(el, tag) {
    const idx = ComposerState.selectedHashtags.indexOf(tag);
    if (idx >= 0) {
      ComposerState.selectedHashtags.splice(idx, 1);
      el.classList.remove('selected');
    } else {
      ComposerState.selectedHashtags.push(tag);
      el.classList.add('selected');
    }
    this.updateHashtagCount();
  },

  updateHashtagCount() {
    const el = document.getElementById('selected-hashtag-count');
    if (el) el.textContent = ComposerState.selectedHashtags.length;
  },

  selectAllHashtags() {
    document.querySelectorAll('#hashtag-chips .hashtag-chip').forEach(chip => {
      chip.classList.add('selected');
    });
    ComposerState.selectedHashtags = Array.from(
      document.querySelectorAll('#hashtag-chips .hashtag-chip')
    ).map(el => el.textContent.trim().replace(/^#/, ''));
    this.updateHashtagCount();
  },

  clearHashtags() {
    document.querySelectorAll('#hashtag-chips .hashtag-chip').forEach(chip => chip.classList.remove('selected'));
    ComposerState.selectedHashtags = [];
    this.updateHashtagCount();
  },

  renderPlatformPreviews() {
    const container = document.getElementById('platform-previews');
    if (!container) return;

    const title = ComposerState.selectedTitle || 'Your video title will appear here...';
    const desc = document.getElementById('post-description')?.value || 'Your description...';
    const hashtags = ComposerState.selectedHashtags.slice(0, 3).map(h => `#${h}`).join(' ');

    if (ComposerState.selectedPlatforms.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Select platforms in Step 2 to see previews.</p>';
      return;
    }

    container.innerHTML = ComposerState.selectedPlatforms.map(id => {
      const p = PLATFORMS[id];
      const previewText = (desc.slice(0, 80) + (desc.length > 80 ? '...' : '')) + (hashtags ? ' ' + hashtags : '');
      const maxLen = p.maxDescLen || 280;
      const usedLen = Math.min(desc.length, maxLen);
      const pct = Math.round((usedLen / maxLen) * 100);
      const barColor = pct > 90 ? '#ef4444' : pct > 75 ? '#f59e0b' : '#10b981';

      return `
        <div class="preview-card">
          <div class="preview-card-header" style="color:${p.color};">
            <span>${p.emoji}</span>
            <span>${p.name}</span>
          </div>
          ${p.maxTitleLen > 0 ? `<div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:6px;">${title.slice(0, p.maxTitleLen)}</div>` : ''}
          <div class="preview-card-text">${previewText}</div>
          <div class="preview-char-bar">
            <div class="preview-char-fill" style="width:${pct}%;background:${barColor};"></div>
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">${usedLen}/${maxLen} chars</div>
        </div>`;
    }).join('');
  },

  updateScheduleType(input) {
    const val = typeof input === 'string' ? input : input.value;
    ComposerState.scheduleType = val;

    // Style the options
    ['opt-now', 'opt-scheduled', 'opt-draft'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('selected');
    });

    const map = { now: 'opt-now', scheduled: 'opt-scheduled', draft: 'opt-draft' };
    const selectedEl = document.getElementById(map[val]);
    if (selectedEl) selectedEl.classList.add('selected');

    const dtWrap = document.getElementById('datetime-picker-wrap');
    if (dtWrap) dtWrap.classList.toggle('hidden', val !== 'scheduled');

    // Update publish button label
    const labels = { now: 'Publish Now', scheduled: 'Schedule Post', draft: 'Save as Draft' };
    const labelEl = document.getElementById('publish-btn-label');
    if (labelEl) labelEl.textContent = labels[val] || 'Publish';
  },

  applyBestTime(platformId) {
    const p = PLATFORMS[platformId];
    if (!p) return;

    // Set schedule type to scheduled
    document.querySelectorAll('input[name="schedule-type"]').forEach(r => {
      r.checked = r.value === 'scheduled';
    });
    this.updateScheduleType('scheduled');

    // Set next occurrence of best day
    const now = new Date();
    now.setDate(now.getDate() + 1);
    document.getElementById('schedule-date').value = now.toISOString().split('T')[0];

    // Parse time from bestTime
    const timeMap = {
      youtube: '14:00', instagram: '10:00', tiktok: '19:00',
      facebook: '13:00', x: '10:00', pinterest: '21:00',
      threads: '10:00', linkedin: '09:00', snapchat: '22:00'
    };
    document.getElementById('schedule-time').value = timeMap[platformId] || '10:00';

    App.toast(`Best time for ${p.name} applied!`, 'success');
  },

  renderReview() {
    const container = document.getElementById('review-summary');
    if (!container) return;

    const title = ComposerState.selectedTitle || document.getElementById('post-title')?.value || 'Untitled';
    const desc = document.getElementById('post-description')?.value || '';
    const platforms = ComposerState.selectedPlatforms;

    const platformBadges = platforms.map(id => {
      const p = PLATFORMS[id];
      return `<span class="review-platform-badge" style="border-color:${p.color}20;">${p.emoji} ${p.name}</span>`;
    }).join('');

    const scheduleInfo = ComposerState.scheduleType === 'now'
      ? '<span style="color:var(--accent-green);">Publish immediately</span>'
      : ComposerState.scheduleType === 'draft'
      ? '<span style="color:var(--text-muted);">Save as draft</span>'
      : (() => {
          const d = document.getElementById('schedule-date')?.value;
          const t = document.getElementById('schedule-time')?.value;
          return d ? `<span style="color:var(--accent-cyan);">${d} at ${t}</span>` : 'Not set';
        })();

    const hashtagText = ComposerState.selectedHashtags.slice(0, 8).map(h => `#${h}`).join(' ');

    container.innerHTML = `
      <div class="review-block">
        <div class="review-block-title"><i class="fas fa-heading"></i> Title</div>
        <p style="font-size:14px;color:var(--text-primary);font-weight:500;">${title}</p>
      </div>
      <div class="review-block">
        <div class="review-block-title"><i class="fas fa-calendar"></i> Schedule</div>
        <p style="font-size:14px;">${scheduleInfo}</p>
      </div>
      <div class="review-block" style="grid-column:1/-1;">
        <div class="review-block-title"><i class="fas fa-share-alt"></i> Platforms (${platforms.length})</div>
        <div class="review-platforms-wrap">${platformBadges || '<span style="color:var(--text-muted);">None selected</span>'}</div>
      </div>
      <div class="review-block" style="grid-column:1/-1;">
        <div class="review-block-title"><i class="fas fa-align-left"></i> Description Preview</div>
        <p style="font-size:13px;color:var(--text-secondary);max-height:80px;overflow:hidden;">${desc.slice(0, 200)}${desc.length > 200 ? '...' : ''}</p>
      </div>
      <div class="review-block" style="grid-column:1/-1;">
        <div class="review-block-title"><i class="fas fa-hashtag"></i> Hashtags (${ComposerState.selectedHashtags.length})</div>
        <p style="font-size:13px;color:var(--primary-light);">${hashtagText || 'None selected'}</p>
      </div>
    `;
  },

  async publish() {
    const title = ComposerState.selectedTitle || document.getElementById('post-title')?.value || 'Untitled Post';
    const desc = document.getElementById('post-description')?.value || document.getElementById('post-description-manual')?.value || '';
    const hashtags = ComposerState.selectedHashtags.map(h => h.startsWith('#') ? h : `#${h}`);
    const tags = ComposerState.selectedHashtags;
    const platforms = ComposerState.selectedPlatforms;
    const privacyStatus = document.getElementById('privacy-select')?.value || 'public';

    if (platforms.length === 0) {
      App.toast('Please select at least one platform.', 'warning');
      return;
    }

    let scheduledAt = null;
    if (ComposerState.scheduleType === 'scheduled') {
      const d = document.getElementById('schedule-date')?.value;
      const t = document.getElementById('schedule-time')?.value;
      if (d && t) scheduledAt = new Date(`${d}T${t}`).toISOString();
    } else if (ComposerState.scheduleType === 'now') {
      scheduledAt = new Date().toISOString();
    }

    const status = ComposerState.scheduleType === 'now' ? 'published'
                 : ComposerState.scheduleType === 'scheduled' ? 'scheduled'
                 : 'draft';

    const btn = document.getElementById('publish-btn');
    btn.disabled = true;

    if (ComposerState.scheduleType === 'now' && (platforms.includes('youtube') || platforms.includes('facebook') || platforms.includes('instagram')) && ComposerState.videoFile) {
      btn.innerHTML = '<i class="fas fa-spinner spinning"></i> Publishing...';
      
      const progressWrap = document.getElementById('upload-progress-wrap');
      const progressBar = document.getElementById('upload-progress-bar');
      const progressLabel = document.getElementById('upload-progress-label');
      
      if (progressWrap) progressWrap.classList.remove('hidden');
      if (progressBar) progressBar.style.width = '0%';
      if (progressLabel) progressLabel.textContent = '0%';

      try {
        let ytResult = null;
        let fbResult = null;
        let igResult = null;
        
        // Mock public URL for Meta since we don't have Firebase Storage yet
        const publicVideoUrl = "https://www.w3schools.com/html/mov_bbb.mp4";

        if (platforms.includes('youtube') && typeof YouTube !== 'undefined') {
          if (progressLabel) progressLabel.textContent = 'Publishing to YouTube...';
          ytResult = await YouTube.upload(ComposerState.videoFile, { title, description: desc, tags, privacyStatus }, (pct) => {
            if (progressBar) progressBar.style.width = pct + '%';
            if (progressLabel) progressLabel.textContent = pct + '%';
          });
        }
        
        if (platforms.includes('facebook') && typeof Meta !== 'undefined') {
          if (progressLabel) progressLabel.textContent = 'Publishing to Facebook...';
          fbResult = await Meta.publishFacebook(publicVideoUrl, title, desc);
        }

        if (platforms.includes('instagram') && typeof Meta !== 'undefined') {
          if (progressLabel) progressLabel.textContent = 'Publishing to Instagram...';
          igResult = await Meta.publishInstagram(publicVideoUrl, desc);
        }

        const post = {
          id: Data.generateId(),
          title,
          description: desc,
          hashtags,
          platforms,
          status: 'published',
          scheduledAt,
          publishedAt: new Date().toISOString(),
          thumbnail: '🎬',
          videoId: ytResult ? ytResult.videoId : undefined,
          videoUrl: ytResult ? ytResult.videoUrl : undefined,
          fbVideoId: fbResult ? fbResult.videoId : undefined,
          igMediaId: igResult ? igResult.mediaId : undefined
        };
        
        Data.savePost(post);
        if (progressWrap) progressWrap.classList.add('hidden');
        btn.innerHTML = '<i class="fas fa-check"></i> Done!';
        App.toast('🎉 Published successfully!', 'success');
        setTimeout(() => App.navigate('dashboard'), 1500);
        return;
      } catch (err) {
        if (progressWrap) progressWrap.classList.add('hidden');
        btn.innerHTML = '<i class="fas fa-upload"></i> Publish Now';
        btn.disabled = false;
        App.toast('Upload failed. Please try again.', 'error');
        console.error(err);
        return;
      }
    }

    // Fallback — non-YouTube or scheduled/draft (existing behavior)
    const post = {
      id: Data.generateId(),
      title,
      description: desc,
      hashtags,
      platforms,
      status,
      scheduledAt,
      publishedAt: status === 'published' ? new Date().toISOString() : null,
      thumbnail: '🎬',
    };

    btn.innerHTML = '<i class="fas fa-spinner spinning"></i> Processing...';

    setTimeout(() => {
      Data.savePost(post);
      App.renderSidebar();

      const messages = {
        published: `🎉 Post published to ${platforms.length} platform(s)!`,
        scheduled: `📅 Post scheduled successfully!`,
        draft: `📝 Draft saved successfully!`,
      };

      App.toast(messages[status], 'success');
      App.navigate('dashboard');
    }, 1500);
  }
};

// Regenerate helpers called from HTML
const ComposerRegen = {
  regenerateTitles() {
    if (!ComposerState.generatedData) return;
    const topic = document.getElementById('ai-topic').value.trim();
    const keywords = document.getElementById('ai-keywords').value.trim().split(',').map(k => k.trim());
    const titles = AIGenerator.regenerateTitles(topic, keywords, 4);
    Composer.renderTitleOptions(titles);
  },
  regenerateDescription() {
    if (!ComposerState.generatedData) return;
    const topic = document.getElementById('ai-topic').value.trim();
    const keywords = document.getElementById('ai-keywords').value.trim().split(',').map(k => k.trim());
    const desc = AIGenerator.regenerateDescription(topic, keywords, ComposerState.currentTone, ComposerState.selectedPlatforms[0] || 'youtube');
    const descEl = document.getElementById('post-description');
    if (descEl) {
      descEl.value = desc;
      document.getElementById('desc-char-count').textContent = desc.length;
    }
  },
  regenerateHashtags() {
    if (!ComposerState.generatedData) return;
    const topic = document.getElementById('ai-topic').value.trim();
    const keywords = document.getElementById('ai-keywords').value.trim().split(',').map(k => k.trim());
    const hashtags = AIGenerator.regenerateHashtags(topic, keywords, 20, ComposerState.selectedPlatforms[0] || 'youtube');
    Composer.renderHashtags(hashtags);
  }
};

// Attach regenerate to AIGenerator namespace for HTML onclick calls
AIGenerator.regenerateTitles = ComposerRegen.regenerateTitles;
AIGenerator.regenerateDescription = ComposerRegen.regenerateDescription;
AIGenerator.regenerateHashtags = ComposerRegen.regenerateHashtags;

// ==============================
// AI STUDIO PAGE
// ==============================
const AIStudio = {
  init() {
    this.renderPlatformSelector();
  },

  renderPlatformSelector() {
    const container = document.getElementById('studio-platform-group');
    if (!container) return;

    container.innerHTML = getActivePlatforms().map((p, i) => `
      <button class="platform-radio-btn ${i === 0 && AIStudioState.lastPlatform === p.id || (!i && !AIStudioState.lastPlatform) ? 'active' : ''} ${AIStudioState.lastPlatform === p.id ? 'active' : ''}"
              onclick="AIStudio.selectPlatform(this, '${p.id}')">
        ${p.emoji} ${p.name}
      </button>
    `).join('');

    // Mark first active if none selected
    if (!AIStudioState.lastPlatform) {
      AIStudioState.lastPlatform = 'youtube';
      container.querySelector('.platform-radio-btn')?.classList.add('active');
    }
  },

  selectPlatform(btn, platformId) {
    document.querySelectorAll('#studio-platform-group .platform-radio-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    AIStudioState.lastPlatform = platformId;
  },

  generate() {
    const topic = document.getElementById('studio-topic').value.trim();
    if (!topic) {
      App.toast('Please enter a video topic!', 'warning');
      return;
    }

    const keywords = document.getElementById('studio-keywords').value.trim().split(',').map(k => k.trim()).filter(Boolean);
    const titleCount = parseInt(document.getElementById('studio-title-count').value) || 5;
    const hashtagCount = parseInt(document.getElementById('studio-hashtag-count').value) || 15;
    const tone = document.querySelector('.tone-btn.active')?.dataset.tone || 'engaging';

    AIStudioState.lastTopic = topic;
    AIStudioState.lastKeywords = keywords;
    AIStudioState.lastTone = tone;

    const btn = document.getElementById('studio-generate-btn');
    btn.innerHTML = '<i class="fas fa-spinner spinning"></i> Generating...';
    btn.disabled = true;

    document.getElementById('ai-empty-state').classList.add('hidden');

    setTimeout(() => {
      const results = AIGenerator.generateAll(topic, keywords, {
        titleCount,
        hashtagCount,
        tone,
        platform: AIStudioState.lastPlatform,
      });

      AIStudioState.results = results;
      this.renderResults(results);

      btn.innerHTML = '<i class="fas fa-sparkles"></i> Generate Content';
      btn.disabled = false;
      App.toast('Content generated!', 'success');
    }, 1000);
  },

  renderResults(results) {
    const el = document.getElementById('ai-studio-results');
    el.classList.remove('hidden');

    // Titles
    document.getElementById('studio-title-list').innerHTML = results.titles.map((title, i) => `
      <div class="studio-title-item">
        <div class="studio-title-num">${i + 1}</div>
        <div class="studio-title-text">${title}</div>
        <button class="btn-icon" style="width:28px;height:28px;font-size:12px;" onclick="App.copyText('${title.replace(/'/g, "\\'")}')">
          <i class="fas fa-copy"></i>
        </button>
      </div>
    `).join('');

    // Description
    document.getElementById('studio-description').textContent = results.description;

    // Hashtags
    document.getElementById('studio-hashtags').innerHTML = results.hashtags.map(tag => `
      <div class="hashtag-chip selected" onclick="App.copyText('#${tag}')">#${tag}</div>
    `).join('');

    // Tips
    document.getElementById('studio-tips').innerHTML = results.tips.map(tip => `
      <div class="engagement-tip">
        <div class="engagement-tip-icon">${tip.icon}</div>
        <div class="engagement-tip-text">${tip.text}</div>
      </div>
    `).join('');
  },

  regenerate() {
    if (!AIStudioState.lastTopic) return;
    this.generate();
  },

  regenerateDescription() {
    if (!AIStudioState.results) return;
    const tone = document.querySelector('.tone-btn.active')?.dataset.tone || 'engaging';
    const desc = AIGenerator.regenerateDescription(AIStudioState.lastTopic, AIStudioState.lastKeywords, tone, AIStudioState.lastPlatform);
    document.getElementById('studio-description').textContent = desc;
    App.toast('Description regenerated!', 'success');
  },

  regenerateHashtags() {
    if (!AIStudioState.results) return;
    const count = parseInt(document.getElementById('studio-hashtag-count').value) || 15;
    const hashtags = AIGenerator.regenerateHashtags(AIStudioState.lastTopic, AIStudioState.lastKeywords, count, AIStudioState.lastPlatform);
    document.getElementById('studio-hashtags').innerHTML = hashtags.map(tag => `
      <div class="hashtag-chip selected" onclick="App.copyText('#${tag}')">#${tag}</div>
    `).join('');
    App.toast('Hashtags regenerated!', 'success');
  },

  copyTitles() {
    if (!AIStudioState.results) return;
    App.copyText(AIStudioState.results.titles.join('\n'));
  },

  copyDescription() {
    const el = document.getElementById('studio-description');
    if (el) App.copyText(el.textContent);
  },

  copyHashtags() {
    if (!AIStudioState.results) return;
    App.copyText(AIStudioState.results.hashtags.map(h => `#${h}`).join(' '));
  }
};

// ==============================
// ACCOUNTS PAGE
// ==============================
const AccountsPage = {
  render() {
    const container = document.getElementById('accounts-grid');
    if (!container) return;

    const accounts = Data.getAccounts();

    container.innerHTML = accounts.map(acc => {
      const p = PLATFORMS[acc.platformId];
      if (!p) return '';

      const connectedUI = acc.connected ? `
        <div class="account-stats">
          <div class="account-stat">
            <div class="account-stat-value">${formatNumber(acc.followers)}</div>
            <div class="account-stat-label">Followers</div>
          </div>
          <div class="account-stat">
            <div class="account-stat-value">${acc.posts}</div>
            <div class="account-stat-label">Posts</div>
          </div>
        </div>
        <div class="account-actions">
          <button class="btn btn-ghost btn-sm flex-1" onclick="AccountsPage.viewPosts('${acc.platformId}')">
            <i class="fas fa-chart-bar"></i> View Posts
          </button>
          <button class="btn btn-danger btn-sm" id="${acc.platformId}-disconnect-btn" onclick="AccountsPage.disconnect('${acc.platformId}')">
            <i class="fas fa-unlink"></i>
          </button>
        </div>
      ` : `
        <div style="font-size:13px;color:var(--text-muted);">Connect your ${p.name} account to start posting.</div>
        <button class="btn btn-primary btn-sm" id="${acc.platformId}-connect-btn" onclick="AccountsPage.connect('${acc.platformId}')">
          <i class="fas fa-link"></i> Connect ${p.name}
        </button>
      `;

      return `
        <div class="account-card">
          <div class="account-card-header">
            <div class="account-platform-icon" style="background:${p.bgColor};">${p.emoji}</div>
            <div>
              <div class="account-platform-name">${p.name}</div>
              <div class="account-status">
                <div class="status-dot ${acc.connected ? 'connected' : 'disconnected'}"></div>
                <span style="color:${acc.connected ? 'var(--accent-green)' : 'var(--text-muted)'};">
                  ${acc.connected ? acc.username : 'Not connected'}
                </span>
              </div>
            </div>
          </div>
          ${connectedUI}
        </div>`;
    }).join('');
  },

  connect(platformId) {
    if (platformId === 'youtube' && typeof YouTube !== 'undefined') {
      YouTube.connect();
      return;
    }
    if ((platformId === 'facebook' || platformId === 'instagram') && typeof Meta !== 'undefined') {
      Meta.connect();
      return;
    }

    const p = PLATFORMS[platformId];
    App.openModal(`Connect ${p.name}`, `
      <div style="text-align:center;padding:20px 0;">
        <div style="font-size:48px;margin-bottom:16px;">${p.emoji}</div>
        <h3 style="font-size:18px;font-weight:700;margin-bottom:8px;">Connect to ${p.name}</h3>
        <p style="color:var(--text-secondary);font-size:14px;margin-bottom:24px;">
          Click the button below to authenticate with ${p.name}'s official OAuth system.
          You'll be redirected to grant Viralify permission to post on your behalf.
        </p>
        <button class="btn btn-primary" style="width:100%;" onclick="AccountsPage.simulateConnect('${platformId}')">
          <i class="fas fa-link"></i> Authenticate with ${p.name}
        </button>
        <p style="font-size:12px;color:var(--text-muted);margin-top:16px;">
          🔒 Secure OAuth 2.0 — we never see your password
        </p>
      </div>
    `);
  },

  simulateConnect(platformId) {
    if (platformId === 'youtube' && typeof YouTube !== 'undefined') {
      App.closeModal();
      YouTube.connect();
      return;
    }
    if ((platformId === 'facebook' || platformId === 'instagram') && typeof Meta !== 'undefined') {
      App.closeModal();
      Meta.connect();
      return;
    }

    const acc = Data.getAccount(platformId) || { platformId };
    acc.connected = true;
    acc.username = `@viralify_${platformId}`;
    acc.followers = Math.floor(Math.random() * 10000) + 500;
    acc.posts = Math.floor(Math.random() * 100) + 5;
    Data.saveAccount(acc);

    App.closeModal();
    App.toast(`${PLATFORMS[platformId].name} connected successfully!`, 'success');
    this.render();
    App.renderSidebar();
  },

  disconnect(platformId) {
    const p = PLATFORMS[platformId];
    App.openModal('Disconnect Account', `
      <div style="text-align:center;padding:16px 0;">
        <div style="font-size:36px;margin-bottom:12px;">⚠️</div>
        <p style="color:var(--text-secondary);font-size:14px;margin-bottom:20px;">
          Are you sure you want to disconnect your ${p.name} account?<br>
          Scheduled posts for this platform will be paused.
        </p>
        <div style="display:flex;gap:12px;justify-content:center;">
          <button class="btn btn-ghost" onclick="App.closeModal()">Cancel</button>
          <button class="btn btn-danger" onclick="AccountsPage.confirmDisconnect('${platformId}')">Disconnect</button>
        </div>
      </div>
    `);
  },

  confirmDisconnect(platformId) {
    if (platformId === 'youtube' && typeof YouTube !== 'undefined') {
      App.closeModal();
      YouTube.disconnect();
      return;
    }
    if ((platformId === 'facebook' || platformId === 'instagram') && typeof Meta !== 'undefined') {
      App.closeModal();
      Meta.disconnect();
      return;
    }


    const acc = Data.getAccount(platformId);
    if (acc) {
      acc.connected = false;
      acc.username = '';
      acc.followers = 0;
      acc.posts = 0;
      Data.saveAccount(acc);
    }
    App.closeModal();
    App.toast(`${PLATFORMS[platformId].name} disconnected.`, 'info');
    this.render();
    App.renderSidebar();
  },

  async viewPosts(platformId) {
    const p = PLATFORMS[platformId];

    if (platformId === 'youtube' && typeof YouTube !== 'undefined') {
      App.openModal(`${p.emoji} ${p.name} Uploaded Videos`, `
        <div style="text-align:center;padding:30px;" id="youtube-modal-loading">
          <i class="fas fa-spinner fa-spin" style="font-size:32px;color:var(--accent-purple);"></i>
          <p style="margin-top:12px;color:var(--text-secondary);font-size:14px;">Fetching live YouTube videos...</p>
        </div>
        <div id="youtube-posts-container"></div>
      `);

      try {
        const res = await YouTube.getPosts();
        const container = document.getElementById('youtube-posts-container');
        const loading = document.getElementById('youtube-modal-loading');
        if (loading) loading.style.display = 'none';

        if (res && res.success && res.posts && res.posts.length > 0) {
          if (container) {
            container.innerHTML = `<div class="posts-list">` + res.posts.map(post => `
              <div class="post-item" style="display:flex;align-items:center;gap:12px;padding:12px;border-bottom:1px solid var(--border-color, rgba(255,255,255,0.08));">
                <img src="${post.thumbnail}" alt="${post.title}" style="width:80px;height:45px;object-fit:cover;border-radius:8px;" />
                <div class="post-info" style="flex:1;">
                  <div class="post-title" style="font-weight:600;font-size:14px;line-height:1.3;margin-bottom:4px;">${post.title}</div>
                  <div class="post-meta" style="font-size:12px;color:var(--text-muted);">
                    Published: ${new Date(post.publishedAt).toLocaleDateString()}
                  </div>
                </div>
                <a href="${post.videoUrl}" target="_blank" rel="noopener" class="btn btn-primary btn-sm" style="text-decoration:none;white-space:nowrap;">
                  <i class="fab fa-youtube"></i> Watch
                </a>
              </div>`).join('') + `</div>`;
          }
        } else {
          if (container) {
            container.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:20px;">No uploaded videos found on your YouTube channel.</p>`;
          }
        }
      } catch (err) {
        console.error('Failed to load YouTube videos:', err);
        const container = document.getElementById('youtube-posts-container');
        const loading = document.getElementById('youtube-modal-loading');
        if (loading) loading.style.display = 'none';
        if (container) {
          container.innerHTML = `<p style="color:var(--accent-red, #ff4757);text-align:center;padding:20px;">Failed to load videos from YouTube.</p>`;
        }
      }
      return;
    }

    const posts = Data.getPosts().filter(post => post.platforms && post.platforms.includes(platformId));
    const postsHtml = posts.length
      ? posts.map(post => `
          <div class="post-item">
            <div class="post-thumb">${post.thumbnail || '🎬'}</div>
            <div class="post-info">
              <div class="post-title">${post.title}</div>
              <div class="post-meta"><span class="badge badge-${post.status}">${post.status}</span></div>
            </div>
          </div>`).join('')
      : `<p style="color:var(--text-muted);text-align:center;padding:20px;">No posts for ${p.name} yet.</p>`;

    App.openModal(`${p.emoji} ${p.name} Posts`, `<div class="posts-list">${postsHtml}</div>`);
  }
};

// ==============================
// UTILITIES
// ==============================
App.copyText = function(text) {
  navigator.clipboard.writeText(text).then(() => {
    App.toast('Copied to clipboard!', 'success', 2000);
  }).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    App.toast('Copied!', 'success', 2000);
  });
};

function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

// ==============================
// INIT
// ==============================
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

// ==============================
// F001: AUTH HELPERS
// ==============================

/**
 * Checks Firebase auth state and redirects unauthenticated users to auth.html.
 * Called at the top of App.init() when window.FIREBASE_READY is true.
 * @returns {Promise<boolean>} true if user is authenticated and can proceed
 */
async function checkAuthAndInit() {
  return new Promise((resolve) => {
    const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
      unsubscribe();

      if (!user) {
        console.log('[Viralify App] No authenticated user — redirecting to auth.');
        window.location.replace('auth.html');
        resolve(false);
        return;
      }

      // Hard gate: email/password users must have verified email
      if (!user.emailVerified && user.providerData[0]?.providerId === 'password') {
        console.log('[Viralify App] Email not verified — redirecting to auth.');
        window.location.replace('auth.html');
        resolve(false);
        return;
      }

      // Authenticated — update sidebar with real user info
      updateSidebarUser(user);
      resolve(true);
    });
  });
}

/**
 * Updates the sidebar with authenticated user's display name, email, and avatar.
 * @param {object} user - Firebase Auth user object
 */
function updateSidebarUser(user) {
  const displayName = user.displayName || user.email?.split('@')[0] || 'User';
  const email = user.email || '';
  const photoURL = user.photoURL;

  const nameEl = document.getElementById('user-display-name');
  if (nameEl) nameEl.textContent = displayName;

  const emailEl = document.getElementById('user-email');
  if (emailEl) emailEl.textContent = email;

  const initialsEl = document.getElementById('user-avatar-initials');
  const photoEl = document.getElementById('user-avatar-photo');

  if (photoURL && photoEl) {
    photoEl.src = photoURL;
    photoEl.style.display = 'block';
    if (initialsEl) initialsEl.style.display = 'none';
  } else if (initialsEl) {
    const initials = displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    initialsEl.textContent = initials;
  }
}

/**
 * Signs out the current user and redirects to auth page.
 * Called by the sidebar Sign Out button.
 */
App.signOut = async function () {
  if (!window.FIREBASE_READY) return;
  try {
    await firebase.auth().signOut();
    window.location.replace('auth.html');
  } catch (err) {
    console.error('[Viralify App] Sign out error:', err);
  }
};
