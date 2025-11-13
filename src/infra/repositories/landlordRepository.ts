import prisma from '../db/client';

export interface Landlord {
  id: number;
  fullName: string;
  address1: string;
  address2?: string | null;
  postalCode: string;
  city: string;
  email: string;
  phone?: string | null;
  siret?: string | null;
  iban?: string | null;
  bic?: string | null;
  signatureUrl?: string | null;
  updatedAt: Date;
}

export const landlordRepository = {
  async get(): Promise<Landlord> {
    let landlord = await prisma.landlord.findUnique({
      where: { id: 1 },
    });
    
    if (!landlord) {
      // Créer le landlord par défaut s'il n'existe pas
      landlord = await prisma.landlord.create({
        data: {
          id: 1,
          fullName: '',
          address1: '',
          postalCode: '',
          city: '',
          email: '',
        },
      });
    }
    
    return landlord as Landlord;
  },

  async update(data: Partial<Omit<Landlord, 'id' | 'updatedAt'>>): Promise<Landlord> {
    return prisma.landlord.update({
      where: { id: 1 },
      data,
    }) as Promise<Landlord>;
  },

  async getRequiredFields(): Promise<{ field: string; label: string; filled: boolean }[]> {
    const landlord = await this.get();
    const requiredFields = [
      { field: 'fullName', label: 'Nom complet' },
      { field: 'address1', label: 'Adresse' },
      { field: 'postalCode', label: 'Code postal' },
      { field: 'city', label: 'Ville' },
      { field: 'email', label: 'Email' },
    ];
    
    return requiredFields.map(({ field, label }) => ({
      field,
      label,
      filled: !!(landlord as any)[field] && (landlord as any)[field].trim() !== '',
    }));
  },
};

