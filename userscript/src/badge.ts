/// <reference lib="esnext" />
// Fixed corner badge on x.com profiles: status, posts seen and new, elapsed, Start (full / new), Stop, Settings, JSON.
import type { RunMode } from './gm';

export type BadgeActions = {
  start: (mode: RunMode) => void;
  stop: () => void;
  settings: () => void;
  downloadJson: () => void;
};

const HOST_ID = 'xsync-badge';

const css = `
#${HOST_ID}{position:fixed;right:12px;bottom:12px;z-index:2147483000;font:12px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#e7e9ea;background:#15202b;border:1px solid #38444d;border-radius:12px;padding:10px 12px;box-shadow:0 8px 24px rgba(0,0,0,.45);min-width:220px;max-width:300px}
#${HOST_ID} .t{font-weight:700;font-size:13px;display:flex;justify-content:space-between;align-items:center;gap:8px}
#${HOST_ID} .s{margin-top:6px;white-space:pre-line;color:#8b98a5}
#${HOST_ID} .b{margin-top:8px;display:flex;flex-wrap:wrap;gap:6px}
#${HOST_ID} button{cursor:pointer;border:1px solid #38444d;background:#1d9bf0;color:#fff;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:600}
#${HOST_ID} button.sec{background:transparent;color:#e7e9ea}
#${HOST_ID} button.stop{background:#f4212e}
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
    mk('new', 'Sync new', '', () => this.actions.start('incremental'));
    mk('full', 'Full sync', 'sec', () => this.actions.start('full'));
    mk('stop', 'Stop', 'stop', () => this.actions.stop());
    mk('json', 'JSON', 'sec', () => this.actions.downloadJson());
    mk('settings', '⚙', 'sec', () => this.actions.settings());
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
    this.buttons.stop.disabled = !running;
  }

  setJsonAvailable(available: boolean): void {
    if (this.buttons.json) this.buttons.json.disabled = !available;
  }

  set(text: string): void {
    if (this.status) this.status.textContent = text;
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
