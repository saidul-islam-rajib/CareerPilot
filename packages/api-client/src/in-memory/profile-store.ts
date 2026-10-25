import { CompletenessKind, ContactKind, DocumentKind, enumValues, type EnumKey } from '@careerpilot/domain-ui-logic';
import { cleanMultiline, cleanText, normalizeSkills, validateEntry, type EntryValue, type SectionDefinition } from '@careerpilot/dynamic-forms';
import { ApiError, ApiErrorCode } from '../errors';
import type { Clock, IdGenerator, ProfileApi } from '../ports';
import type {
  CompletenessItem,
  Contact,
  DocumentVersion,
  Profile,
  ProfileDocument,
  ProfileEntry,
  PublicConfig,
  UploadSource,
} from '../types';
import { samplePdfDataUri } from './sample-pdf';

const PERCENT = 100;
const FIRST_POSITION = 1;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const FILE_EXTENSION = /\.[^.]+$/;
const PATH_SEPARATORS = /^.*[\\/]/;

export const UploadDetail = {
  Empty: 'file_empty',
  TooLarge: 'file_too_large',
  Type: 'file_type',
} as const;

interface Trash {
  contacts: Contact[];
  entries: Record<string, ProfileEntry[]>;
  documents: ProfileDocument[];
}

export interface ProfileStoreOptions {
  profile: Profile;
  config: PublicConfig;
  clock: Clock;
  ids: IdGenerator;
  respond: <T>(value: T) => Promise<T>;
  reject: (code: ApiErrorCode, detail?: string) => Promise<never>;
}

function invalid(detail: string): never {
  throw new ApiError(ApiErrorCode.Validation, 422, detail);
}

function missing(detail: string): never {
  throw new ApiError(ApiErrorCode.NotFound, 404, detail);
}

function nextPosition(items: ReadonlyArray<{ position: number }>): number {
  return items.reduce((max, item) => Math.max(max, item.position), FIRST_POSITION - 1) + 1;
}

function sortByPosition<T extends { position: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.position - b.position);
}

function objectUrl(blob: Blob): string | undefined {
  try {
    return typeof URL.createObjectURL === 'function' ? URL.createObjectURL(blob) : undefined;
  } catch {
    return undefined;
  }
}

function fileUrl(file: UploadSource): string {
  return (file.blob ? objectUrl(file.blob) : file.uri) ?? samplePdfDataUri(file.name);
}

function displayName(name: string, maxLength: number): string {
  return cleanText(name.replace(PATH_SEPARATORS, '')).slice(0, maxLength);
}

export function computeCompleteness(profile: Profile, config: PublicConfig): { completeness: number; items: CompletenessItem[] } {
  const settings = config.profile;
  const checks: Record<Exclude<CompletenessKind, 'section'>, () => boolean> = {
    [CompletenessKind.Basics]: () => Boolean(profile.fullName && profile.headline),
    [CompletenessKind.Photo]: () => Boolean(profile.photoUrl),
    [CompletenessKind.Contacts]: () => enumValues(ContactKind).every((kind) => profile.contacts.some((c) => c.kind === kind)),
    [CompletenessKind.Skills]: () => profile.skills.length >= settings.limits.minSkillsForCompleteness,
    [CompletenessKind.Documents]: () => profile.documents.some((d) => d.kind === DocumentKind.Cv),
  };
  const items = settings.completeness.map((rule) => ({
    key: rule.section ?? rule.kind,
    weight: rule.weight,
    done: rule.kind === CompletenessKind.Section ? (profile.sections[rule.section ?? '']?.length ?? 0) > 0 : checks[rule.kind](),
  }));
  const total = items.reduce((sum, item) => sum + item.weight, 0) || PERCENT;
  const earned = items.reduce((sum, item) => sum + (item.done ? item.weight : 0), 0);
  return { completeness: Math.round((PERCENT * earned) / total), items };
}

export function createProfileStore(options: ProfileStoreOptions): ProfileApi {
  const { config, clock, ids } = options;
  const settings = config.profile;
  const limits = settings.limits;
  const profile = options.profile;
  const trash: Trash = { contacts: [], entries: {}, documents: [] };

  const nowIso = () => clock.now().toISOString();
  const optionsOf = (key: EnumKey) => config.enumValues.filter((v) => v.enumKey === key && v.isActive).map((v) => v.value);
  const sectionOf = (key: string): SectionDefinition => settings.sections.find((s) => s.key === key) ?? missing('section');
  const entriesOf = (key: string): ProfileEntry[] => (profile.sections[key] ??= []);

  async function run(change: () => void): Promise<Profile> {
    try {
      change();
    } catch (error) {
      if (error instanceof ApiError) {
        return options.reject(error.code, error.detail);
      }
      throw error;
    }
    const { completeness, items } = computeCompleteness(profile, config);
    profile.completeness = completeness;
    profile.completenessItems = items;
    profile.contacts = sortByPosition(profile.contacts);
    profile.documents = sortByPosition(profile.documents);
    for (const key of Object.keys(profile.sections)) {
      profile.sections[key] = sortByPosition(entriesOf(key));
    }
    return options.respond(profile);
  }

  function requireLength(value: string, max: number, detail: string): string {
    return value.length > max ? invalid(detail) : value;
  }

  function contactValue(kind: ContactKind, value: string): string {
    if (kind === ContactKind.Email) {
      const email = value.trim().toLowerCase();
      return EMAIL.test(email) && email.length <= config.validationPolicy.email.maxLength ? email : invalid('email');
    }
    const phone = cleanText(value);
    return new RegExp(limits.phonePattern).test(phone) ? phone : invalid('phone');
  }

  function entryValues(section: SectionDefinition, values: Record<string, EntryValue>): Record<string, EntryValue> {
    const unknown = Object.keys(values).find((key) => !section.fields.some((f) => f.key === key));
    if (unknown) {
      invalid(`${section.key}.${unknown}`);
    }
    const result = validateEntry(section, values, { limits, now: clock.now(), optionsOf });
    if (!result.ok) {
      invalid(`${section.key}.${Object.keys(result.errors)[0] ?? ''}`);
    }
    return result.values;
  }

  function stored(file: UploadSource, accepted: string[], maxBytes: number): Omit<DocumentVersion, 'version'> {
    if (file.size <= 0) {
      invalid(UploadDetail.Empty);
    }
    if (file.size > maxBytes) {
      invalid(UploadDetail.TooLarge);
    }
    if (!accepted.includes(file.type)) {
      invalid(UploadDetail.Type);
    }
    return { fileName: displayName(file.name, limits.documentNameMaxLength), contentType: file.type, sizeBytes: file.size, uploadedAt: nowIso(), url: fileUrl(file) };
  }

  function ensurePrimary(kind: ContactKind): void {
    const sameKind = sortByPosition(profile.contacts.filter((c) => c.kind === kind));
    const first = sameKind[0];
    if (first && !sameKind.some((c) => c.isPrimary)) {
      first.isPrimary = true;
    }
  }

  function reorder<T extends { id: string; position: number }>(items: T[], orderedIds: string[], detail: string): void {
    if (orderedIds.length !== items.length || !items.every((item) => orderedIds.includes(item.id))) {
      invalid(detail);
    }
    for (const item of items) {
      item.position = orderedIds.indexOf(item.id) + FIRST_POSITION;
    }
  }

  function take<T extends { id: string }>(items: T[], id: string, detail: string): T {
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) {
      missing(detail);
    }
    return items.splice(index, 1)[0] as T;
  }

  const find = <T extends { id: string }>(items: T[], id: string, detail: string): T => items.find((item) => item.id === id) ?? missing(detail);

  return {
    getProfile: () => run(() => undefined),
    updateBasics: (changes) =>
      run(() => {
        if (changes.fullName !== undefined) {
          const name = changes.fullName.trim();
          const policy = config.validationPolicy.name;
          profile.fullName = name.length >= policy.minLength && name.length <= policy.maxLength ? name : invalid('name');
        }
        if (changes.headline !== undefined) {
          profile.headline = requireLength(cleanText(changes.headline), limits.headlineMaxLength, 'headline');
        }
        if (changes.location !== undefined) {
          profile.location = requireLength(cleanText(changes.location), limits.locationMaxLength, 'location');
        }
        if (changes.summary !== undefined) {
          profile.summary = requireLength(cleanMultiline(changes.summary), limits.summaryMaxLength, 'summary');
        }
      }),
    setPhoto: (file) =>
      run(() => {
        profile.photoUrl = stored(file, settings.uploads.photoTypes, settings.uploads.maxPhotoBytes).url;
      }),
    removePhoto: () =>
      run(() => {
        delete profile.photoUrl;
      }),
    addContact: (input) =>
      run(() => {
        if (profile.contacts.length >= limits.maxContacts) {
          invalid('contacts');
        }
        const value = contactValue(input.kind, input.value);
        if (profile.contacts.some((c) => c.kind === input.kind && c.value === value)) {
          throw new ApiError(ApiErrorCode.Conflict, 409, 'contact_exists');
        }
        profile.contacts.push({
          id: ids.next('c'),
          kind: input.kind,
          value,
          label: requireLength(cleanText(input.label), limits.contactLabelMaxLength, 'label'),
          isPrimary: !profile.contacts.some((c) => c.kind === input.kind),
          verified: false,
          position: nextPosition(profile.contacts),
        });
      }),
    updateContact: (id, changes) =>
      run(() => {
        const contact = find(profile.contacts, id, 'contact');
        if (changes.value !== undefined) {
          const value = contactValue(contact.kind, changes.value);
          if (value !== contact.value) {
            contact.value = value;
            contact.verified = false;
          }
        }
        if (changes.label !== undefined) {
          contact.label = requireLength(cleanText(changes.label), limits.contactLabelMaxLength, 'label');
        }
      }),
    removeContact: (id) =>
      run(() => {
        const contact = take(profile.contacts, id, 'contact');
        trash.contacts.push({ ...contact, isPrimary: false });
        ensurePrimary(contact.kind);
      }),
    restoreContact: (id) =>
      run(() => {
        const contact = take(trash.contacts, id, 'contact');
        profile.contacts.push({ ...contact, position: nextPosition(profile.contacts) });
        ensurePrimary(contact.kind);
      }),
    reorderContacts: (orderedIds) => run(() => reorder(profile.contacts, orderedIds, 'contact_order')),
    setPrimaryContact: (id) =>
      run(() => {
        const target = find(profile.contacts, id, 'contact');
        for (const contact of profile.contacts) {
          if (contact.kind === target.kind) {
            contact.isPrimary = contact.id === id;
          }
        }
      }),
    setSkills: (skills) =>
      run(() => {
        const normalized = normalizeSkills(skills, limits.maxSkillLength);
        if (normalized.tooLong.length > 0 || normalized.skills.length > limits.maxSkills) {
          invalid('skills');
        }
        profile.skills = normalized.skills;
      }),
    addEntry: (key, values) =>
      run(() => {
        const section = sectionOf(key);
        const entries = entriesOf(section.key);
        if (entries.length >= limits.maxEntriesPerSection) {
          invalid(section.key);
        }
        entries.push({ id: ids.next('pe'), position: nextPosition(entries), values: entryValues(section, values), updatedAt: nowIso() });
      }),
    updateEntry: (key, id, values) =>
      run(() => {
        const section = sectionOf(key);
        const entry = find(entriesOf(section.key), id, 'entry');
        entry.values = entryValues(section, values);
        entry.updatedAt = nowIso();
      }),
    removeEntry: (key, id) =>
      run(() => {
        const section = sectionOf(key);
        (trash.entries[section.key] ??= []).push(take(entriesOf(section.key), id, 'entry'));
      }),
    restoreEntry: (key, id) =>
      run(() => {
        const section = sectionOf(key);
        const entry = take(trash.entries[section.key] ?? [], id, 'entry');
        const entries = entriesOf(section.key);
        entries.push({ ...entry, position: nextPosition(entries) });
      }),
    reorderEntries: (key, orderedIds) => run(() => reorder(entriesOf(sectionOf(key).key), orderedIds, 'entry_order')),
    uploadDocument: (input) =>
      run(() => {
        if (profile.documents.length >= limits.maxDocuments) {
          invalid('documents');
        }
        const file = { ...stored(input.file, settings.uploads.documentTypes, settings.uploads.maxDocumentBytes), version: FIRST_POSITION };
        const name = cleanText(input.name ?? '') || file.fileName.replace(FILE_EXTENSION, '');
        profile.documents.push({
          id: ids.next('doc'),
          name: requireLength(name, limits.documentNameMaxLength, 'name'),
          kind: input.kind,
          position: nextPosition(profile.documents),
          version: file.version,
          updatedAt: file.uploadedAt,
          file,
          versions: [file],
        });
      }),
    uploadDocumentVersion: (id, upload) =>
      run(() => {
        const document = find(profile.documents, id, 'document');
        const file = { ...stored(upload, settings.uploads.documentTypes, settings.uploads.maxDocumentBytes), version: document.version + 1 };
        Object.assign(document, { version: file.version, updatedAt: file.uploadedAt, file, versions: [file, ...document.versions] });
      }),
    updateDocument: (id, changes) =>
      run(() => {
        const document = find(profile.documents, id, 'document');
        if (changes.name !== undefined) {
          const name = cleanText(changes.name);
          document.name = name ? requireLength(name, limits.documentNameMaxLength, 'name') : invalid('name');
        }
        if (changes.kind !== undefined) {
          document.kind = changes.kind;
        }
        document.updatedAt = nowIso();
      }),
    removeDocument: (id) => run(() => void trash.documents.push(take(profile.documents, id, 'document'))),
    restoreDocument: (id) =>
      run(() => {
        const document = take(trash.documents, id, 'document');
        profile.documents.push({ ...document, position: nextPosition(profile.documents) });
      }),
    reorderDocuments: (orderedIds) => run(() => reorder(profile.documents, orderedIds, 'document_order')),
  };
}
