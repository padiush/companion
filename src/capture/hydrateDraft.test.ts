import type { AnswerRow, CachedForm } from '../db/types';
import { hydrateDraft } from './hydrateDraft';

function form(): CachedForm {
  return {
    id: 1,
    projectId: 9,
    name: 'Plant uses',
    description: null,
    isActive: true,
    updatedAt: null,
    sections: [
      {
        id: 1,
        name: 'Plant',
        order: 1,
        repeatable: false,
        items: [
          { id: 10, label: 'Name', name: 'name', type: 'text' } as never,
          { id: 11, label: 'Parts', name: 'parts', type: 'multi' } as never,
        ],
      },
      {
        id: 2,
        name: 'Uses',
        order: 2,
        repeatable: true,
        items: [{ id: 20, label: 'Use', name: 'use', type: 'text' } as never],
      },
    ],
  };
}

function row(overrides: Partial<AnswerRow>): AnswerRow {
  return {
    client_id: 'c',
    instance_id: 'i',
    section_id: 1,
    item_id: 10,
    repeatable_index: null,
    value: null,
    edited_at: null,
    ...overrides,
  };
}

describe('hydrateDraft', () => {
  it('returns empty state for a missing form', () => {
    expect(hydrateDraft(null, [])).toEqual({ answers: {}, repeats: {} });
  });

  it('seeds repeatable sections at one set with no answers', () => {
    expect(hydrateDraft(form(), []).repeats).toEqual({ 2: 1 });
  });

  it('decodes answers by item type, including multi-selects', () => {
    const { answers } = hydrateDraft(form(), [
      row({ item_id: 10, value: 'Ruda' }),
      row({ item_id: 11, value: '["Hoja","Raíz"]' }),
    ]);

    expect(answers['10:x']).toBe('Ruda');
    expect(answers['11:x']).toEqual(['Hoja', 'Raíz']);
  });

  it('grows a repeatable section to fit the highest saved set index', () => {
    const { answers, repeats } = hydrateDraft(form(), [
      row({ section_id: 2, item_id: 20, repeatable_index: 0, value: 'food' }),
      row({ section_id: 2, item_id: 20, repeatable_index: 2, value: 'medicine' }),
    ]);

    expect(repeats[2]).toBe(3);
    expect(answers['20:0']).toBe('food');
    expect(answers['20:2']).toBe('medicine');
  });

  it('ignores answers for items no longer in the form', () => {
    const { answers } = hydrateDraft(form(), [row({ item_id: 999, value: 'stale' })]);
    expect(answers).toEqual({});
  });
});
