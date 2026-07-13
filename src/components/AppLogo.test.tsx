import { render } from '@testing-library/react-native';

import { AppLogo } from './AppLogo';

describe('AppLogo', () => {
  it('renders the brand mark', async () => {
    const { getByTestId } = await render(<AppLogo size={48} color="#3c6200" />);
    expect(getByTestId('app-logo')).toBeTruthy();
  });
});
