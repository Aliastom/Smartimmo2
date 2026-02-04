import 'fake-indexeddb/auto';
import { getLocalDB } from '@/lib/offline/db';

describe('Dexie + fake-indexeddb prototype fix', () => {
  it('should create DB without prototype error', async () => {
    // Ce test vérifie que getLocalDB() peut créer une DB sans erreur "Cannot read properties of undefined (reading 'prototype')"
    const db = await getLocalDB();
    expect(db).toBeDefined();
    expect(db.name).toBe('SmartimmoLocalDB');
  });
});
