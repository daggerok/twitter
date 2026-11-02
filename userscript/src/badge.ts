/// <reference lib="esnext" />
// Fixed corner badge on x.com profiles: status, posts seen and new, elapsed, Start (full / new), Stop, Settings, JSON.
import type { RunMode } from './gm';

export type BadgeActions = {
  start: (mode: RunMode) => void;
  stop: () => void;
  watch: () => void;
  settings: () => void;
  downloadJson: () => void;
  debug: () => void;
};

const HOST_ID = 'xsync-badge';

// right:84px keeps clear of X's own floating buttons in the bottom right corner (compose, Grok)
const css = `
#${HOST_ID}{position:fixed;right:84px;bottom:16px;z-index:2147483000;font:12px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#e7e9ea;background:#15202b;border:1px solid #38444d;border-radius:12px;padding:10px 12px;box-shadow:0 8px 24px rgba(0,0,0,.45);min-width:300px;max-width:340px}
#${HOST_ID} .t{font-weight:700;font-size:13px;display:flex;justify-content:space-between;align-items:center;gap:8px}
#${HOST_ID} .s{margin-top:6px;white-space:pre-line;color:#8b98a5}
#${HOST_ID} .b{margin-top:8px;display:flex;flex-wrap:wrap;gap:6px}
#${HOST_ID} button{cursor:pointer;border:1px solid #38444d;background:#1d9bf0;color:#fff;border-radius:50%;width:32px;height:32px;padding:0;display:inline-flex;align-items:center;justify-content:center;font-size:15px;line-height:1;font-weight:700}
#${HOST_ID} button.sec{background:transparent;color:#e7e9ea}
#${HOST_ID} button.stop{background:#f4212e}
#${HOST_ID} button.full{background:#00ba7c}
#${HOST_ID} button.watch{background:#ffd400;color:#0f1419;opacity:.4}
#${HOST_ID} button.watch.on{opacity:1}
#${HOST_ID} button.json{background:transparent;color:#00ba7c;font-weight:800}
#${HOST_ID} button.grey{background:#536471}
#${HOST_ID} button:disabled{opacity:.5;cursor:default}
#${HOST_ID} .x{cursor:pointer;color:#8b98a5;font-size:14px;background:none;border:0;padding:0 2px}
#${HOST_ID}.min .s,#${HOST_ID}.min .b{display:none}
#${HOST_ID}.min{min-width:0}
`;

export class Badge {
  private root: HTMLDivElement | null = null;
  private status: HTMLDivElement | null = null;
  private buttons: Record<string, HTMLButtonElement> = {};
  private minimized = false;

  constructor(private readonly actions: BadgeActions, private readonly version: string) {}

  mount(): void {
    if (this.root || !document.body) return;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    const root = document.createElement('div');
    root.id = HOST_ID;
    const title = document.createElement('div');
    title.className = 't';
    title.innerHTML = `<span>𝕏 sync <small style="font-weight:400;color:#8b98a5">v${this.version}</small></span>`;
    const min = document.createElement('button');
    min.className = 'x';
    min.textContent = '–';
    min.title = 'Minimize';
    min.onclick = () => { this.minimized = !this.minimized; root.classList.toggle('min', this.minimized); min.textContent = this.minimized ? '+' : '–'; };
    title.appendChild(min);
    root.appendChild(title);
    const status = document.createElement('div');
    status.className = 's';
    status.textContent = 'idle';
    root.appendChild(status);
    const bar = document.createElement('div');
    bar.className = 'b';
    const mk = (key: string, label: string, cls: string, onClick: () => void) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.className = cls;
      b.onclick = onClick;
      this.buttons[key] = b;
      bar.appendChild(b);
    };
    // every button is a circle with an icon; the title is the tooltip on hover
    mk('new', '＋', '', () => this.actions.start('incremental'));
    this.buttons.new.title = 'New: sync the new posts only (incremental)';
    mk('full', '↻', 'full', () => this.actions.start('full'));
    this.buttons.full.title = 'Full: the whole timeline again, down to the oldest post';
    mk('watch', '👀', 'watch', () => this.actions.watch());
    this.buttons.watch.title = 'Watch (toggle): reload the profile every N minutes (⚙) and sync the new posts; click again or 🛑 to end it';
    mk('stop', '🛑', 'stop', () => this.actions.stop());
    this.buttons.stop.title = 'Stop (and end Watch)';
    mk('json', '{}', 'json', () => this.actions.downloadJson());
    this.buttons.json.title = 'Download the posts of the last run as JSON';
    mk('settings', '⚙', 'sec', () => this.actions.settings());
    mk('debug', '🐞', 'grey', () => this.actions.debug());
    this.buttons.debug.title = 'Download the diagnostics of the interceptor (a small JSON)';
    this.buttons.settings.title = 'Settings of a run (delays, rests, Watch interval)';
    root.appendChild(bar);
    document.body.appendChild(root);
    this.root = root;
    this.status = status;
    this.setRunning(false);
  }

  unmount(): void {
    if (this.root) this.root.remove();
    this.root = null;
  }

  setRunning(running: boolean): void {
    if (!this.root) return;
    this.buttons.new.disabled = running;
    this.buttons.full.disabled = running;
    this.buttons.watch.disabled = running;
    this.buttons.stop.disabled = !running;
  }

  setJsonAvailable(available: boolean): void {
    if (this.buttons.json) this.buttons.json.disabled = !available;
  }

  set(text: string): void {
    if (this.status) this.status.textContent = text;
  }

  /** The Watch line under the status: empty hides it. */
  setWatch(text: string): void {
    if (!this.root) return;
    let el = this.root.querySelector<HTMLDivElement>('.w');
    if (!el) { el = document.createElement('div'); el.className = 's w'; this.status?.after(el); }
    el.textContent = text;
    el.style.display = text ? '' : 'none';
    if (this.buttons.watch) this.buttons.watch.classList.toggle('on', text !== '');
  }
}

export function downloadJson(name: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
