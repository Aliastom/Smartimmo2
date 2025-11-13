export type Property = {
  id: string;
  name: string;
  status: 'occupied' | 'vacant';
  // Autres champs optionnels selon votre modèle
  address?: string;
  city?: string;
  type?: string;
};

export type Transaction = {
  id: string;
  propertyId: string;
  date: string; // ISO string
  amount: number;
  kind: 'income' | 'expense';
  // Autres champs optionnels
  description?: string;
  category?: string;
};

export type MonthlyData = {
  income: number;
  expense: number;
  net: number;
};

export type MonthlyNetResult = {
  months: string[];
  monthly: MonthlyData[];
  cumulative: number[];
  totals: MonthlyData;
};

