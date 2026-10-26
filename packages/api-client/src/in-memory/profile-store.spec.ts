import { describe, expect, it } from 'vitest';
import { ContactKind, DocumentKind } from '@careerpilot/domain-ui-logic';
import { ApiErrorCode, isApiError } from '../errors';
import { createTestApi } from '../test-support';
import type { UploadSource } from '../types';
import { samplePdf } from './sample-pdf';

const PDF_TYPE = 'application/pdf';

function pdfFile(name: string, size = 2_048): UploadSource {
  return { name, type: PDF_TYPE, size, blob: new Blob([samplePdf(name)], { type: PDF_TYPE }) };
}

async function failure(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e);
  if (!isApiError(error)) {
    throw new Error('expected an API error');
  }
  return { code: error.code, detail: error.detail };
}

describe('in-memory profile store', () => {
  it('updates basics with the same rules as the server', async () => {
    const api = createTestApi();
    const profile = await api.profile.updateBasics({ headline: '  Lead   engineer ', location: 'Chattogram', summary: ' Hello  \nworld ' });
    expect([profile.headline, profile.location, profile.summary]).toEqual(['Lead engineer', 'Chattogram', 'Hello\nworld']);
    expect(await failure(api.profile.updateBasics({ fullName: 'A' }))).toEqual({ code: ApiErrorCode.Validation, detail: 'name' });
  });

  it('adds, edits, removes, and restores contacts with one primary per kind', async () => {
    const api = createTestApi();
    const added = await api.profile.addContact({ kind: ContactKind.Email, value: ' New@Example.com ', label: 'Jobs' });
    const contact = added.contacts.at(-1);
    expect([contact?.value, contact?.isPrimary, contact?.verified]).toEqual(['new@example.com', false, false]);
    expect(await failure(api.profile.addContact({ kind: ContactKind.Email, value: 'new@example.com', label: 'Again' }))).toEqual({
      code: ApiErrorCode.Conflict,
      detail: 'contact_exists',
    });
    expect((await failure(api.profile.addContact({ kind: ContactKind.Phone, value: 'call me', label: '' }))).detail).toBe('phone');

    const edited = await api.profile.updateContact('c_phone_mobile', { value: '+880 1999 000111' });
    expect(edited.contacts.find((c) => c.id === 'c_phone_mobile')).toMatchObject({ value: '+880 1999 000111', verified: false });

    const removed = await api.profile.removeContact('c_email_work');
    expect(removed.contacts.some((c) => c.id === 'c_email_work')).toBe(false);
    expect(removed.contacts.filter((c) => c.kind === ContactKind.Email && c.isPrimary).map((c) => c.id)).toEqual(['c_email_personal']);
    const restored = await api.profile.restoreContact('c_email_work');
    expect(restored.contacts.at(-1)?.id).toBe('c_email_work');
  });

  it('frames the photo with the same rules as the server', async () => {
    const api = createTestApi();
    const crop = { x: 0.25, y: 0, width: 0.5, height: 0.25 };
    expect((await api.profile.setPhotoCrop(crop)).photoCrop).toEqual(crop);
    expect((await failure(api.profile.setPhotoCrop({ x: 0.75, y: 0, width: 0.5, height: 0.5 }))).detail).toBe('photo_crop');
    const replaced = await api.profile.setPhoto({ name: 'me.png', type: 'image/png', size: 1_024, blob: new Blob(['png'], { type: 'image/png' }) });
    expect(replaced.photoCrop).toBeUndefined();
    await api.profile.removePhoto();
    expect(await failure(api.profile.setPhotoCrop(crop))).toEqual({ code: ApiErrorCode.NotFound, detail: 'photo' });
  });

  it('cleans skills and rejects overly long ones', async () => {
    const api = createTestApi();
    expect((await api.profile.setSkills([' Go ', 'go', 'Rust'])).skills).toEqual(['Go', 'Rust']);
    expect((await failure(api.profile.setSkills(['x'.repeat(200)]))).detail).toBe('skills');
  });

  it('validates section entries and supports undo and reordering', async () => {
    const api = createTestApi();
    expect((await failure(api.profile.addEntry('experience', { title: '', organization: 'X', start: '2024-01' }))).detail).toBe('experience.title');
    expect((await failure(api.profile.addEntry('experience', { title: 'A', organization: 'X', start: '2024-05', end: '2024-01' }))).detail).toBe('experience.end');
    expect((await failure(api.profile.addEntry('hobbies', { name: 'Chess' }))).code).toBe(ApiErrorCode.NotFound);

    const added = await api.profile.addEntry('languages', { language: 'Arabic', proficiency: 'basic' });
    const id = added.sections.languages?.at(-1)?.id ?? '';
    expect(added.sections.languages?.at(-1)?.values).toEqual({ language: 'Arabic', proficiency: 'basic' });

    const removed = await api.profile.removeEntry('languages', id);
    expect(removed.sections.languages?.map((e) => e.id)).not.toContain(id);
    const restored = await api.profile.restoreEntry('languages', id);
    const ids = restored.sections.languages?.map((e) => e.id) ?? [];
    expect(ids.at(-1)).toBe(id);
    const reordered = await api.profile.reorderEntries('languages', [...ids].reverse());
    expect(reordered.sections.languages?.map((e) => e.id)).toEqual([...ids].reverse());
  });

  it('uploads PDF documents with versions and rejects other files', async () => {
    const api = createTestApi();
    const uploaded = await api.profile.uploadDocument({ file: pdfFile('C:\\fakepath\\Ayesha CV.pdf'), kind: DocumentKind.Cv });
    const document = uploaded.documents.at(-1);
    expect([document?.name, document?.version, document?.file.fileName]).toEqual(['Ayesha CV', 1, 'Ayesha CV.pdf']);

    const image: UploadSource = { name: 'scan.png', type: 'image/png', size: 100, uri: 'file://scan.png' };
    expect((await failure(api.profile.uploadDocument({ file: image, kind: DocumentKind.Other }))).detail).toBe('file_type');
    expect((await failure(api.profile.uploadDocument({ file: pdfFile('huge.pdf', 50_000_000), kind: DocumentKind.Other }))).detail).toBe('file_too_large');

    const versioned = await api.profile.uploadDocumentVersion(document?.id ?? '', pdfFile('Ayesha CV v2.pdf'));
    expect(versioned.documents.find((d) => d.id === document?.id)?.versions.map((v) => v.version)).toEqual([2, 1]);
    const renamed = await api.profile.updateDocument(document?.id ?? '', { name: 'Remote CV', kind: DocumentKind.CoverLetter });
    expect(renamed.documents.find((d) => d.id === document?.id)).toMatchObject({ name: 'Remote CV', kind: DocumentKind.CoverLetter });
  });

  it('recomputes completeness from the configured weights', async () => {
    const api = createTestApi();
    const before = await api.profile.getProfile();
    expect(before.completenessItems.map((item) => item.key)).toContain('documents');
    for (const document of before.documents) {
      await api.profile.removeDocument(document.id);
    }
    const after = await api.profile.getProfile();
    expect(after.completenessItems.find((item) => item.key === 'documents')?.done).toBe(false);
    expect(after.completeness).toBeLessThan(before.completeness);
  });
});
