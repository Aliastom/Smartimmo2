'use client';

import React, { useState, useEffect } from 'react';
import { Property } from '../../domain/entities/Property';
import { Document } from '../../domain/entities/Document';
import { Upload, Trash2, X } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import PhotoStatsCards from '../components/stats/PhotoStatsCards';
import { usePhotos, useCreatePhoto, useDeletePhoto } from '../hooks/useDocuments';

interface PropertyPhotosClientProps {
  property: Property;
}

export default function PropertyPhotosClient({ property }: PropertyPhotosClientProps) {
  const { addToast } = useToast();
  const [selectedPhoto, setSelectedPhoto] = useState<Document | null>(null);
  
  // Utiliser les hooks React Query
  const { data: photos = [], isLoading: loading, refetch } = usePhotos(property.id);
  const createPhoto = useCreatePhoto();
  const deletePhoto = useDeletePhoto();

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('propertyId', property.id);
        formData.append('docType', 'photo');
        formData.append('title', file.name);

        await createPhoto.mutateAsync(formData);
      }
    } catch (error) {
      console.error('Error uploading photos:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Confirmer la suppression de cette photo ?')) return;

    try {
      await deletePhoto.mutateAsync(id);
      setSelectedPhoto(null);
    } catch (error) {
      console.error('Error deleting photo:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold text-neutral-900">Photos</h3>
          <p className="text-neutral-600 mt-1">
            {photos.length} photo{photos.length > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <PhotoStatsCards propertyId={property.id} />

      {/* Upload zone */}
      <div className="bg-base-100 rounded-lg shadow-card p-6">
        <div className="border-2 border-dashed border-neutral-300 rounded-lg p-8 text-center hover:border-primary-500 transition-colors">
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => handleUpload(e.target.files)}
            className="hidden"
            id="photo-upload"
          />
          <label htmlFor="photo-upload" className="cursor-pointer">
            <Upload size={48} className="mx-auto text-neutral-400 mb-4" />
            <p className="text-lg font-medium text-neutral-900 mb-2">
              Déposer des photos ici ou cliquer pour sélectionner
            </p>
            <p className="text-sm text-neutral-600">
              JPG, PNG, GIF (max 10 MB par fichier)
            </p>
          </label>
        </div>
      </div>

      {/* Galerie */}
      <div className="bg-base-100 rounded-lg shadow-card p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">
          Galerie ({photos.length})
        </h3>
        {loading ? (
          <p className="text-neutral-500">Chargement...</p>
        ) : photos.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="relative group cursor-pointer rounded-lg overflow-hidden border border-neutral-200 hover:border-primary-500 transition-colors"
                onClick={() => setSelectedPhoto(photo)}
              >
                <img
                  src={photo.url}
                  alt={photo.title}
                  className="w-full h-48 object-cover"
                />
                <div className="absolute inset-0 bg-base-content bg-opacity-0 group-hover:bg-opacity-40 transition-opacity flex items-center justify-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(photo.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-base-100 bg-error p-2 rounded-full"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-neutral-500">Aucune photo</p>
        )}
      </div>

      {/* Modal de visualisation */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-base-content bg-opacity-90 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            onClick={() => setSelectedPhoto(null)}
            className="absolute top-4 right-4 text-base-100 bg-neutral-800 p-2 rounded-full hover:bg-neutral-700 transition-colors"
          >
            <X size={24} />
          </button>
          <img
            src={selectedPhoto.url}
            alt={selectedPhoto.title}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

