import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const documentTypes = [
  { code: 'RENT_RECEIPT', label: 'Quittance de loyer', icon: 'Receipt', isSystem: true },
  { code: 'SIGNED_LEASE', label: 'Bail signé', icon: 'FileText', isSystem: true },
  { code: 'LEASE_DRAFT', label: 'Brouillon de bail', icon: 'Edit', isSystem: true },
  { code: 'EDL_IN', label: "État des lieux d'entrée", icon: 'Home', isSystem: true },
  { code: 'EDL_OUT', label: 'État des lieux de sortie', icon: 'LogOut', isSystem: true },
  { code: 'RIB', label: 'Relevé d\'identité bancaire', icon: 'CreditCard', isSystem: true },
  { code: 'INSURANCE', label: 'Assurance', icon: 'Shield', isSystem: true },
  { code: 'TAX', label: 'Impôts', icon: 'FileText', isSystem: true },
  { code: 'MISC', label: 'Divers', icon: 'File', isSystem: true },
  { code: 'PHOTO', label: 'Photo', icon: 'Camera', isSystem: true },
];

async function seedDocumentTypes() {
  console.log('🌱 Seeding document types...');
  
  for (const docType of documentTypes) {
    try {
      await prisma.documentType.upsert({
        where: { code: docType.code },
        update: {
          label: docType.label,
          icon: docType.icon,
          isSystem: docType.isSystem,
        },
        create: docType,
      });
      console.log(`✅ Document type "${docType.label}" seeded`);
    } catch (error) {
      console.error(`❌ Error seeding document type "${docType.label}":`, error);
    }
  }
  
  console.log('🎉 Document types seeding completed!');
}

seedDocumentTypes()
  .catch((e) => {
    console.error('Error seeding document types:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
