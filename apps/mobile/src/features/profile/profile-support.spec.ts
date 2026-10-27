import { toUploadSource } from './profile-support';

const mockPhoneBytes = new Uint8Array([37, 80, 68, 70]);

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((uri: string) => ({ uri, bytes: async () => mockPhoneBytes })),
}));

describe('toUploadSource', () => {
  it('reads a phone file through the file system and keeps its own name', async () => {
    const source = toUploadSource({ uri: 'file:///cache/DocumentPicker/4f2a.pdf', name: 'My CV.pdf', mimeType: 'application/pdf', size: 4 });
    expect(source).toMatchObject({ name: 'My CV.pdf', type: 'application/pdf', size: 4, blob: undefined });
    expect(await source.bytes?.()).toBe(mockPhoneBytes);
  });

  it('sends a browser file as it is', () => {
    const file = new File(['%PDF'], 'cv.pdf', { type: 'application/pdf' });
    const source = toUploadSource({ uri: 'blob:cv', file });
    expect(source).toMatchObject({ name: 'blob:cv', type: 'application/pdf', blob: file, bytes: undefined });
  });
});
