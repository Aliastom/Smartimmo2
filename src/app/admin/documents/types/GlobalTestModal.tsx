'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Label } from '@/ui/shared/label';
import { Textarea } from '@/ui/shared/textarea';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/ui/shared/tabs';
import { Loader2, Play, Upload, FileText, CheckCircle, XCircle, AlertCircle, Eye, Settings, Zap, ChevronDown, ChevronRight, Info, TestTube, AlertTriangle } from 'lucide-react';

interface TestResult {
  fileInfo?: {
    name: string;
    size: number;
    pages?: number;
    ocrStatus: 'pdf-text' | 'pdf-ocr' | 'image-ocr' | 'manual';
    analysisTime: number;
  };
  classification: {
    top3: Array<{
      typeId: string;
      typeLabel: string;
      typeCode: string;
      threshold: number;
      rawScore: number;
      normalizedScore: number;
      matchedKeywords: Array<{
        keyword: string;
        weight: number;
        context?: string;
        occurrences?: Array<{
          text: string;
          position: number;
        }>;
      }>;
      matchedSignals: Array<{
        code: string;
        label: string;
        weight: number;
        details?: string;
      }>;
      scoreBreakdown: {
        keywordsTotal: number;
        signalsTotal: number;
        rawTotal: number;
        normalizedTotal: number;
      };
    }>;
    autoAssigned: boolean;
    autoAssignedType?: string;
    autoAssignReason?: string;
  };
  extraction: Array<{
    fieldName: string;
    value: string;
    confidence: number;
    ruleUsed: string;
  }>;
}

interface GlobalTestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GlobalTestModal({
  isOpen,
  onClose,
}: GlobalTestModalProps) {
  const [testText, setTestText] = useState('');
  const [testFile, setTestFile] = useState<File | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [activeTab, setActiveTab] = useState<'text' | 'file'>('text');
  const [selectedTypeForExtraction, setSelectedTypeForExtraction] = useState<string>('');
  const [expandedResults, setExpandedResults] = useState<Set<number>>(new Set());
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [showExtractionModal, setShowExtractionModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedTypeForConfig, setSelectedTypeForConfig] = useState<string>('');
  const [currentRunId, setCurrentRunId] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDeterminismTest, setShowDeterminismTest] = useState(false);
  const [activeResultTab, setActiveResultTab] = useState<'results' | 'debug'>('results');

  // Fonction d'extraction OCR via l'API serveur
  const extractTextWithOCR = async (file: File): Promise<{
    success: boolean;
    text: string;
    source: 'pdf-parse' | 'tesseract' | 'pdf-ocr';
    duration: number;
    preview?: string;
    sha256?: string;
    length?: number;
    pagesOcred?: number;
    error?: string;
  }> => {
    const startTime = Date.now();
    
    try {
      console.log(`[OCR] Envoi du BLOB réel à l'API: ${file.name}`);
      
      // 1) Envoie le BLOB réel, pas de texte hardcodé
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (!data.ok) {
        return {
          success: false,
          text: '',
          source: 'pdf-parse',
          duration: Date.now() - startTime,
          error: data.error || 'Erreur extraction',
        };
      }
      
      console.log(`[OCR] ✓ Texte extrait: ${data.length} caractères (source: ${data.meta.source})`);
      
      // Retourner les vraies données OCR
      return {
        success: true,
        text: data.text || '', // Texte normalisé
        source: data.meta?.source || 'pdf-parse',
        duration: data.meta?.duration || (Date.now() - startTime),
        preview: data.preview,
        sha256: data.meta?.sha256,
        length: data.length,
        pagesOcred: data.meta?.pagesOcred,
      };
      
    } catch (error) {
      console.error('[OCR] Erreur:', error);
      return {
        success: false,
        text: '',
        source: 'pdf-parse',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Erreur OCR'
      };
    }
  };

  const handleTest = async () => {
    if (!testText.trim() && !testFile) {
      alert('Veuillez saisir du texte ou sélectionner un fichier');
      return;
    }

    try {
      setIsTesting(true);
      // 5) Vider l'état précédent : plus d'anciens résultats
      setTestResult(null);
      setDebugInfo(null);
      setExtractionError(null);

      // Générer un nouveau runId pour éviter les résultats obsolètes
      const newRunId = crypto.randomUUID();
      setCurrentRunId(newRunId);

      let finalText = testText;
      let fileInfo: TestResult['fileInfo'] | undefined;
      let ocrMeta: {
        source?: string;
        sha256?: string;
        preview?: string;
        length?: number;
        pagesOcred?: number;
      } = {};
      
      // Si c'est un fichier, tenter l'extraction OCR
      if (activeTab === 'file' && testFile) {
        console.log('[Test] Tentative d\'extraction OCR avec BLOB réel...');
        const ocrResult = await extractTextWithOCR(testFile);
        
        if (ocrResult.success && ocrResult.text.length > 0) {
          // 3) Utiliser le texte normalisé renvoyé par l'API
          finalText = ocrResult.text;
          console.log(`[Test] ✓ Texte normalisé extrait: ${finalText.length} caractères (source: ${ocrResult.source})`);
          
          // Stocker les métadonnées OCR pour l'onglet Debug
          ocrMeta = {
            source: ocrResult.source,
            sha256: ocrResult.sha256,
            preview: ocrResult.preview,
            length: ocrResult.length,
            pagesOcred: ocrResult.pagesOcred,
          };
          
          // Remplir les informations du fichier
          fileInfo = {
            name: testFile.name,
            size: testFile.size,
            ocrStatus: ocrResult.source as any,
            analysisTime: ocrResult.duration,
          };
        } else {
          // Si l'extraction échoue, NE PAS utiliser de fallback texte hardcodé
          setExtractionError(ocrResult.error || 'Erreur d\'extraction');
          alert(`⚠️ Extraction automatique échouée\n\n${ocrResult.error || 'Impossible d\'extraire le texte'}\n\nVeuillez utiliser l\'onglet "Texte libre" pour tester manuellement.`);
          return;
        }
      }

      // Envoyer le texte final à l'API avec les métadonnées OCR
      const response = await fetch(`/api/admin/document-types/test-global?documentTypeId=${selectedTypeForExtraction}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: finalText,
          runId: newRunId,
          fileInfo,
          ocrMeta, // Ajouter les métadonnées OCR pour l'onglet Debug
        }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors du test');
      }

      const result = await response.json();
      
      if (!result.success) {
        // Gestion des erreurs d'extraction
        if (result.error === 'Aucun texte extrait du fichier') {
          setExtractionError(result.details?.extractionError || 'Erreur d\'extraction');
          setFallbackText('');
          alert('Aucun texte extrait du fichier. Utilisez le champ "Texte libre" pour tester.');
          return;
        } else {
          alert(`Erreur: ${result.error}`);
          return;
        }
      }
      
      // Vérifier que c'est bien le bon runId (garde-fou contre les résultats obsolètes)
      if (result.data.runId !== newRunId) {
        console.warn('Résultat obsolète ignoré:', result.data.runId, 'vs', newRunId);
        return;
      }

      setTestResult(result.data);
      setDebugInfo(result.data.debug);
      setExtractionError(null); // Réinitialiser l'erreur d'extraction
    } catch (error) {
      console.error('Erreur lors du test:', error);
      alert('Erreur lors du test de classification');
    } finally {
      setIsTesting(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setTestFile(file || null);
    setTestText('');
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.6) return 'warning';
    return 'danger';
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.8) return <CheckCircle className="w-4 h-4" />;
    if (confidence >= 0.6) return <AlertCircle className="w-4 h-4" />;
    return <XCircle className="w-4 h-4" />;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 50) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const toggleResultExpansion = (index: number) => {
    const newExpanded = new Set(expandedResults);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedResults(newExpanded);
  };

  const handleViewConfig = (typeId: string) => {
    setSelectedTypeForConfig(typeId);
    setShowConfigModal(true);
  };

  const handleTestExtraction = (typeId: string) => {
    setSelectedTypeForExtraction(typeId);
    setShowExtractionModal(true);
  };

  const handleAssignType = async (typeId: string, typeLabel: string) => {
    if (confirm(`Assigner ce document au type "${typeLabel}" ?`)) {
      // Ici, vous pourriez appeler une API pour assigner le type
      alert(`Document assigné au type "${typeLabel}"`);
    }
  };

  const handleTestDeterminism = async () => {
    if (!testFile && !testText.trim()) {
      alert('Veuillez sélectionner un fichier ou saisir du texte pour tester le déterminisme');
      return;
    }
    
    try {
      setIsTesting(true);
      console.log('[Déterminisme] Début du test (3 itérations)...');
      
      const iterations = 3;
      const extractedTexts: string[] = [];
      const hashes: string[] = [];
      
      // Si fichier, extraire le texte 3 fois pour vérifier la stabilité
      if (activeTab === 'file' && testFile) {
        for (let i = 0; i < iterations; i++) {
          console.log(`[Déterminisme] Itération ${i + 1}/${iterations}...`);
          const ocrResult = await extractTextWithOCR(testFile);
          
          if (!ocrResult.success) {
            alert(`Erreur extraction (itération ${i + 1}): ${ocrResult.error}`);
            return;
          }
          
          extractedTexts.push(ocrResult.text);
          // Calculer un hash simple
          const hash = btoa(ocrResult.text).substring(0, 16);
          hashes.push(hash);
        }
      } else {
        // Pour le texte, vérifier que la classification est stable
        const text = testText.trim();
        for (let i = 0; i < iterations; i++) {
          extractedTexts.push(text);
          hashes.push(btoa(text).substring(0, 16));
        }
      }
      
      // Vérifier si tous les hash sont identiques
      const allHashesIdentical = hashes.every(h => h === hashes[0]);
      const allTextsIdentical = extractedTexts.every(t => t === extractedTexts[0]);
      
      const deterministic = allHashesIdentical && allTextsIdentical;
      
      if (deterministic) {
        alert(`✅ Test de déterminisme PASSÉ\n\n${iterations} extractions identiques\nTexte: ${extractedTexts[0].length} caractères\nSource: ${activeTab === 'file' ? 'OCR' : 'Manuel'}`);
      } else {
        alert(`❌ Test de déterminisme ÉCHOUÉ\n\n${iterations} extractions différentes\n\nHash 1: ${hashes[0]}\nHash 2: ${hashes[1]}\nHash 3: ${hashes[2]}\n\nLe texte extrait varie entre les exécutions.`);
      }
      
    } catch (error) {
      console.error('[Déterminisme] Erreur:', error);
      alert(`Erreur lors du test de déterminisme: ${error instanceof Error ? error.message : 'Inconnu'}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Test Global de Classification"
      size="xl"
    >
      <div className="space-y-4">
        {/* Information OCR réel */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
          <Info className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-green-800">
            <strong>OCR réel activé :</strong> L'extraction de fichiers utilise maintenant un vrai OCR Tesseract.
            Les PDFs et images seront analysés pour extraire le texte réel. Le traitement peut prendre quelques secondes.
          </div>
        </div>

        {/* Configuration du test */}
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-3">Configuration du test</h3>
          
          <div className="mb-3">
            <Label>Type de test</Label>
            <div className="flex space-x-4 mt-1">
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="testType"
                  checked={activeTab === 'text'}
                  onChange={() => setActiveTab('text')}
                  className="rounded border-gray-300"
                />
                <span>Texte libre</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="testType"
                  checked={activeTab === 'file'}
                  onChange={() => setActiveTab('file')}
                  className="rounded border-gray-300"
                />
                <span>Fichier</span>
              </label>
            </div>
          </div>

          {activeTab === 'text' ? (
            <div>
              <Label htmlFor="testText">Texte à analyser</Label>
              <Textarea
                id="testText"
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="Collez ici le texte d'un document à analyser..."
                rows={4}
              />
              <p className="text-sm text-gray-500 mt-1">
                Le système testera ce texte contre tous les types de documents configurés.
              </p>
            </div>
          ) : (
            <div>
              <Label htmlFor="testFile">Fichier à analyser</Label>
              <div className="mt-1">
                <input
                  id="testFile"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.txt,.doc,.docx"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {testFile && (
                  <div className="mt-2 p-2 bg-gray-50 rounded flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">{testFile.name}</span>
                    <span className="text-xs text-gray-500">
                      ({(testFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <Button
              onClick={handleTest}
              disabled={isTesting || (!testText.trim() && !testFile)}
            >
              {isTesting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              {isTesting ? 'Test en cours...' : 'Lancer le test global'}
            </Button>
            <Button
              variant="outline"
              onClick={handleTestDeterminism}
              disabled={isTesting}
              title="Tester le déterminisme"
            >
              <TestTube className="w-4 h-4 mr-2" />
              Test déterminisme
            </Button>
          </div>
        </Card>

        {/* Message d'erreur d'extraction (sans fallback texte hardcodé) */}
        {extractionError && (
          <Card className="p-4 border-orange-200 bg-orange-50">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-orange-800">Erreur d'extraction OCR</h4>
                <p className="text-sm text-orange-700 mt-1">
                  {extractionError}
                </p>
                <p className="text-xs text-orange-600 mt-2">
                  💡 Utilisez l'onglet "Texte libre" pour tester manuellement avec du texte copié.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Résultats du test avec onglets */}
        {testResult && (
          <Card className="p-4">
            <Tabs value={activeResultTab} onValueChange={(value: 'results' | 'debug') => setActiveResultTab(value)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="results">Résultats</TabsTrigger>
                <TabsTrigger value="debug">Debug</TabsTrigger>
              </TabsList>
              
              <TabsContent value="results" className="space-y-4 mt-4">
                {/* Informations du fichier */}
                {testResult.fileInfo && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <Info className="w-4 h-4 text-blue-600" />
                      <h4 className="font-semibold text-blue-900">Contexte du test</h4>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div>
                        <span className="font-medium text-blue-800">Fichier:</span>
                        <p className="text-blue-700 text-xs">{testResult.fileInfo.name}</p>
                      </div>
                      <div>
                        <span className="font-medium text-blue-800">Taille:</span>
                        <p className="text-blue-700 text-xs">{(testResult.fileInfo.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <div>
                        <span className="font-medium text-blue-800">OCR:</span>
                        <p className="text-blue-700 text-xs">
                          {testResult.fileInfo.ocrStatus === 'pdf-text' ? 'Texte brut' : 
                           testResult.fileInfo.ocrStatus === 'pdf-ocr' ? 'Document scanné' : 
                           testResult.fileInfo.ocrStatus === 'image-ocr' ? 'Image OCR' :
                           'Manuel'}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-blue-800">Temps:</span>
                        <p className="text-blue-700 text-xs">{testResult.fileInfo.analysisTime}ms</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Classification globale */}
                <div>
                  <h4 className="text-lg font-semibold mb-3">Résultats de classification</h4>
              
                  <div className="space-y-2">
                    {testResult.classification.top3.map((result, index) => {
                      const isExpanded = expandedResults.has(index);
                      const scorePercentage = ((result.normalizedScore || result.confidence || 0) * 100).toFixed(0);
                      
                      return (
                        <div
                          key={result.typeId}
                          className={`p-3 rounded-lg border ${
                            index === 0 ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => toggleResultExpansion(index)}
                                className="flex items-center space-x-1 hover:bg-gray-100 rounded p-1"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-3 h-3" />
                                ) : (
                                  <ChevronRight className="w-3 h-3" />
                                )}
                                <Badge variant={index === 0 ? 'primary' : 'secondary'} className="text-xs">
                                  #{index + 1}
                                </Badge>
                              </button>
                              <span className="font-medium text-sm">{result.typeLabel}</span>
                              <Badge variant="outline" className="text-xs">
                                Seuil: {((result.threshold || 0.85) * 100).toFixed(0)}%
                              </Badge>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Badge variant={getConfidenceColor(result.normalizedScore || result.confidence || 0)}>
                                {getConfidenceIcon(result.normalizedScore || result.confidence || 0)}
                                {scorePercentage}%
                              </Badge>
                              <div className="flex space-x-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewConfig(result.typeId)}
                                  title="Voir la configuration"
                                  className="h-6 w-6 p-0"
                                >
                                  <Settings className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleTestExtraction(result.typeId)}
                                  title="Tester l'extraction"
                                  className="h-6 w-6 p-0"
                                >
                                  <Zap className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleAssignType(result.typeId, result.typeLabel)}
                                  title="Assigner ce type"
                                  className="h-6 w-6 p-0"
                                >
                                  <CheckCircle className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                          
                          {/* Barre de progression compacte */}
                          <div className="mt-2">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all duration-300 ${getScoreColor(Number(scorePercentage))}`}
                                style={{ width: `${scorePercentage}%` }}
                              />
                            </div>
                            <div className="mt-1 text-xs text-gray-600">
                              {result.scoreBreakdown ? (
                                <>
                                  Score brut = +{result.scoreBreakdown.keywordsTotal?.toFixed(1) || '0'} mots-clés + {result.scoreBreakdown.signalsTotal?.toFixed(1) || '0'} signaux → Score normalisé {scorePercentage}%
                                </>
                              ) : (
                                `Score normalisé: ${scorePercentage}%`
                              )}
                            </div>
                          </div>

                          {/* Détails dépliables */}
                          {isExpanded && (
                            <div className="mt-3 space-y-2 border-t pt-2">
                              {/* Mots-clés trouvés */}
                              {result.matchedKeywords && result.matchedKeywords.length > 0 && (
                                <div>
                                  <span className="font-medium text-gray-700 text-xs">Mots-clés trouvés:</span>
                                  <div className="mt-1 space-y-1">
                                    {result.matchedKeywords.map((keyword, idx) => (
                                      <div key={idx} className="flex items-center justify-between p-1 bg-white rounded border text-xs">
                                        <div className="flex-1">
                                          <Badge variant="outline" className="text-xs mr-1">
                                            +{keyword.weight || 0}
                                          </Badge>
                                          <span className="font-medium">{keyword.keyword || 'N/A'}</span>
                                        </div>
                                        {keyword.occurrences && keyword.occurrences.length > 0 && (
                                          <div className="text-xs text-gray-600 max-w-xs truncate">
                                            {keyword.occurrences[0].text}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* Signaux détectés */}
                              {result.matchedSignals && result.matchedSignals.length > 0 && (
                                <div>
                                  <span className="font-medium text-gray-700 text-xs">Signaux détectés:</span>
                                  <div className="mt-1 space-y-1">
                                    {result.matchedSignals.map((signal, idx) => (
                                      <div key={idx} className="flex items-center justify-between p-1 bg-white rounded border text-xs">
                                        <div className="flex-1">
                                          <Badge variant="outline" className="text-xs mr-1">
                                            +{signal.weight || 0}
                                          </Badge>
                                          <span className="font-medium">{signal.label || 'N/A'}</span>
                                        </div>
                                        {signal.details && (
                                          <div className="text-xs text-gray-600 max-w-xs truncate">
                                            {signal.details}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Auto-assignation */}
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">Auto-assignation:</span>
                      <Badge variant={testResult.classification.autoAssigned ? 'success' : 'secondary'}>
                        {testResult.classification.autoAssigned ? 'Oui' : 'Non'}
                      </Badge>
                    </div>
                    {!testResult.classification.autoAssigned && testResult.classification.top3.length > 0 && (
                      <div className="mt-1 text-xs text-gray-600">
                        Score {((testResult.classification.top3[0].normalizedScore || testResult.classification.top3[0].confidence || 0) * 100).toFixed(0)}% &lt; seuil {((testResult.classification.top3[0].threshold || 0.85) * 100).toFixed(0)}% ({testResult.classification.top3[0].typeLabel})
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="debug" className="mt-4">
                {debugInfo && (
                  <div className="space-y-3">
                    {/* 2) Afficher meta.source, meta.sha256, length, et preview */}
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <Info className="w-4 h-4 text-gray-600" />
                        <h4 className="font-semibold text-gray-900">Informations de debug</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="font-medium text-gray-800">Run ID:</span>
                          <p className="text-gray-700 font-mono text-xs">{currentRunId}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-800">Config version:</span>
                          <p className="text-gray-700">v{testResult.configVersion}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-800">Temps de traitement:</span>
                          <p className="text-gray-700">{debugInfo.processingTime}ms</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-800">Longueur du texte:</span>
                          <p className="text-gray-700">{debugInfo.textLength} caractères</p>
                        </div>
                        
                        {/* Métadonnées OCR de l'API */}
                        {debugInfo.ocrMeta && (
                          <>
                            <div className="col-span-2">
                              <span className="font-medium text-gray-800">Source OCR:</span>
                              <div className="flex items-center gap-2 mt-1">
                                {/* 4) Badge de couleur selon la source */}
                                {debugInfo.ocrMeta.source === 'pdf-parse' && (
                                  <Badge className="bg-green-500 text-white">
                                    📄 PDF Parse (texte natif)
                                  </Badge>
                                )}
                                {debugInfo.ocrMeta.source === 'tesseract' && (
                                  <Badge className="bg-blue-500 text-white">
                                    🔍 Tesseract OCR (image)
                                  </Badge>
                                )}
                                {debugInfo.ocrMeta.source === 'pdf-ocr' && (
                                  <Badge className="bg-blue-500 text-white">
                                    📄🔍 PDF OCR (scanné)
                                  </Badge>
                                )}
                                {debugInfo.ocrMeta.pagesOcred && (
                                  <span className="text-xs text-gray-600">
                                    ({debugInfo.ocrMeta.pagesOcred} pages OCR)
                                  </span>
                                )}
                              </div>
                            </div>
                            {debugInfo.ocrMeta.sha256 && (
                              <div className="col-span-2">
                                <span className="font-medium text-gray-800">SHA-256:</span>
                                <p className="text-gray-700 font-mono text-xs">{debugInfo.ocrMeta.sha256}</p>
                              </div>
                            )}
                            {debugInfo.ocrMeta.length && (
                              <div>
                                <span className="font-medium text-gray-800">Longueur extraction:</span>
                                <p className="text-gray-700">{debugInfo.ocrMeta.length} caractères</p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      
                      {/* Preview du texte brut extrait */}
                      {debugInfo.ocrMeta?.preview && (
                        <div className="mt-3">
                          <span className="font-medium text-gray-800 text-sm">Aperçu du texte brut extrait (premiers 300 chars):</span>
                          <p className="text-gray-700 font-mono text-xs bg-blue-50 p-2 rounded border mt-1 whitespace-pre-wrap">
                            {debugInfo.ocrMeta.preview}
                          </p>
                        </div>
                      )}
                      
                      {/* Texte normalisé */}
                      <div className="mt-3">
                        <span className="font-medium text-gray-800 text-sm">Texte normalisé (envoyé à la classification):</span>
                        <p className="text-gray-700 font-mono text-xs bg-white p-2 rounded border mt-1 whitespace-pre-wrap max-h-40 overflow-y-auto">
                          {debugInfo.normalizedText}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </Card>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-6 border-t">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Fermer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
