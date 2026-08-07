import type { Item } from '../api/types';
import type { CachedForm } from '../db/types';
import { validateInstance } from './validate';

const item = (overrides: Partial<Item>): Item => ({
  id: 1,
  label: 'Field',
  name: 'field',
  type: 'text',
  required: false,
  options: null,
  link_to_species: false,
  is_use_category: false,
  min: null,
  max: null,
  step: null,
  order: 1,
  ...overrides,
});

const form = (items: Item[], repeatable = false): CachedForm =>
  ({
    sections: [{ id: 1, name: 'Section', order: 1, repeatable, items }],
  }) as CachedForm;

describe('required fields', () => {
  it('reports a required field left blank', () => {
    const issues = validateInstance(form([item({ id: 1, required: true })]), { '1:x': '' }, {});

    expect(issues).toEqual({ '1:x': { reason: 'required' } });
  });

  it('reports a required field never touched at all', () => {
    const issues = validateInstance(form([item({ id: 1, required: true })]), {}, {});

    expect(issues['1:x']).toEqual({ reason: 'required' });
  });

  it('treats whitespace as blank', () => {
    const issues = validateInstance(form([item({ id: 1, required: true })]), { '1:x': '   ' }, {});

    expect(issues['1:x']).toEqual({ reason: 'required' });
  });

  it('accepts a required multi-select with a choice made', () => {
    const issues = validateInstance(
      form([item({ id: 1, type: 'multi', required: true })]),
      { '1:x': ['medicinal'] },
      {},
    );

    expect(issues).toEqual({});
  });

  it('reports a required multi-select with nothing chosen', () => {
    const issues = validateInstance(
      form([item({ id: 1, type: 'multi', required: true })]),
      { '1:x': [] },
      {},
    );

    expect(issues['1:x']).toEqual({ reason: 'required' });
  });

  it('leaves an optional blank field alone', () => {
    const issues = validateInstance(form([item({ id: 1, required: false })]), { '1:x': '' }, {});

    expect(issues).toEqual({});
  });
});

describe('numeric bounds', () => {
  const numeric = (overrides: Partial<Item>) => form([item({ id: 1, type: 'number', ...overrides })]);

  it('reports a value below the minimum', () => {
    const issues = validateInstance(numeric({ min: 10 }), { '1:x': '4' }, {});

    expect(issues['1:x']).toEqual({ reason: 'min', limit: 10 });
  });

  it('reports a value above the maximum', () => {
    const issues = validateInstance(numeric({ max: 10 }), { '1:x': '11' }, {});

    expect(issues['1:x']).toEqual({ reason: 'max', limit: 10 });
  });

  it('accepts the bounds themselves', () => {
    expect(validateInstance(numeric({ min: 10, max: 20 }), { '1:x': '10' }, {})).toEqual({});
    expect(validateInstance(numeric({ min: 10, max: 20 }), { '1:x': '20' }, {})).toEqual({});
  });

  it('accepts a negative value when the minimum allows it', () => {
    expect(validateInstance(numeric({ min: -10 }), { '1:x': '-4' }, {})).toEqual({});
  });

  it('reports text typed into a number field', () => {
    expect(validateInstance(numeric({}), { '1:x': 'about ten' }, {})['1:x']).toEqual({
      reason: 'notANumber',
    });
  });

  /** Steps count from the minimum, so 10 stepping by 5 accepts 15, not 12. */
  it('counts steps from the minimum', () => {
    expect(validateInstance(numeric({ min: 10, step: 5 }), { '1:x': '15' }, {})).toEqual({});
    expect(validateInstance(numeric({ min: 10, step: 5 }), { '1:x': '12' }, {})['1:x']).toEqual({
      reason: 'step',
      limit: 5,
    });
  });

  /** 0.3 % 0.1 is not 0 in binary floating point; a naive check would reject it. */
  it('accepts a fractional value that lands on a fractional step', () => {
    expect(validateInstance(numeric({ step: 0.1 }), { '1:x': '0.3' }, {})).toEqual({});
  });

  it('ignores a step of zero rather than dividing by it', () => {
    expect(validateInstance(numeric({ step: 0 }), { '1:x': '7' }, {})).toEqual({});
  });

  it('does not bound a text field that happens to hold digits', () => {
    const issues = validateInstance(form([item({ id: 1, type: 'text', max: 5 })]), { '1:x': '99' }, {});

    expect(issues).toEqual({});
  });
});

describe('repeatable sections', () => {
  it('checks every set the recorder opened', () => {
    const issues = validateInstance(
      form([item({ id: 1, required: true })], true),
      { '1:0': 'given', '1:1': '' },
      { 1: 2 },
    );

    expect(issues).toEqual({ '1:1': { reason: 'required' } });
  });

  /** Sets that were never opened do not exist, so they cannot be incomplete. */
  it('ignores sets beyond the ones on screen', () => {
    const issues = validateInstance(
      form([item({ id: 1, required: true })], true),
      { '1:0': 'given' },
      { 1: 1 },
    );

    expect(issues).toEqual({});
  });
});

describe('validateInstance', () => {
  it('returns nothing for a form that has not loaded', () => {
    expect(validateInstance(null, {}, {})).toEqual({});
  });

  it('collects issues across several fields at once', () => {
    const issues = validateInstance(
      form([
        item({ id: 1, required: true }),
        item({ id: 2, type: 'number', max: 5 }),
        item({ id: 3, required: false }),
      ]),
      { '1:x': '', '2:x': '9', '3:x': '' },
      {},
    );

    expect(Object.keys(issues).sort()).toEqual(['1:x', '2:x']);
  });
});
