import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/admin/document-types/[id]/test - Tester la classification et l'extraction
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    // Gérer FormData (fichier) ou JSON (texte)
    let testText = '';
    
    try {
      const contentType = request.headers.get('content-type');
      if (contentType?.includes('multipart/form-data')) {
        // Gestion des fichiers
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const textFromForm = formData.get('text') as string;
        
        if (file) {
          // Simulation d'extraction de texte depuis fichier
          testText = `Texte extrait du fichier ${file.name} (${file.type})`;
        } else if (textFromForm) {
          testText = textFromForm;
        }
      } else {
        // Gestion du JSON
        const body = await request.json();
        testText = body.text || '';
      }
    } catch (parseError) {
      return NextResponse.json(
        { success: false, error: 'Erreur de parsing des données' },
        { status: 400 }
      );
    }

    if (!testText) {
      return NextResponse.json(
        { success: false, error: 'Aucun texte fourni pour le test' },
        { status: 400 }
      );
    }

    // Récupérer le type de document avec ses configurations
    const documentType = await prisma.documentType.findUnique({
      where: { id },
      include: {
        DocumentKeyword: true,
        TypeSignal: true,
        DocumentExtractionRule: {
          orderBy: { priority: 'asc' },
        },
      },
    });

    if (!documentType) {
      return NextResponse.json(
        { success: false, error: 'Type de document non trouvé' },
        { status: 404 }
      );
    }

    // Simuler la classification
    const classificationResult = await simulateClassification(testText, documentType);

    // Simuler l'extraction
    const extractionResult = await simulateExtraction(testText, documentType);

    return NextResponse.json({
      success: true,
      data: {
        classification: {
          top3: [classificationResult],
          autoAssigned: classificationResult.confidence >= (documentType.autoAssignThreshold || 0.85),
          autoAssignedType: classificationResult.confidence >= (documentType.autoAssignThreshold || 0.85) 
            ? documentType.label 
            : null,
        },
        extraction: extractionResult,
      },
    });
  } catch (error) {
    console.error('Error testing document type:', error);
    
    return NextResponse.json(
      { success: false, error: 'Erreur lors du test du type de document' },
      { status: 500 }
    );
  }
}

// Fonction pour simuler la classification
async function simulateClassification(text: string, documentType: any) {
  const lowerText = text.toLowerCase();
  let totalScore = 0;
  const matchedKeywords: any[] = [];
  const matchedSignals: any[] = [];

  // Calculer le score des mots-clés
  for (const keyword of documentType.DocumentKeyword) {
    const keywordLower = keyword.keyword.toLowerCase();
    if (lowerText.includes(keywordLower)) {
      totalScore += keyword.weight;
      matchedKeywords.push({
        keyword: keyword.keyword,
        weight: keyword.weight,
      });
    }
  }

  // Calculer le score des signaux
  for (const signal of documentType.signals) {
    let signalMatched = false;
    
    switch (signal.code) {
      case 'HAS_IBAN':
        signalMatched = /\bFR\d{12,32}\b/i.test(text);
        break;
      case 'HAS_SIREN':
        signalMatched = /\b\d{9}\b/.test(text);
        break;
      case 'HAS_SIRET':
        signalMatched = /\b\d{14}\b/.test(text);
        break;
      case 'META_PDF_TITLE':
        signalMatched = lowerText.includes('titre') || lowerText.includes('document');
        break;
      case 'HEADER_IMPOTS':
        signalMatched = lowerText.includes('impôt') || lowerText.includes('fiscal');
        break;
      case 'HEADER_ASSUREUR':
        signalMatched = lowerText.includes('assurance') || lowerText.includes('assureur');
        break;
      case 'MONTH_YEAR_PATTERN':
        signalMatched = /\b(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{4}\b/i.test(text);
        break;
      case 'MONEY_PATTERN':
        signalMatched = /\d+[,\\.]\d{2}\s?€/.test(text);
        break;
      case 'ADDRESS_PATTERN':
        signalMatched = /\d+\s+(rue|avenue|boulevard|place|allée)/i.test(text);
        break;
      default:
        signalMatched = Math.random() > 0.7; // 30% de chance de match
    }

    if (signalMatched) {
      totalScore += signal.weight;
      matchedSignals.push({
        code: signal.code,
        label: signal.label,
        weight: signal.weight,
      });
    }
  }

  // Normaliser le score (0-1)
  const maxPossibleScore = documentType.DocumentKeyword.reduce((sum: number, k: any) => sum + k.weight, 0) +
                          documentType.signals.reduce((sum: number, s: any) => sum + s.weight, 0);
  
  const normalizedScore = maxPossibleScore > 0 ? Math.min(totalScore / maxPossibleScore, 1) : 0;

  return {
    typeId: documentType.id,
    typeCode: documentType.code,
    typeLabel: documentType.label,
    score: normalizedScore,
    confidence: normalizedScore,
    matchedKeywords,
    matchedSignals,
  };
}

// Fonction pour simuler l'extraction
async function simulateExtraction(text: string, documentType: any) {
  const extractionResults: any[] = [];

  for (const rule of documentType.DocumentExtractionRule) {
    try {
      const regex = new RegExp(rule.pattern, 'gi');
      const matches = text.match(regex);
      
      if (matches && matches.length > 0) {
        const value = matches[0];
        let processedValue = value;

        // Post-processing
        if (rule.postProcess) {
          switch (rule.postProcess) {
            case 'fr_date':
              processedValue = formatFrenchDate(value);
              break;
            case 'money_eur':
              processedValue = formatMoney(value);
              break;
            case 'iban_norm':
              processedValue = value.replace(/\s/g, '').toUpperCase();
              break;
            case 'siren':
              processedValue = value.replace(/\D/g, '');
              break;
            case 'year':
              processedValue = value.replace(/\D/g, '').substring(0, 4);
              break;
            case 'fr_month':
              processedValue = formatFrenchMonth(value);
              break;
            case 'string':
            default:
              processedValue = value.trim();
          }
        }

        extractionResults.push({
          fieldName: rule.fieldName,
          value: processedValue,
          confidence: 0.9, // Simulation
          ruleUsed: rule.pattern,
        });
      }
    } catch (regexError) {
      console.error('Error processing regex:', regexError);
    }
  }

  return extractionResults;
}

// Fonctions utilitaires pour le post-processing
function formatFrenchDate(dateStr: string): string {
  return dateStr;
}

function formatMoney(moneyStr: string): string {
  return moneyStr.replace(/[^\d.,]/g, '').replace(',', '.');
}

function formatFrenchMonth(monthStr: string): string {
  const monthMap: { [key: string]: string } = {
    'janv': '01', 'janvier': '01',
    'févr': '02', 'février': '02',
    'mars': '03',
    'avr': '04', 'avril': '04',
    'mai': '05',
    'juin': '06',
    'juil': '07', 'juillet': '07',
    'août': '08',
    'sept': '09', 'septembre': '09',
    'oct': '10', 'octobre': '10',
    'nov': '11', 'novembre': '11',
    'déc': '12', 'décembre': '12',
  };

  const lowerMonth = monthStr.toLowerCase().replace(/\./g, '');
  return monthMap[lowerMonth] || monthStr;
}