import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/test/render';
import { Button } from './button';
import { splitTemplate } from './linked-text';
import { targetIndex } from './sortable-list';
import { Stepper } from './stepper';
import { TextField } from './text-field';
import { clampZoom } from './zoomable-image';

describe('pure ui helpers', () => {
  it('splits catalog templates around placeholders', () => {
    expect(splitTemplate('I agree to the {terms} and the {privacy}.')).toEqual([
      { text: 'I agree to the ' },
      { text: '{terms}', key: 'terms' },
      { text: ' and the ' },
      { text: '{privacy}', key: 'privacy' },
      { text: '.' },
    ]);
  });

  it('computes drop positions for drag and drop', () => {
    expect(targetIndex(0, 130, 60, 4)).toBe(2);
    expect(targetIndex(2, -500, 60, 4)).toBe(0);
    expect(targetIndex(1, 1000, 60, 4)).toBe(3);
    expect(targetIndex(1, 50, 0, 4)).toBe(1);
  });

  it('clamps zoom levels', () => {
    expect(clampZoom(9, 1, 5)).toBe(5);
    expect(clampZoom(0.2, 1, 5)).toBe(1);
  });
});

describe('ui components', () => {
  it('presses an enabled button and ignores a loading one', async () => {
    const onPress = jest.fn();
    renderWithProviders(
      <>
        <Button label="Go" onPress={onPress} />
        <Button label="Busy" onPress={onPress} loading />
      </>,
    );
    fireEvent.press(await screen.findByLabelText('Go'));
    fireEvent.press(screen.getByLabelText('Busy'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('reveals a secret field and shows translated errors', async () => {
    renderWithProviders(<TextField label="Password" secret error="validation.passwordLength" errorParams={{ min: 10 }} value="" />);
    expect(await screen.findByText('Use at least 10 characters.')).toBeTruthy();
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
    fireEvent.press(screen.getByLabelText('Show password'));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);
  });

  it('keeps the stepper within bounds', async () => {
    const onChange = jest.fn();
    renderWithProviders(<Stepper name="Count" value={1} min={1} max={2} onChange={onChange} />);
    fireEvent.press(await screen.findByLabelText('Decrease Count'));
    fireEvent.press(screen.getByLabelText('Increase Count'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(2);
  });
});
