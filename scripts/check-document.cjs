const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const docId = process.argv[2] || 'cmhntrg2m0004n8w01gqakptn';
  
  const doc = await prisma.document.findFirst({
    where: { id: docId },
    select: {
      id: true,
      fileName: true,
      documentTypeId: true,
      extractedText: true,
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
    console.log(`❌ Document ${docId} non trouvé`);
    return;
  }
  
  console.log('✅ Document trouvé:', doc.fileName);
  console.log('Type:', doc.DocumentType?.code || 'NULL');
  console.log('Texte OCR:', doc.extractedText ? `${doc.extractedText.length} caractères` : 'NULL');
  console.log('Has suggestionsConfig:', !!doc.DocumentType?.suggestionsConfig);
  
  if (doc.extractedText) {
    console.log('\nAperçu texte (100 premiers caractères):');
    console.log(doc.extractedText.substring(0, 100));
  }
}

main().finally(() => prisma.$disconnect());

