/// <reference lib="esnext" />
// Masking of the values shown in Settings (the youtube repo's helpers): nothing sensitive is readable on screen
// unless the eye button is pressed. The values themselves stay in localStorage, same as youtube.

export function maskEmail(email: string): string {
  if (!email) return '••••••••••••';
  const parts = email.split('@');
  if (parts.length !== 2) return '•'.repeat(email.length);
  const [name, domain] = parts;
  const maskedName = name.length <= 2 ? '•'.repeat(name.length) : name[0] + '•'.repeat(name.length - 2) + name[name.length - 1];
  return `${maskedName}@${domain}`;
}

export function maskSpreadsheetUrl(url: string): string {
  if (!url) return '';
  const idx = url.indexOf('/d/');
  if (idx === -1) return '•'.repeat(Math.min(url.length, 24));
  const prefix = url.slice(0, idx + 3);
  const rest = url.slice(idx + 3);
  const idPart = rest.split('/')[0];
  const suffix = rest.slice(idPart.length);
  const maskedId = idPart.length <= 4 ? '••••••••' : idPart.slice(0, 3) + '••••••••••••••••' + idPart.slice(-3);
  return `${prefix}${maskedId}${suffix}`;
}

/** A Client ID or any token: first 4 and last 4 characters, dots between. */
export function maskId(id: string): string {
  if (!id) return '';
  if (id.length <= 8) return '•'.repeat(id.length);
  return `${id.slice(0, 4)}${'•'.repeat(Math.min(24, id.length - 8))}${id.slice(-4)}`;
}
