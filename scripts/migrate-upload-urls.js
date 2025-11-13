const { PrismaClient } = require('@prisma/client');
const { readFileSync, existsSync } = require('fs');
const { join } = require('path');

const prisma = new PrismaClient();

async function migrateUploadUrls() {
  try {
    console.log('🔄 Migration des URLs d\'upload...');
    
    // Récupérer tous les documents
    const documents = await prisma.document.findMany({
      where: {
        url: {
          startsWith: '/uploads/'
        }
      }
    });

    console.log(`📄 Trouvé ${documents.length} documents à migrer`);

    let migrated = 0;
    let notFound = 0;

    for (const doc of documents) {
      const oldUrl = doc.url;
      
      // Chercher le fichier dans uploads/2025/10/
      const uploadDir = join(process.cwd(), 'uploads', '2025', '10');
      const publicDir = join(process.cwd(), 'public', 'uploads');
      
      let newUrl = null;
      let foundFile = null;

      // Chercher dans uploads/2025/10/ d'abord
      if (existsSync(uploadDir)) {
        const files = require('fs').readdirSync(uploadDir);
        foundFile = files.find(file => file.includes(doc.fileName.split('.')[0]));
        
        if (foundFile) {
          newUrl = `/uploads/2025/10/${foundFile}`;
        }
      }

      // Si pas trouvé, chercher dans public/uploads
      if (!foundFile && existsSync(publicDir)) {
        const files = require('fs').readdirSync(publicDir);
        foundFile = files.find(file => file.includes(doc.fileName.split('.')[0]));
        
        if (foundFile) {
          newUrl = `/uploads/${foundFile}`;
        }
      }

      if (newUrl && newUrl !== oldUrl) {
        await prisma.document.update({
          where: { id: doc.id },
          data: { url: newUrl }
        });
        
        console.log(`✅ Migré: ${doc.fileName} -> ${newUrl}`);
        migrated++;
      } else {
        console.log(`❌ Fichier non trouvé: ${doc.fileName}`);
        notFound++;
      }
    }

    console.log(`\n📊 Résultats:`);
    console.log(`✅ Migrés: ${migrated}`);
    console.log(`❌ Non trouvés: ${notFound}`);
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateUploadUrls();
