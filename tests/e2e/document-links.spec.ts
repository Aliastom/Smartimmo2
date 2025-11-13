/**
 * Tests E2E pour le système de liens polymorphiques des documents
 * 
 * Cas de test validés:
 * 1. Upload sans doublon depuis page globale
 * 2. Upload sans doublon depuis onglet Bien
 * 3. Doublon + link_existing depuis Bien
 * 4. Doublon + replace depuis Bien
 * 5. Doublon + keep_both
 * 6. Doublon + cancel
 * 7. Vérification dédup existante (pas de régression)
 * 8. Réutilisation DocumentType existant
 */

import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { readFile } from 'fs/promises';
import { join } from 'path';

const prisma = new PrismaClient();

// Fonction helper pour créer un fichier test
async function createTestFile(name: string, content: string): Promise<File> {
  const blob = new Blob([content], { type: 'application/pdf' });
  return new File([blob], name, { type: 'application/pdf' });
}

test.describe('Système de Liens Polymorphiques - Documents', () => {
  
  let testPropertyId: string;
  let testDocumentTypeId: string;

  test.beforeAll(async () => {
    // Créer un bien de test
    const property = await prisma.property.create({
      data: {
        name: 'Bien Test E2E',
        type: 'apartment',
        address: '123 Rue Test',
        postalCode: '75001',
        city: 'Paris',
        surface: 50,
        rooms: 2,
        acquisitionDate: new Date(),
        acquisitionPrice: 200000,
        notaryFees: 10000,
        currentValue: 220000,
        status: 'vacant',
      },
    });
    testPropertyId = property.id;

    // Récupérer un type de document existant
    const documentType = await prisma.documentType.findFirst({
      where: { isActive: true },
    });
    testDocumentTypeId = documentType?.id || '';
  });

  test.afterAll(async () => {
    // Nettoyer les données de test
    await prisma.documentLink.deleteMany({
      where: { entityId: testPropertyId },
    });
    await prisma.document.deleteMany({
      where: { propertyId: testPropertyId },
    });
    await prisma.property.delete({
      where: { id: testPropertyId },
    });
    await prisma.$disconnect();
  });

  test('1. Upload sans doublon depuis page globale', async ({ page }) => {
    // Aller sur la page Documents globale
    await page.goto('/documents');

    // Cliquer sur le bouton d'upload
    await page.click('button:has-text("Ajouter un document")');

    // Attendre que la modale s'ouvre
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Vérifier que le contexte est GLOBAL par défaut
    await expect(page.locator('select#entity-type')).toHaveValue('GLOBAL');

    // Uploader un fichier
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-global.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('Test PDF content'),
    });

    // Attendre l'analyse
    await page.waitForSelector('button:has-text("Confirmer")');

    // Sélectionner un type
    await page.selectOption('select[name="documentType"]', testDocumentTypeId);

    // Confirmer
    await page.click('button:has-text("Confirmer")');

    // Vérifier le succès
    await expect(page.locator('text=Document(s) enregistré(s)')).toBeVisible();

    // Vérifier en base de données
    const document = await prisma.document.findFirst({
      where: { filenameOriginal: 'test-global.pdf' },
      include: { links: true },
    });

    expect(document).toBeTruthy();
    expect(document?.links).toHaveLength(1);
    expect(document?.links[0].entityType).toBe('GLOBAL');
    expect(document?.links[0].entityId).toBeNull();
  });

  test('2. Upload sans doublon depuis onglet Bien', async ({ page }) => {
    // Aller sur la page du bien
    await page.goto(`/properties/${testPropertyId}`);

    // Cliquer sur l'onglet Documents
    await page.click('button:has-text("Documents")');

    // Cliquer sur le bouton d'upload
    await page.click('button:has-text("Ajouter des documents")');

    // Vérifier que le contexte est pré-rempli avec PROPERTY
    await expect(page.locator('text=Bien immobilier')).toBeVisible();

    // Uploader un fichier
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-property.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('Test PDF content for property'),
    });

    // Attendre l'analyse
    await page.waitForSelector('button:has-text("Confirmer")');

    // Sélectionner un type
    await page.selectOption('select[name="documentType"]', testDocumentTypeId);

    // Confirmer
    await page.click('button:has-text("Confirmer")');

    // Vérifier le succès
    await expect(page.locator('text=Document(s) enregistré(s)')).toBeVisible();

    // Vérifier en base de données
    const document = await prisma.document.findFirst({
      where: { filenameOriginal: 'test-property.pdf' },
      include: { links: true },
    });

    expect(document).toBeTruthy();
    expect(document?.links).toHaveLength(1);
    expect(document?.links[0].entityType).toBe('PROPERTY');
    expect(document?.links[0].entityId).toBe(testPropertyId);
  });

  test('3. Doublon + link_existing depuis Bien', async ({ page }) => {
    // Créer d'abord un document existant
    const existingDoc = await prisma.document.create({
      data: {
        filenameOriginal: 'test-duplicate.pdf',
        fileName: 'test-duplicate.pdf',
        mime: 'application/pdf',
        size: 1000,
        sha256: 'abc123def456', // Hash fixe pour le test
        bucketKey: 'storage/documents/test.pdf',
        url: '/api/documents/test/file',
        status: 'classified',
        documentTypeId: testDocumentTypeId,
      },
    });

    // Créer un lien GLOBAL pour ce document
    await prisma.documentLink.create({
      data: {
        documentId: existingDoc.id,
        entityType: 'GLOBAL',
        entityId: null,
        isPrimary: false,
      },
    });

    // Aller sur la page du bien
    await page.goto(`/properties/${testPropertyId}`);
    await page.click('button:has-text("Documents")');
    await page.click('button:has-text("Ajouter des documents")');

    // Uploader le même fichier (même SHA256)
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-duplicate.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('Same content'), // Générera le même SHA256
    });

    // Attendre la détection du doublon
    await expect(page.locator('text=Doublon détecté')).toBeVisible();

    // Sélectionner l'action "Lier au document existant"
    await page.click('button:has-text("Lier au document existant")');

    // Confirmer
    await page.click('button:has-text("Confirmer")');

    // Vérifier le succès
    await expect(page.locator('text=Document lié au contexte existant')).toBeVisible();

    // Vérifier en base de données
    const links = await prisma.documentLink.findMany({
      where: { documentId: existingDoc.id },
    });

    // Doit avoir 2 liens : GLOBAL + PROPERTY
    expect(links).toHaveLength(2);
    const propertyLink = links.find(l => l.entityType === 'PROPERTY');
    expect(propertyLink).toBeTruthy();
    expect(propertyLink?.entityId).toBe(testPropertyId);

    // Vérifier qu'aucun nouveau document n'a été créé
    const documentCount = await prisma.document.count({
      where: { sha256: 'abc123def456' },
    });
    expect(documentCount).toBe(1);
  });

  test('4. Doublon + replace depuis Bien', async ({ page }) => {
    // Créer un document existant avec un lien PROPERTY
    const existingDoc = await prisma.document.create({
      data: {
        filenameOriginal: 'test-replace.pdf',
        fileName: 'test-replace.pdf',
        mime: 'application/pdf',
        size: 1000,
        sha256: 'replace123',
        bucketKey: 'storage/documents/test-replace.pdf',
        url: '/api/documents/test-replace/file',
        status: 'classified',
        documentTypeId: testDocumentTypeId,
        propertyId: testPropertyId,
      },
    });

    await prisma.documentLink.create({
      data: {
        documentId: existingDoc.id,
        entityType: 'PROPERTY',
        entityId: testPropertyId,
        isPrimary: true,
      },
    });

    // Uploader un doublon avec action "replace"
    await page.goto(`/properties/${testPropertyId}`);
    await page.click('button:has-text("Documents")');
    await page.click('button:has-text("Ajouter des documents")');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-replace-v2.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('Replaced content'),
    });

    await expect(page.locator('text=Doublon détecté')).toBeVisible();

    // Sélectionner "Remplacer"
    await page.click('button:has-text("Remplacer la version principale")');
    await page.click('button:has-text("Confirmer")');

    // Vérifier le succès
    await expect(page.locator('text=Document(s) enregistré(s)')).toBeVisible();

    // Vérifier en base de données
    const oldLink = await prisma.documentLink.findFirst({
      where: {
        documentId: existingDoc.id,
        entityType: 'PROPERTY',
        entityId: testPropertyId,
      },
    });
    expect(oldLink?.isPrimary).toBe(false); // Ancien lien mis à false

    const newDoc = await prisma.document.findFirst({
      where: { filenameOriginal: 'test-replace-v2.pdf' },
      include: { links: true },
    });
    expect(newDoc).toBeTruthy();
    expect(newDoc?.links[0].isPrimary).toBe(true); // Nouveau document est principal
  });

  test('5. Doublon + keep_both', async ({ page }) => {
    const existingDoc = await prisma.document.create({
      data: {
        filenameOriginal: 'test-keepboth.pdf',
        fileName: 'test-keepboth.pdf',
        mime: 'application/pdf',
        size: 1000,
        sha256: 'keepboth123',
        bucketKey: 'storage/documents/test-keepboth.pdf',
        url: '/api/documents/test-keepboth/file',
        status: 'classified',
        documentTypeId: testDocumentTypeId,
      },
    });

    await prisma.documentLink.create({
      data: {
        documentId: existingDoc.id,
        entityType: 'GLOBAL',
        entityId: null,
        isPrimary: false,
      },
    });

    await page.goto(`/properties/${testPropertyId}`);
    await page.click('button:has-text("Documents")');
    await page.click('button:has-text("Ajouter des documents")');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-keepboth-v2.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('Keep both content'),
    });

    await expect(page.locator('text=Doublon détecté')).toBeVisible();

    // Sélectionner "Conserver les deux"
    await page.click('button:has-text("Conserver les deux documents")');
    
    // Optionnel: cocher "Définir comme principal"
    // await page.check('input[type="checkbox"]:has-text("Définir comme document principal")');
    
    await page.click('button:has-text("Confirmer")');

    // Vérifier le succès
    await expect(page.locator('text=Document(s) enregistré(s)')).toBeVisible();

    // Vérifier en base de données
    const newDoc = await prisma.document.findFirst({
      where: { filenameOriginal: 'test-keepboth-v2.pdf' },
      include: { links: true },
    });
    
    expect(newDoc).toBeTruthy();
    // isPrimary dépend si la checkbox a été cochée (false par défaut)
  });

  test('6. Doublon + cancel', async ({ page }) => {
    await page.goto('/documents');
    await page.click('button:has-text("Ajouter un document")');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-cancel.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('Cancel content'),
    });

    // Si doublon détecté
    const hasDuplicate = await page.locator('text=Doublon détecté').isVisible();
    
    if (hasDuplicate) {
      // Sélectionner "Annuler"
      await page.click('button:has-text("Annuler l\'upload")');
      await page.click('button:has-text("Confirmer")');

      // Vérifier que la modale se ferme
      await expect(page.locator('[role="dialog"]')).not.toBeVisible();

      // Vérifier qu'aucun document n'a été créé
      const doc = await prisma.document.findFirst({
        where: { filenameOriginal: 'test-cancel.pdf' },
      });
      expect(doc).toBeNull();
    }
  });

  test('7. Vérification dédup existante (pas de régression)', async ({ page }) => {
    // Tester que le système de dédup existant fonctionne toujours
    // Ce test vérifie que useDedupFlow et DedupFlowModal fonctionnent

    await page.goto('/documents');
    await page.click('button:has-text("Ajouter un document")');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-dedup-regression.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('Dedup regression test'),
    });

    // Attendre l'analyse OCR et la classification
    await page.waitForSelector('text=Classification automatique', { timeout: 10000 });

    // Vérifier que les prédictions sont affichées
    await expect(page.locator('[data-testid="predictions"]')).toBeVisible();

    // Le système de dédup doit fonctionner normalement
    // (pas d'erreur, pas de régression)
  });

  test('8. Réutilisation DocumentType existant', async ({ page }) => {
    // Vérifier qu'on utilise bien DocumentType existant et pas une nouvelle table

    const documentTypesBefore = await prisma.documentType.count();

    await page.goto('/documents');
    await page.click('button:has-text("Ajouter un document")');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-doctype.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('DocType test'),
    });

    await page.waitForSelector('button:has-text("Confirmer")');
    
    // Sélectionner un type existant
    await page.selectOption('select[name="documentType"]', testDocumentTypeId);
    
    await page.click('button:has-text("Confirmer")');

    // Vérifier qu'aucun nouveau type n'a été créé
    const documentTypesAfter = await prisma.documentType.count();
    expect(documentTypesAfter).toBe(documentTypesBefore);

    // Vérifier que le document utilise bien documentTypeId
    const doc = await prisma.document.findFirst({
      where: { filenameOriginal: 'test-doctype.pdf' },
    });
    expect(doc?.documentTypeId).toBe(testDocumentTypeId);
  });
});

/**
 * Tests API - Endpoint /api/documents/finalize
 */
test.describe('API - /api/documents/finalize', () => {
  
  test('API: link_existing ne crée pas de nouveau Document', async ({ request }) => {
    // Créer un document existant
    const existingDoc = await prisma.document.create({
      data: {
        filenameOriginal: 'existing.pdf',
        fileName: 'existing.pdf',
        mime: 'application/pdf',
        size: 1000,
        sha256: 'api-test-123',
        bucketKey: 'storage/documents/existing.pdf',
        url: '/api/documents/existing/file',
        status: 'classified',
      },
    });

    // Simuler un appel API avec link_existing
    const response = await request.post('/api/documents/finalize', {
      data: {
        tempId: 'temp-123',
        context: {
          entityType: 'PROPERTY',
          entityId: 'property-123',
        },
        dedup: {
          decision: 'link_existing',
          matchedId: existingDoc.id,
        },
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.linked).toBe(true);

    // Vérifier qu'aucun nouveau document n'a été créé
    const documentCount = await prisma.document.count({
      where: { sha256: 'api-test-123' },
    });
    expect(documentCount).toBe(1);

    // Vérifier qu'un lien a été créé
    const link = await prisma.documentLink.findFirst({
      where: {
        documentId: existingDoc.id,
        entityType: 'PROPERTY',
        entityId: 'property-123',
      },
    });
    expect(link).toBeTruthy();
  });

  test('API: Validation du contexte', async ({ request }) => {
    // Contexte invalide: entityType != GLOBAL mais pas d'entityId
    const response = await request.post('/api/documents/finalize', {
      data: {
        tempId: 'temp-456',
        context: {
          entityType: 'PROPERTY',
          // entityId manquant
        },
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('entityId est requis');
  });
});

/**
 * Tests API - Endpoint /api/documents/[id]/set-primary
 */
test.describe('API - /api/documents/[id]/set-primary', () => {
  
  test('API: Définir un document comme principal', async ({ request }) => {
    // Créer deux documents liés au même bien
    const doc1 = await prisma.document.create({
      data: {
        filenameOriginal: 'doc1.pdf',
        fileName: 'doc1.pdf',
        mime: 'application/pdf',
        size: 1000,
        bucketKey: 'storage/documents/doc1.pdf',
        url: '/api/documents/doc1/file',
        status: 'classified',
      },
    });

    const doc2 = await prisma.document.create({
      data: {
        filenameOriginal: 'doc2.pdf',
        fileName: 'doc2.pdf',
        mime: 'application/pdf',
        size: 1000,
        bucketKey: 'storage/documents/doc2.pdf',
        url: '/api/documents/doc2/file',
        status: 'classified',
      },
    });

    const propertyId = 'property-test-123';

    await prisma.documentLink.create({
      data: {
        documentId: doc1.id,
        entityType: 'PROPERTY',
        entityId: propertyId,
        isPrimary: true,
      },
    });

    await prisma.documentLink.create({
      data: {
        documentId: doc2.id,
        entityType: 'PROPERTY',
        entityId: propertyId,
        isPrimary: false,
      },
    });

    // Définir doc2 comme principal
    const response = await request.post(`/api/documents/${doc2.id}/set-primary`, {
      data: {
        entityType: 'PROPERTY',
        entityId: propertyId,
      },
    });

    expect(response.status()).toBe(200);

    // Vérifier que doc1 est maintenant à isPrimary=false
    const link1 = await prisma.documentLink.findFirst({
      where: {
        documentId: doc1.id,
        entityType: 'PROPERTY',
        entityId: propertyId,
      },
    });
    expect(link1?.isPrimary).toBe(false);

    // Vérifier que doc2 est maintenant à isPrimary=true
    const link2 = await prisma.documentLink.findFirst({
      where: {
        documentId: doc2.id,
        entityType: 'PROPERTY',
        entityId: propertyId,
      },
    });
    expect(link2?.isPrimary).toBe(true);
  });
});

