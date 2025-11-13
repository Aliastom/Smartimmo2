export type TransactionType = 'income' | 'expense' | 'financial' | 'other';

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  isDeductible: boolean;
  isCapitalizable: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
