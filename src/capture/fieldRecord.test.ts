import type { FieldRecordRow } from '../db/types';
import {
  draftFromRow,
  emptyDraft,
  permitLabel,
  recordTitle,
  toStoredFields,
  type FieldRecordDraft,
} from './fieldRecord';

const AT = '2026-10-04T10:00:00.000Z';

function row(overrides: Partial<FieldRecordRow> = {}): FieldRecordRow {
  return {
    client_id: 'fr-1',
    project_id: 1,
    server_id: null,
    basis_of_record: 'human_observation',
    vernacular_name: 'guaba',
    collection_number: 'RA-014',
    collector: 'R. Arévalo',
    collected_on: '2026-10-01',
    locality: 'cafetal above the school',
    location_lat: 13.7,
    location_lng: -89.2,
    notes: null,
    collecting_permit_id: null,
    permit_exemption: 'private_land',
    answer_client_id: null,
    edited_at: AT,
    sync_status: 'draft',
    sync_error: null,
    created_at: AT,
    updated_at: AT,
    ...overrides,
  };
}

describe('a new record', () => {
  it('starts as a collected specimen, by the person holding the phone, today', () => {
    const draft = emptyDraft({ collector: 'M. Menéndez', today: '2026-10-04' });

    expect(draft).toMatchObject({
      basis: 'preserved_specimen',
      collector: 'M. Menéndez',
      collectedOn: '2026-10-04',
      location: null,
      permitId: null,
      exemption: null,
    });
  });
});

describe('reopening a stored record', () => {
  it('restores every recorded field', () => {
    expect(draftFromRow(row())).toEqual({
      basis: 'human_observation',
      vernacularName: 'guaba',
      collectionNumber: 'RA-014',
      collector: 'R. Arévalo',
      collectedOn: '2026-10-01',
      locality: 'cafetal above the school',
      notes: '',
      location: { lat: 13.7, lng: -89.2 },
      permitId: null,
      exemption: 'private_land',
    });
  });

  it('has no location unless both coordinates were stored', () => {
    expect(draftFromRow(row({ location_lng: null })).location).toBeNull();
  });

  /** A value this build does not know must not crash the screen or be offered back as-is. */
  it('falls back to the defaults for values outside the vocabulary', () => {
    const draft = draftFromRow(row({ basis_of_record: 'fossil', permit_exemption: 'bribe' }));

    expect(draft.basis).toBe('preserved_specimen');
    expect(draft.exemption).toBeNull();
  });
});

describe('storing a draft', () => {
  const draft: FieldRecordDraft = {
    ...emptyDraft({ collector: '  R. Arévalo ', today: '2026-10-04' }),
    vernacularName: '   ',
    locality: ' El Cafetal ',
    permitId: 5,
  };

  it('stores blank text as null and trims the rest', () => {
    const stored = toStoredFields(draft, AT);

    expect(stored.vernacularName).toBeNull();
    expect(stored.collector).toBe('R. Arévalo');
    expect(stored.locality).toBe('El Cafetal');
  });

  it('stamps the edit time, which last-writer-wins compares on sync', () => {
    expect(toStoredFields(draft, AT)).toMatchObject({ editedAt: AT, updatedAt: AT });
  });

  it('carries the permit and the basis through unchanged', () => {
    expect(toStoredFields(draft, AT)).toMatchObject({
      basisOfRecord: 'preserved_specimen',
      collectingPermitId: 5,
      permitExemption: null,
    });
  });
});

describe('naming things in a list', () => {
  it('labels a permit by its authority and reference', () => {
    expect(permitLabel({ authority: 'MARN', reference: 'AIMA-2026-014' })).toBe(
      'MARN · AIMA-2026-014'
    );
  });

  it('leaves out whichever half of a permit label is missing', () => {
    expect(permitLabel({ authority: 'MARN', reference: null })).toBe('MARN');
    expect(permitLabel({ authority: ' ', reference: 'AIMA-2026-014' })).toBe('AIMA-2026-014');
    expect(permitLabel({ authority: null, reference: null })).toBe('');
  });

  it('titles a record by its local name, then by the number on its tag', () => {
    expect(recordTitle({ vernacular_name: 'guaba', collection_number: 'RA-014' })).toBe('guaba');
    expect(recordTitle({ vernacular_name: null, collection_number: 'RA-014' })).toBe('RA-014');
    expect(recordTitle({ vernacular_name: ' ', collection_number: null })).toBeNull();
  });
});
