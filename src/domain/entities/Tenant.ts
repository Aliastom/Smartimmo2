export interface Tenant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  birthDate?: Date;
  nationality?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
