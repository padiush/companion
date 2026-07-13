import type { Form, ProjectSummary } from '../api/types';
import {
  formFromRecord,
  formRecordFromApi,
  projectFromRecord,
  projectRecordFromApi,
} from './mappers';

const project: ProjectSummary = {
  id: 7,
  name: 'Cloud forest',
  capabilities: {
    manage_project: true,
    manage_users: false,
    manage_forms: true,
    record_data: true,
    manage_data: false,
    generate_reports: true,
    view_catalog: true,
    edit_catalog: false,
  },
  updated_at: '2026-07-12T00:00:00Z',
};

const form: Form = {
  id: 3,
  name: 'Plant uses',
  description: null,
  is_active: true,
  updated_at: '2026-07-12T00:00:00Z',
  sections: [
    {
      id: 1,
      name: 'Uses',
      order: 1,
      repeatable: true,
      items: [
        {
          id: 10,
          label: 'Folk name',
          name: 'folk_name',
          type: 'text',
          required: true,
          options: null,
          link_to_species: true,
          is_use_category: false,
          min: null,
          max: null,
          step: null,
          order: 1,
        },
      ],
    },
  ],
};

describe('project mappers', () => {
  it('round-trips a project through the record shape', () => {
    const record = projectRecordFromApi(project);
    expect(typeof record.capabilities).toBe('string');

    expect(projectFromRecord(record)).toEqual({
      id: 7,
      name: 'Cloud forest',
      capabilities: project.capabilities,
      updated_at: '2026-07-12T00:00:00Z',
    });
  });
});

describe('form mappers', () => {
  it('injects the project id and encodes is_active and structure', () => {
    const record = formRecordFromApi(form, 7);

    expect(record.project_id).toBe(7);
    expect(record.is_active).toBe(1);
    expect(typeof record.structure).toBe('string');
  });

  it('round-trips a form back to its render-ready shape', () => {
    const cached = formFromRecord(formRecordFromApi(form, 7));

    expect(cached.projectId).toBe(7);
    expect(cached.isActive).toBe(true);
    expect(cached.sections).toEqual(form.sections);
  });
});
