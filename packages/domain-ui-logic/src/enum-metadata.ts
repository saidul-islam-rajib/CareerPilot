import type { EnumKey, StatusTone } from './enums';

export interface EnumValueMetadata {
  enumKey: EnumKey;
  value: string;
  labelKey: string;
  tone: StatusTone;
  sortOrder: number;
  isTerminal: boolean;
  isActive: boolean;
}

export interface EnumMetadataIndex {
  get(enumKey: EnumKey, value: string): EnumValueMetadata | undefined;
  list(enumKey: EnumKey): EnumValueMetadata[];
}

export function createEnumMetadataIndex(rows: readonly EnumValueMetadata[]): EnumMetadataIndex {
  const byKey = new Map<string, EnumValueMetadata>();
  const byEnum = new Map<EnumKey, EnumValueMetadata[]>();
  for (const row of rows) {
    byKey.set(`${row.enumKey}:${row.value}`, row);
    const list = byEnum.get(row.enumKey) ?? [];
    list.push(row);
    byEnum.set(row.enumKey, list);
  }
  for (const list of byEnum.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return {
    get: (enumKey, value) => byKey.get(`${enumKey}:${value}`),
    list: (enumKey) => (byEnum.get(enumKey) ?? []).filter((row) => row.isActive),
  };
}
