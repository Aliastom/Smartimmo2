'use client';

import React, { useState } from 'react';
import { Edit, Save, X, MapPin, Home, Ruler, Calendar, Euro, TrendingUp } from 'lucide-react';
import { Property } from '../../domain/entities/Property';
import { useToast } from '../../hooks/useToast';
import { useRouter } from 'next/navigation';

interface PropertyInfoTabProps {
  property: Property;
  onUpdate: () => void;
}

export default function PropertyInfoTab({ property, onUpdate }: PropertyInfoTabProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedProperty, setEditedProperty] = useState(property);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showSuccess, showError } = useToast();
  const router = useRouter();

  // Mettre à jour editedProperty quand property change
  React.useEffect(() => {
    setEditedProperty(property);
  }, [property]);

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const updateData = {
        name: editedProperty.name,
        type: editedProperty.type,
        address: editedProperty.address,
        postalCode: editedProperty.postalCode,
        city: editedProperty.city,
        surface: editedProperty.surface,
        rooms: editedProperty.rooms,
        status: editedProperty.status,
        statusMode: editedProperty.statusMode,
        statusManual: editedProperty.statusManual,
        occupation: editedProperty.occupation,
        exitFeesRate: editedProperty.exitFeesRate,
        evalSource: editedProperty.evalSource,
        evalDate: editedProperty.evalDate ? new Date(editedProperty.evalDate).toISOString() : null,
        notes: editedProperty.notes,
        currentValue: editedProperty.currentValue,
        acquisitionPrice: editedProperty.acquisitionPrice,
        notaryFees: editedProperty.notaryFees,
        acquisitionDate: editedProperty.acquisitionDate ? new Date(editedProperty.acquisitionDate).toISOString() : null,
      };

      const response = await fetch(`/api/properties/${property.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        showSuccess('Bien sauvegardé', 'Les informations du bien ont été mises à jour avec succès');
        setIsEditing(false);
        onUpdate();
        router.refresh();
      } else {
        showError('Erreur', 'Erreur lors de la sauvegarde du bien');
      }
    } catch (error) {
      console.error('Error saving property:', error);
      showError('Erreur', 'Une erreur inattendue est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setEditedProperty(property);
    setIsEditing(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'Non renseigné';
    try {
      return new Date(date).toLocaleDateString('fr-FR');
    } catch {
      return 'Date invalide';
    }
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-neutral-900">Informations générales</h3>
        <div className="flex space-x-2">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                disabled={isSubmitting}
                className="flex items-center space-x-2 px-3 py-2 bg-primary text-base-100 rounded-md hover:bg-primary transition disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>{isSubmitting ? 'Sauvegarde...' : 'Sauvegarder'}</span>
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center space-x-2 px-3 py-2 bg-base-content text-base-100 rounded-md hover:bg-base-content/80 transition"
              >
                <X className="h-4 w-4" />
                <span>Annuler</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center space-x-2 px-3 py-2 bg-primary text-base-100 rounded-md hover:bg-primary transition"
            >
              <Edit className="h-4 w-4" />
              <span>Modifier</span>
            </button>
          )}
        </div>
      </div>

      {/* General Information */}
      <div className="bg-base-100 border border-neutral-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-neutral-900 mb-4 flex items-center">
          <Home className="h-5 w-5 mr-2" />
          Général
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Nom du bien</label>
            {isEditing ? (
              <input
                type="text"
                value={editedProperty.name}
                onChange={(e) => setEditedProperty({ ...editedProperty, name: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
              />
            ) : (
              <p className="text-neutral-900">{property.name}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Type</label>
            {isEditing ? (
              <select
                value={editedProperty.type}
                onChange={(e) => setEditedProperty({ ...editedProperty, type: e.target.value as 'house' | 'apartment' | 'garage' | 'commercial' | 'land' })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
              >
                <option value="house">Maison</option>
                <option value="apartment">Appartement</option>
                <option value="garage">Garage</option>
                <option value="commercial">Commercial</option>
                <option value="land">Terrain</option>
              </select>
            ) : (
              <p className="text-neutral-900">{property.type}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Surface (m²)</label>
            {isEditing ? (
              <input
                type="number"
                value={editedProperty.surface}
                onChange={(e) => setEditedProperty({ ...editedProperty, surface: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
              />
            ) : (
              <p className="text-neutral-900">{property.surface} m²</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Nombre de pièces</label>
            {isEditing ? (
              <input
                type="number"
                value={editedProperty.rooms}
                onChange={(e) => setEditedProperty({ ...editedProperty, rooms: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
              />
            ) : (
              <p className="text-neutral-900">{property.rooms}</p>
            )}
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-neutral-700 mb-1 flex items-center">
              <MapPin className="h-4 w-4 mr-1" />
              Adresse
            </label>
            {isEditing ? (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Adresse"
                  value={editedProperty.address}
                  onChange={(e) => setEditedProperty({ ...editedProperty, address: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Code postal"
                    value={editedProperty.postalCode}
                    onChange={(e) => setEditedProperty({ ...editedProperty, postalCode: e.target.value })}
                    className="px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
                  />
                  <input
                    type="text"
                    placeholder="Ville"
                    value={editedProperty.city}
                    onChange={(e) => setEditedProperty({ ...editedProperty, city: e.target.value })}
                    className="px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
                  />
                </div>
              </div>
            ) : (
              <p className="text-neutral-900">{property.address}, {property.postalCode} {property.city}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Type d'occupation</label>
            {isEditing ? (
              <select
                value={editedProperty.occupation || 'VACANT'}
                onChange={(e) => setEditedProperty({ ...editedProperty, occupation: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
              >
                <option value="PRINCIPALE">Résidence principale</option>
                <option value="SECONDAIRE">Résidence secondaire</option>
                <option value="LOCATIF">Locatif</option>
                <option value="VACANT">Vacant</option>
                <option value="USAGE_PRO">Usage professionnel</option>
                <option value="AUTRE">Autre</option>
              </select>
            ) : (
              <p className="text-neutral-900">{property.occupation || 'VACANT'}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Mode de statut</label>
            {isEditing ? (
              <select
                value={editedProperty.statusMode || 'AUTO'}
                onChange={(e) => setEditedProperty({ ...editedProperty, statusMode: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
              >
                <option value="AUTO">Automatique (recommandé)</option>
                <option value="MANUAL">Manuel</option>
              </select>
            ) : (
              <p className="text-neutral-900">{property.statusMode === 'MANUAL' ? 'Manuel' : 'Automatique'}</p>
            )}
          </div>
          {isEditing && editedProperty.statusMode === 'MANUAL' && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Statut (manuel)</label>
              <select
                value={editedProperty.statusManual || editedProperty.status}
                onChange={(e) => setEditedProperty({ ...editedProperty, statusManual: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
              >
                <option value="rented">Loué</option>
                <option value="vacant">Vacant</option>
                <option value="under_works">En travaux</option>
                <option value="occupied_owner">Occupé par le propriétaire</option>
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Taux frais de sortie</label>
            {isEditing ? (
              <input
                type="number"
                step="0.001"
                min="0"
                max="1"
                placeholder="0.07"
                value={editedProperty.exitFeesRate || ''}
                onChange={(e) => setEditedProperty({ ...editedProperty, exitFeesRate: e.target.value ? parseFloat(e.target.value) : null })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
              />
            ) : (
              <p className="text-neutral-900">{property.exitFeesRate ? `${(property.exitFeesRate * 100).toFixed(1)}%` : 'Par défaut (7%)'}</p>
            )}
          </div>
        </div>
      </div>

      {/* Financial Information */}
      <div className="bg-base-100 border border-neutral-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-neutral-900 mb-4 flex items-center">
          <Euro className="h-5 w-5 mr-2" />
          Finances
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Valeur actuelle</label>
            {isEditing ? (
              <div className="flex space-x-2">
                <input
                  type="number"
                  value={editedProperty.currentValue}
                  onChange={(e) => setEditedProperty({ ...editedProperty, currentValue: parseFloat(e.target.value) })}
                  className="flex-1 px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
                />
                <button className="px-3 py-2 bg-base-200 text-base-content opacity-90 rounded-md hover:bg-base-200 transition">
                  Estimer
                </button>
              </div>
            ) : (
              <p className="text-neutral-900">{formatCurrency(property.currentValue)}</p>
            )}
          </div>
        </div>
      </div>

      {/* Acquisition Information */}
      <div className="bg-base-100 border border-neutral-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-neutral-900 mb-4 flex items-center">
          <Calendar className="h-5 w-5 mr-2" />
          Acquisition
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Date d'acquisition</label>
            {isEditing ? (
              <input
                type="date"
                value={editedProperty.acquisitionDate ? new Date(editedProperty.acquisitionDate).toISOString().split('T')[0] : ''}
                onChange={(e) => setEditedProperty({ ...editedProperty, acquisitionDate: e.target.value ? new Date(e.target.value) : null })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
              />
            ) : (
              <p className="text-neutral-900">{formatDate(property.acquisitionDate)}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Prix d'acquisition</label>
            {isEditing ? (
              <input
                type="number"
                value={editedProperty.acquisitionPrice}
                onChange={(e) => setEditedProperty({ ...editedProperty, acquisitionPrice: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
              />
            ) : (
              <p className="text-neutral-900">{formatCurrency(property.acquisitionPrice)}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Frais de notaire</label>
            {isEditing ? (
              <input
                type="number"
                value={editedProperty.notaryFees}
                onChange={(e) => setEditedProperty({ ...editedProperty, notaryFees: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
              />
            ) : (
              <p className="text-neutral-900">{formatCurrency(property.notaryFees)}</p>
            )}
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-base-100 border border-neutral-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-neutral-900 mb-4">Notes</h4>
        {isEditing ? (
          <textarea
            value={editedProperty.notes || ''}
            onChange={(e) => setEditedProperty({ ...editedProperty, notes: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-blue-500 focus:border-primary"
            placeholder="Ajoutez des notes sur ce bien..."
          />
        ) : (
          <p className="text-neutral-900">{property.notes || 'Aucune note'}</p>
        )}
      </div>
    </div>
  );
}
