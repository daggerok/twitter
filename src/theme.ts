// Theme modes of the toolbar button: light, dark, or auto = by the local clock (dark from 19:00 to 07:00). Same in daggerok/youtube.
export type ThemeMode = 'light' | 'dark' | 'auto';
export const isThemeMode = (v: unknown): v is ThemeMode => v === 'light' || v === 'dark' || v === 'auto';
/** night by the browser's local clock: 19:00 to 06:59 */
export const isNight = (d: Date = new Date()): boolean => { const h = d.getHours(); return h >= 19 || h < 7; };
/** a click cycles light -> dark -> auto -> light */
export const nextMode = (m: ThemeMode): ThemeMode => (m === 'light' ? 'dark' : m === 'dark' ? 'auto' : 'light');
export const isDark = (m: ThemeMode, night: boolean): boolean => (m === 'auto' ? night : m === 'dark');
/** The button: in light and dark it shows what the theme can switch to (the youtube way: a sun on the dark page); in auto it shows the current theme with an A. */
export const themeIcon = (m: ThemeMode, night: boolean): { icon: string; auto: boolean } => (m === 'auto' ? { icon: night ? '🌙' : '☀', auto: true } : { icon: m === 'dark' ? '☀' : '🌙', auto: false });
export const themeTitle = (m: ThemeMode, night: boolean): string =>
  m === 'light' ? 'Light theme. Click: dark theme' : m === 'dark' ? 'Dark theme. Click: automatic theme (dark from 19:00 to 07:00 by your clock, light by day)' : `Automatic theme, now ${night ? 'night: dark' : 'day: light'}. Click: light theme`;
