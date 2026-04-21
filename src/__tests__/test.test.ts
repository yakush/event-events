import { describe, expect, it } from 'vitest';
import { testMe } from '../index.js';

describe('testing testing', () => {
  it('basic testing success`', () => {
    const result = testMe(false);
    expect(result).toEqual('OK');
  });

  it('basic testing fail', () => {
    expect(() => {
      testMe(true);
    }).toThrowError();
  });
});
