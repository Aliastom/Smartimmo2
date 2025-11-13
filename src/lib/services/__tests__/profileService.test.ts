import { validateProfileForLeaseSignature, ProfileData } from '../profileService';

describe('validateProfileForLeaseSignature', () => {
  const completeProfile: ProfileData = {
    firstName: 'Jean',
    lastName: 'Dupont',
    email: 'jean.dupont@example.com',
    address: '123 Rue de la République',
    signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    phone: '+33 1 23 45 67 89',
    city: 'Paris',
    postalCode: '75001',
    company: 'Test Company',
    siret: '12345678901234',
    logo: undefined
  };

  it('should validate a complete profile', () => {
    const result = validateProfileForLeaseSignature(completeProfile);
    expect(result.isValid).toBe(true);
    expect(result.missingFields).toEqual([]);
    expect(result.message).toBe('');
  });

  it('should detect missing first name', () => {
    const profile = { ...completeProfile, firstName: '' };
    const result = validateProfileForLeaseSignature(profile);
    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain('Prénom');
  });

  it('should detect missing last name', () => {
    const profile = { ...completeProfile, lastName: '' };
    const result = validateProfileForLeaseSignature(profile);
    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain('Nom');
  });

  it('should detect missing email', () => {
    const profile = { ...completeProfile, email: '' };
    const result = validateProfileForLeaseSignature(profile);
    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain('Email');
  });

  it('should detect invalid email format', () => {
    const profile = { ...completeProfile, email: 'invalid-email' };
    const result = validateProfileForLeaseSignature(profile);
    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain('Email (format invalide)');
  });

  it('should detect missing address', () => {
    const profile = { ...completeProfile, address: '' };
    const result = validateProfileForLeaseSignature(profile);
    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain('Adresse');
  });

  it('should detect missing signature', () => {
    const profile = { ...completeProfile, signature: '' };
    const result = validateProfileForLeaseSignature(profile);
    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain('Signature');
  });

  it('should detect multiple missing fields', () => {
    const profile = { ...completeProfile, firstName: '', lastName: '', email: '' };
    const result = validateProfileForLeaseSignature(profile);
    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain('Prénom');
    expect(result.missingFields).toContain('Nom');
    expect(result.missingFields).toContain('Email');
    expect(result.missingFields.length).toBe(3);
  });

  it('should generate appropriate message for single missing field', () => {
    const profile = { ...completeProfile, firstName: '' };
    const result = validateProfileForLeaseSignature(profile);
    expect(result.message).toContain('Le champ "Prénom" est manquant');
    expect(result.message).toContain('Veuillez compléter votre profil');
  });

  it('should generate appropriate message for multiple missing fields', () => {
    const profile = { ...completeProfile, firstName: '', lastName: '' };
    const result = validateProfileForLeaseSignature(profile);
    expect(result.message).toContain('Les champs suivants sont manquants');
    expect(result.message).toContain('Prénom, Nom');
    expect(result.message).toContain('Veuillez compléter votre profil');
  });
});
