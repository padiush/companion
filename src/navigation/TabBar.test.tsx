import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { fireEvent, render } from '@testing-library/react-native';

import { TabBar } from './TabBar';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const routes = [
  { key: 'i', name: 'Interviews' },
  { key: 'r', name: 'Records' },
  { key: 'o', name: 'Outbox' },
];

function props(index = 0, badge?: number): BottomTabBarProps {
  const navigation = { emit: jest.fn(() => ({ defaultPrevented: false })), navigate: jest.fn() };
  return {
    navigation,
    state: { index, routes },
    descriptors: {
      i: { options: { tabBarLabel: 'Entrevistas' } },
      r: { options: { tabBarLabel: 'Registros' } },
      o: { options: { tabBarLabel: 'Por enviar', tabBarBadge: badge } },
    },
  } as unknown as BottomTabBarProps;
}

describe('TabBar', () => {
  it('names only the open tab, and moves to another when pressed', async () => {
    const p = props(0);
    const { getByText, queryByText, getByTestId } = await render(<TabBar {...p} />);

    expect(getByText('Entrevistas')).toBeTruthy();
    expect(queryByText('Registros')).toBeNull();

    await fireEvent.press(getByTestId('tab-Records'));

    expect(p.navigation.navigate).toHaveBeenCalledWith('Records', undefined);
  });

  /** Unsent work is visible from every tab. */
  it('counts what is waiting to be sent on Por enviar', async () => {
    const { getByTestId } = await render(<TabBar {...props(0, 3)} />);

    expect(getByTestId('tab-badge-Outbox')).toHaveTextContent('3');
    expect(getByTestId('tab-Outbox').props.accessibilityLabel).toBe('Por enviar, 3');
  });
});
