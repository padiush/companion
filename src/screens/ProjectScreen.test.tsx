import { fireEvent, render } from '@testing-library/react-native';

import { useForms } from '../hooks/useForms';
import { ProjectScreen } from './ProjectScreen';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: { projectId: 9, projectName: 'Cloud forest' } }),
}));
jest.mock('../hooks/useForms', () => ({ useForms: jest.fn() }));

const mockUseForms = useForms as jest.Mock;

const form = (id: number, name: string, isActive = true) => ({
  id,
  projectId: 9,
  name,
  description: null,
  isActive,
  updatedAt: null,
  sections: [],
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ProjectScreen', () => {
  it('lists only the active forms', async () => {
    mockUseForms.mockReturnValue({
      forms: [form(1, 'Plant uses'), form(2, 'Retired form', false)],
      loading: false,
    });

    const { getByTestId, queryByTestId } = await render(<ProjectScreen />);

    expect(getByTestId('form-1')).toBeTruthy();
    expect(queryByTestId('form-2')).toBeNull();
  });

  it('starts an interview for the tapped form', async () => {
    mockUseForms.mockReturnValue({ forms: [form(1, 'Plant uses')], loading: false });

    const { getByTestId } = await render(<ProjectScreen />);
    await fireEvent.press(getByTestId('form-1'));

    expect(mockNavigate).toHaveBeenCalledWith('Interview', {
      formId: 1,
      projectId: 9,
      formName: 'Plant uses',
    });
  });

  it('shows the empty state when there are no active forms', async () => {
    mockUseForms.mockReturnValue({ forms: [], loading: false });

    const { getByText } = await render(<ProjectScreen />);
    expect(getByText('project.empty')).toBeTruthy();
  });
});
