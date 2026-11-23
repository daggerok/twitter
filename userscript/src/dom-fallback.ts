/// <reference lib="esnext" />
// =========================================================================
// DOM fallback: when no GraphQL payload arrived (an X api change, the interceptor out of reach) read
// the rendered `article[data-testid="tweet"]` cards. Fewer fields: no lang, no bookmarks, no quoted
// or reposted ids, counts from the aria-labels of the action buttons. Rows read this way still carry
// the id, handle, date, text, media and url, so the sheet stays usable until the parser is updated.
// =========================================================================
import { dateFromId, handleFromPath, type Media, type Post, type PostType } from '../../shared/post';

// English and Russian X: "12.5K", "1.2M", "6 тыс.", "1,2 млн"
const countFromLabel = (label: string): number => {
  const m = /([\d.,]+)\s*([KkMm]|тыс|млн)?/.exec(label.replace(/[\u00a0\u202f]/g, ' '));
  if (!m) return 0;
  const suffix = (m[2] || '').toLowerCase();
  // a comma is a thousands separator in "1,234" and a decimal mark in Russian "1,2 млн"
  const digits = suffix && /^\d+,\d{1,2}$/.test(m[1]) ? m[1].replace(',', '.') : m[1].replace(/,/g, '');
  const n = Number(digits);
  if (!Number.isFinite(n)) return 0;
  const mult = suffix === 'k' || suffix === 'тыс' ? 1000 : suffix === 'm' || suffix === 'млн' ? 1_000_000 : 1;
  return Math.round(n * mult);
};

/** A count of the action bar: by its test id (until Nov 2026), else by the words of the button's aria-label. */
function countByWords(article: Element, testId: string, words: RegExp): number {
  if (article.querySelector(`[data-testid="${testId}"], [data-testid="un${testId}"]`)) return countOf(article, testId);
  const el = Array.from(article.querySelectorAll('button[aria-label], [role="button"][aria-label]')).find((x) => words.test(x.getAttribute('aria-label') || ''));
  return el ? countFromLabel(el.getAttribute('aria-label') || '') : 0;
}

function countOf(article: Element, testId: string): number {
  const el = article.querySelector(`[data-testid="${testId}"]`) || article.querySelector(`[data-testid="un${testId}"]`);
  if (!el) return 0;
  const label = el.getAttribute('aria-label') || (el.closest('[aria-label]') ? el.closest('[aria-label]')?.getAttribute('aria-label') : '') || el.textContent || '';
  return countFromLabel(label);
}

export function postFromArticle(article: Element, handle: string, seenAt: string): Post | null {
  // the timestamp link `/<user>/status/<id>`; a photo or video link of the card (`/status/<id>/photo/1`) names the same post
  const link = Array.from(article.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]')).find((a) => /^\/[^/]+\/status\/\d+(?:\/|$)/.test(new URL(a.href, location.href).pathname));
  if (!link) return null;
  const path = new URL(link.href, location.href).pathname;
  const m = /^\/([^/]+)\/status\/(\d+)(?:\/|$)/.exec(path);
  if (!m) return null;
  const author = m[1];
  const id = m[2];
  // the line above the author ("ICT reposted", "Pinned"): a test id until Nov 2026, else the card's first line before the author's name
  const social = article.querySelector('[data-testid="socialContext"]');
  const firstLine = ((article as HTMLElement).innerText || article.textContent || '').split('\n')[0] || '';
  const socialText = (social && social.textContent) || (/repost|retweet|репост|ретвит|pinned|закреп/i.test(firstLine) && firstLine.length < 80 ? firstLine : '');
  const isRepost = /repost|retweet|репост|ретвит/i.test(socialText);
  const isPinned = /pinned|закреп/i.test(socialText);
  if (handle && author.toLowerCase() !== handle.toLowerCase() && !isRepost) return null;
  const time = article.querySelector('time');
  const created = (time && time.getAttribute('datetime')) || dateFromId(id);
  // the post text: data-testid="tweetText" until Nov 2026, now the first element with a lang attribute
  const textEl = article.querySelector('[data-testid="tweetText"]') || article.querySelector('div[lang]');
  const text = textEl ? (textEl as HTMLElement).innerText.trim() : '';
  const media: Media[] = [];
  const photos = article.querySelectorAll<HTMLImageElement>('[data-testid="tweetPhoto"] img');
  (photos.length ? Array.from(photos) : Array.from(article.querySelectorAll<HTMLImageElement>('img')).filter((i) => /pbs\.twimg\.com\/(media|tweet_video_thumb)\//.test(i.src))).forEach((img) => {
    if (!img.src) return;
    const gif = gifFromThumb(img.src);
    media.push(gif ? { type: 'gif', url: gif } : { type: 'photo', url: img.src });
  });
  // videos and gifs: X renders a <video> (gifs too, looping); the source url when it is there, else the post's video page
  const videos = Array.from(article.querySelectorAll<HTMLVideoElement>('video'));
  if (videos.length || article.querySelector('[data-testid="videoPlayer"], [data-testid="videoComponent"], [data-testid="gifPlayer"]')) {
    (videos.length ? videos : [null]).forEach((v, i) => {
      const src = v ? (v.currentSrc || v.src || v.querySelector('source')?.src || '') : '';
      const gif = !!v && v.loop && !v.controls || !!article.querySelector('[data-testid="gifPlayer"]') || /tweet_video/.test(src);
      media.push({ type: gif ? 'gif' : 'video', url: src && !src.startsWith('blob:') ? src : `https://x.com/${author}/status/${id}/video/${i + 1}` });
    });
  }
  const links = Array.from((textEl || article).querySelectorAll<HTMLAnchorElement>('a[href^="http"]'))
    .map((a) => a.href).filter((h) => !/^https?:\/\/(x|twitter)\.com\//i.test(h));
  const replyTo = Array.from(article.querySelectorAll('a[href^="/"]')).map((a) => a.getAttribute('href') || '')
    .find((h) => !!h && !h.includes('/status/') && /^\/[A-Za-z0-9_]{1,15}$/.test(h) && /Replying to|В ответ/i.test(article.textContent || ''));
  // since Nov 2026 the Replies tab lists replies only, so an own card there is a reply even when no "Replying to" line shows (a thread)
  const onRepliesTab = /\/with_replies\/?$/.test(location.pathname);
  const type: PostType = isRepost ? 'repost' : (replyTo || onRepliesTab) && !isPinned ? 'reply' : article.querySelector('[data-testid="quoteTweet"], div[role="link"] time') ? 'quote' : 'post'; // a quoted post is a nested div[role=link] card with its own time; the post's own timestamp is an a[role=link], never a quote
  const owner = handle || author;
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
    in_reply_to_handle: type === 'reply' && replyTo ? replyTo.slice(1) : '',
    in_reply_to_text: '',
    conversation_id: '',
    quoted_id: '',
    reposted_id: isRepost ? id : '',
    reposted_handle: isRepost ? author : '',
    media,
    links,
    likes: countByWords(article, 'like', /like|нравится/i),
    reposts: countByWords(article, 'retweet', /repost|retweet|репост/i),
    replies: countByWords(article, 'reply', /repl|ответ/i),
    quotes: 0,
    bookmarks: countOf(article, 'bookmark'),
    views: countFromLabel((article.querySelector('a[href$="/analytics"]') as HTMLElement | null)?.innerText || ''),
    is_pinned: isPinned,
    first_seen_at: seenAt,
    last_seen_at: seenAt,
    hidden: false,
  };
}

export function scanDom(seenAt = new Date().toISOString()): Post[] {
  const handle = handleFromPath(location.pathname) || '';
  const out: Post[] = [];
  // X names a post card article[data-testid="tweet"]; when that test id goes, every article is tried
  const cards = document.querySelectorAll('article[data-testid="tweet"]');
  (cards.length ? cards : document.querySelectorAll('article')).forEach((a) => {
    try {
      const p = postFromArticle(a, handle, seenAt);
      if (p) out.push(p);
    } catch { /* one odd card never stops the scan */ }
  });
  return out;
}

/** A gif's poster is served as pbs.twimg.com/tweet_video_thumb/<id>; its mp4 is video.twimg.com/tweet_video/<id>.mp4. */
export function gifFromThumb(src: string): string | null {
  const m = /pbs\.twimg\.com\/tweet_video_thumb\/([A-Za-z0-9_-]+)/.exec(src);
  return m ? `https://video.twimg.com/tweet_video/${m[1]}.mp4` : null;
}

export { countFromLabel };
