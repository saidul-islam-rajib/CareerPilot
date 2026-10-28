import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/test/render';
import { Button } from './button';
import { splitTemplate } from './linked-text';
import { targetIndex } from './sortable-list';
import { Stepper } from './stepper';
import { TextField } from './text-field';
import { boundTranslation, clampZoom, focalTranslation } from './zoomable-image';

describe('pure ui helpers', () => {
  it('splits catalog templates around placeholders', async () => {
    expect(splitTemplate('I agree to the {terms} and the {privacy}.')).toEqual([
      { text: 'I agree to the ' },
      { text: '{terms}', key: 'terms' },
      { text: ' and the ' },
      { text: '{privacy}', key: 'privacy' },
      { text: '.' },
    ]);
  });

  it('computes drop positions for drag and drop', async () => {
    expect(targetIndex(0, 130, 60, 4)).toBe(2);
    expect(targetIndex(2, -500, 60, 4)).toBe(0);
    expect(targetIndex(1, 1000, 60, 4)).toBe(3);
    expect(targetIndex(1, 50, 0, 4)).toBe(1);
  });

  it('clamps zoom levels', async () => {
    expect(clampZoom(9, 1, 5)).toBe(5);
    expect(clampZoom(0.2, 1, 5)).toBe(1);
    expect(focalTranslation(100, 0, 2)).toBe(-100);
    expect(focalTranslation(0, 40, 2)).toBe(80);
    expect(boundTranslation(500, 200, 2)).toBe(100);
    expect(boundTranslation(-500, 200, 2)).toBe(-100);
    expect(boundTranslation(30, 200, 1)).toBe(0);
  });
});

describe('ui components', () => {
  it('presses an enabled button and ignores a loading one', async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <>
        <Button label="Go" onPress={onPress} />
        <Button label="Busy" onPress={onPress} loading />
      </>,
    );
    await fireEvent.press(await screen.findByLabelText('Go'));
    await fireEvent.press(screen.getByLabelText('Busy'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('reveals a secret field and shows translated errors', async () => {
    await renderWithProviders(<TextField label="Password" secret error="validation.passwordLength" errorParams={{ min: 10 }} value="" />);
    expect(await screen.findByText('Use at least 10 characters.')).toBeTruthy();
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
    await fireEvent.press(screen.getByLabelText('Show password'));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);
  });

  it('keeps the stepper within bounds', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<Stepper name="Count" value={1} min={1} max={2} onChange={onChange} />);
    await fireEvent.press(await screen.findByLabelText('Decrease Count'));
    await fireEvent.press(screen.getByLabelText('Increase Count'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(2);
  });
});
