import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/admin/document-config/export - Exporter la configuration complÃ¨te
export async function GET(request: NextRequest) {
  try {
    // RÃ©cupÃ©rer tous les types de documents avec leurs relations
    const documentTypes = await prisma.documentType.findMany({
      include: {
        DocumentKeyword: {
          orderBy: { keyword: 'asc' },
        },
        TypeSignal: {
          where: { enabled: true },
          include: {
            Signal: true
          },
          orderBy: { order: 'asc' },
        },
        DocumentExtractionRule: {
          orderBy: { priority: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    });

    // Construire l'objet d'export
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      types: documentTypes.map(type => ({
        code: type.code,
        label: type.label,
        description: type.description,
        order: type.order ?? 0,
        isActive: type.isActive,
        isSensitive: type.isSensitive ?? false,
        autoAssignThreshold: type.autoAssignThreshold ?? 0.85,
        defaultContexts: type.defaultContexts ? JSON.parse(type.defaultContexts) : [],
        suggestionsConfig: type.suggestionsConfig ? JSON.parse(type.suggestionsConfig) : {},
        flowLocks: type.flowLocks ? JSON.parse(type.flowLocks) : [],
        metaSchema: type.metaSchema ? JSON.parse(type.metaSchema) : {},
        keywords: (type.DocumentKeyword ?? []).map(k => ({
          term: k.keyword, // En base de donnÃ©es, le champ s'appelle 'keyword'
          weight: k.weight ?? 1,
          context: k.context ?? null,
        })),
        signals: (type.TypeSignal ?? []).map(ts => ({
          code: ts.Signal.code,
          weight: ts.weight ?? 1,
          enabled: ts.enabled ?? true,
          order: ts.order ?? 0,
        })),
        rules: (type.DocumentExtractionRule ?? []).map(r => ({
          fieldName: r.fieldName,
          pattern: r.pattern,
          postProcess: r.postProcess ?? null,
          priority: r.priority ?? 100,
        })),
      })),
    };

    // CrÃ©er le fichier JSON
    const jsonString = JSON.stringify(exportData, null, 2);
    
    // Retourner le fichier
    return new NextResponse(jsonString, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="document-types-config-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    console.error('Error exporting document config:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de l\'export de la configuration' },
      { status: 500 }
    );
  }
}