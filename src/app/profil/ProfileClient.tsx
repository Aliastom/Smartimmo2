'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { 
  Upload, 
  Trash2, 
  Eye, 
  PenTool,
  Check,
  X
} from 'lucide-react';

interface ProfileClientProps {
  user: {
    id: string;
    name: string;
    email: string;
    signatureUrl?: string | null;
    settings: {
      theme: string;
      notifications: boolean;
      language: string;
    };
  };
}

export default function ProfileClient({ user }: ProfileClientProps) {
  const [signatureUrl, setSignatureUrl] = useState(user.signatureUrl);
  const [isUploading, setIsUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Vérifier le type de fichier
    if (!file.type.includes('image/')) {
      alert('Veuillez sélectionner un fichier image');
      return;
    }

    // Vérifier la taille (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Le fichier doit faire moins de 5MB');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('signature', file);
      formData.append('userId', user.id);

      const response = await fetch('/api/profile/signature', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setSignatureUrl(data.url);
        alert('Signature uploadée avec succès');
      } else {
        throw new Error('Erreur lors de l\'upload');
      }
    } catch (error) {
      console.error('Error uploading signature:', error);
      alert('Erreur lors de l\'upload de la signature');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteSignature = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer votre signature ?')) {
      return;
    }

    try {
      const response = await fetch('/api/profile/signature', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });

      if (response.ok) {
        setSignatureUrl(null);
        alert('Signature supprimée avec succès');
      } else {
        throw new Error('Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Error deleting signature:', error);
      alert('Erreur lors de la suppression de la signature');
    }
  };

  const handleTestSignature = () => {
    // Générer un PDF de test avec la signature
    window.open('/api/profile/signature/test', '_blank');
  };

  return (
    <div className="space-y-6">
      {/* État actuel */}
      <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-100 rounded-lg">
            <PenTool className="h-5 w-5 text-gray-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Signature</p>
            <p className="text-sm text-gray-500">
              {signatureUrl ? 'Signature configurée' : 'Aucune signature'}
            </p>
          </div>
        </div>
        <Badge variant={signatureUrl ? "success" : "warning"}>
          {signatureUrl ? "Configurée" : "Non configurée"}
        </Badge>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <Upload className="h-4 w-4 mr-2" />
          {isUploading ? 'Upload en cours...' : 'Uploader une signature'}
        </Button>

        {signatureUrl && (
          <>
            <Button
              variant="outline"
              onClick={() => setShowPreview(!showPreview)}
            >
              <Eye className="h-4 w-4 mr-2" />
              {showPreview ? 'Masquer' : 'Aperçu'}
            </Button>
            
            <Button
              variant="outline"
              onClick={handleTestSignature}
            >
              <PenTool className="h-4 w-4 mr-2" />
              Tester sur PDF
            </Button>
            
            <Button
              variant="outline"
              onClick={handleDeleteSignature}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </Button>
          </>
        )}
      </div>

      {/* Aperçu */}
      {signatureUrl && showPreview && (
        <div className="p-6 border border-gray-200 rounded-lg bg-gray-50">
          <h4 className="font-medium text-gray-900 mb-4">Aperçu de votre signature</h4>
          <div className="flex items-center justify-center p-8 bg-white border border-gray-300 rounded-lg">
            <img
              src={signatureUrl}
              alt="Signature"
              className="max-h-32 max-w-full object-contain"
            />
          </div>
          <p className="text-sm text-gray-500 mt-3 text-center">
            Cette signature sera automatiquement ajoutée aux documents générés
          </p>
        </div>
      )}

      {/* Instructions */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Instructions</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Format accepté : PNG, JPG, JPEG</li>
          <li>• Taille maximale : 5MB</li>
          <li>• Fond transparent recommandé (PNG)</li>
          <li>• Résolution : 300 DPI minimum</li>
          <li>• Dimensions : 200x100 pixels recommandées</li>
        </ul>
      </div>
    </div>
  );
}
