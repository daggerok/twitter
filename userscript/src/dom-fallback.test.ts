/// <reference types="bun" />
/// <reference types="node" />
import { describe, expect, test } from 'bun:test';
import { countFromLabel, gifFromThumb } from './dom-fallback';

describe('dom fallback gifs', () => {
  test('a tweet_video_thumb poster is a gif whose mp4 has the same id', () => {
    expect(gifFromThumb('https://pbs.twimg.com/tweet_video_thumb/HVutcuHXsAAM0Mk?format=jpg&name=small')).toBe('https://video.twimg.com/tweet_video/HVutcuHXsAAM0Mk.mp4');
    expect(gifFromThumb('https://pbs.twimg.com/media/abc.jpg')).toBeNull();
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
