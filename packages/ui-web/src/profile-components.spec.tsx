import { act, fireEvent, render, screen } from '@testing-library/react';
import { checkFile, FileDropZone, FileRejection } from './file-drop-zone';
import { ProgressRing } from './progress-ring';
import { SelectField } from './select-field';
import { splitTags, TagInput } from './tag-input';
import { ToastProvider, useToast } from './toast';

const PDF = 'application/pdf';

function file(name: string, type: string, size: number): File {
  const created = new File(['x'], name, { type });
  Object.defineProperty(created, 'size', { value: size });
  return created;
}

describe('file checks', () => {
  it('rejects empty, wrong-type, and oversized files', () => {
    expect(checkFile(file('a.pdf', PDF, 0), [PDF], 10)).toBe(FileRejection.Empty);
    expect(checkFile(file('a.png', 'image/png', 5), [PDF], 10)).toBe(FileRejection.Type);
    expect(checkFile(file('a.pdf', PDF, 11), [PDF], 10)).toBe(FileRejection.Size);
    expect(checkFile(file('a.pdf', PDF, 10), [PDF], 10)).toBeUndefined();
  });

  it('passes accepted files from the picker and reports rejected ones', () => {
    const onFile = vi.fn();
    const onReject = vi.fn();
    render(<FileDropZone label="Upload PDF" hint="PDF only" accept={[PDF]} maxBytes={10} onFile={onFile} onReject={onReject} />);
    const input = screen.getByLabelText('Upload PDF');
    fireEvent.change(input, { target: { files: [file('cv.pdf', PDF, 5)] } });
    fireEvent.change(input, { target: { files: [file('photo.png', 'image/png', 5)] } });
    expect(onFile).toHaveBeenCalledTimes(1);
    expect(onReject).toHaveBeenCalledWith(FileRejection.Type);
  });
});

describe('tag input', () => {
  it('splits comma separated tags', () => {
    expect(splitTags(' React, ,TypeScript ')).toEqual(['React', 'TypeScript']);
  });

  it('adds on Enter, removes with buttons and Backspace', () => {
    const onAdd = vi.fn();
    const onRemove = vi.fn();
    render(<TagInput label="Skills" values={['Go', 'Rust']} addLabel="Add skill" removeLabel={(v) => `Remove ${v}`} onAdd={onAdd} onRemove={onRemove} />);
    const input = screen.getByRole('textbox', { name: 'Skills' });
    fireEvent.change(input, { target: { value: 'React, Vue' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAdd).toHaveBeenCalledWith(['React', 'Vue']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Go' }));
    fireEvent.keyDown(input, { key: 'Backspace' });
    expect(onRemove.mock.calls).toEqual([['Go'], ['Rust']]);
  });
});

describe('select field and progress ring', () => {
  it('reports the chosen option', () => {
    const onValueChange = vi.fn();
    render(<SelectField label="Proficiency" value="" placeholder="Choose" options={[{ value: 'native', label: 'Native' }]} onValueChange={onValueChange} />);
    fireEvent.change(screen.getByLabelText('Proficiency'), { target: { value: 'native' } });
    expect(onValueChange).toHaveBeenCalledWith('native');
  });

  it('exposes progress to assistive technology', () => {
    render(<ProgressRing value={0.86} label="Profile 86% complete" caption="86%" />);
    expect(screen.getByRole('progressbar', { name: 'Profile 86% complete' })).toHaveAttribute('aria-valuenow', '86');
  });
});

function UndoButton({ onUndo }: { onUndo: () => void }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast.show({ message: 'Entry removed', actionLabel: 'Undo', onAction: onUndo })}>
      Remove
    </button>
  );
}

describe('toasts', () => {
  it('runs the undo action and closes the toast', () => {
    const onUndo = vi.fn();
    render(
      <ToastProvider>
        <UndoButton onUndo={onUndo} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.getByText('Entry removed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Entry removed')).not.toBeInTheDocument();
  });

  it('dismisses itself after a while', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <UndoButton onUndo={vi.fn()} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.queryByText('Entry removed')).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
