'use client';

import React from 'react';
import { PropertyDocumentsUnified } from './PropertyDocumentsUnified';

interface PropertyDocumentsTabProps {
  propertyId: string;
  propertyName: string;
}

export function PropertyDocumentsTab({ propertyId, propertyName }: PropertyDocumentsTabProps) {
  return (
    <PropertyDocumentsUnified 
      propertyId={propertyId} 
      propertyName={propertyName} 
    />
  );
}