import { fireEvent, render } from '@testing-library/react-native';

import type { Item, ItemType } from '../api/types';
import { FormItemInput } from './FormItemInput';

function item(overrides: Partial<Item> & { type: ItemType }): Item {
  return {
    id: 10,
    label: 'Field',
    name: 'field',
    required: false,
    options: null,
    link_to_species: false,
    is_use_category: false,
    min: null,
    max: null,
    step: null,
    order: 1,
    ...overrides,
  };
}

describe('FormItemInput', () => {
  it('reports typed text', async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <FormItemInput item={item({ type: 'text' })} value="" onChange={onChange} />
    );

    await fireEvent.changeText(getByTestId('input-10'), 'guaba');
    expect(onChange).toHaveBeenCalledWith('guaba');
  });

  it('selects a single option and deselects on second tap', async () => {
    const onChange = jest.fn();
    const props = { item: item({ type: 'select', options: ['fresh', 'dry'] }), onChange };

    const { getByTestId, rerender } = await render(<FormItemInput {...props} value="" />);
    await fireEvent.press(getByTestId('option-10-fresh'));
    expect(onChange).toHaveBeenCalledWith('fresh');

    await rerender(<FormItemInput {...props} value="fresh" />);
    await fireEvent.press(getByTestId('option-10-fresh'));
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('toggles multi-select options in a list', async () => {
    const onChange = jest.fn();
    const multi = item({ type: 'multi', options: ['food', 'medicine'] });

    const { getByTestId } = await render(
      <FormItemInput item={multi} value={['food']} onChange={onChange} />
    );

    await fireEvent.press(getByTestId('option-10-medicine'));
    expect(onChange).toHaveBeenCalledWith(['food', 'medicine']);

    await fireEvent.press(getByTestId('option-10-food'));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('opens a date picker and reports the chosen date', async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <FormItemInput item={item({ type: 'date' })} value="" onChange={onChange} />
    );

    await fireEvent.press(getByTestId('date-10'));
    await fireEvent.press(getByTestId('date-picker-10'));

    expect(onChange).toHaveBeenCalledWith('2026-07-13');
  });
});
