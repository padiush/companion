import type { SQLiteDatabase } from 'expo-sqlite';

import { api } from '../api/client';
import type { Bundle, Capabilities, Form, ProjectSummary } from '../api/types';
import { saveSession } from '../auth/session';
import { pruneForms, upsertForms } from '../db/formsRepository';
import { upsertProjects } from '../db/projectsRepository';
import { getMeta, setMeta } from '../db/syncMetaRepository';
import { pull, pullForms, pullProjects } from './pull';

jest.mock('../api/client', () => ({ api: { me: jest.fn(), bundle: jest.fn() } }));
jest.mock('../db/projectsRepository', () => ({ upsertProjects: jest.fn() }));
jest.mock('../db/formsRepository', () => ({ upsertForms: jest.fn(), pruneForms: jest.fn() }));
jest.mock('../db/syncMetaRepository', () => ({ getMeta: jest.fn(), setMeta: jest.fn() }));
jest.mock('../auth/session', () => ({ saveSession: jest.fn() }));

const mockApi = api as jest.Mocked<typeof api>;
const mockGetMeta = getMeta as jest.MockedFunction<typeof getMeta>;

const db = {} as SQLiteDatabase;

const capabilities: Capabilities = {
  manage_project: false,
  manage_users: false,
  manage_forms: false,
  record_data: true,
  manage_data: false,
  generate_reports: false,
  view_catalog: false,
  edit_catalog: false,
};

const project = (id: number): ProjectSummary => ({
  id,
  name: `Project ${id}`,
  capabilities,
  updated_at: null,
});

const forms = [{ id: 3 }] as unknown as Form[];

function bundle(cursor: string | null, activeFormIds: number[] | undefined = [3]): Bundle {
  return {
    form_version_cursor: cursor,
    server_time: '2026-07-12T00:00:00Z',
    active_form_ids: activeFormIds,
    forms,
  };
}

function me(projects: ProjectSummary[]) {
  return { user: { id: 1, name: 'Field', email: 'field@example.org' }, projects };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('pullProjects', () => {
  it('caches the projects from /me and returns them', async () => {
    mockApi.me.mockResolvedValue(me([project(1), project(2)]));

    const result = await pullProjects(db);

    expect(upsertProjects).toHaveBeenCalledWith(db, [project(1), project(2)]);
    expect(result).toHaveLength(2);
  });

  /**
   * /me succeeding is the server confirming the identity, so it also refreshes
   * the offline window. Without this, someone who syncs daily but never cold-
   * launches online would still be locked out when the window lapsed.
   */
  it('refreshes the cached identity, extending the offline window', async () => {
    mockApi.me.mockResolvedValue(me([project(1)]));

    await pullProjects(db);

    expect(saveSession).toHaveBeenCalledWith({
      id: 1,
      name: 'Field',
      email: 'field@example.org',
    });
  });
});

describe('pullForms', () => {
  it('pulls from the stored cursor and advances it', async () => {
    mockGetMeta.mockResolvedValue('2026-07-01T00:00:00Z');
    mockApi.bundle.mockResolvedValue(bundle('2026-07-12T00:00:00Z'));

    await pullForms(db, 9);

    expect(getMeta).toHaveBeenCalledWith(db, 'bundle_cursor:9');
    expect(mockApi.bundle).toHaveBeenCalledWith(9, '2026-07-01T00:00:00Z');
    expect(upsertForms).toHaveBeenCalledWith(db, forms, 9);
    expect(setMeta).toHaveBeenCalledWith(db, 'bundle_cursor:9', '2026-07-12T00:00:00Z');
  });

  it('pulls with no cursor on first sync and does not advance when none is returned', async () => {
    mockGetMeta.mockResolvedValue(null);
    mockApi.bundle.mockResolvedValue(bundle(null));

    await pullForms(db, 9);

    expect(mockApi.bundle).toHaveBeenCalledWith(9, undefined);
    expect(setMeta).not.toHaveBeenCalled();
  });
});

describe('pull', () => {
  it('pulls projects then each project’s forms', async () => {
    mockApi.me.mockResolvedValue(me([project(1), project(2)]));
    mockGetMeta.mockResolvedValue(null);
    mockApi.bundle.mockResolvedValue(bundle(null));

    await pull(db);

    expect(mockApi.bundle).toHaveBeenCalledTimes(2);
    expect(mockApi.bundle).toHaveBeenCalledWith(1, undefined);
    expect(mockApi.bundle).toHaveBeenCalledWith(2, undefined);
  });
});

describe('retiring forms the server no longer lists', () => {
  /**
   * The bundle's delta cannot express a removal — a retired form just stops
   * appearing, which is indistinguishable from one that has not changed — so
   * the server sends the full active set and the device reconciles against it.
   */
  it('reconciles the cache against the active set', async () => {
    mockGetMeta.mockResolvedValue(null);
    mockApi.bundle.mockResolvedValue(bundle('2026-07-12T00:00:00Z', [3, 4]));

    await pullForms(db, 9);

    expect(pruneForms).toHaveBeenCalledWith(db, 9, [3, 4]);
  });

  it('retires everything when the project has no active forms left', async () => {
    mockGetMeta.mockResolvedValue(null);
    mockApi.bundle.mockResolvedValue(bundle(null, []));

    await pullForms(db, 9);

    expect(pruneForms).toHaveBeenCalledWith(db, 9, []);
  });

  /**
   * Against a server predating the field, an absent list must not read as "no
   * forms are active" — that would wipe every cached form on the device.
   */
  it('leaves the cache alone when the server does not send the set', async () => {
    mockGetMeta.mockResolvedValue(null);
    // Built without the key rather than with it undefined: a default parameter
    // would fill an explicit undefined back in, and the test would pass while
    // never exercising an older server's response at all.
    mockApi.bundle.mockResolvedValue({
      form_version_cursor: null,
      server_time: '2026-07-12T00:00:00Z',
      forms,
    });

    await pullForms(db, 9);

    expect(pruneForms).not.toHaveBeenCalled();
    expect(upsertForms).toHaveBeenCalled();
  });
});
