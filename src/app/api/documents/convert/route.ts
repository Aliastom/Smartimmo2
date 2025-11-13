import { NextResponse, NextRequest } from 'next/server';
import { documentConversionService } from '@/services/DocumentConversionService';

/**
 * POST /api/documents/convert
 * Convertit un document Office en PDF
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ 
        success: false, 
        error: 'Aucun fichier fourni' 
      }, { status: 400 });
    }

    // Vérifier si le fichier nécessite une conversion
    if (!documentConversionService.needsConversion(file.type)) {
      return NextResponse.json({
        success: false,
        error: 'Ce type de fichier ne nécessite pas de conversion',
        details: `Type ${file.type} non supporté pour la conversion. Types supportés: ${
          documentConversionService.getSupportedFormats().map(f => f.extension).join(', ')
        }`
      }, { status: 400 });
    }

    // Conversion
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await documentConversionService.convertToPDF(buffer, file.type, file.name);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: 'Échec de la conversion',
        details: result.error
      }, { status: 500 });
    }

    // Créer la réponse avec le PDF
    const pdfBlob = new Blob([result.pdfBuffer!], { type: 'application/pdf' });
    const response = new Response(pdfBlob);
    
    // Headers pour le téléchargement
    const originalName = file.name.replace(/\.[^/.]+$/, ''); // Enlever l'extension
    response.headers.set('Content-Type', 'application/pdf');
    response.headers.set('Content-Disposition', `attachment; filename="${originalName}.pdf"`);
    response.headers.set('X-Conversion-Info', JSON.stringify({
      originalType: result.originalMime,
      convertedFrom: result.convertedFrom,
      conversionTimeMs: result.conversionTimeMs
    }));

    return response;

  } catch (error: any) {
    console.error('Erreur conversion API:', error);
    return NextResponse.json({
      success: false,
      error: 'Erreur interne du serveur',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * GET /api/documents/convert
 * Retourne les formats supportés pour la conversion
 */
export async function GET() {
  try {
    const supportedFormats = documentConversionService.getSupportedFormats();
    const isLibreOfficeAvailable = await documentConversionService.checkLibreOfficeAvailability();
    
    return NextResponse.json({
      success: true,
      supportedFormats,
      libreOfficeAvailable: isLibreOfficeAvailable,
      info: {
        description: 'API de conversion de documents Office vers PDF',
        usage: 'POST avec un fichier en multipart/form-data',
        maxFileSize: '20MB (recommandé)',
        timeout: '30 secondes'
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Erreur lors de la vérification du service',
      details: error.message
    }, { status: 500 });
  }
}
