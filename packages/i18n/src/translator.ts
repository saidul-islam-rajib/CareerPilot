export type Catalog = { readonly [key: string]: string | Catalog };

export type TranslationParams = Readonly<Record<string, string | number>>;

export type Translate = (key: string, params?: TranslationParams) => string;

const PLACEHOLDER = /\{(\w+)\}/g;

function lookup(catalog: Catalog, key: string): string | undefined {
  let node: string | Catalog | undefined = catalog;
  for (const part of key.split('.')) {
    if (node === undefined || typeof node === 'string') {
      return undefined;
    }
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

export function interpolate(template: string, params: TranslationParams = {}): string {
  return template.replace(PLACEHOLDER, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

export function createTranslator(primary: Catalog, fallback?: Catalog): Translate {
  return (key, params) => {
    const template = lookup(primary, key) ?? (fallback ? lookup(fallback, key) : undefined);
    return template === undefined ? key : interpolate(template, params);
  };
}

export function hasKey(catalog: Catalog, key: string): boolean {
  return lookup(catalog, key) !== undefined;
}

export function flattenKeys(catalog: Catalog, prefix = ''): string[] {
  return Object.entries(catalog).flatMap(([name, value]) => {
    const key = prefix ? `${prefix}.${name}` : name;
    return typeof value === 'string' ? [key] : flattenKeys(value, key);
  });
}
