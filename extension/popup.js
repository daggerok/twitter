(() => {
  'use strict';

  const statusEl = document.getElementById('status');
  let activeTab = null;

  function isXUrl(url) {
    try {
      const host = new URL(url).hostname;
      return host === 'x.com' || host === 'www.x.com' || host === 'twitter.com' || host === 'www.twitter.com';
    } catch {
      return false;
    }
  }

  function renderStatus(status) {
    if (!status?.ok) {
      statusEl.innerHTML = `<strong class="error">Collector unavailable</strong><div class="meta">${status?.error || 'Open an X profile and click Show panel.'}</div>`;
      return;
    }
    const mode = status.collecting ? (status.autoScrolling ? 'Assisted auto-scroll' : 'Manual collection') : 'Paused';
    statusEl.innerHTML = `<strong>${mode} · @${status.handle || 'no profile'}</strong><div class="meta">${status.captured} captured · ${status.known} known · ${status.scrollCount} scrolls<br>${status.reason || ''}</div>`;
  }

  async function findActiveTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tabs[0] || null;
    return activeTab;
  }

  async function sendRaw(command) {
    return await chrome.tabs.sendMessage(activeTab.id, { source: 'daggerok-x-collector-popup', command });
  }

  async function ensureCollector() {
    const tab = await findActiveTab();
    if (!tab || !isXUrl(tab.url || '')) {
      throw new Error('Current tab is not x.com. Open the ICT profile first.');
    }
    try {
      return await sendRaw('status');
    } catch {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      await new Promise(resolve => setTimeout(resolve, 100));
      return await sendRaw('status');
    }
  }

  async function command(name) {
    try {
      await ensureCollector();
      const result = await sendRaw(name);
      renderStatus(result);
    } catch (error) {
      renderStatus({ ok: false, error: error?.message || String(error) });
    }
  }

  document.getElementById('show').addEventListener('click', () => command('show'));
  document.getElementById('manual').addEventListener('click', () => command('start-manual'));
  document.getElementById('auto').addEventListener('click', () => command('start-auto'));
  document.getElementById('pause').addEventListener('click', () => command('pause'));
  document.getElementById('copy').addEventListener('click', async () => {
    try {
      await ensureCollector();
      const result = await sendRaw('get-json');
      if (!result.json) throw new Error(result.error || 'No newly captured posts are available to copy yet.');
      await navigator.clipboard.writeText(result.json);
      result.reason = `Copied ${result.captured} new post${result.captured === 1 ? '' : 's'} as JSON`;
      renderStatus(result);
    } catch (error) {
      renderStatus({ ok: false, error: error?.message || String(error) });
    }
  });

  ensureCollector().then(renderStatus).catch(error => renderStatus({ ok: false, error: error?.message || String(error) }));
  setInterval(() => {
    if (!activeTab) return;
    sendRaw('status').then(renderStatus).catch(() => {});
  }, 1000);
})();
