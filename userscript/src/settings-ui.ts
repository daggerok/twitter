/// <reference lib="esnext" />
// A small in-page form for the run settings (stored with GM_setValue, never hard-coded).
import { DEFAULTS, loadSettings, normalize, saveSettings, type Settings } from './settings';

const FIELDS: { key: keyof Settings; label: string }[] = [
  { key: 'maxPosts', label: 'Max posts per run' },
  { key: 'maxMinutes', label: 'Max minutes per run' },
  { key: 'delayMinMs', label: 'Delay between scrolls, min ms' },
  { key: 'delayMaxMs', label: 'Delay between scrolls, max ms' },
  { key: 'restEvery', label: 'Rest every N scrolls' },
  { key: 'restMinSec', label: 'Rest, min seconds' },
  { key: 'restMaxSec', label: 'Rest, max seconds' },
  { key: 'idleScrolls', label: 'Stop after N scrolls without new posts' },
];

export function openSettings(onSaved: (s: Settings) => void): void {
  const existing = document.getElementById('xsync-settings');
  if (existing) existing.remove();
  const s = loadSettings();
  const wrap = document.createElement('div');
  wrap.id = 'xsync-settings';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:2147483001;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;font:13px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
  const box = document.createElement('form');
  box.style.cssText = 'background:#15202b;color:#e7e9ea;border:1px solid #38444d;border-radius:12px;padding:16px;width:min(360px,92vw);display:grid;gap:8px';
  box.innerHTML = '<div style="font-weight:700;font-size:14px">𝕏 sync settings</div>';
  const inputs: Partial<Record<keyof Settings, HTMLInputElement>> = {};
  FIELDS.forEach((f) => {
    const row = document.createElement('label');
    row.style.cssText = 'display:grid;grid-template-columns:1fr 90px;gap:8px;align-items:center';
    const input = document.createElement('input');
    input.type = 'number';
    input.value = String(s[f.key]);
    input.style.cssText = 'background:#000;color:#e7e9ea;border:1px solid #38444d;border-radius:6px;padding:4px 6px';
    row.append(f.label, input);
    inputs[f.key] = input;
    box.appendChild(row);
  });
  const withReplies = document.createElement('label');
  withReplies.style.cssText = 'display:flex;gap:8px;align-items:center';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = s.withReplies;
  withReplies.append(cb, 'Include replies (the viewer opens /with_replies)');
  box.appendChild(withReplies);
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:4px';
  const btn = (label: string, primary: boolean) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.type = 'button';
    b.style.cssText = `cursor:pointer;border:1px solid #38444d;border-radius:999px;padding:5px 12px;font-weight:600;background:${primary ? '#1d9bf0' : 'transparent'};color:#fff`;
    bar.appendChild(b);
    return b;
  };
  btn('Defaults', false).onclick = () => { FIELDS.forEach((f) => { const i = inputs[f.key]; if (i) i.value = String(DEFAULTS[f.key]); }); cb.checked = DEFAULTS.withReplies; };
  btn('Cancel', false).onclick = () => wrap.remove();
  btn('Save', true).onclick = () => {
    const next: Record<string, unknown> = { withReplies: cb.checked };
    FIELDS.forEach((f) => { const i = inputs[f.key]; if (i) next[f.key] = Number(i.value); });
    const saved = normalize(next);
    saveSettings(saved);
    wrap.remove();
    onSaved(saved);
  };
  box.appendChild(bar);
  box.onsubmit = (e) => e.preventDefault();
  wrap.appendChild(box);
  wrap.onclick = (e) => { if (e.target === wrap) wrap.remove(); };
  document.body.appendChild(wrap);
}
