/// <reference types="bun" />
/// <reference types="node" />
import { describe, expect, test } from 'bun:test';
import { cardMedia, countFromLabel, gifFromThumb } from './dom-fallback';

describe('dom fallback gifs', () => {
  test('a tweet_video_thumb poster is a gif whose mp4 has the same id', () => {
    expect(gifFromThumb('https://pbs.twimg.com/tweet_video_thumb/HVutcuHXsAAM0Mk?format=jpg&name=small')).toBe('https://video.twimg.com/tweet_video/HVutcuHXsAAM0Mk.mp4');
    expect(gifFromThumb('https://pbs.twimg.com/media/abc.jpg')).toBeNull();
  });
});

describe('dom fallback media of a card', () => {
  const thumb = 'https://pbs.twimg.com/tweet_video_thumb/HYN6y2YXIAAOoDx?format=jpg&name=small';
  const mp4 = 'https://video.twimg.com/tweet_video/HYN6y2YXIAAOoDx.mp4';
  const post = 'https://x.com/acc/status/9';
  test('a gif is one item though the card draws it as a poster image and a video', () => {
    // the owner's 28 Nov card: the poster img, and a <video> without loop whose source is the mp4
    expect(cardMedia([thumb], [{ src: mp4, poster: thumb, gif: false }], false, post)).toEqual([{ type: 'gif', url: mp4 }]);
    // the same with the source not loaded yet (a blob): still the one gif, named by its poster
    expect(cardMedia([thumb], [{ src: 'blob:https://x.com/1', poster: thumb, gif: false }], false, post)).toEqual([{ type: 'gif', url: mp4 }]);
  });
  test('photos stay as they are, the same image twice is one', () => {
    expect(cardMedia(['https://pbs.twimg.com/media/a.jpg', 'https://pbs.twimg.com/media/b.jpg', 'https://pbs.twimg.com/media/a.jpg'], [], false, post)).toEqual([
      { type: 'photo', url: 'https://pbs.twimg.com/media/a.jpg' }, { type: 'photo', url: 'https://pbs.twimg.com/media/b.jpg' },
    ]);
  });
  test('a video: its source, the post\'s video page for a blob or a player without a video element; two videos are two', () => {
    expect(cardMedia([], [{ src: 'https://video.twimg.com/ext_tw_video/1/vid/a.mp4', poster: 'https://pbs.twimg.com/ext_tw_video_thumb/1/img/a.jpg', gif: false }], true, post)).toEqual([{ type: 'video', url: 'https://video.twimg.com/ext_tw_video/1/vid/a.mp4' }]);
    expect(cardMedia([], [{ src: 'blob:x', poster: '', gif: false }, { src: 'blob:y', poster: '', gif: false }], true, post)).toEqual([{ type: 'video', url: `${post}/video/1` }, { type: 'video', url: `${post}/video/2` }]);
    expect(cardMedia([], [], true, post)).toEqual([{ type: 'video', url: `${post}/video/1` }]);
    expect(cardMedia([], [], false, post)).toEqual([]);
  });
});

describe('dom fallback counts', () => {
  test('aria-label numbers with separators and K/M suffixes', () => {
    expect(countFromLabel('1,234 Likes. Like')).toBe(1234);
    expect(countFromLabel('12.5K reposts')).toBe(12_500);
    expect(countFromLabel('1.2M views')).toBe(1_200_000);
    expect(countFromLabel('Like')).toBe(0);
    expect(countFromLabel('')).toBe(0);
  });
});

describe('dom fallback counts in Russian', () => {
  test('тыс. and млн, a comma as the decimal mark', () => {
    expect(countFromLabel('6 тыс.')).toBe(6000);
    expect(countFromLabel('1,2 млн')).toBe(1_200_000);
    expect(countFromLabel('131 отметка «Нравится». Нравится')).toBe(131);
  });
});
