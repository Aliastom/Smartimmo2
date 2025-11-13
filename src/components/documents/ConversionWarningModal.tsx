'use client';

import React from 'react';
import { FileText, AlertTriangle, Zap, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';

export interface ConversionFile {
  name: string;
  type: string;
  size: number;
  extension: string;
}

interface ConversionWarningModalProps {
  isOpen: boolean;
  files: ConversionFile[];
  onConfirm: () => void;
  onCancel: () => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const getFileTypeIcon = (extension: string) => {
  switch (extension.toLowerCase()) {
    case 'docx':
    case 'doc':
      return '📝';
    case 'xlsx':
    case 'xls':
      return '📊';
    case 'pptx':
    case 'ppt':
      return '📊';
    default:
      return '📄';
  }
};

const getFileTypeName = (extension: string) => {
  switch (extension.toLowerCase()) {
    case 'docx':
      return 'Document Word';
    case 'doc':
      return 'Document Word (ancien)';
    case 'xlsx':
      return 'Classeur Excel';
    case 'xls':
      return 'Classeur Excel (ancien)';
    case 'pptx':
      return 'Présentation PowerPoint';
    case 'ppt':
      return 'Présentation PowerPoint (ancien)';
    case 'odt':
      return 'Document LibreOffice';
    case 'ods':
      return 'Classeur LibreOffice';
    case 'odp':
      return 'Présentation LibreOffice';
    case 'rtf':
      return 'Document RTF';
    default:
      return 'Document Office';
  }
};

export default function ConversionWarningModal({ 
  isOpen, 
  files, 
  onConfirm, 
  onCancel 
}: ConversionWarningModalProps) {
  if (!isOpen) return null;

  const totalSize = files.reduce((acc, file) => acc + file.size, 0);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <CardTitle className="text-xl">Conversion nécessaire</CardTitle>
              <CardDescription>
                Les fichiers sélectionnés seront automatiquement convertis en PDF
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Explication */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900 mb-1">
                  Pourquoi cette conversion ?
                </h4>
                <p className="text-sm text-blue-700">
                  Pour analyser le contenu de vos documents Office et les classifier automatiquement, 
                  nous devons les convertir en PDF. Cette opération préserve tout le contenu et 
                  améliore la précision de la reconnaissance de caractères.
                </p>
              </div>
            </div>
          </div>

          {/* Liste des fichiers */}
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-orange-500" />
              Fichiers à convertir ({files.length})
            </h4>
            
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {files.map((file, index) => (
                <div 
                  key={index}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  <div className="text-2xl">
                    {getFileTypeIcon(file.extension)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {getFileTypeName(file.extension)} • {formatFileSize(file.size)}
                    </p>
                  </div>
                  <div className="text-xs text-gray-400">
                    → PDF
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Informations techniques */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-green-900 mb-1">
                  Processus sécurisé
                </h4>
                <div className="text-sm text-green-700 space-y-1">
                  <p>• Conversion côté serveur avec LibreOffice</p>
                  <p>• Contenu préservé à l'identique</p>
                  <p>• Fichiers temporaires automatiquement supprimés</p>
                  <p>• Temps estimé : {Math.ceil(totalSize / (1024 * 1024)) * 2-5} secondes</p>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={onCancel}
            >
              Annuler
            </Button>
            <Button 
              onClick={onConfirm}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Zap className="h-4 w-4 mr-2" />
              Convertir et continuer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
