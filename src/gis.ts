/// <reference lib="esnext" />
// =========================================================================
// Google Identity Services: the access token for the Sheets API, exactly as daggerok/youtube does it.
// Only the public OAuth Client ID is stored (localStorage); the token stays in memory with its expiry,
// a silent renewal (prompt: '') is deduplicated, and a 401 renews once and retries (withGoogleAuth).
// =========================================================================
export const SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'openid', 'email', 'profile'].join(' ');
const GIS_SRC = 'https://accounts.google.com/gsi/client';
const USERINFO = 'https://www.googleapis.com/oauth2/v3/userinfo';

type TokenResponse = { access_token?: string; expires_in?: number | string; error?: string };
type TokenClient = { requestAccessToken: (o: { prompt: string }) => void };
type Gis = {
  accounts: {
    oauth2: {
      initTokenClient: (o: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: { type?: string; message?: string }) => void }) => TokenClient;
      revoke: (token: string, done: () => void) => void;
    };
  };
};

const gis = (): Gis | undefined => (window as unknown as { google?: Gis }).google;

let loading: Promise<void> | null = null;

function waitForGis(timeoutMs = 12_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const tick = () => {
      if (gis()?.accounts?.oauth2) return resolve();
      if (Date.now() - t0 > timeoutMs) return reject(new Error('Google Identity Services did not load'));
      setTimeout(tick, 50);
    };
    tick();
  });
}

export async function loadGis(): Promise<void> {
  if (gis()?.accounts?.oauth2) return;
  if (!loading) {
    loading = new Promise<void>((resolve, reject) => {
      if (document.querySelector('script[data-gis]')) {
        waitForGis().then(resolve).catch((e) => { loading = null; reject(e); });
        return;
      }
      const s = document.createElement('script');
      s.src = GIS_SRC;
      s.async = true;
      s.defer = true;
      s.dataset.gis = '1';
      s.onload = () => waitForGis().then(resolve).catch((e) => { loading = null; reject(e); });
      s.onerror = () => { loading = null; reject(new Error('Google Identity Services failed to load')); };
      document.head.appendChild(s);
    });
  }
  await loading;
}

export type Token = { value: string; expiresAt: number };

export async function requestToken(clientId: string, interactive: boolean): Promise<Token> {
  await loadGis();
  const g = gis();
  if (!g) throw new Error('Google Identity Services unavailable');
  return new Promise((resolve, reject) => {
    const client = g.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (r) => {
        if (r.error) return reject(new Error(r.error));
        if (!r.access_token) return reject(new Error('No access token'));
        const expiresIn = Number(r.expires_in) || 3600;
        resolve({ value: r.access_token, expiresAt: Date.now() + expiresIn * 1000 });
      },
      error_callback: (e) => reject(new Error(e?.type || e?.message || 'Google sign-in failed')),
    });
    client.requestAccessToken({ prompt: interactive ? 'consent' : '' });
  });
}

export function revokeToken(token: string): void {
  try { gis()?.accounts.oauth2.revoke(token, () => { /* done */ }); } catch { /* ignore */ }
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function googleFetch<T>(url: string, token: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
  if (!res.ok) {
    const msg = (json as { error?: { message?: string } } | null)?.error?.message || text || `HTTP ${res.status}`;
    throw new ApiError(`Google API ${res.status}: ${msg}`, res.status);
  }
  return json as T;
}

export const isAuthError = (e: unknown): boolean => e instanceof ApiError && e.status === 401;

export const fetchEmail = async (token: string): Promise<string> => {
  const p = await googleFetch<{ email?: string }>(USERINFO, token);
  return p.email || '';
};

/**
 * Token holder with the youtube rules: reuse a token that has more than a minute left, otherwise renew
 * silently; concurrent renewals share one request; a 401 inside `run` renews once and retries once.
 */
export class GoogleSession {
  private token: Token | null = null;
  private pending: Promise<Token> | null = null;
  disabled = false; // after Disconnect, until the next Connect

  constructor(private readonly clientId: () => string) {}

  get connected(): boolean { return !!this.token && !this.disabled; }

  async get(interactive = false, force = false): Promise<string> {
    const cid = this.clientId().trim();
    if (!cid) throw new Error('Enter the Google OAuth Client ID in Settings first');
    if (interactive) this.disabled = false;
    if (this.disabled) throw new Error('Disconnected: press Connect Google');
    if (!force && this.token && Date.now() + 60_000 < this.token.expiresAt) return this.token.value;
    if (this.pending) return (await this.pending).value;
    this.pending = requestToken(cid, interactive).then((t) => { this.token = t; return t; }).finally(() => { this.pending = null; });
    try {
      return (await this.pending).value;
    } catch (e) {
      this.token = null;
      throw e;
    }
  }

  async run<T>(op: (token: string) => Promise<T>): Promise<T> {
    const token = await this.get(false);
    try {
      return await op(token);
    } catch (e) {
      if (!isAuthError(e)) throw e;
      this.token = null;
      const fresh = await this.get(false, true);
      return op(fresh);
    }
  }

  disconnect(): void {
    if (this.token) revokeToken(this.token.value);
    this.token = null;
    this.disabled = true;
  }
}
