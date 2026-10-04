import type { FieldRecordLocation, FieldRecordUpdate } from '../db/fieldRecordsRepository';
import type { CollectingPermitRow, FieldRecordRow } from '../db/types';

/**
 * What kind of encounter a record documents. The same vocabulary the server
 * validates against (`FieldRecord::BASES` in the platform), in the order the
 * web offers it. A collected specimen is the default, as it is there.
 */
export const BASES = [
  'preserved_specimen',
  'human_observation',
  'living_specimen',
  'material_sample',
] as const;

export type Basis = (typeof BASES)[number];

/**
 * The stated reasons a collection needed no permit (`FieldRecord::EXEMPTIONS`).
 * A reason is a complete answer, not a gap: it is what lets coverage tell a
 * lawful exemption from a permit nobody wrote down.
 */
export const EXEMPTIONS = ['private_land', 'cultivated', 'market', 'other'] as const;

export type Exemption = (typeof EXEMPTIONS)[number];

/**
 * The record as the screen edits it. Text fields are plain strings so an input
 * can be bound to them directly; blanks become nulls only when stored.
 *
 * A permit and an exemption are held apart, but the screen only ever lets one
 * be set: choosing either clears the other, as on the web.
 */
export interface FieldRecordDraft {
  basis: Basis;
  vernacularName: string;
  collectionNumber: string;
  collector: string;
  collectedOn: string;
  locality: string;
  notes: string;
  location: FieldRecordLocation | null;
  permitId: number | null;
  exemption: Exemption | null;
}

/**
 * A new record's starting point. The collector is usually the person holding
 * the phone and the date is usually today, so both are filled in; neither is
 * a reason to save anything until something else is entered.
 */
export function emptyDraft(defaults: { collector: string; today: string }): FieldRecordDraft {
  return {
    basis: 'preserved_specimen',
    vernacularName: '',
    collectionNumber: '',
    collector: defaults.collector,
    collectedOn: defaults.today,
    locality: '',
    notes: '',
    location: null,
    permitId: null,
    exemption: null,
  };
}

function isBasis(value: string): value is Basis {
  return (BASES as readonly string[]).includes(value);
}

function isExemption(value: string | null): value is Exemption {
  return value !== null && (EXEMPTIONS as readonly string[]).includes(value);
}

/** A stored record, back into something the screen can edit. */
export function draftFromRow(row: FieldRecordRow): FieldRecordDraft {
  return {
    basis: isBasis(row.basis_of_record) ? row.basis_of_record : 'preserved_specimen',
    vernacularName: row.vernacular_name ?? '',
    collectionNumber: row.collection_number ?? '',
    collector: row.collector ?? '',
    collectedOn: row.collected_on ?? '',
    locality: row.locality ?? '',
    notes: row.notes ?? '',
    location:
      row.location_lat !== null && row.location_lng !== null
        ? { lat: row.location_lat, lng: row.location_lng }
        : null,
    permitId: row.collecting_permit_id,
    exemption: isExemption(row.permit_exemption) ? row.permit_exemption : null,
  };
}

/** Blank or whitespace-only text is no answer at all, and is stored as null. */
function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** The draft as the repository stores it, stamped with the time of the edit. */
export function toStoredFields(draft: FieldRecordDraft, now: string): FieldRecordUpdate {
  return {
    basisOfRecord: draft.basis,
    vernacularName: textOrNull(draft.vernacularName),
    collectionNumber: textOrNull(draft.collectionNumber),
    collector: textOrNull(draft.collector),
    collectedOn: textOrNull(draft.collectedOn),
    locality: textOrNull(draft.locality),
    location: draft.location,
    notes: textOrNull(draft.notes),
    collectingPermitId: draft.permitId,
    permitExemption: draft.exemption,
    editedAt: now,
    updatedAt: now,
  };
}

/**
 * How a permit is named in a list: the authority and the reference, as the
 * web labels it. Either may be missing, and the separator only appears
 * between two parts that are both there.
 */
export function permitLabel(permit: Pick<CollectingPermitRow, 'authority' | 'reference'>): string {
  return [permit.authority, permit.reference]
    .map((part) => part?.trim() ?? '')
    .filter((part) => part !== '')
    .join(' · ');
}

/**
 * What to call a record in a list. The name the informant gave it comes
 * first, because that is how the person who recorded it will remember it;
 * then the number on the tag. Neither may exist yet — a record is often made
 * before anyone has said what it is — so null means "untitled", and the
 * caller words that.
 */
export function recordTitle(row: Pick<FieldRecordRow, 'vernacular_name' | 'collection_number'>) {
  return row.vernacular_name?.trim() || row.collection_number?.trim() || null;
}
