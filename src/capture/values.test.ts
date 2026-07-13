import {
  answerKey,
  decodeAnswerValue,
  emptyValueFor,
  encodeAnswerValue,
  isAnswered,
} from './values';

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

describe('answerKey', () => {
  it('distinguishes repeatable sets and non-repeatable items', () => {
    expect(answerKey(10, null)).toBe('10:x');
    expect(answerKey(10, 0)).toBe('10:0');
    expect(answerKey(10, 1)).toBe('10:1');
    expect(answerKey(10, 0)).not.toBe(answerKey(10, null));
  });
});

describe('emptyValueFor', () => {
  it('is an empty list for multi and an empty string otherwise', () => {
    expect(emptyValueFor('multi')).toEqual([]);
    expect(emptyValueFor('text')).toBe('');
    expect(emptyValueFor('select')).toBe('');
  });
});
