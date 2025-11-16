/**
 * Service pour la suppression sécurisée d'utilisateurs
 * Gère la logique de suppression avec vérifications multi-tenant
 */

import { prisma } from '@/lib/prisma';

export interface DeleteUserResult {
  success: boolean;
  message: string;
}

/**
 * Supprime un utilisateur de manière sécurisée
 * - Vérifie que l'utilisateur ne se supprime pas lui-même
 * - Vérifie qu'aucun autre utilisateur ne partage la même organisation (chaque utilisateur a sa propre org isolée)
 * - Supprime TOUTES les données métier de l'organisation (biens, transactions, documents, échéances, prêts, etc.)
 * - Supprime les sessions et comptes associés
 * - Supprime l'organisation elle-même
 * - CONSERVE les données admin partagées (catégories, types de documents, natures, configs fiscales, paramètres admin)
 * 
 * IMPORTANT : Dans ce système multi-tenant, chaque utilisateur a sa propre organisation isolée.
 * Lors de la suppression d'un utilisateur, toutes ses données métier sont supprimées, mais les données admin partagées restent intactes.
 */
export async function deleteUserSafely(
  userIdToDelete: string,
  currentAdminId: string
): Promise<DeleteUserResult> {
  // Ne pas permettre de se supprimer soi-même
  if (userIdToDelete === currentAdminId) {
    throw new Error('Vous ne pouvez pas supprimer votre propre compte');
  }

  // Récupérer l'utilisateur à supprimer avec son organisation
  const userToDelete = await prisma.user.findUnique({
    where: { id: userIdToDelete },
    select: {
      id: true,
      email: true,
      name: true,
      organizationId: true,
      role: true,
      supabaseId: true,
    },
  });

  if (!userToDelete) {
    throw new Error('Utilisateur non trouvé');
  }

  // Vérifier si l'utilisateur est le propriétaire de son organisation
  const organization = await prisma.organization.findUnique({
    where: { id: userToDelete.organizationId },
    select: {
      id: true,
      name: true,
      ownerUserId: true,
    },
  });

  if (!organization) {
    throw new Error('Organisation non trouvée');
  }

  const organizationId = userToDelete.organizationId;

  // IMPORTANT : Chaque utilisateur a sa propre organisation isolée
  // On vérifie qu'aucun autre utilisateur n'est dans cette organisation
  const otherUsersCount = await prisma.user.count({
    where: {
      organizationId,
      id: { not: userIdToDelete },
    },
  });

  if (otherUsersCount > 0) {
    // Si d'autres utilisateurs sont dans la même organisation, c'est une erreur de configuration
    // Dans un système multi-tenant isolé, chaque utilisateur doit avoir sa propre organisation
    console.warn(`[Delete User] ⚠️ ATTENTION : ${otherUsersCount} autre(s) utilisateur(s) dans l'organisation ${organization.name}`);
    console.warn(`[Delete User] ⚠️ Ces utilisateurs ne devraient PAS partager la même organisation !`);
    // On continue quand même la suppression, mais on log un avertissement
  }
  
  console.log(`[Delete User] 🗑️ Suppression de toutes les données métier de l'organisation ${organization.name}...`);

  // IMPORTANT : Supprimer toutes les données métier de l'organisation
  // Ordre important : respecter les foreign keys (enfants avant parents)
  
  // 1. Documents et leurs relations (enfants)
  console.log(`[Delete User] 📄 Suppression des documents...`);
  const docsDeleted = await prisma.document.deleteMany({
    where: { organizationId },
  });
  console.log(`   ✅ ${docsDeleted.count} document(s) supprimé(s)`);

  // 2. Upload sessions et staged items
  console.log(`[Delete User] 📤 Suppression des sessions d'upload...`);
  const uploadSessionsDeleted = await prisma.uploadSession.deleteMany({
    where: { organizationId },
  });
  const uploadItemsDeleted = await prisma.uploadStagedItem.deleteMany({
    where: { organizationId },
  });
  console.log(`   ✅ ${uploadSessionsDeleted.count} session(s) et ${uploadItemsDeleted.count} item(s) supprimé(s)`);

  // 3. Transactions (peuvent être liées à des documents, baux, etc.)
  console.log(`[Delete User] 💰 Suppression des transactions...`);
  const transDeleted = await prisma.transaction.deleteMany({
    where: { organizationId },
  });
  console.log(`   ✅ ${transDeleted.count} transaction(s) supprimée(s)`);

  // 4. Payments
  console.log(`[Delete User] 💳 Suppression des paiements...`);
  const paymentsDeleted = await prisma.payment.deleteMany({
    where: { organizationId },
  });
  console.log(`   ✅ ${paymentsDeleted.count} paiement(s) supprimé(s)`);

  // 5. Photos
  console.log(`[Delete User] 📸 Suppression des photos...`);
  const photosDeleted = await prisma.photo.deleteMany({
    where: { organizationId },
  });
  console.log(`   ✅ ${photosDeleted.count} photo(s) supprimée(s)`);

  // 6. Échéances récurrentes
  console.log(`[Delete User] 📅 Suppression des échéances récurrentes...`);
  const echeancesDeleted = await prisma.echeanceRecurrente.deleteMany({
    where: { organizationId },
  });
  console.log(`   ✅ ${echeancesDeleted.count} échéance(s) supprimée(s)`);

  // 7. Reminders (rappel)
  console.log(`[Delete User] 🔔 Suppression des rappels...`);
  const remindersDeleted = await prisma.reminder.deleteMany({
    where: { organizationId },
  });
  console.log(`   ✅ ${remindersDeleted.count} rappel(s) supprimé(s)`);

  // 8. Baux (peuvent référencer des biens, locataires)
  console.log(`[Delete User] 📜 Suppression des baux...`);
  const leasesDeleted = await prisma.lease.deleteMany({
    where: { organizationId },
  });
  console.log(`   ✅ ${leasesDeleted.count} bail/baux supprimé(s)`);

  // 9. Prêts
  console.log(`[Delete User] 🏦 Suppression des prêts...`);
  const loansDeleted = await prisma.loan.deleteMany({
    where: { organizationId },
  });
  console.log(`   ✅ ${loansDeleted.count} prêt(s) supprimé(s)`);

  // 10. Historique d'occupation
  console.log(`[Delete User] 📊 Suppression de l'historique d'occupation...`);
  const occupancyDeleted = await prisma.occupancyHistory.deleteMany({
    where: { 
      Property: {
        organizationId,
      },
    },
  });
  console.log(`   ✅ ${occupancyDeleted.count} entrée(s) d'historique supprimée(s)`);

  // 11. Biens (propriétés)
  console.log(`[Delete User] 🏠 Suppression des biens...`);
  const propertiesDeleted = await prisma.property.deleteMany({
    where: { organizationId },
  });
  console.log(`   ✅ ${propertiesDeleted.count} bien(s) supprimé(s)`);

  // 12. Locataires
  console.log(`[Delete User] 👤 Suppression des locataires...`);
  const tenantsDeleted = await prisma.tenant.deleteMany({
    where: { organizationId },
  });
  console.log(`   ✅ ${tenantsDeleted.count} locataire(s) supprimé(s)`);

  // 13. Simulations fiscales
  console.log(`[Delete User] 📊 Suppression des simulations fiscales...`);
  const simulationsDeleted = await prisma.fiscalSimulation.deleteMany({
    where: { organizationId },
  });
  console.log(`   ✅ ${simulationsDeleted.count} simulation(s) supprimée(s)`);

  // 14. Supprimer les sessions et comptes Supabase (Account et Session)
  console.log(`[Delete User] 🔐 Suppression des sessions et comptes...`);
  await prisma.session.deleteMany({
    where: { userId: userIdToDelete },
  });

  await prisma.account.deleteMany({
    where: { userId: userIdToDelete },
  });

  // 15. Supprimer l'utilisateur
  console.log(`[Delete User] 👤 Suppression de l'utilisateur...`);
  await prisma.user.delete({
    where: { id: userIdToDelete },
  });

  // 16. Supprimer l'organisation (elle devient inutile)
  console.log(`[Delete User] 🏢 Suppression de l'organisation...`);
  await prisma.organization.delete({
    where: { id: organizationId },
  });

  console.log(`[Delete User] ✅ Utilisateur ${userToDelete.email} et toutes ses données supprimés`);
  console.log(`[Delete User] ✅ DONNÉES CONSERVÉES : Catégories, Types de documents, Natures, Configs fiscales, Paramètres admin`);

  return {
    success: true,
    message: `Utilisateur ${userToDelete.email} supprimé avec succès`,
  };
}

