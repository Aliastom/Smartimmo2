'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Check, Edit3, Save, X, Menu, Loader2 } from 'lucide-react';
import AddressAutocomplete from '@/components/forms/AddressAutocomplete';
import { useProfileData } from '@/hooks/offline/useProfileData';
import { useSidebarOptional } from '@/contexts/SidebarContext';

interface ProfileData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  company?: string;
  siret?: string;
  signature?: string;
  logo?: string;
}

interface ProfilClientProps {
  initialData?: ProfileData | null;
  mode?: 'normal' | 'app-shell';
}

export default function ProfilClient({ initialData, mode = 'normal' }: ProfilClientProps) {
  // Utiliser le hook unifié en mode app-shell, sinon utiliser l'état local
  const profileHook = mode === 'app-shell' ? useProfileData({ mode, initialData: null }) : null;
  const profileData = mode === 'app-shell' ? profileHook?.profile : initialData;
  const sidebarContext = useSidebarOptional();

  const [profile, setProfile] = useState<ProfileData>({
    firstName: profileData?.firstName || '',
    lastName: profileData?.lastName || '',
    email: profileData?.email || '',
    phone: profileData?.phone || '',
    address: profileData?.address || '',
    city: profileData?.city || '',
    postalCode: profileData?.postalCode || '',
    company: profileData?.company || '',
    siret: profileData?.siret || '',
    signature: profileData?.signature || '',
    logo: profileData?.logo || ''
  });

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSignatureModified, setIsSignatureModified] = useState(false);

  // Synchroniser l'état local avec les données du hook en mode app-shell
  useEffect(() => {
    if (mode === 'app-shell' && profileHook?.profile) {
      setProfile({
        firstName: profileHook.profile.firstName || '',
        lastName: profileHook.profile.lastName || '',
        email: profileHook.profile.email || '',
        phone: profileHook.profile.phone || '',
        address: profileHook.profile.address || '',
        city: profileHook.profile.city || '',
        postalCode: profileHook.profile.postalCode || '',
        company: profileHook.profile.company || '',
        siret: profileHook.profile.siret || '',
        signature: profileHook.profile.signature || '',
        logo: profileHook.profile.logo || ''
      });
    }
  }, [mode, profileHook?.profile]);

  // Initialiser le canvas pour la signature
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Configuration du canvas
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Charger la signature existante si elle existe
    if (profile.signature) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = profile.signature;
    }
  }, [profile.signature]);

  const handleInputChange = (field: keyof ProfileData, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    setIsSignatureModified(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoordinates(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const handleCanvasMouseUp = () => {
    setIsDrawing(false);
  };

  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(true);
    setIsSignatureModified(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleCanvasTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsSignatureModified(true);
  };

  const saveSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const signatureData = canvas.toDataURL('image/png');
    
    // Sauvegarder immédiatement la signature
    try {
      if (mode === 'app-shell' && profileHook) {
        // Utiliser le hook pour sauvegarder
        await profileHook.save({
          ...profile,
          signature: signatureData
        });
        setIsSignatureModified(false);
        alert('Signature sauvegardée avec succès !');
      } else {
        // Mode normal : utiliser l'API
        const response = await fetch('/api/profiles', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...profile,
            signature: signatureData
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erreur lors de la sauvegarde de la signature');
        }

        const result = await response.json();
        
        // Mettre à jour l'état avec les données sauvegardées
        setProfile(result.data);
        setIsSignatureModified(false);
        
        console.log('Signature sauvegardée:', result.data);
        alert('Signature sauvegardée avec succès !');
      }
    } catch (error) {
      console.error('Error saving signature:', error);
      alert(`Erreur lors de la sauvegarde de la signature: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      console.log('Sauvegarde du profil:', profile);
      
      if (mode === 'app-shell' && profileHook) {
        // Utiliser le hook pour sauvegarder
        await profileHook.save(profile);
        setIsEditing(false);
        alert('Profil sauvegardé avec succès !');
      } else {
        // Mode normal : utiliser l'API
        const response = await fetch('/api/profiles', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(profile),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erreur lors de la sauvegarde du profil');
        }

        const result = await response.json();
        console.log('Profil sauvegardé:', result.data);
        
        // Mettre à jour avec les données sauvegardées
        setProfile(result.data);
        setIsEditing(false);
        alert('Profil sauvegardé avec succès !');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      alert(`Erreur lors de la sauvegarde: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Recharger les données originales
    const currentData = mode === 'app-shell' ? profileHook?.profile : initialData;
    if (currentData) {
      setProfile(currentData);
    }
    // Réinitialiser le canvas de signature
    const canvas = canvasRef.current;
    if (canvas && initialData?.signature) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = initialData.signature;
      }
    } else if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setIsSignatureModified(false);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header - même style que Gestion déléguée */}
      <div className="mb-4 sm:mb-6 space-y-3">
        {/* Ligne 1 : Hamburger + Titre + Bouton "Modifier" */}
        <div className="flex items-center justify-between w-full gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {/* Bouton hamburger mobile - Discret, aligné à gauche du titre */}
            {sidebarContext && (
              <button
                onClick={sidebarContext.toggleSidebar}
                className="lg:hidden flex items-center justify-center w-10 h-10 min-w-[40px] min-h-[40px] flex-shrink-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                aria-label={sidebarContext.sidebarOpen ? "Fermer le menu" : "Ouvrir le menu"}
              >
                {sidebarContext.sidebarOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
            )}
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate min-w-0">Mon Profil</h1>
          </div>
          <div className="flex-shrink-0">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="inline-flex items-center justify-center h-8 w-8 text-gray-600 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Annuler"
                  title="Annuler"
                >
                  <X className="h-4 w-4" />
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="inline-flex items-center justify-center h-8 w-8 text-orange-600 border border-orange-200 rounded-lg bg-white hover:bg-gradient-to-r hover:from-orange-500 hover:to-red-500 hover:text-white transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-orange-600"
                  aria-label={isSaving ? "Sauvegarde en cours..." : "Sauvegarder"}
                  title={isSaving ? "Sauvegarde en cours..." : "Sauvegarder"}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center justify-center h-8 w-8 text-orange-600 border border-orange-200 rounded-lg bg-white hover:bg-gradient-to-r hover:from-orange-500 hover:to-red-500 hover:text-white transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                aria-label="Modifier le profil"
                title="Modifier le profil"
              >
                <Edit3 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        
        {/* Ligne 2 : Description */}
        <p className="text-sm sm:text-base text-gray-600">Gérez vos informations personnelles et votre signature</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Informations personnelles */}
        <Card>
          <CardHeader>
            <CardTitle>Informations Personnelles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">Prénom</Label>
                <Input
                  id="firstName"
                  value={profile.firstName || ''}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  disabled={!isEditing}
                  placeholder="Votre prénom"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Nom</Label>
                <Input
                  id="lastName"
                  value={profile.lastName || ''}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  disabled={!isEditing}
                  placeholder="Votre nom"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={profile.email || ''}
                onChange={(e) => handleInputChange('email', e.target.value)}
                disabled={!isEditing}
                placeholder="votre@email.com"
              />
            </div>
            <div>
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                value={profile.phone || ''}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                disabled={!isEditing}
                placeholder="+33 1 23 45 67 89"
              />
            </div>
            <div>
              <Label htmlFor="address">Adresse</Label>
              {isEditing ? (
                <AddressAutocomplete
                  initialValue={profile.address || ''}
                  onAddressSelect={(address) => {
                    handleInputChange('address', address.street);
                    handleInputChange('postalCode', address.postcode);
                    handleInputChange('city', address.city);
                  }}
                  placeholder="123 Rue de la République, Paris"
                  className="w-full"
                />
              ) : (
                <Input
                  id="address"
                  value={profile.address || ''}
                  disabled
                  placeholder="123 Rue de la République"
                />
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="postalCode">Code Postal</Label>
                <Input
                  id="postalCode"
                  value={profile.postalCode || ''}
                  onChange={(e) => handleInputChange('postalCode', e.target.value)}
                  disabled={!isEditing}
                  placeholder="75001"
                />
              </div>
              <div>
                <Label htmlFor="city">Ville</Label>
                <Input
                  id="city"
                  value={profile.city || ''}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  disabled={!isEditing}
                  placeholder="Paris"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Informations professionnelles */}
        <Card>
          <CardHeader>
            <CardTitle>Informations Professionnelles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="company">Entreprise</Label>
              <Input
                id="company"
                value={profile.company || ''}
                onChange={(e) => handleInputChange('company', e.target.value)}
                disabled={!isEditing}
                placeholder="Nom de votre entreprise"
              />
            </div>
            <div>
              <Label htmlFor="siret">SIRET</Label>
              <Input
                id="siret"
                value={profile.siret || ''}
                onChange={(e) => handleInputChange('siret', e.target.value)}
                disabled={!isEditing}
                placeholder="12345678901234"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Signature */}
      <Card>
        <CardHeader>
          <CardTitle>Signature Électronique</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border border-gray-300 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">Zone de signature</h4>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSignature}
                >
                  Effacer
                </Button>
                <Button
                  size="sm"
                  onClick={saveSignature}
                  disabled={!isSignatureModified && !profile.signature}
                >
                  <Check className="h-4 w-4 mr-1" />
                  {isSignatureModified ? 'Sauvegarder' : 'Sauvegardé'}
                </Button>
              </div>
            </div>
            
            <canvas
              ref={canvasRef}
              width={600}
              height={200}
              className="border border-gray-200 rounded-md cursor-crosshair w-full"
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              onTouchStart={handleCanvasTouchStart}
              onTouchMove={handleCanvasTouchMove}
              onTouchEnd={handleCanvasTouchEnd}
              style={{ touchAction: 'none' }}
            />
            
            <p className="text-sm text-gray-500 mt-2">
              Signez dans la zone ci-dessus. Votre signature sera automatiquement intégrée dans les baux et documents générés.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}