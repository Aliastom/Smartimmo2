import { NextRequest, NextResponse } from 'next/server';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * GET /api/debug/temp-files
 * Endpoint de debug pour lister les fichiers temporaires
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const tempDir = join(tmpdir(), 'smartimmo', 'uploads');
    
    try {
      const files = await readdir(tempDir);
      const fileInfos = [];
      
      for (const file of files) {
        const filePath = join(tempDir, file);
        const stats = await stat(filePath);
        fileInfos.push({
          name: file,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          isFile: stats.isFile(),
          isDirectory: stats.isDirectory()
        });
      }
      
      return NextResponse.json({
        success: true,
        tempDir,
        files: fileInfos
      });
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Répertoire temporaire introuvable',
        tempDir,
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      });
    }
    
  } catch (error) {
    console.error('[Debug] Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur lors du debug' },
      { status: 500 }
    );
  }
}
