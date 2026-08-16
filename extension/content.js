(() => {
  'use strict';

  if (globalThis.__DAGGEROK_X_COLLECTOR_EXTENSION_LOADED__) {
    globalThis.__DAGGEROK_X_COLLECTOR_EXTENSION_API__?.showPanel('Panel reopened after reinjection');
    return;
  }
  globalThis.__DAGGEROK_X_COLLECTOR_EXTENSION_LOADED__ = true;

  const SCHEMA = 'daggerok-x-collector/v1';
  const DEFAULT_MAX_SCROLLS = 80;
  const DEFAULT_DELAY_MS = 2500;
  const MAX_KNOWN_IDS = 25000;
  const PANEL_ID = 'daggerok-x-collector-host';

  let targetHandle = getProfileHandle();
  let knownIds = new Set();
  let initialKnownIds = new Set();
  let session = new Map();
  let collecting = false;
  let autoScrolling = false;
  let autoTimer = null;
  let scanTimer = null;
  let scrollCount = 0;
  let noNewCount = 0;
  let reachedKnown = false;
  let lastReason = 'Ready';
  let ui = null;

  const storageGet = (key, fallback) => new Promise(resolve => {
    chrome.storage.local.get([key], result => {
      if (chrome.runtime.lastError) return resolve(fallback);
      resolve(result[key] ?? fallback);
    });
  });
  const storageSet = (key, value) => new Promise(resolve => {
    chrome.storage.local.set({ [key]: value }, () => resolve());
  });
  const storageRemove = key => new Promise(resolve => {
    chrome.storage.local.remove(key, () => resolve());
  });
  const knownKey = () => `known:${(targetHandle || 'unknown').toLowerCase()}`;

  console.info('[daggerok X Collector] Chrome extension v1.0.0 loaded', location.href);
  document.documentElement.dataset.daggerokXCollectorExtension = '1.0.0';

  function getProfileHandle() {
    const part = location.pathname.split('/').filter(Boolean)[0] || '';
    const blocked = new Set(['home', 'explore', 'notifications', 'messages', 'i', 'search', 'settings', 'compose', 'login', 'logout']);
    return /^[A-Za-z0-9_]{1,15}$/.test(part) && !blocked.has(part.toLowerCase()) ? part : '';
  }

  function directMatches(root, selector) {
    return Array.from(root.querySelectorAll(selector)).filter(element => element.closest('article[data-testid="tweet"]') === root);
  }

  function parseCount(value) {
    const text = String(value || '').replace(/,/g, '');
    const match = text.match(/(\d+(?:\.\d+)?)\s*([KMB])?/i);
    if (!match) return 0;
    const multipliers = { K: 1e3, M: 1e6, B: 1e9 };
    return Math.round(Number(match[1]) * (multipliers[(match[2] || '').toUpperCase()] || 1));
  }

  function metric(article, selectors) {
    for (const selector of selectors) {
      const element = directMatches(article, selector)[0];
      if (!element) continue;
      const value = element.getAttribute('aria-label') || element.innerText || element.textContent || '';
      const count = parseCount(value);
      if (count || /\b0\b/.test(value)) return count;
    }
    return 0;
  }

  function parseTweet(article) {
    if (!targetHandle) return null;
    const allText = article.innerText || '';
    const lines = allText.split('\n').map(line => line.trim()).filter(Boolean);
    if (lines.some(line => line === 'Promoted' || line === 'Ad')) return null;

    const times = directMatches(article, 'time');
    const time = times[0];
    const statusLink = time?.closest('a[href*="/status/"]');
    const href = statusLink?.getAttribute('href') || '';
    const match = href.match(/^\/([^/]+)\/status\/(\d+)/);
    if (!match) return null;

    const authorHandle = match[1];
    const id = match[2];
    const socialContext = lines.slice(0, 8).find(line => /\b(reposted|retweeted)\b/i.test(line)) || '';
    // On a profile timeline, a rendered social-context row identifies a repost by that profile.
    // X normally uses the display name (not @handle), so do not require a handle text match.
    const isRepost = Boolean(socialContext);
    if (authorHandle.toLowerCase() !== targetHandle.toLowerCase() && !isRepost) return null;

    const textElement = directMatches(article, '[data-testid="tweetText"]')[0];
    const text = textElement?.innerText || '';
    const replyIndex = lines.findIndex(line => /^Replying to\b/i.test(line));
    const replyLine = replyIndex >= 0 ? lines.slice(replyIndex, replyIndex + 4).join(' ') : '';
    const replyHandles = replyLine.match(/@[A-Za-z0-9_]{1,15}/g) || [];
    const inReplyToUsername = replyHandles[0]?.slice(1) || '';
    const statusIds = directMatches(article, 'a[href*="/status/"]')
      .map(link => (link.getAttribute('href') || '').match(/\/status\/(\d+)/)?.[1])
      .filter(Boolean);
    const isQuote = new Set(statusIds).size > 1 || directMatches(article, '[data-testid="tweetText"]').length > 1;
    const media = Array.from(new Set(
      directMatches(article, '[data-testid="tweetPhoto"] img, video[poster], [data-testid="videoPlayer"] video')
        .map(element => element.tagName === 'VIDEO' ? (element.poster || element.currentSrc || element.src || '') : (element.currentSrc || element.src || ''))
        .filter(Boolean)
    ));
    const capturedAt = new Date().toISOString();
    const createdAt = time?.getAttribute('datetime') || capturedAt;

    return {
      id,
      url: new URL(href, 'https://x.com').href,
      text,
      createdAt,
      author: { userName: authorHandle },
      isReply: Boolean(replyLine),
      inReplyToUsername,
      inReplyToUserId: '',
      conversationId: id,
      replyCount: metric(article, ['button[data-testid="reply"]']),
      retweetCount: metric(article, ['button[data-testid="retweet"]', 'button[data-testid="unretweet"]']),
      likeCount: metric(article, ['button[data-testid="like"]', 'button[data-testid="unlike"]']),
      viewCount: metric(article, ['a[href$="/analytics"]', '[aria-label*="views" i]']),
      retweeted_tweet: isRepost ? { socialContext } : null,
      quoted_tweet: isQuote ? { detectedFromRenderedCard: true } : null,
      media,
      capturedAt,
      collectorContext: [socialContext, replyLine].filter(Boolean).join(' · '),
      collectorSource: 'rendered-x-dom'
    };
  }

  async function loadKnown() {
    const values = await storageGet(knownKey(), []);
    knownIds = new Set(Array.isArray(values) ? values.map(String) : []);
    initialKnownIds = new Set(knownIds);
  }

  async function persistKnown() {
    const values = Array.from(knownIds);
    await storageSet(knownKey(), values.slice(Math.max(0, values.length - MAX_KNOWN_IDS)));
  }

  async function scanVisible() {
    if (!collecting || !targetHandle) return 0;
    let added = 0;
    for (const article of document.querySelectorAll('article[data-testid="tweet"]')) {
      const tweet = parseTweet(article);
      if (!tweet) continue;
      if (initialKnownIds.has(tweet.id) && !session.has(tweet.id)) reachedKnown = true;
      if (knownIds.has(tweet.id) || session.has(tweet.id)) continue;
      session.set(tweet.id, tweet);
      knownIds.add(tweet.id);
      added++;
    }
    if (added) {
      noNewCount = 0;
      await persistKnown();
      lastReason = `Captured ${added} new post${added === 1 ? '' : 's'}`;
    }
    updateUi();
    return added;
  }

  function scheduleScan() {
    if (!collecting || scanTimer) return;
    scanTimer = setTimeout(async () => {
      scanTimer = null;
      await scanVisible();
    }, 300);
  }

  async function autoStep() {
    if (!collecting || !autoScrolling) return;
    const before = session.size;
    await scanVisible();
    const added = session.size - before;
    noNewCount = added ? 0 : noNewCount + 1;

    const maxScrolls = Math.max(1, Math.min(500, Number(ui.maxScrolls.value) || DEFAULT_MAX_SCROLLS));
    const delay = Math.max(1200, Math.min(10000, Number(ui.delay.value) || DEFAULT_DELAY_MS));
    if (scrollCount >= maxScrolls) return stop(`Stopped at the ${maxScrolls}-scroll safety cap`);
    if (reachedKnown && window.scrollY > window.innerHeight * 2 && noNewCount >= 3) return stop('Reached posts collected on an earlier run');
    if (noNewCount >= 10) return stop('Stopped after 10 scans with no new rendered posts');

    scrollCount++;
    window.scrollBy({ top: Math.max(520, Math.floor(window.innerHeight * 0.78)), behavior: 'smooth' });
    lastReason = `Assisted scroll ${scrollCount}/${maxScrolls}`;
    updateUi();
    autoTimer = setTimeout(autoStep, delay);
  }

  async function start(auto) {
    targetHandle = getProfileHandle();
    if (!targetHandle) {
      lastReason = 'Open a public profile page first';
      updateUi();
      return;
    }
    if (!collecting && session.size === 0) {
      await loadKnown();
      scrollCount = 0;
      noNewCount = 0;
      reachedKnown = false;
    }
    collecting = true;
    autoScrolling = Boolean(auto);
    lastReason = auto ? 'Collecting with assisted scrolling' : 'Collecting while you scroll manually';
    await scanVisible();
    updateUi();
    if (autoScrolling) {
      clearTimeout(autoTimer);
      autoTimer = setTimeout(autoStep, 800);
    }
  }

  function stop(reason = 'Paused by you') {
    collecting = false;
    autoScrolling = false;
    clearTimeout(autoTimer);
    autoTimer = null;
    lastReason = reason;
    updateUi();
  }

  function payload() {
    return {
      schema: SCHEMA,
      handle: targetHandle,
      collectedAt: new Date().toISOString(),
      sourcePage: location.href,
      assistedScrolling: scrollCount > 0,
      tweets: Array.from(session.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    };
  }

  async function copyJson() {
    if (!session.size) {
      lastReason = 'No new posts to copy yet';
      updateUi();
      return;
    }
    const json = JSON.stringify(payload(), null, 2);
    try {
      await navigator.clipboard.writeText(json);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = json;
      textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    lastReason = `Copied ${session.size} new post${session.size === 1 ? '' : 's'} as JSON`;
    updateUi();
  }

  function downloadJson() {
    if (!session.size) {
      lastReason = 'No new posts to download yet';
      updateUi();
      return;
    }
    const blob = new Blob([JSON.stringify(payload(), null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `x-${targetHandle}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    lastReason = `Downloaded ${session.size} posts`;
    updateUi();
  }

  async function resetHistory() {
    if (!confirm(`Forget all collected IDs for @${targetHandle || '?'}? The dashboard data is not affected.`)) return;
    stop('History cleared');
    session.clear();
    knownIds.clear();
    initialKnownIds.clear();
    await storageRemove(knownKey());
    updateUi();
  }

  function newSession() {
    stop('New capture session ready');
    session.clear();
    scrollCount = 0;
    noNewCount = 0;
    reachedKnown = false;
    loadKnown().then(updateUi);
  }

  function createPanel() {
    if (!document.body) {
      setTimeout(createPanel, 100);
      return;
    }
    document.getElementById(PANEL_ID)?.remove();
    const host = document.createElement('div');
    host.id = PANEL_ID;
    host.style.cssText = 'all:initial;position:fixed;right:16px;bottom:16px;z-index:2147483647;font-family:Inter,system-ui,sans-serif;';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        *{box-sizing:border-box} .panel{width:310px;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:14px;box-shadow:0 16px 50px rgba(0,0,0,.45);overflow:hidden;font-size:12px}
        header{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#111c31;border-bottom:1px solid #334155}.title{font-weight:750;color:#34d399}.sub{font-size:10px;color:#94a3b8;margin-top:1px}.close{border:0;background:transparent;color:#94a3b8;font-size:17px;cursor:pointer}
        main{padding:11px;display:grid;gap:9px}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.stat{background:#111827;border:1px solid #263348;border-radius:8px;padding:7px;text-align:center}.num{display:block;font-weight:800;font-size:15px;color:#f8fafc}.label{font-size:9px;color:#94a3b8;text-transform:uppercase}
        .status{padding:8px;border-radius:8px;background:#0b1220;color:#a7f3d0;line-height:1.35;min-height:44px}.row{display:flex;gap:6px}.row>*{flex:1}button{border:1px solid #334155;border-radius:8px;background:#1e293b;color:#e2e8f0;padding:7px 6px;font:inherit;font-weight:650;cursor:pointer}button:hover{background:#334155}.primary{background:#059669;border-color:#10b981;color:white}.primary:hover{background:#047857}.danger{color:#fda4af}label{display:grid;gap:3px;color:#94a3b8;font-size:10px}input,select{width:100%;border:1px solid #334155;border-radius:6px;background:#0b1220;color:#e2e8f0;padding:5px;font:inherit}.warn{font-size:9px;line-height:1.35;color:#fbbf24}.hidden{display:none}
      </style>
      <section class="panel">
        <header><div><div class="title">𝕏 ICT Collector</div><div id="profile" class="sub">Profile: —</div></div><button id="close" class="close" title="Hide panel">×</button></header>
        <main>
          <div class="stats"><div class="stat"><span id="captured" class="num">0</span><span class="label">new</span></div><div class="stat"><span id="scrolls" class="num">0</span><span class="label">scrolls</span></div><div class="stat"><span id="known" class="num">0</span><span class="label">known</span></div></div>
          <div id="status" class="status">Ready</div>
          <div class="row"><button id="manual" class="primary">Start Manual</button><button id="auto" class="primary">Start + Auto</button><button id="pause">Pause</button></div>
          <div class="row"><label>Max scrolls<input id="maxScrolls" type="number" min="1" max="500" value="${DEFAULT_MAX_SCROLLS}"></label><label>Delay<select id="delay"><option value="1800">1.8 sec</option><option value="2500" selected>2.5 sec</option><option value="4000">4 sec</option><option value="6000">6 sec</option></select></label></div>
          <div class="row"><button id="copy">Copy New JSON</button><button id="download">Download JSON</button></div>
          <div class="row"><button id="newSession">New Session</button><button id="reset" class="danger">Forget Known IDs</button></div>
          <div class="warn">Assisted scrolling is optional and may trigger X anti-automation limits. Keep this tab visible, use a conservative delay, and stop if X warns or rate-limits you. No cookies or credentials are collected.</div>
        </main>
      </section>`;
    document.body.appendChild(host);
    ui = {
      host,
      profile: shadow.getElementById('profile'),
      captured: shadow.getElementById('captured'),
      scrolls: shadow.getElementById('scrolls'),
      known: shadow.getElementById('known'),
      status: shadow.getElementById('status'),
      maxScrolls: shadow.getElementById('maxScrolls'),
      delay: shadow.getElementById('delay')
    };
    shadow.getElementById('manual').addEventListener('click', () => start(false));
    shadow.getElementById('auto').addEventListener('click', () => start(true));
    shadow.getElementById('pause').addEventListener('click', () => stop());
    shadow.getElementById('copy').addEventListener('click', copyJson);
    shadow.getElementById('download').addEventListener('click', downloadJson);
    shadow.getElementById('newSession').addEventListener('click', newSession);
    shadow.getElementById('reset').addEventListener('click', resetHistory);
    shadow.getElementById('close').addEventListener('click', () => host.remove());
    updateUi();
  }

  function updateUi() {
    if (!ui?.host?.isConnected) return;
    ui.profile.textContent = targetHandle ? `Profile: @${targetHandle}` : 'Open a public profile first';
    ui.captured.textContent = String(session.size);
    ui.scrolls.textContent = String(scrollCount);
    ui.known.textContent = String(initialKnownIds.size);
    ui.status.textContent = `${collecting ? (autoScrolling ? '▶ Auto' : '● Manual') : '■ Paused'} · ${lastReason}`;
  }

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  let lastUrl = location.href;
  setInterval(async () => {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    const nextHandle = getProfileHandle();
    if (nextHandle !== targetHandle) {
      stop('Profile changed');
      targetHandle = nextHandle;
      session.clear();
      scrollCount = 0;
      reachedKnown = false;
      await loadKnown();
      updateUi();
    }
  }, 1000);

  async function showPanel(reason = 'Collector panel opened') {
    targetHandle = getProfileHandle();
    lastReason = reason;
    createPanel();
    try {
      await loadKnown();
      lastReason = targetHandle ? reason : 'Open a public X profile page first';
    } catch (error) {
      lastReason = `Panel loaded; collector storage unavailable: ${error?.message || error}`;
      console.error('[daggerok X Collector] storage initialization failed', error);
    }
    updateUi();
  }

  function collectorStatus() {
    return {
      ok: true,
      version: '1.0.0',
      handle: targetHandle,
      collecting,
      autoScrolling,
      captured: session.size,
      scrollCount,
      known: initialKnownIds.size,
      reason: lastReason,
      panelVisible: Boolean(document.getElementById(PANEL_ID))
    };
  }

  globalThis.__DAGGEROK_X_COLLECTOR_EXTENSION_API__ = { showPanel, start, stop, copyJson, downloadJson, status: collectorStatus };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.source !== 'daggerok-x-collector-popup') return false;
    (async () => {
      if (message.command === 'show') await showPanel('Panel opened from extension');
      else if (message.command === 'start-manual') { await showPanel('Starting manual collection'); await start(false); }
      else if (message.command === 'start-auto') { await showPanel('Starting assisted scrolling'); await start(true); }
      else if (message.command === 'pause') stop('Paused from extension');
      else if (message.command === 'copy') await copyJson();
      else if (message.command === 'get-json') {
        const status = collectorStatus();
        status.json = session.size ? JSON.stringify(payload(), null, 2) : '';
        if (!status.json) status.error = 'No newly captured posts are available to copy yet.';
        sendResponse(status);
        return;
      }
      sendResponse(collectorStatus());
    })().catch(error => sendResponse({ ok: false, error: error?.message || String(error) }));
    return true;
  });

  // Mount the UI first so a storage permission/error cannot make the collector fail invisibly.
  createPanel();
  loadKnown().then(() => {
    lastReason = targetHandle ? 'Ready' : 'Open a public X profile page first';
    updateUi();
  }).catch(error => {
    lastReason = `Panel loaded; collector storage unavailable: ${error?.message || error}`;
    console.error('[daggerok X Collector] storage initialization failed', error);
    updateUi();
  });
})();
