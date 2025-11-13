'use client';

import React from 'react';
import { PropertyDocumentsUnified } from '@/components/documents/PropertyDocumentsUnified';

interface PropertyDocumentsTabProps {
  property: any;
  documents: any[];
  onUpdate: () => void;
}

export default function PropertyDocumentsTab({ property, documents, onUpdate }: PropertyDocumentsTabProps) {
  return (
    <PropertyDocumentsUnified 
      propertyId={property.id} 
      propertyName={property.name} 
    />
  );
}

