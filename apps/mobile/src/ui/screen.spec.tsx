import { StyleSheet } from 'react-native';
import { screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/test/render';
import { useTheme } from '@/core/theme/theme';
import { Button } from './button';
import { Screen } from './screen';
import { Text } from './text';

const HOME_INDICATOR = 34;
let footerSpacing = 0;

function SpacingProbe() {
  footerSpacing = useTheme().space.md;
  return null;
}

function bottomPadding(): number {
  return Number(StyleSheet.flatten(screen.getByTestId('screen-footer').props.style).paddingBottom);
}

describe('Screen', () => {
  it('keeps footer actions clear of the home indicator', async () => {
    await renderWithProviders(
      <Screen footer={<Button label="Approve and send" onPress={() => undefined} />}>
        <SpacingProbe />
        <Text>Body</Text>
      </Screen>,
      { bottomInset: HOME_INDICATOR },
    );
    expect(bottomPadding()).toBe(footerSpacing + HOME_INDICATOR);
  });

  it('still leaves breathing room on phones without a home indicator', async () => {
    await renderWithProviders(
      <Screen footer={<Button label="Save" onPress={() => undefined} />}>
        <SpacingProbe />
      </Screen>,
    );
    expect(bottomPadding()).toBe(footerSpacing);
  });

  it('does not add the inset twice when the screen already covers the bottom edge', async () => {
    await renderWithProviders(
      <Screen edges={['left', 'right', 'bottom']} footer={<Button label="Save" onPress={() => undefined} />}>
        <SpacingProbe />
      </Screen>,
      { bottomInset: HOME_INDICATOR },
    );
    expect(bottomPadding()).toBe(footerSpacing);
  });
});
