import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function backupNatureMapping() {
  console.log('💾 Creating backup of nature mapping data...');

  try {
    // Récupérer toutes les données
    const [natures, rules, defaults, categories] = await Promise.all([
      prisma.natureEntity.findMany(),
      prisma.natureRule.findMany(),
      prisma.natureDefault.findMany({
        include: {
          nature: true,
          defaultCategory: true,
        },
      }),
      prisma.category.findMany(),
    ]);

    const backup = {
      timestamp: new Date().toISOString(),
      natures,
      rules,
      defaults,
      categories,
    };

    // Créer le dossier backup s'il n'existe pas
    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Sauvegarder dans un fichier JSON
    const filename = `nature-mapping-backup-${new Date().toISOString().split('T')[0]}.json`;
    const filepath = path.join(backupDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));
    
    console.log(`✅ Backup created: ${filepath}`);
    console.log(`📊 Backup contains:`);
    console.log(`   - ${natures.length} nature entities`);
    console.log(`   - ${rules.length} nature rules`);
    console.log(`   - ${defaults.length} nature defaults`);
    console.log(`   - ${categories.length} categories`);
    
  } catch (error) {
    console.error('❌ Error creating backup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
backupNatureMapping()
  .then(() => {
    console.log('✅ Backup completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  });
