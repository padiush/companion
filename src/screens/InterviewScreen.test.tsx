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
    syncStatus: 'draft',
    syncError: null,
    answerErrors: {},
    orphanedErrors: [],
    answerClientIds: {},
    setAnswer: jest.fn(),
    addRepeat: jest.fn(),
    removeRepeat: jest.fn(),
    retry: jest.fn(),
    discardAnswer: jest.fn(),
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
    // The fixture's only field is required, so answer it before leaving.
    mockInterview({ saving: false, answers: { '10:x': 'guaba' } });
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

describe('an interview the server refused', () => {
  it('says nothing about sync on an ordinary draft', async () => {
    mockInterview({ syncStatus: 'draft' });

    const { queryByTestId } = await render(<InterviewScreen />);

    expect(queryByTestId('sync-banner')).toBeNull();
  });

  it('explains why a whole interview was rejected', async () => {
    mockInterview({ syncStatus: 'rejected', syncError: 'api.sync.form_not_in_project' });

    const { getByTestId, getByText } = await render(<InterviewScreen />);

    expect(getByTestId('sync-banner')).toBeTruthy();
    expect(getByText('sync.instanceErrors.api.sync.form_not_in_project')).toBeTruthy();
  });

  it('offers to send a refused interview again', async () => {
    const retry = jest.fn();
    mockInterview({ syncStatus: 'rejected', syncError: 'api.sync.not_owner', retry });

    const { getByTestId } = await render(<InterviewScreen />);
    await fireEvent.press(getByTestId('sync-retry'));

    expect(retry).toHaveBeenCalled();
  });

  it('marks the individual answers the server refused', async () => {
    mockInterview({
      syncStatus: 'partial',
      answerErrors: { '10:x': 'api.sync.item_not_in_form' },
      answerClientIds: { '10:x': 'a-1' },
    });

    const { getByTestId, getByText } = await render(<InterviewScreen />);

    expect(getByTestId('answer-error-10')).toBeTruthy();
    expect(getByText('sync.answerErrors.api.sync.item_not_in_form')).toBeTruthy();
  });

  it('discards a refused answer only after the loss is confirmed', async () => {
    const discardAnswer = jest.fn();
    mockInterview({
      syncStatus: 'partial',
      answerErrors: { '10:x': 'api.sync.item_not_in_form' },
      answerClientIds: { '10:x': 'a-1' },
      discardAnswer,
    });

    const { getByTestId } = await render(<InterviewScreen />);
    await fireEvent.press(getByTestId('discard-answer-10'));

    expect(discardAnswer).not.toHaveBeenCalled();
    pressAlertButton('destructive');
    expect(discardAnswer).toHaveBeenCalledWith('a-1');
  });

  it('keeps the answer when the discard is cancelled', async () => {
    const discardAnswer = jest.fn();
    mockInterview({
      syncStatus: 'partial',
      answerErrors: { '10:x': 'api.sync.item_not_in_form' },
      answerClientIds: { '10:x': 'a-1' },
      discardAnswer,
    });

    const { getByTestId } = await render(<InterviewScreen />);
    await fireEvent.press(getByTestId('discard-answer-10'));
    pressAlertButton('cancel');

    expect(discardAnswer).not.toHaveBeenCalled();
  });

  /**
   * Once the bundle catches up with the deletion that caused the refusal, the
   * answer has no field left to render against — but it still blocks the
   * interview, so it needs its own way out.
   */
  it('offers to discard a refused answer whose question is gone', async () => {
    const discardAnswer = jest.fn();
    mockInterview({
      syncStatus: 'partial',
      orphanedErrors: [{ clientId: 'a-9', itemId: 999, error: 'api.sync.item_not_in_form' }],
      discardAnswer,
    });

    const { getByTestId } = await render(<InterviewScreen />);
    await fireEvent.press(getByTestId('discard-orphan-a-9'));
    pressAlertButton('destructive');

    expect(discardAnswer).toHaveBeenCalledWith('a-9');
  });
});

describe('constraints the form declares', () => {
  it('says nothing about a required field until completion is attempted', async () => {
    mockInterview({ answers: {} });

    const { queryByTestId } = await render(<InterviewScreen />);

    // Marking the whole interview red before a word is recorded helps nobody.
    expect(queryByTestId('answer-issue-10')).toBeNull();
  });

  it('marks what is missing when Done is pressed', async () => {
    mockInterview({ answers: {} });

    const { getByTestId, getByText } = await render(<InterviewScreen />);
    await fireEvent.press(getByTestId('interview-done'));

    expect(getByTestId('answer-issue-10')).toBeTruthy();
    expect(getByText('interview.issues.required')).toBeTruthy();
  });

  it('does not leave while there is something to review', async () => {
    mockInterview({ answers: {} });

    const { getByTestId } = await render(<InterviewScreen />);
    await fireEvent.press(getByTestId('interview-done'));

    expect(mockGoBack).not.toHaveBeenCalled();
  });

  /**
   * An interview left half-filled is ordinary fieldwork — the informant had to
   * go, an answer needs checking. Trapping the recorder would not fill it in,
   * and everything is saved either way.
   */
  it('lets the recorder leave anyway once told', async () => {
    mockInterview({ answers: {} });

    const { getByTestId } = await render(<InterviewScreen />);
    await fireEvent.press(getByTestId('interview-done'));
    const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2] as AlertButton[];
    buttons?.find((button) => button.style !== 'cancel')?.onPress?.();

    expect(mockGoBack).toHaveBeenCalled();
  });
});
