import { prisma } from '@/lib/prisma';

async function main() {
  try {
    console.log('=== NATURES ===\n');
    const natures = await prisma.natureEntity.findMany({
      orderBy: { code: 'asc' }
    });
    natures.forEach(n => {
      console.log(`- ${n.code}: ${n.label}`);
    });
    console.log(`\nTotal: ${natures.length} natures\n`);
    
    console.log('=== CATEGORIES ===\n');
    const categories = await prisma.category.findMany({
      orderBy: { slug: 'asc' }
    });
    categories.forEach(c => {
      console.log(`- ${c.slug}: ${c.label} (type: ${c.type})`);
    });
    console.log(`\nTotal: ${categories.length} catégories\n`);
    
    console.log('=== MAPPINGS (NatureDefault) ===\n');
    const mappings = await prisma.natureDefault.findMany({
      include: {
        defaultCategory: {
          select: {
            slug: true,
            label: true
          }
        }
      }
    });
    mappings.forEach(m => {
      console.log(`- ${m.natureCode} → ${m.defaultCategory?.label || 'Aucune'} (${m.defaultCategory?.slug || 'N/A'})`);
    });
    console.log(`\nTotal: ${mappings.length} mappings\n`);
    
  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
