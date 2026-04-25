/**
 * Garde-fous légers : le périmètre LMNP ne doit pas appeler prisma.transaction.update.
 * Complément manuel : imports Airbnb, dashboards, cashflow (hors scope LMNP).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { globSync } from 'glob';

function read(rel: string) {
  return readFileSync(resolve(process.cwd(), rel), 'utf8');
}

describe('Garde-fous LMNP (fichiers sources)', () => {
  it('LmnpExportBuilder ne contient pas transaction.update', () => {
    const src = read('src/services/lmnp/LmnpExportBuilder.ts');
    expect(src).not.toMatch(/transaction\.update\s*\(/i);
    expect(src).not.toMatch(/prisma\.transaction\.update/i);
  });

  it('routes /api/lmnp ne contiennent pas transaction.update', () => {
    const files = globSync('src/app/api/lmnp/**/*.ts', { cwd: process.cwd() });
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const src = read(f);
      expect(src).not.toMatch(/prisma\.transaction\.update/i);
    }
  });

  it('LmnpExportClassifier ne touche pas Prisma', () => {
    const src = read('src/services/lmnp/LmnpExportClassifier.ts');
    expect(src).not.toContain('@/lib/prisma');
    expect(src).not.toContain('prisma.');
  });
});
