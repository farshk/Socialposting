// =============================================
// VIRALIFY — SCHEDULER.JS
// Calendar rendering and scheduling logic
// =============================================

const Calendar = (() => {

  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth(); // 0-indexed

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }

  function getFirstDayOfMonth(year, month) {
    return new Date(year, month, 1).getDay(); // 0 = Sunday
  }

  function getPostsOnDate(posts, year, month, day) {
    const target = new Date(year, month, day);
    const targetStr = target.toDateString();
    return posts.filter(p => {
      if (!p.scheduledAt) return false;
      const d = new Date(p.scheduledAt);
      return d.toDateString() === targetStr;
    });
  }

  function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const label = document.getElementById('calendar-month-label');
    if (!grid || !label) return;

    label.textContent = `${MONTH_NAMES[currentMonth]} ${currentYear}`;

    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const today = new Date();

    const posts = Data.getPosts();

    let html = '';

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      const prevMonthDay = getDaysInMonth(currentYear, currentMonth - 1) - firstDay + i + 1;
      html += `<div class="calendar-day other-month"><span class="cal-day-num">${prevMonthDay}</span></div>`;
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = (
        today.getFullYear() === currentYear &&
        today.getMonth() === currentMonth &&
        today.getDate() === day
      );
      const dayPosts = getPostsOnDate(posts, currentYear, currentMonth, day);
      const hasPosts = dayPosts.length > 0;

      const dotsHtml = dayPosts.slice(0, 4).map(p => {
        const platforms = p.platforms || [];
        const firstPlatform = platforms[0];
        const color = firstPlatform ? (PLATFORMS[firstPlatform]?.color || '#7c3aed') : '#7c3aed';
        return `<div class="cal-post-dot" style="background:${color}" title="${p.title}"></div>`;
      }).join('');

      html += `
        <div class="calendar-day ${isToday ? 'today' : ''} ${hasPosts ? 'has-posts' : ''}"
             onclick="Calendar.selectDay(${currentYear}, ${currentMonth}, ${day})"
             title="${hasPosts ? dayPosts.length + ' post(s)' : ''}">
          <span class="cal-day-num">${day}</span>
          ${hasPosts ? `<div class="cal-post-dots">${dotsHtml}</div>` : ''}
        </div>`;
    }

    // Fill remaining cells
    const totalCells = firstDay + daysInMonth;
    const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= remainingCells; i++) {
      html += `<div class="calendar-day other-month"><span class="cal-day-num">${i}</span></div>`;
    }

    grid.innerHTML = html;
  }

  function renderScheduledPosts(filterPlatform = 'all') {
    const container = document.getElementById('scheduled-posts-list');
    if (!container) return;

    let posts = Data.getPosts().filter(p => p.status === 'scheduled' || p.status === 'published');
    if (filterPlatform !== 'all') {
      posts = posts.filter(p => p.platforms && p.platforms.includes(filterPlatform));
    }

    // Sort by date
    posts.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

    if (posts.length === 0) {
      container.innerHTML = `<div class="text-center" style="padding:32px 0; color:var(--text-muted);">
        <i class="fas fa-calendar-times" style="font-size:32px; margin-bottom:12px; display:block;"></i>
        No posts for this filter.
      </div>`;
      return;
    }

    container.innerHTML = posts.map(post => {
      const date = post.scheduledAt ? new Date(post.scheduledAt) : null;
      const dateStr = date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set';
      const timeStr = date ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
      const platformsHtml = (post.platforms || []).map(id => getPlatformBadge(id)).join('');
      const statusBadge = `<span class="badge badge-${post.status}">${post.status}</span>`;

      return `
        <div class="post-item" onclick="App.showPostDetail('${post.id}')">
          <div class="post-thumb">${post.thumbnail || '🎬'}</div>
          <div class="post-info">
            <div class="post-title">${post.title}</div>
            <div class="post-meta">
              ${statusBadge}
              <span><i class="fas fa-clock" style="font-size:10px"></i> ${dateStr} ${timeStr}</span>
            </div>
            <div class="post-platforms" style="margin-top:4px;">${platformsHtml}</div>
          </div>
        </div>`;
    }).join('');
  }

  function renderPlatformFilters() {
    const container = document.getElementById('sched-platform-filter');
    if (!container) return;

    const connectedIds = Data.getConnectedPlatforms();
    const btnHtml = connectedIds.map(id => {
      const p = PLATFORMS[id];
      return `<button class="platform-filter-btn" data-platform="${id}" onclick="Calendar.filterByPlatform('${id}')">${p.emoji} ${p.name}</button>`;
    }).join('');

    container.innerHTML = `<button class="platform-filter-btn active" data-platform="all" onclick="Calendar.filterByPlatform('all')">All</button>${btnHtml}`;
  }

  // Best time suggestions based on platform
  function renderBestTimes(selectedPlatforms) {
    const container = document.getElementById('best-times-grid');
    if (!container) return;

    const platforms = selectedPlatforms.length > 0
      ? selectedPlatforms
      : Object.keys(PLATFORMS).slice(0, 4);

    container.innerHTML = platforms.map(id => {
      const p = PLATFORMS[id];
      if (!p) return '';
      return `
        <div class="best-time-card" onclick="Composer.applyBestTime('${id}')">
          <div class="best-time-platform">${p.emoji}</div>
          <div class="best-time-text">${p.bestTime.time}</div>
          <div class="best-time-days">${p.bestTime.days}</div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">${p.name}</div>
        </div>`;
    }).join('');
  }

  return {
    init() {
      renderCalendar();
      renderScheduledPosts();
      renderPlatformFilters();
    },

    prevMonth() {
      currentMonth--;
      if (currentMonth < 0) { currentMonth = 11; currentYear--; }
      renderCalendar();
    },

    nextMonth() {
      currentMonth++;
      if (currentMonth > 11) { currentMonth = 0; currentYear++; }
      renderCalendar();
    },

    selectDay(year, month, day) {
      const posts = Data.getPosts();
      const dayPosts = posts.filter(p => {
        if (!p.scheduledAt) return false;
        const d = new Date(p.scheduledAt);
        return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
      });

      const dateStr = new Date(year, month, day).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });

      let content = '';
      if (dayPosts.length === 0) {
        content = `
          <div class="text-center" style="padding:20px 0; color:var(--text-muted);">
            <p>No posts scheduled for this day.</p>
            <button class="btn btn-primary btn-sm mt-3" onclick="App.closeModal(); App.navigate('composer');">
              <i class="fas fa-plus"></i> Schedule a Post
            </button>
          </div>`;
      } else {
        content = dayPosts.map(p => {
          const platformsHtml = (p.platforms || []).map(id => getPlatformBadge(id)).join('');
          return `
            <div class="post-item" style="margin-bottom:8px;">
              <div class="post-thumb">${p.thumbnail || '🎬'}</div>
              <div class="post-info">
                <div class="post-title">${p.title}</div>
                <div class="post-meta">
                  <span class="badge badge-${p.status}">${p.status}</span>
                </div>
                <div class="post-platforms" style="margin-top:4px;">${platformsHtml}</div>
              </div>
            </div>`;
        }).join('');
      }

      App.openModal(`Posts — ${dateStr}`, content);
    },

    filterByPlatform(platformId) {
      document.querySelectorAll('#sched-platform-filter .platform-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.platform === platformId);
      });
      renderScheduledPosts(platformId);
    },

    renderBestTimes,
    refresh() {
      renderCalendar();
      renderScheduledPosts();
    }
  };
})();
