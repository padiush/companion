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
    sync_error: null,
    ...overrides,
  };
}

describe('hydrateDraft', () => {
  it('returns empty state for a missing form', () => {
    expect(hydrateDraft(null, [])).toEqual({
      answers: {},
      repeats: {},
      clientIds: {},
      errors: {},
      orphaned: [],
    });
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

describe('refused answers', () => {
  it('reports the server’s reason against the slot it belongs to', () => {
    const hydrated = hydrateDraft(form(), [
      row({ item_id: 10, value: 'Sábila', sync_error: 'api.sync.item_not_in_form' }),
    ]);

    expect(hydrated.errors).toEqual({ '10:x': 'api.sync.item_not_in_form' });
    expect(hydrated.orphaned).toEqual([]);
  });

  it('exposes the client id per slot, so an answer can be acted on', () => {
    const hydrated = hydrateDraft(form(), [row({ client_id: 'a-1', item_id: 10 })]);

    expect(hydrated.clientIds).toEqual({ '10:x': 'a-1' });
  });

  /**
   * The case that causes the refusal in the first place: the item was deleted
   * on the web, and once the bundle catches up the device has no field to
   * render the answer against. It still blocks the interview, so it cannot
   * simply be dropped from view.
   */
  it('surfaces a refused answer whose item has gone from the form', () => {
    const hydrated = hydrateDraft(form(), [
      row({ client_id: 'a-9', item_id: 999, sync_error: 'api.sync.item_not_in_form' }),
    ]);

    expect(hydrated.orphaned).toEqual([
      { clientId: 'a-9', itemId: 999, error: 'api.sync.item_not_in_form' },
    ]);
  });

  it('still ignores an answer for a departed item when nothing was refused', () => {
    const hydrated = hydrateDraft(form(), [row({ item_id: 999, value: 'x' })]);

    expect(hydrated.orphaned).toEqual([]);
    expect(hydrated.answers).toEqual({});
  });
});
