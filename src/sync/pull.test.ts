import type { SQLiteDatabase } from 'expo-sqlite';

import { api } from '../api/client';
import type { Bundle, Capabilities, Form, ProjectSummary } from '../api/types';
import { upsertForms } from '../db/formsRepository';
import { upsertProjects } from '../db/projectsRepository';
import { getMeta, setMeta } from '../db/syncMetaRepository';
import { pull, pullForms, pullProjects } from './pull';

jest.mock('../api/client', () => ({ api: { me: jest.fn(), bundle: jest.fn() } }));
jest.mock('../db/projectsRepository', () => ({ upsertProjects: jest.fn() }));
jest.mock('../db/formsRepository', () => ({ upsertForms: jest.fn() }));
jest.mock('../db/syncMetaRepository', () => ({ getMeta: jest.fn(), setMeta: jest.fn() }));

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

function bundle(cursor: string | null): Bundle {
  return { form_version_cursor: cursor, server_time: '2026-07-12T00:00:00Z', forms };
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
