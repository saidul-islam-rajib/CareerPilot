import fs from 'node:fs';
import path from 'node:path';
import * as icons from './icons';

const SOURCE_ROOT = path.resolve(__dirname, '..');
const ICONS_MODULE = path.join(SOURCE_ROOT, 'ui', 'icons.ts');
const SOURCE_FILE = /\.(ts|tsx)$/;
const WHOLE_PACKAGE_IMPORT = /from\s+'lucide-react-native'/;

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(full);
    }
    return SOURCE_FILE.test(entry.name) ? [full] : [];
  });
}

describe('icons', () => {
  it('loads each icon on its own so the bundle carries only the icons in use', () => {
    const offenders = sourceFiles(SOURCE_ROOT).filter((file) => file !== ICONS_MODULE && WHOLE_PACKAGE_IMPORT.test(fs.readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('exports renderable icon components', () => {
    expect(Object.keys(icons).length).toBeGreaterThan(0);
    for (const icon of Object.values(icons)) {
      expect(['function', 'object']).toContain(typeof icon);
    }
  });
});
