import { ProfileFieldType } from '@careerpilot/domain-ui-logic';
import {
  FieldMessage,
  type EntryErrors,
  type EntryResult,
  type EntryValue,
  type EntryValues,
  type FieldDefinition,
  type FieldError,
  type SectionDefinition,
  type ValidationContext,
} from './types';

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DIGITS = /^\d+$/;
const WHITESPACE = /\s+/g;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const URL_SCHEMES = new Set(['http:', 'https:']);
const LINE_BREAK = /\r?\n/;

type Parsed = { value: EntryValue } | { error: FieldError };
type Parser = (raw: EntryValue, field: FieldDefinition, context: ValidationContext) => Parsed;

export function cleanText(value: string): string {
  return value.replace(WHITESPACE, ' ').trim();
}

export function cleanMultiline(value: string): string {
  return value
    .trim()
    .split(LINE_BREAK)
    .map((line) => line.trimEnd())
    .join('\n');
}

function fail(message: FieldError['message'], params?: FieldError['params']): Parsed {
  return { error: params ? { message, params } : { message } };
}

function withinLength(value: string, field: FieldDefinition): Parsed {
  return field.maxLength !== undefined && value.length > field.maxLength ? fail(FieldMessage.TooLong, { max: field.maxLength }) : { value };
}

function maxYear(context: ValidationContext): number {
  return context.now.getFullYear() + context.limits.futureYears;
}

function isCalendarDay(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return URL_SCHEMES.has(url.protocol) && url.host.length > 0;
  } catch {
    return false;
  }
}

const parsers: Record<ProfileFieldType, Parser> = {
  [ProfileFieldType.Text]: (raw, field) => withinLength(cleanText(String(raw)), field),
  [ProfileFieldType.Textarea]: (raw, field) => withinLength(cleanMultiline(String(raw)), field),
  [ProfileFieldType.Url]: (raw, field) => {
    const value = String(raw).trim();
    return isUrl(value) ? withinLength(value, field) : fail(FieldMessage.Url);
  },
  [ProfileFieldType.Email]: (raw, field) => {
    const value = String(raw).trim().toLowerCase();
    return EMAIL.test(value) ? withinLength(value, field) : fail(FieldMessage.Email);
  },
  [ProfileFieldType.Phone]: (raw, field, context) => {
    const value = cleanText(String(raw));
    return new RegExp(context.limits.phonePattern).test(value) ? withinLength(value, field) : fail(FieldMessage.Phone);
  },
  [ProfileFieldType.Month]: (raw, _field, context) => {
    const value = String(raw).trim();
    const match = MONTH.exec(value);
    const year = match ? Number(match[1]) : Number.NaN;
    return year >= context.limits.minYear && year <= maxYear(context) ? { value } : fail(FieldMessage.Month);
  },
  [ProfileFieldType.Date]: (raw, _field, context) => {
    const value = String(raw).trim();
    const match = DAY.exec(value);
    const [year, month, day] = match ? [Number(match[1]), Number(match[2]), Number(match[3])] : [Number.NaN, 0, 0];
    const valid = isCalendarDay(year, month, day) && year >= context.limits.minYear && year <= maxYear(context);
    return valid ? { value } : fail(FieldMessage.Date);
  },
  [ProfileFieldType.Year]: (raw, _field, context) => {
    const text = String(raw).trim();
    const year = typeof raw === 'number' ? raw : DIGITS.test(text) ? Number(text) : Number.NaN;
    const max = maxYear(context);
    return Number.isInteger(year) && year >= context.limits.minYear && year <= max
      ? { value: year }
      : fail(FieldMessage.Year, { min: context.limits.minYear, max });
  },
  [ProfileFieldType.Number]: (raw, field) => {
    const number = typeof raw === 'number' ? raw : Number(String(raw).trim());
    const inRange = Number.isFinite(number) && (field.min === undefined || number >= field.min) && (field.max === undefined || number <= field.max);
    return inRange ? { value: number } : fail(FieldMessage.Number);
  },
  [ProfileFieldType.Select]: (raw, field, context) => {
    const value = String(raw);
    return field.options && context.optionsOf(field.options).includes(value) ? { value } : fail(FieldMessage.Option);
  },
  [ProfileFieldType.Boolean]: (raw) => (typeof raw === 'boolean' ? { value: raw } : fail(FieldMessage.Required)),
};

function isEmpty(value: EntryValue | undefined): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '') || value === false;
}

function parseField(field: FieldDefinition, raw: EntryValue | undefined, context: ValidationContext): Parsed {
  if (field.type === ProfileFieldType.Boolean) {
    return raw === true ? { value: true } : { value: null };
  }
  if (isEmpty(raw)) {
    return field.required ? fail(FieldMessage.Required) : { value: null };
  }
  return parsers[field.type](raw as EntryValue, field, context);
}

function checkPeriod(section: SectionDefinition, values: Record<string, EntryValue>, errors: EntryErrors): void {
  if (section.ongoingField && values[section.ongoingField] === true && section.endField) {
    values[section.endField] = null;
  }
  const start = section.startField ? values[section.startField] : null;
  const end = section.endField ? values[section.endField] : null;
  if (section.endField && start !== null && start !== undefined && end !== null && end !== undefined && String(end) < String(start)) {
    errors[section.endField] = { message: FieldMessage.EndBeforeStart };
  }
}

export function validateEntry(section: SectionDefinition, input: EntryValues, context: ValidationContext): EntryResult {
  const values: Record<string, EntryValue> = {};
  const errors: EntryErrors = {};
  for (const field of section.fields) {
    const parsed = parseField(field, input[field.key], context);
    if ('error' in parsed) {
      errors[field.key] = parsed.error;
    } else {
      values[field.key] = parsed.value;
    }
  }
  if (Object.keys(errors).length === 0) {
    checkPeriod(section, values, errors);
  }
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, values: Object.fromEntries(Object.entries(values).filter(([, value]) => value !== null)) };
}

export function emptyValues(section: SectionDefinition): EntryValues {
  return Object.fromEntries(section.fields.map((field) => [field.key, field.type === ProfileFieldType.Boolean ? false : '']));
}

export function formValues(section: SectionDefinition, values: Record<string, EntryValue>): EntryValues {
  return { ...emptyValues(section), ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value ?? ''])) };
}

export function normalizeSkills(skills: readonly string[], maxLength: number): { skills: string[]; tooLong: string[] } {
  const seen = new Set<string>();
  const result: string[] = [];
  const tooLong: string[] = [];
  for (const raw of skills) {
    const skill = cleanText(raw);
    const key = skill.toLocaleLowerCase();
    if (!skill || seen.has(key)) {
      continue;
    }
    if (skill.length > maxLength) {
      tooLong.push(skill);
      continue;
    }
    seen.add(key);
    result.push(skill);
  }
  return { skills: result, tooLong };
}
