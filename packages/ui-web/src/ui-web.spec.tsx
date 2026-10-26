import { fireEvent, render, screen } from '@testing-library/react';
import { Button } from './button';
import { clampZoom } from './image-viewer';
import { splitTemplate } from './linked-text';
import { Segmented } from './segmented';
import { SortableList } from './sortable-list';
import { Stepper } from './stepper';
import { TextField } from './text-field';
import { AppTheme, ThemeScope } from './theme';
import { themes } from '@careerpilot/ui-tokens';

describe('ui-web helpers', () => {
  it('splits templates and clamps zoom', () => {
    expect(splitTemplate('a {x} b').map((p) => p.key ?? p.text)).toEqual(['a ', 'x', ' b']);
    expect(clampZoom(10, 1, 5)).toBe(5);
  });
});

describe('ui-web components', () => {
  it('disables a loading button', () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('links a text field to its translated error and reveals secrets', () => {
    render(<TextField label="Password" secret error="validation.passwordLength" errorParams={{ min: 10 }} />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Use at least 10 characters.');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
  });

  it('keeps the stepper in range', () => {
    const onChange = vi.fn();
    render(<Stepper name="Count" value={5} min={1} max={5} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Increase Count' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Decrease Count' }));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('selects a segment', () => {
    const onChange = vi.fn();
    render(<Segmented label="Mode" value="a" onChange={onChange} options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]} />);
    fireEvent.click(screen.getByRole('radio', { name: 'B' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('reorders with accessible move buttons', () => {
    const onReorder = vi.fn();
    render(<SortableList items={['x', 'y']} keyOf={(i) => i} labelOf={(i) => i} renderItem={(i) => <span>{i}</span>} onReorder={onReorder} />);
    expect(screen.getByRole('button', { name: 'Move up: x' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Move down: x' }));
    expect(onReorder).toHaveBeenCalledWith(0, 1);
  });
});

describe('themes', () => {
  it('puts the app theme on the document so dialogs and menus in portals get its colours', () => {
    const root = document.documentElement;
    const { unmount } = render(
      <AppTheme theme={themes.horizon}>
        <ThemeScope theme={themes.orchid}>preview</ThemeScope>
      </AppTheme>,
    );
    expect(root.dataset.theme).toBe('horizon');
    expect(root.style.getPropertyValue('--cp-primary')).toBe(themes.horizon.colors.primary);
    expect(root.style.getPropertyValue('--cp-card')).toBe(themes.horizon.colors.card);
    expect(root.style.getPropertyValue('--cp-viewer-backdrop')).toBe(themes.horizon.colors.viewerBackdrop);
    unmount();
    expect(root.style.getPropertyValue('--cp-primary')).toBe('');
  });
});
