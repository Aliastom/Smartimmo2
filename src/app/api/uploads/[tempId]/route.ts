import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * GET /api/uploads/[tempId]
 * Sert un fichier temporaire pour prévisualisation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { tempId: string } }
) {
  try {
    const { tempId } = params;

    console.log('[Uploads API] Demande de fichier temporaire:', tempId);

    if (!tempId || !tempId.startsWith('tmp_')) {
      return NextResponse.json(
        { error: 'ID temporaire invalide' },
        { status: 400 }
      );
    }

    // Chemin vers le fichier temporaire (correspond à la structure de l'upload)
    const tempDir = join(tmpdir(), 'smartimmo', 'uploads');
    console.log('[Uploads API] Répertoire temporaire:', tempDir);
    
    // Chercher le fichier avec l'extension (il peut être .pdf, .jpg, etc.)
    let filePath: string | null = null;
    let metaPath = join(tempDir, `${tempId}.meta.json`);
    console.log('[Uploads API] Chemin métadonnées:', metaPath);
    
    // Lire d'abord les métadonnées pour obtenir l'extension
    try {
      const metaContent = await readFile(metaPath, 'utf-8');
      const meta = JSON.parse(metaContent);
      const ext = meta.ext || 'bin';
      filePath = join(tempDir, `${tempId}.${ext}`);
      console.log('[Uploads API] Fichier trouvé via métadonnées:', filePath, 'extension:', ext);
    } catch (error) {
      console.log('[Uploads API] Métadonnées non trouvées, recherche par extensions communes');
      // Si pas de métadonnées, essayer les extensions communes
      const commonExts = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'];
      for (const ext of commonExts) {
        const testPath = join(tempDir, `${tempId}.${ext}`);
        try {
          await stat(testPath);
          filePath = testPath;
          console.log('[Uploads API] Fichier trouvé par extension:', filePath);
          break;
        } catch {
          // Continuer avec la prochaine extension
        }
      }
    }

    // Vérifier que le fichier existe
    if (!filePath) {
      return NextResponse.json(
        { error: 'Fichier temporaire introuvable' },
        { status: 404 }
      );
    }

    try {
      await stat(filePath);
      await stat(metaPath);
    } catch (error) {
      return NextResponse.json(
        { error: 'Fichier temporaire introuvable ou expiré' },
        { status: 404 }
      );
    }

    // Lire les métadonnées
    const metaContent = await readFile(metaPath, 'utf-8');
    const meta = JSON.parse(metaContent);

    // Vérifier l'expiration
    if (meta.expiresAt && Date.now() > meta.expiresAt) {
      return NextResponse.json(
        { error: 'Fichier temporaire expiré' },
        { status: 410 }
      );
    }

    // Lire le fichier
    const fileBuffer = await readFile(filePath);
    const mimeType = meta.mime || 'application/octet-stream';

    // Retourner le fichier avec les bons headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': fileBuffer.length.toString(),
        'Content-Disposition': `inline; filename="${meta.originalName}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error) {
    console.error('[Uploads API] Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la lecture du fichier temporaire' },
      { status: 500 }
    );
  }
}
