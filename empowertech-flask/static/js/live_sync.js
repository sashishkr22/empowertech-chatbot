// ================================================================
// live_sync.js  — Auto-refreshes dashboard data every 10 seconds
// ================================================================
// HOW IT WORKS:
//   1. Every 10 seconds, fetch /api/tickets/live from Flask
//   2. Update the stat cards and ticket table in place
//   3. Show a "New ticket!" notification if count changes
//   4. No page reload needed — smooth live updates
//
// ADD THIS TO base.html:
//   <script src="{{ url_for('static', filename='js/live_sync.js') }}"></script>
// ================================================================

(function () {
  'use strict';

  // ── Config ──────────────────────────────────────────────────
  const POLL_INTERVAL = 10000;   // 10 seconds
  let   lastTotal     = null;
  let   lastHandoffs  = null;
  let   pollTimer     = null;
  let   isPolling     = false;

  // ── Only run on dashboard page ───────────────────────────────
  const isDashboard = document.querySelector('.stats-grid') !== null;
  const isTickets   = document.querySelector('.ticket-table') !== null;
  if (!isDashboard && !isTickets) return;

  // ── Create live indicator badge ──────────────────────────────
  const badge = document.createElement('div');
  badge.id    = 'live-badge';
  badge.style.cssText = `
    position: fixed; bottom: 32px; right: 32px;
    padding: 10px; border-radius: 30px; font-size: 12px;
    font-family: 'Inter', sans-serif; font-weight: 700;
    display: flex; align-items: center; gap: 0;
    z-index: 999; transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden; white-space: nowrap; width: 32px; height: 32px;
    cursor: default;
  `;
  badge.innerHTML = `
    <span class="live-dot" style="width:12px;height:12px;background:var(--green);border-radius:50%;
                 animation:livepulse 2s infinite;display:inline-block;box-shadow:0 0 8px var(--green);flex-shrink:0;"></span>
    <span class="live-text" style="opacity:0; margin-left:0; transition: all 0.5s ease;">Live sync ON</span>
  `;
  document.body.appendChild(badge);

  // Helper to expand/collapse badge
  function expandBadge(text = null) {
    const textEl = badge.querySelector('.live-text');
    if (text) textEl.textContent = text;
    
    badge.style.width = '140px';
    badge.style.padding = '10px 18px';
    textEl.style.opacity = '1';
    textEl.style.marginLeft = '10px';
    
    setTimeout(() => {
      badge.style.width = '32px';
      badge.style.padding = '10px';
      textEl.style.opacity = '0';
      textEl.style.marginLeft = '0';
    }, 4000);
  }

  // Hover effect
  badge.addEventListener('mouseenter', () => {
    const textEl = badge.querySelector('.live-text');
    badge.style.width = '140px';
    badge.style.padding = '10px 18px';
    textEl.style.opacity = '1';
    textEl.style.marginLeft = '10px';
  });
  badge.addEventListener('mouseleave', () => {
    const textEl = badge.querySelector('.live-text');
    badge.style.width = '32px';
    badge.style.padding = '10px';
    textEl.style.opacity = '0';
    textEl.style.marginLeft = '0';
  });

  // Expand initially
  expandBadge();

  // Add keyframe for badge pulse
  const style = document.createElement('style');
  style.textContent = `@keyframes livepulse{0%,100%{opacity:1}50%{opacity:0.4}}`;
  document.head.appendChild(style);

  // ── Notification toast ───────────────────────────────────────
  function showNotification(msg, type='primary') {
    const n = document.createElement('div');
    n.className = 'live-notification';
    n.innerHTML = `<span>${msg}</span>`;
    if (type === 'handoff') {
      n.style.borderColor = 'var(--primary)';
    }
    document.body.appendChild(n);
    setTimeout(() => {
      n.style.opacity = '0';
      n.style.transform = 'translateX(100%)';
      n.style.transition = 'all 0.4s ease';
      setTimeout(() => n.remove(), 400);
    }, 4000);
  }

  // ── Update stat cards on dashboard ───────────────────────────
  function updateStats(data) {
    const stats = data.stats;
    const map = {
      '.stat-card.open       .stat-value': stats.open,
      '.stat-card.inprogress .stat-value': stats.in_progress,
      '.stat-card.resolved   .stat-value': stats.resolved,
    };
    for (const [sel, val] of Object.entries(map)) {
      const el = document.querySelector(sel.trim());
      if (el && el.textContent != val) {
        el.textContent = val;
        el.style.transition = 'color 0.5s';
        el.style.color = '#6ee7b7';
        setTimeout(() => { el.style.color = ''; }, 1500);
      }
    }
    
    // Update handoffs specifically
    const handoffVal = document.querySelector('.stat-card[onclick*="handoffs"] .stat-value');
    if (handoffVal && handoffVal.textContent != data.active_handoffs) {
        handoffVal.textContent = data.active_handoffs;
        handoffVal.style.color = '#6ee7b7';
        setTimeout(() => { handoffVal.style.color = ''; }, 1500);
    }
    
    // Update ticket total
    const ticketTotal = document.querySelectorAll('.stat-card.total')[1]?.querySelector('.stat-value');
    if (ticketTotal && ticketTotal.textContent != data.total) {
        ticketTotal.textContent = data.total;
    }
  }

  // ── Poll the live endpoint ────────────────────────────────────
  async function poll() {
    if (isPolling) return;
    isPolling = true;

    try {
      const res  = await fetch('/api/tickets/live');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();

      // Update stats if on dashboard
      if (isDashboard && data.stats) {
        updateStats(data);
      }

      // Detect new tickets
      if (lastTotal !== null && data.total > lastTotal) {
        const diff = data.total - lastTotal;
        showNotification(`🎫 ${diff} new ticket${diff>1?'s':''} arrived!`, 'primary');
        // If on tickets page, refresh to show new rows
        if (isTickets && !window.location.pathname.includes('handoff')) {
          setTimeout(() => window.location.reload(), 1500);
        }
      }
      
      // Detect new handoffs
      if (lastHandoffs !== null && data.handoffs_count > lastHandoffs) {
        const diff = data.handoffs_count - lastHandoffs;
        showNotification(`💬 ${diff} new chat request${diff>1?'s':''}!`, 'handoff');
        if (window.location.pathname.includes('handoffs')) {
            setTimeout(() => window.location.reload(), 1500);
        }
      }

      lastTotal = data.total;
      lastHandoffs = data.handoffs_count;

      // Update badge timestamp/status
      expandBadge('Live sync ON');

    } catch (err) {
      console.warn('Live sync error:', err.message);
      badge.style.background = '#450a0a';
      expandBadge('Sync error');
    } finally {
      isPolling = false;
    }
  }

  // ── Start polling ────────────────────────────────────────────
  poll();   // immediate first poll
  pollTimer = setInterval(poll, POLL_INTERVAL);

  // Stop polling when tab hidden (save resources)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(pollTimer);
    } else {
      poll();
      pollTimer = setInterval(poll, POLL_INTERVAL);
    }
  });

})();
