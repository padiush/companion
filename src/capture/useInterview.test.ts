import { act, renderHook, waitFor } from '@testing-library/react-native';

import { createTestDatabase, type TestDatabase } from '../../test-utils/sqliteDatabase';
import type { Item } from '../api/types';
import { getAnswersForInstance } from '../db/answersRepository';
import { getDatabase } from '../db/database';
import { upsertForms } from '../db/formsRepository';
import { captureLocation } from './location';
import { useInterview } from './useInterview';

jest.mock('../db/database', () => ({ getDatabase: jest.fn() }));
jest.mock('./location', () => ({ captureLocation: jest.fn() }));

let mockNextId = 0;
jest.mock('../ids', () => ({ uuid: () => `id-${++mockNextId}` }));

const mockGetDatabase = getDatabase as jest.Mock;
const mockCaptureLocation = captureLocation as jest.Mock;

const plantName: Item = {
  id: 4,
  label: 'Nombre local de la planta',
  name: 'nombre_local',
  type: 'text',
  required: true,
  options: null,
  link_to_species: true,
  is_use_category: false,
  min: null,
  max: null,
  step: null,
  order: 1,
};

let db: TestDatabase;

beforeEach(async () => {
  jest.clearAllMocks();
  db = await createTestDatabase();
  mockGetDatabase.mockResolvedValue(db);
  mockCaptureLocation.mockResolvedValue(null);
  await upsertForms(
    db,
    [
      {
        id: 27,
        name: 'Usos',
        description: null,
        is_active: true,
        updated_at: null,
        sections: [
          { id: 2, name: 'Usos reportados', order: 1, repeatable: true, items: [plantName] },
        ],
      },
    ],
    9
  );
});

afterEach(async () => {
  await db.closeAsync();
});

describe('answer ids', () => {
  /**
   * A field record made from an answer links to it by this id. Knowing it only
   * from the next time the interview opened meant a plant named just now could
   * not be recorded until the researcher left and came back.
   */
  it('knows a new answer’s id as soon as its first save lands', async () => {
    const { result } = await renderHook(() => useInterview(27, 9));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => result.current.setAnswer(2, 4, 0, 'hierbabuena'));
    await waitFor(() => expect(result.current.answerClientIds['4:0']).toBeDefined());

    const [stored] = await getAnswersForInstance(db, result.current.instanceId as string);
    expect(result.current.answerClientIds['4:0']).toBe(stored.client_id);
  });

  it('keeps the same id as the answer is edited', async () => {
    const { result } = await renderHook(() => useInterview(27, 9));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => result.current.setAnswer(2, 4, 0, 'hierba'));
    await waitFor(() => expect(result.current.answerClientIds['4:0']).toBeDefined());
    const first = result.current.answerClientIds['4:0'];

    await act(async () => result.current.setAnswer(2, 4, 0, 'hierbabuena'));
    await waitFor(() => expect(result.current.saving).toBe(false));

    expect(result.current.answerClientIds['4:0']).toBe(first);
    expect(await getAnswersForInstance(db, result.current.instanceId as string)).toHaveLength(1);
  });
});
