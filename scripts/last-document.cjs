const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const doc = await prisma.document.findFirst({
    orderBy: { uploadedAt: 'desc' },
    select: {
      id: true,
      fileName: true,
      documentTypeId: true,
      extractedText: true,
      uploadedAt: true,
      DocumentType: {
        select: {
          code: true,
          label: true,
          suggestionsConfig: true
        }
      }
    }
  });
  
  if (!doc) {
    console.log('❌ Aucun document trouvé');
    return;
  }
  
  console.log('🔍 Dernier document uploadé:\n');
  console.log('ID:', doc.id);
  console.log('Fichier:', doc.fileName);
  console.log('Date:', doc.uploadedAt);
  console.log('Type:', doc.DocumentType?.code || 'NULL');
  console.log('Texte OCR:', doc.extractedText ? `${doc.extractedText.length} caractères` : '❌ NULL');
  console.log('Has suggestionsConfig:', !!doc.DocumentType?.suggestionsConfig ? '✅' : '❌');
  
  if (doc.extractedText && doc.extractedText.length > 0) {
    console.log('\n📄 Aperçu texte (200 premiers caractères):');
    console.log(doc.extractedText.substring(0, 200));
  }
}

main().finally(() => prisma.$disconnect());

