import { ProfileFieldType, type EnumKey } from '@careerpilot/domain-ui-logic';
import type { EntryValue, SectionDefinition } from './types';

export interface EntryPeriod {
  start?: EntryValue;
  end?: EntryValue;
  ongoing: boolean;
}

export interface EntryDisplay {
  title: string;
  subtitle: string[];
  period?: EntryPeriod;
  body?: string;
  link?: string;
}

export type OptionLabel = (enumKey: EnumKey, value: string) => string;

export type InputKind = 'text' | 'email' | 'tel' | 'url' | 'month' | 'number' | 'date';

function present(value: EntryValue | undefined): value is string | number | boolean {
  return value !== undefined && value !== null && value !== '';
}

function text(section: SectionDefinition, key: string, values: Record<string, EntryValue>, optionLabel: OptionLabel): string | undefined {
  const value = values[key];
  if (!present(value)) {
    return undefined;
  }
  const field = section.fields.find((f) => f.key === key);
  return field?.type === ProfileFieldType.Select && field.options ? optionLabel(field.options, String(value)) : String(value);
}

export function describeEntry(section: SectionDefinition, values: Record<string, EntryValue>, optionLabel: OptionLabel): EntryDisplay {
  const start = section.startField ? values[section.startField] : undefined;
  const end = section.endField ? values[section.endField] : undefined;
  const ongoing = section.ongoingField ? values[section.ongoingField] === true : false;
  const hasPeriod = present(start) || present(end) || ongoing;
  return {
    title: text(section, section.titleField, values, optionLabel) ?? '',
    subtitle: (section.subtitleFields ?? []).flatMap((key) => text(section, key, values, optionLabel) ?? []),
    period: hasPeriod ? { start: present(start) ? start : undefined, end: present(end) ? end : undefined, ongoing } : undefined,
    body: section.bodyField ? text(section, section.bodyField, values, optionLabel) : undefined,
    link: section.linkField ? text(section, section.linkField, values, optionLabel) : undefined,
  };
}

const INPUT_KINDS: Partial<Record<ProfileFieldType, InputKind>> = {
  [ProfileFieldType.Email]: 'email',
  [ProfileFieldType.Phone]: 'tel',
  [ProfileFieldType.Url]: 'url',
  [ProfileFieldType.Month]: 'month',
  [ProfileFieldType.Date]: 'date',
  [ProfileFieldType.Year]: 'number',
  [ProfileFieldType.Number]: 'number',
};

export function fieldInputKind(type: ProfileFieldType): InputKind {
  return INPUT_KINDS[type] ?? 'text';
}

export function sectionVisible(section: SectionDefinition, homeCountry: string, entryCount: number): boolean {
  return entryCount > 0 || !section.countries?.length || section.countries.includes(homeCountry);
}

export function canAddEntry(section: SectionDefinition, entryCount: number): boolean {
  return section.maxEntries === undefined || entryCount < section.maxEntries;
}
