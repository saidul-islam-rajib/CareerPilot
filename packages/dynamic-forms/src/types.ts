import type { EnumKey, ProfileFieldType } from '@careerpilot/domain-ui-logic';

export type EntryValue = string | number | boolean | null;
export type EntryValues = Record<string, EntryValue | undefined>;

export interface FieldDefinition {
  key: string;
  type: ProfileFieldType;
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  options?: EnumKey;
}

export interface SectionDefinition {
  key: string;
  icon: string;
  titleField: string;
  subtitleFields?: string[];
  startField?: string;
  endField?: string;
  ongoingField?: string;
  bodyField?: string;
  linkField?: string;
  countries?: string[];
  maxEntries?: number;
  fields: FieldDefinition[];
}

export interface FormLimits {
  phonePattern: string;
  minYear: number;
  futureYears: number;
}

export const FieldMessage = {
  Required: 'validation.required',
  TooLong: 'validation.tooLong',
  Url: 'validation.url',
  Email: 'validation.email',
  Phone: 'validation.phone',
  Month: 'validation.month',
  Date: 'validation.date',
  Year: 'validation.year',
  Number: 'validation.number',
  Option: 'validation.option',
  EndBeforeStart: 'validation.endBeforeStart',
} as const;
export type FieldMessage = (typeof FieldMessage)[keyof typeof FieldMessage];

export interface FieldError {
  message: FieldMessage;
  params?: Record<string, number>;
}

export type EntryErrors = Record<string, FieldError>;

export type EntryResult = { ok: true; values: Record<string, EntryValue> } | { ok: false; errors: EntryErrors };

export interface ValidationContext {
  limits: FormLimits;
  now: Date;
  optionsOf: (enumKey: EnumKey) => readonly string[];
}
