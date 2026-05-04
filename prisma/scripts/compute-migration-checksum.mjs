#!/usr/bin/env node
/**
 * Recalcule le checksum Prisma (SHA-256 hex du fichier migration.sql)
 * pour une ou plusieurs migrations. Usage :
 *   node prisma/scripts/compute-migration-checksum.mjs
 *   node prisma/scripts/compute-migration-checksum.mjs prisma/migrations/20251124130000_add_loan_fields/migration.sql
 */
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');

const defaultPaths = [
  'prisma/migrations/20251124130000_add_loan_fields/migration.sql',
  'prisma/migrations/20260425114000_add_lmnp_activity_scope/migration.sql',
];

const inputs = process.argv.slice(2).length ? process.argv.slice(2) : defaultPaths;

for (const rel of inputs) {
  const p = path.isAbsolute(rel) ? rel : path.join(root, rel);
  const buf = fs.readFileSync(p);
  const digest = crypto.createHash('sha256').update(buf).digest('hex');
  const name = path.basename(path.dirname(p));
  console.log(`${name}`);
  console.log(`  file: ${rel}`);
  console.log(`  checksum: ${digest}`);
  console.log(`  SQL: UPDATE "_prisma_migrations" SET checksum = '${digest}' WHERE migration_name = '${name}';`);
  console.log('');
}
