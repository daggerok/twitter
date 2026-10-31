/// <reference lib="esnext" />
// =========================================================================
// DOM fallback: when no GraphQL payload arrived (an X api change, the interceptor out of reach) read
// the rendered `article[data-testid="tweet"]` cards. Fewer fields: no lang, no bookmarks, no quoted
// or reposted ids, counts from the aria-labels of the action buttons. Rows read this way still carry
// the id, handle, date, text, media and url, so the sheet stays usable until the parser is updated.
// =========================================================================
import { handleFromPath, type Media, type Post, type PostType } from '../../shared/post';

const countFromLabel = (label: string): number => {
  const m = /([\d.,]+)\s*([KkMm]?)/.exec(label.replace(/ /g, ' '));
  if (!m) return 0;
  const n = Number(m[1].replace(/,/g, ''));
  if (!Number.isFinite(n)) return 0;
  const mult = m[2].toUpperCase() === 'K' ? 1000 : m[2].toUpperCase() === 'M' ? 1_000_000 : 1;
  return Math.round(n * mult);
};

function countOf(article: Element, testId: string): number {
  const el = article.querySelector(`[data-testid="${testId}"]`) || article.querySelector(`[data-testid="un${testId}"]`);
  if (!el) return 0;
  const label = el.getAttribute('aria-label') || (el.closest('[aria-label]') ? el.closest('[aria-label]')?.getAttribute('aria-label') : '') || el.textContent || '';
  return countFromLabel(label);
}

export function postFromArticle(article: Element, handle: string, seenAt: string): Post | null {
  const link = Array.from(article.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]')).find((a) => /^\/[^/]+\/status\/\d+$/.test(new URL(a.href, location.href).pathname));
  if (!link) return null;
  const path = new URL(link.href, location.href).pathname;
  const m = /^\/([^/]+)\/status\/(\d+)$/.exec(path);
  if (!m) return null;
  const author = m[1].toLowerCase();
  const id = m[2];
  const social = article.querySelector('[data-testid="socialContext"]');
  const socialText = (social && social.textContent) || '';
  const isRepost = /repost|retweet/i.test(socialText);
  const isPinned = /pinned/i.test(socialText);
  if (handle && author !== handle.toLowerCase() && !isRepost) return null;
  const time = article.querySelector('time');
  const created = (time && time.getAttribute('datetime')) || '';
  const textEl = article.querySelector('[data-testid="tweetText"]');
  const text = textEl ? (textEl as HTMLElement).innerText.trim() : '';
  const media: Media[] = [];
  article.querySelectorAll<HTMLImageElement>('[data-testid="tweetPhoto"] img').forEach((img) => { if (img.src) media.push({ type: 'photo', url: img.src }); });
  // videos and gifs: X renders a <video> (gifs too, looping); the source url when it is there, else the post's video page
  const videos = Array.from(article.querySelectorAll<HTMLVideoElement>('video'));
  if (videos.length || article.querySelector('[data-testid="videoPlayer"], [data-testid="videoComponent"], [data-testid="gifPlayer"]')) {
    (videos.length ? videos : [null]).forEach((v, i) => {
      const src = v ? (v.currentSrc || v.src || v.querySelector('source')?.src || '') : '';
      const gif = !!v && v.loop && !v.controls || !!article.querySelector('[data-testid="gifPlayer"]') || /tweet_video/.test(src);
      media.push({ type: gif ? 'gif' : 'video', url: src && !src.startsWith('blob:') ? src : `https://x.com/${author}/status/${id}/video/${i + 1}` });
    });
  }
  const links = Array.from(article.querySelectorAll<HTMLAnchorElement>('[data-testid="tweetText"] a[href^="http"]'))
    .map((a) => a.href).filter((h) => !/^https?:\/\/(x|twitter)\.com\//i.test(h));
  const replyTo = Array.from(article.querySelectorAll('a[href^="/"]')).map((a) => a.getAttribute('href') || '')
    .find((h) => !!h && !h.includes('/status/') && /^\/[A-Za-z0-9_]{1,15}$/.test(h) && article.textContent?.includes('Replying to'));
  const type: PostType = isRepost ? 'repost' : replyTo && !isPinned ? 'reply' : article.querySelector('[data-testid="quoteTweet"], [role="link"] time') ? 'quote' : 'post';
  const owner = handle.toLowerCase() || author;
  return {
    id,
    handle: isRepost ? owner : author,
    author_name: (article.querySelector('[data-testid="User-Name"] span')?.textContent || '').trim(),
    created_at: created,
    type,
    text,
    lang: '',
    url: `https://x.com/${isRepost ? owner : author}/status/${id}`,
    in_reply_to_id: '',
    in_reply_to_handle: type === 'reply' && replyTo ? replyTo.slice(1).toLowerCase() : '',
    conversation_id: '',
    quoted_id: '',
    reposted_id: isRepost ? id : '',
    reposted_handle: isRepost ? author : '',
    media,
    links,
    likes: countOf(article, 'like'),
    reposts: countOf(article, 'retweet'),
    replies: countOf(article, 'reply'),
    quotes: 0,
    bookmarks: countOf(article, 'bookmark'),
    views: 0,
    is_pinned: isPinned,
    first_seen_at: seenAt,
    last_seen_at: seenAt,
    hidden: false,
  };
}

export function scanDom(seenAt = new Date().toISOString()): Post[] {
  const handle = handleFromPath(location.pathname) || '';
  const out: Post[] = [];
  document.querySelectorAll('article[data-testid="tweet"]').forEach((a) => {
    try {
      const p = postFromArticle(a, handle, seenAt);
      if (p) out.push(p);
    } catch { /* one odd card never stops the scan */ }
  });
  return out;
}

export { countFromLabel };
