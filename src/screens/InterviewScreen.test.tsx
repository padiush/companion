import { fireEvent, render } from '@testing-library/react-native';
import { Alert } from 'react-native';

import type { Item } from '../api/types';
import { useInterview } from '../capture/useInterview';
import { InterviewScreen } from './InterviewScreen';

type AlertButton = { text?: string; style?: string; onPress?: () => void };

/** Simulate the user tapping the alert button with the given style. */
function pressAlertButton(style: 'cancel' | 'destructive') {
  const spy = Alert.alert as jest.Mock;
  const buttons = spy.mock.calls.at(-1)?.[2] as AlertButton[] | undefined;
  buttons?.find((button) => button.style === style)?.onPress?.();
}

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { number?: number }) => (opts?.number ? `${key}:${opts.number}` : key),
  }),
}));
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: { formId: 27, projectId: 9, formName: 'Plant uses' } }),
  useNavigation: () => ({ goBack: mockGoBack }),
}));
jest.mock('../capture/useInterview', () => ({ useInterview: jest.fn() }));
jest.mock('../capture/MediaSection', () => ({ MediaSection: () => null }));
jest.mock('../capture/AudioRecorder', () => ({ AudioRecorder: () => null }));

const mockUseInterview = useInterview as jest.Mock;

const textItem: Item = {
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
};

function form(repeatable: boolean) {
  return {
    id: 27,
    projectId: 9,
    name: 'Plant uses',
    description: null,
    isActive: true,
    updatedAt: null,
    sections: [{ id: 1, name: 'Uses', order: 1, repeatable, items: [textItem] }],
  };
}

function mockInterview(overrides: Record<string, unknown> = {}) {
  mockUseInterview.mockReturnValue({
    form: form(false),
    loading: false,
    saving: false,
    answers: {},
    repeats: {},
    setAnswer: jest.fn(),
    addRepeat: jest.fn(),
    removeRepeat: jest.fn(),
    ...overrides,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('InterviewScreen', () => {
  it('shows a preparing state while loading', async () => {
    mockInterview({ loading: true, form: null });

    const { getByText } = await render(<InterviewScreen />);
    expect(getByText('interview.preparing')).toBeTruthy();
  });

  it('renders the form fields and saves an answer as it is typed', async () => {
    const setAnswer = jest.fn();
    mockInterview({ setAnswer });

    const { getByTestId } = await render(<InterviewScreen />);
    await fireEvent.changeText(getByTestId('input-10'), 'guaba');

    expect(setAnswer).toHaveBeenCalledWith(1, 10, null, 'guaba');
  });

  it('adds a set to a repeatable section', async () => {
    const addRepeat = jest.fn();
    mockInterview({ form: form(true), repeats: { 1: 1 }, addRepeat });

    const { getByTestId, getByText, queryByTestId } = await render(<InterviewScreen />);
    expect(getByText('interview.set:1')).toBeTruthy();
    // Only one set, so there's nothing to remove yet.
    expect(queryByTestId('remove-set-1')).toBeNull();

    await fireEvent.press(getByTestId('add-set-1'));
    expect(addRepeat).toHaveBeenCalledWith(1);
  });

  it('removes a set only after the removal is confirmed', async () => {
    const removeRepeat = jest.fn();
    mockInterview({ form: form(true), repeats: { 1: 2 }, removeRepeat });

    const { getByTestId } = await render(<InterviewScreen />);
    await fireEvent.press(getByTestId('remove-set-1'));

    // The press asks for confirmation instead of removing outright.
    expect(Alert.alert).toHaveBeenCalled();
    expect(removeRepeat).not.toHaveBeenCalled();

    pressAlertButton('destructive');
    expect(removeRepeat).toHaveBeenCalledWith(1);
  });

  it('keeps the set when removal is cancelled', async () => {
    const removeRepeat = jest.fn();
    mockInterview({ form: form(true), repeats: { 1: 2 }, removeRepeat });

    const { getByTestId } = await render(<InterviewScreen />);
    await fireEvent.press(getByTestId('remove-set-1'));
    pressAlertButton('cancel');

    expect(removeRepeat).not.toHaveBeenCalled();
  });

  it('reflects the save state and returns on Done', async () => {
    mockInterview({ saving: false });
    const saved = await render(<InterviewScreen />);
    expect(saved.getByText('interview.savedLocally')).toBeTruthy();

    await fireEvent.press(saved.getByTestId('interview-done'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('shows a saving indicator while an answer is being written', async () => {
    mockInterview({ saving: true });
    const { getByText, queryByText } = await render(<InterviewScreen />);

    expect(getByText('interview.saving')).toBeTruthy();
    expect(queryByText('interview.savedLocally')).toBeNull();
  });
});
