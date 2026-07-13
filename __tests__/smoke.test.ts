import { API_BASE_URL } from '../src/config';

// Confirms the jest-expo preset, the TypeScript transform, and module
// resolution into src/ are all wired up. Feature tests live next to their code.
describe('test harness', () => {
  it('resolves app modules and runs', () => {
    expect(API_BASE_URL).toContain('/api/v1');
  });
});
