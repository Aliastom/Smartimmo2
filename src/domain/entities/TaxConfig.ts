export interface TaxConfig {
  id: string;
  year: number;
  json: string; // Stored as string for SQLite
  createdAt: Date;
  updatedAt: Date;
}
