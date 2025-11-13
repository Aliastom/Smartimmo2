export interface Photo {
  id: string;
  fileName: string;
  mime: string;
  url: string;
  size: number;
  propertyId: string;
  room?: string;
  tag?: string;
  metadata?: string;
  createdAt: string;
  updatedAt: string;
  
  // Relations
  property?: {
    id: string;
    name: string;
  };
}

export interface PhotoFilters {
  propertyId?: string;
  room?: string;
  tag?: string;
  q?: string; // search query
}

export interface PhotoUploadData {
  propertyId: string;
  room?: string;
  tag?: string;
  file: {
    name: string;
    mime: string;
    size: number;
    base64: string;
  };
  metadata?: Record<string, any>;
}

