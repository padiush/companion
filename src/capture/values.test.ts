import { decodeAnswerValue, encodeAnswerValue, isAnswered } from './values';

describe('encodeAnswerValue', () => {
  it('passes strings through and JSON-encodes multi-select arrays', () => {
    expect(encodeAnswerValue('guaba')).toBe('guaba');
    expect(encodeAnswerValue(['food', 'medicine'])).toBe('["food","medicine"]');
    expect(encodeAnswerValue(null)).toBeNull();
  });
});

describe('decodeAnswerValue', () => {
  it('returns the raw string for non-multi items', () => {
    expect(decodeAnswerValue('guaba', 'text')).toBe('guaba');
    expect(decodeAnswerValue(null, 'text')).toBeNull();
  });

  it('parses multi-select values into an array', () => {
    expect(decodeAnswerValue('["food","medicine"]', 'multi')).toEqual(['food', 'medicine']);
    expect(decodeAnswerValue(null, 'multi')).toEqual([]);
    expect(decodeAnswerValue('not json', 'multi')).toEqual([]);
  });
});

describe('isAnswered', () => {
  it('treats null, empty strings and empty arrays as unanswered', () => {
    expect(isAnswered(null)).toBe(false);
    expect(isAnswered('')).toBe(false);
    expect(isAnswered('   ')).toBe(false);
    expect(isAnswered([])).toBe(false);
  });

  it('treats non-empty values as answered', () => {
    expect(isAnswered('guaba')).toBe(true);
    expect(isAnswered(['food'])).toBe(true);
  });
});
