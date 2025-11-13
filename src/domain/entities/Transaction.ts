export interface Transaction {
  id: string;
  propertyId: string;
  leaseId?: string; // Optional, for owner expenses
  categoryId?: string;
  label: string;
  amount: number; // Decimal
  date: Date;
  month?: number;
  year?: number;
  isRecurring?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
