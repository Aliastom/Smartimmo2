import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

const execAsync = promisify(exec);

/**
 * POST /api/admin/database/studio
 * Lance Prisma Studio (nécessite ENABLE_PRISMA_STUDIO=true dans .env.local)
 */
export async function POST(request: NextRequest) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    // Vérifier que Prisma Studio est explicitement activé dans .env.local
    if (process.env.ENABLE_PRISMA_STUDIO !== 'true') {
      return NextResponse.json(
        { error: 'Prisma Studio n\'est pas activé. Ajoutez ENABLE_PRISMA_STUDIO=true dans votre fichier .env.local' },
        { status: 403 }
      );
    }

    // Vérifier que Prisma Studio n'est pas déjà en cours d'exécution
    // On vérifie si le port 5555 (port par défaut de Prisma Studio) est déjà utilisé
    try {
      const { stdout } = await execAsync('netstat -ano | findstr :5555');
      if (stdout) {
        return NextResponse.json(
          { 
            success: true, 
            message: 'Prisma Studio est déjà en cours d\'exécution',
            url: 'http://localhost:5555'
          },
          { status: 200 }
        );
      }
    } catch (error) {
      // Le port n'est pas utilisé, on peut continuer
    }

    // Lancer Prisma Studio en arrière-plan
    exec('npm run db:studio', { cwd: process.cwd() }, (error, stdout, stderr) => {
      if (error) {
        console.error('Erreur lors du lancement de Prisma Studio:', error);
        return;
      }
      console.log('Prisma Studio démarré avec succès');
    });

    // Attendre un peu pour que Prisma Studio démarre
    await new Promise(resolve => setTimeout(resolve, 2000));

    return NextResponse.json(
      { 
        success: true, 
        message: 'Prisma Studio est en cours de démarrage...',
        url: 'http://localhost:5555'
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Erreur lors du lancement de Prisma Studio:', error);
    return NextResponse.json(
      { error: 'Erreur lors du lancement de Prisma Studio' },
      { status: 500 }
    );
  }
}

