export interface Property {
  id: string;
  name: string;
  type: 'house' | 'apartment' | 'garage' | 'commercial' | 'land';
  address: string;
  postalCode: string;
  city: string;
  surface: number; // m²
  rooms: number;
  acquisitionDate: Date;
  acquisitionPrice: number; // Decimal
  notaryFees: number; // Decimal
  currentValue: number; // Decimal
  status: 'rented' | 'vacant' | 'under_works';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
