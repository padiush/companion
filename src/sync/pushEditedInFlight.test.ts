import { createTestDatabase, type TestDatabase } from '../../test-utils/sqliteDatabase';
import { api } from '../api/client';
import type { SyncRequest } from '../api/types';
import { createDraft, saveAnswer } from '../capture/captureService';
import { getAnswersForInstance } from '../db/answersRepository';
import { getInstance } from '../db/instancesRepository';
import { pushDrafts } from './push';

jest.mock('../api/client', () => ({ api: { syncInstances: jest.fn() } }));
jest.mock('../db/formsRepository', () => ({
  getForm: jest.fn().mockResolvedValue({ sections: [] }),
}));

let mockNextId = 0;
jest.mock('../ids', () => ({ uuid: () => `id-${++mockNextId}` }));

const mockSync = api.syncInstances as jest.Mock;

let db: TestDatabase;

beforeEach(async () => {
  jest.clearAllMocks();
  db = await createTestDatabase();
});

afterEach(async () => {
  await db.closeAsync();
});

/** The server accepts every interview it is sent, and remembers what it saw. */
function serverAccepts(seen: SyncRequest[] = []) {
  mockSync.mockImplementation(async (_project: number, body: SyncRequest) => {
    seen.push(body);
    return { results: body.instances.map((sent) => ({ id: sent.id, status: 'created' })) };
  });
  return seen;
}

async function interviewWithAnswer(value: string) {
  const instanceId = await createDraft(db, { formId: 27, projectId: 9 });
  await saveAnswer(db, { instanceId, sectionId: 1, itemId: 10, repeatableIndex: null, value });
  return instanceId;
}

it('marks an interview sent when nothing changed while it was in flight', async () => {
  const instanceId = await interviewWithAnswer('guaba');
  serverAccepts();

  await pushDrafts(db);

  expect((await getInstance(db, instanceId))?.sync_status).toBe('synced');
});

/**
 * The race: an answer saved while the push is waiting on the server. The
 * result that comes back is about the copy without it. Applied as-is, the
 * interview would be marked sent — and with only drafts in the outbox, the new
 * answer would never leave the device.
 */
it('keeps an interview in the outbox when an answer is saved during its push, and sends it next time', async () => {
  const instanceId = await interviewWithAnswer('guaba');
  // Later than the first save, as a real edit would be.
  await new Promise((resolve) => setTimeout(resolve, 5));

  mockSync.mockImplementationOnce(async (_project: number, body: SyncRequest) => {
    await saveAnswer(db, {
      instanceId,
      sectionId: 1,
      itemId: 10,
      repeatableIndex: null,
      value: 'guayaba',
    });
    return { results: body.instances.map((sent) => ({ id: sent.id, status: 'created' })) };
  });

  await pushDrafts(db);

  expect((await getInstance(db, instanceId))?.sync_status).toBe('draft');
  expect((await getAnswersForInstance(db, instanceId))[0].value).toBe('guayaba');

  const seen = serverAccepts();
  await pushDrafts(db);

  expect(seen[0].instances[0].answers[0].value).toBe('guayaba');
  expect((await getInstance(db, instanceId))?.sync_status).toBe('synced');
});
