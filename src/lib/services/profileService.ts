// Service pour gérer les données de profil
// Pour l'instant, retourne des données par défaut
// Plus tard, on pourra lier à une vraie base de données

export interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  company?: string;
  siret?: string;
  signature?: string; // Base64 de la signature
  logo?: string; // URL du logo
}

export async function getProfileData(organizationId?: string): Promise<ProfileData> {
  try {
    // Récupérer depuis la base de données
    const { prisma } = await import('@/lib/prisma');
    const { getCurrentUser } = await import('@/lib/auth/getCurrentUser');
    
    // Si organizationId n'est pas fourni, le récupérer de l'utilisateur connecté
    let orgId = organizationId;
    if (!orgId) {
      const user = await getCurrentUser();
      if (user) {
        orgId = user.organizationId;
      }
    }
    
    const profile = await prisma.userProfile.findFirst({
      where: orgId ? { organizationId: orgId } : undefined,
    });
    
    if (profile) {
      return {
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phone: profile.phone || undefined,
        address: profile.address || undefined,
        city: profile.city || undefined,
        postalCode: profile.postalCode || undefined,
        company: profile.company || undefined,
        siret: profile.siret || undefined,
        signature: profile.signature || undefined,
        logo: profile.logo || undefined
      };
    }
  } catch (error) {
    console.error('Erreur lors de la récupération du profil:', error);
  }
  
  // Fallback si pas de profil en base
  return {
    firstName: 'Jean',
    lastName: 'Dupont',
    email: 'jean.dupont@smartimmo.fr',
    phone: '+33 1 23 45 67 89',
    address: '123 Rue de la République, 75001 Paris',
    company: 'Smartimmo',
    siret: '12345678901234',
    signature: undefined,
    logo: undefined
  };
}

export async function saveProfileData(profile: ProfileData): Promise<void> {
  // Pour l'instant, simuler la sauvegarde
  // Plus tard, sauvegarder dans la base de données
  console.log('Saving profile data:', profile);
  
  // Simuler un délai de sauvegarde
  await new Promise(resolve => setTimeout(resolve, 1000));
}

export interface ProfileValidationResult {
  isValid: boolean;
  missingFields: string[];
  message: string;
}

export function validateProfileForLeaseSignature(profile: ProfileData): ProfileValidationResult {
  const missingFields: string[] = [];
  
  // Vérifier les champs obligatoires
  if (!profile.firstName || profile.firstName.trim() === '') {
    missingFields.push('Prénom');
  }
  
  if (!profile.lastName || profile.lastName.trim() === '') {
    missingFields.push('Nom');
  }
  
  if (!profile.email || profile.email.trim() === '') {
    missingFields.push('Email');
  } else {
    // Vérifier que l'email est valide
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(profile.email.trim())) {
      missingFields.push('Email (format invalide)');
    }
  }
  
  if (!profile.address || profile.address.trim() === '') {
    missingFields.push('Adresse');
  }
  
  if (!profile.signature || profile.signature.trim() === '') {
    missingFields.push('Signature');
  }
  
  const isValid = missingFields.length === 0;
  
  let message = '';
  if (!isValid) {
    if (missingFields.length === 1) {
      message = `Le champ "${missingFields[0]}" est manquant dans votre profil.`;
    } else {
      message = `Les champs suivants sont manquants dans votre profil : ${missingFields.join(', ')}.`;
    }
    message += ' Veuillez compléter votre profil avant d\'envoyer le bail pour signature.';
  }
  
  return {
    isValid,
    missingFields,
    message
  };
}