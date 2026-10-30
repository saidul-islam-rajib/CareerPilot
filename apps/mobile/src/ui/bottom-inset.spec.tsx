import { act, screen } from '@testing-library/react-native';
import { DeviceEventEmitter } from 'react-native';
import { renderWithProviders } from '@/test/render';
import { useBottomInset } from './bottom-inset';
import { Text } from './text';

const HOME_INDICATOR = 34;

function InsetProbe() {
  return <Text testID="bottom-inset">{String(useBottomInset())}</Text>;
}

function shownInset(): string {
  return String(screen.getByTestId('bottom-inset').props.children);
}

describe('useBottomInset', () => {
  it('keeps content above the home indicator until the keyboard opens', async () => {
    await renderWithProviders(<InsetProbe />, { bottomInset: HOME_INDICATOR });
    expect(shownInset()).toBe(String(HOME_INDICATOR));
    await act(() => DeviceEventEmitter.emit('keyboardWillShow', {}));
    expect(shownInset()).toBe('0');
    await act(() => DeviceEventEmitter.emit('keyboardWillHide', {}));
    expect(shownInset()).toBe(String(HOME_INDICATOR));
  });
});
