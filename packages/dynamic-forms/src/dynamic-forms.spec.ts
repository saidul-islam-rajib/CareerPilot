import { describe, expect, it } from 'vitest';
import { EnumKey, LanguageProficiency, ProfileFieldType, enumValues } from '@careerpilot/domain-ui-logic';
import {
  canAddEntry,
  describeEntry,
  emptyValues,
  fieldInputKind,
  formValues,
  normalizeSkills,
  sectionVisible,
  validateEntry,
  FieldMessage,
  type SectionDefinition,
  type ValidationContext,
} from './index';

const experience: SectionDefinition = {
  key: 'experience',
  icon: 'briefcase',
  titleField: 'title',
  subtitleFields: ['organization', 'location'],
  startField: 'start',
  endField: 'end',
  ongoingField: 'current',
  bodyField: 'summary',
  fields: [
    { key: 'title', type: ProfileFieldType.Text, required: true, maxLength: 20 },
    { key: 'organization', type: ProfileFieldType.Text, required: true },
    { key: 'location', type: ProfileFieldType.Text },
    { key: 'start', type: ProfileFieldType.Month, required: true },
    { key: 'end', type: ProfileFieldType.Month },
    { key: 'current', type: ProfileFieldType.Boolean },
    { key: 'summary', type: ProfileFieldType.Textarea },
  ],
};

const languages: SectionDefinition = {
  key: 'languages',
  icon: 'languages',
  titleField: 'language',
  subtitleFields: ['proficiency'],
  fields: [
    { key: 'language', type: ProfileFieldType.Text, required: true },
    { key: 'proficiency', type: ProfileFieldType.Select, required: true, options: EnumKey.LanguageProficiency },
  ],
};

const misc: SectionDefinition = {
  key: 'misc',
  icon: 'link',
  titleField: 'label',
  linkField: 'url',
  fields: [
    { key: 'label', type: ProfileFieldType.Text, required: true },
    { key: 'url', type: ProfileFieldType.Url },
    { key: 'email', type: ProfileFieldType.Email },
    { key: 'phone', type: ProfileFieldType.Phone },
    { key: 'year', type: ProfileFieldType.Year },
    { key: 'score', type: ProfileFieldType.Number, min: 0, max: 9 },
  ],
};

const context: ValidationContext = {
  limits: { phonePattern: '^\\+?[0-9][0-9 ()-]{5,19}$', minYear: 1950, futureYears: 10 },
  now: new Date('2026-10-25T00:00:00Z'),
  optionsOf: (key) => (key === EnumKey.LanguageProficiency ? enumValues(LanguageProficiency) : []),
};

describe('validateEntry', () => {
  it('cleans values and drops empty optional fields', () => {
    const input = { title: '  Staff   Engineer ', organization: 'Kite', location: '', start: '2024-01', current: true, end: '2025-01', summary: ' Led  \nthings  ' };
    expect(validateEntry(experience, input, context)).toEqual({
      ok: true,
      values: { title: 'Staff Engineer', organization: 'Kite', start: '2024-01', current: true, summary: 'Led\nthings' },
    });
  });

  it('reports one message per invalid field', () => {
    expect(validateEntry(experience, { title: 'x'.repeat(21), organization: ' ', start: '2024-13' }, context)).toEqual({
      ok: false,
      errors: {
        title: { message: FieldMessage.TooLong, params: { max: 20 } },
        organization: { message: FieldMessage.Required },
        start: { message: FieldMessage.Month },
      },
    });
  });

  it('rejects an end before the start unless the entry is ongoing', () => {
    expect(validateEntry(experience, { title: 'A', organization: 'B', start: '2024-05', end: '2024-01' }, context)).toEqual({
      ok: false,
      errors: { end: { message: FieldMessage.EndBeforeStart } },
    });
    expect(validateEntry(experience, { title: 'A', organization: 'B', start: '2024-05', end: '2024-01', current: true }, context).ok).toBe(true);
  });

  it('checks urls, emails, phones, years, numbers, and options', () => {
    const bad = validateEntry(misc, { label: 'L', url: 'javascript:alert(1)', email: 'nope', phone: 'call me', year: '1800', score: 12 }, context);
    const messages = bad.ok ? {} : Object.fromEntries(Object.entries(bad.errors).map(([key, error]) => [key, error.message]));
    expect(messages).toEqual({
      url: FieldMessage.Url,
      email: FieldMessage.Email,
      phone: FieldMessage.Phone,
      year: FieldMessage.Year,
      score: FieldMessage.Number,
    });
    const good = validateEntry(misc, { label: 'L', url: 'https://x.dev', email: 'A@B.co', phone: '+880 1712 345678', year: '2020', score: '7' }, context);
    expect(good).toEqual({ ok: true, values: { label: 'L', url: 'https://x.dev', email: 'a@b.co', phone: '+880 1712 345678', year: 2020, score: 7 } });
    expect(validateEntry(languages, { language: 'Bangla', proficiency: 'excellent' }, context).ok).toBe(false);
  });
});

describe('form helpers', () => {
  it('builds empty and prefilled form values', () => {
    expect(emptyValues(languages)).toEqual({ language: '', proficiency: '' });
    expect(formValues(experience, { title: 'A', current: true })).toMatchObject({ title: 'A', current: true, end: '' });
  });

  it('describes entries with option labels and periods', () => {
    expect(describeEntry(languages, { language: 'Bangla', proficiency: 'native' }, (key, value) => `${key}:${value}`)).toEqual({
      title: 'Bangla',
      subtitle: ['language_proficiency:native'],
      period: undefined,
      body: undefined,
      link: undefined,
    });
    expect(describeEntry(experience, { title: 'A', organization: 'B', start: '2024-01', current: true }, (_key, value) => value).period).toEqual({
      start: '2024-01',
      end: undefined,
      ongoing: true,
    });
  });

  it('normalizes skills and maps input kinds', () => {
    expect(normalizeSkills([' React ', 'react', 'Type  Script', '', 'x'.repeat(5)], 6)).toEqual({ skills: ['React', 'xxxxx'], tooLong: ['Type Script'] });
    expect(fieldInputKind(ProfileFieldType.Month)).toBe('month');
    expect(fieldInputKind(ProfileFieldType.Textarea)).toBe('text');
  });
});

describe('Bangladesh identity section', () => {
  const identity: SectionDefinition = {
    key: 'identity',
    icon: 'id-card',
    titleField: 'name_english',
    countries: ['BD'],
    maxEntries: 1,
    fields: [
      { key: 'name_english', type: ProfileFieldType.Text, required: true },
      { key: 'date_of_birth', type: ProfileFieldType.Date, required: true },
    ],
  };

  it('accepts real calendar days within the year range only', () => {
    expect(validateEntry(identity, { name_english: 'Ayesha', date_of_birth: '1998-04-23' }, context)).toEqual({ ok: true, values: { name_english: 'Ayesha', date_of_birth: '1998-04-23' } });
    for (const bad of ['1998-02-30', '23/04/1998', '1800-01-01', '1998-4-3']) {
      expect(validateEntry(identity, { name_english: 'Ayesha', date_of_birth: bad }, context)).toEqual({ ok: false, errors: { date_of_birth: { message: FieldMessage.Date } } });
    }
    expect(fieldInputKind(ProfileFieldType.Date)).toBe('date');
  });

  it('shows country sections at home or when they already have entries, and caps entries', () => {
    expect(sectionVisible(identity, 'BD', 0)).toBe(true);
    expect(sectionVisible(identity, 'SG', 0)).toBe(false);
    expect(sectionVisible(identity, 'SG', 1)).toBe(true);
    expect(sectionVisible(experience, 'SG', 0)).toBe(true);
    expect(canAddEntry(identity, 0)).toBe(true);
    expect(canAddEntry(identity, 1)).toBe(false);
    expect(canAddEntry(experience, 39)).toBe(true);
  });
});
