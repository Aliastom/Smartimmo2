import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDocuments() {
  console.log('📊 Vérification des documents en base...\n');
  
  try {
    const docs = await prisma.document.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        filenameOriginal: true,
        sha256: true,
        extractedText: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`📊 ${docs.length} documents trouvés en base:`);
    
    docs.forEach((doc, index) => {
      console.log(`\n${index + 1}. ${doc.filenameOriginal}`);
      console.log(`   - ID: ${doc.id}`);
      console.log(`   - SHA256: ${doc.sha256?.slice(0, 16)}...`);
      console.log(`   - Texte extrait: ${doc.extractedText?.length || 0} caractères`);
      console.log(`   - Créé le: ${doc.createdAt.toLocaleString('fr-FR')}`);
      if (doc.extractedText) {
        console.log(`   - Aperçu: ${doc.extractedText.slice(0, 100)}...`);
      }
    });
    
  } catch (error) {
    console.error('💥 Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDocuments();
