/// <reference types="bun" />
/// <reference types="node" />
import { describe, expect, test } from 'bun:test';
import { maskEmail, maskId, maskSpreadsheetUrl } from './mask';

describe('masks', () => {
  test('email keeps the first and last letter and the domain', () => {
    expect(maskEmail('daggerok@gmail.com')).toBe('d••••••k@gmail.com');
    expect(maskEmail('ab@x.io')).toBe('••@x.io');
    expect(maskEmail('')).toBe('••••••••••••');
    expect(maskEmail('nonsense')).toBe('••••••••');
  });
  test('spreadsheet url keeps 3 + 3 of the id', () => {
    expect(maskSpreadsheetUrl('https://docs.google.com/spreadsheets/d/1uWabcdefghij790/edit')).toBe('https://docs.google.com/spreadsheets/d/1uW••••••••••••••••790/edit');
    expect(maskSpreadsheetUrl('')).toBe('');
    expect(maskSpreadsheetUrl('plain-id')).toBe('••••••••');
  });
  test('id keeps 4 + 4', () => {
    expect(maskId('1234567890-abcdefghijklmnop.apps.googleusercontent.com')).toMatch(/^1234•+\.com$/);
    expect(maskId('short')).toBe('•••••');
    expect(maskId('')).toBe('');
  });
});
