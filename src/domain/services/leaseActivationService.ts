import { prisma } from '@/lib/prisma';

/**
 * Active automatiquement les baux signés dont la date de début est dépassée
 * @returns Nombre de baux activés
 */
export async function autoActivateLeases(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const leasesToActivate = await prisma.lease.findMany({
    where: {
      status: 'SIGNÉ',
      startDate: {
        lte: today
      }
    },
    select: {
      id: true,
      propertyId: true
    }
  });

  if (leasesToActivate.length === 0) {
    return 0;
  }

  // Activer les baux
  await prisma.lease.updateMany({
    where: {
      id: {
        in: leasesToActivate.map(l => l.id)
      }
    },
    data: {
      status: 'ACTIF'
    }
  });

  // Mettre à jour le statut des propriétés en mode AUTO
  const propertyIds = [...new Set(leasesToActivate.map(l => l.propertyId))];
  
  for (const propertyId of propertyIds) {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { statusMode: true, occupation: true }
    });

    if (property && property.statusMode === 'AUTO' && property.occupation === 'LOCATIF') {
      await prisma.property.update({
        where: { id: propertyId },
        data: { status: 'rented' }
      });
    }
  }

  return leasesToActivate.length;
}

/**
 * Active un bail spécifique s'il remplit les conditions
 */
export async function activateLease(leaseId: string): Promise<boolean> {
  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    select: {
      status: true,
      startDate: true,
      propertyId: true,
      Property: {
        select: {
          statusMode: true,
          occupation: true
        }
      }
    }
  });

  if (!lease) {
    throw new Error(`Lease ${leaseId} not found`);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Activer seulement si SIGNÉ et date de début <= aujourd'hui
  if (lease.status === 'SIGNÉ' && lease.startDate <= today) {
    await prisma.lease.update({
      where: { id: leaseId },
      data: { status: 'ACTIF' }
    });

    // Mettre à jour le statut de la propriété si en mode AUTO
    if (lease.Property.statusMode === 'AUTO' && lease.Property.occupation === 'LOCATIF') {
      await prisma.property.update({
        where: { id: lease.propertyId },
        data: { status: 'rented' }
      });
    }

    return true;
  }

  return false;
}

