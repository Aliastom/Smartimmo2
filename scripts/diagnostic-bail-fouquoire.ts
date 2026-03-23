/**
 * Diagnostic ciblé : bail Joel Fouquoire
 *
 * 1. leaseId exact
 * 2. Transaction RECETTE_LOYER avec ce leaseId + accounting_month = 2025-09
 * 3. Montant total reconnu pour septembre 2025
 * 4. Analyse expected vs realized (pourquoi "En retard")
 *
 * Usage : npx tsx scripts/diagnostic-bail-fouquoire.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('═'.repeat(70));
  console.log('DIAGNOSTIC : Bail Joel Fouquoire');
  console.log('═'.repeat(70));

  // 1. Trouver le bail Joel Fouquoire (via Tenant)
  const tenant = await prisma.tenant.findFirst({
    where: {
      OR: [
        { lastName: { contains: 'Fouquoire', mode: 'insensitive' } },
        { firstName: { contains: 'Joel', mode: 'insensitive' }, lastName: { contains: 'Fouquoire', mode: 'insensitive' } },
      ],
    },
    select: { id: true, firstName: true, lastName: true },
  });

  if (!tenant) {
    console.log('\n❌ Locataire "Joel Fouquoire" introuvable.');
    const allTenants = await prisma.tenant.findMany({
      where: { lastName: { contains: 'fouq', mode: 'insensitive' } },
      select: { id: true, firstName: true, lastName: true },
    });
    if (allTenants.length > 0) {
      console.log('  Suggestions:', allTenants.map((t) => `${t.firstName} ${t.lastName} (${t.id})`));
    }
    return;
  }

  const leases = await prisma.lease.findMany({
    where: { tenantId: tenant.id },
    include: {
      Property: { select: { name: true, address: true } },
      Tenant: { select: { firstName: true, lastName: true } },
    },
    orderBy: { startDate: 'desc' },
  });

  if (leases.length === 0) {
    console.log('\n❌ Aucun bail trouvé pour ce locataire.');
    return;
  }

  const lease = leases[0];
  const leaseId = lease.id;

  console.log('\n📋 1. LEASE ID EXACT');
  console.log('─'.repeat(70));
  console.log(`   leaseId : ${leaseId}`);
  console.log(`   Locataire : ${lease.Tenant.firstName} ${lease.Tenant.lastName}`);
  console.log(`   Bien : ${lease.Property.name}`);
  console.log(`   Période : ${lease.startDate.toISOString().slice(0, 10)} → ${lease.endDate?.toISOString().slice(0, 10) ?? '—'}`);
  console.log(`   Loyer HC : ${lease.rentAmount}€`);
  console.log(`   Charges récup : ${lease.chargesRecupMensuelles ?? 0}€`);
  const totalAttendu = lease.rentAmount + (lease.chargesRecupMensuelles ?? 0);
  console.log(`   Total attendu/mois : ${totalAttendu}€`);

  // 2. Transaction RECETTE_LOYER avec ce leaseId + accounting_month = 2025-09
  const txSeptByAcc = await prisma.transaction.findMany({
    where: {
      leaseId,
      accounting_month: '2025-09',
      amount: { gt: 0 },
    },
  });

  const txSeptByNature = await prisma.transaction.findMany({
    where: {
      leaseId,
      accounting_month: '2025-09',
      nature: { in: ['RECETTE_LOYER', 'LOYER'] },
    },
  });

  console.log('\n📋 2. TRANSACTIONS RECETTE_LOYER (leaseId + accounting_month = 2025-09)');
  console.log('─'.repeat(70));
  console.log(`   Transactions avec accounting_month='2025-09' et leaseId : ${txSeptByAcc.length}`);
  console.log(`   Dont nature RECETTE_LOYER/LOYER : ${txSeptByNature.length}`);

  if (txSeptByNature.length > 0) {
    for (const t of txSeptByNature) {
      console.log(`\n   ┌─ ${t.label}`);
      console.log(`   │  id: ${t.id}`);
      console.log(`   │  amount: ${t.amount}€`);
      console.log(`   │  accounting_month: ${t.accounting_month}`);
      console.log(`   │  date: ${t.date.toISOString().slice(0, 10)}`);
      console.log(`   │  nature: ${t.nature}`);
      console.log(`   └─`);
    }
  } else {
    console.log('   ❌ Aucune transaction trouvée.');
  }

  // 3. Montant total reconnu
  const totalRealise = txSeptByNature.reduce((s, t) => s + t.amount, 0);
  console.log('\n📋 3. MONTANT TOTAL RECONNU POUR SEPTEMBRE 2025');
  console.log('─'.repeat(70));
  console.log(`   Total réalisé (Prisma) : ${totalRealise}€`);
  console.log(`   Total attendu : ${totalAttendu}€`);
  console.log(`   Écart : ${(totalRealise - totalAttendu).toFixed(2)}€`);

  // 4. Pourquoi "En retard" ?
  console.log('\n📋 4. ANALYSE : POURQUOI "EN RETARD" ?');
  console.log('─'.repeat(70));

  if (totalRealise >= totalAttendu - 0.01) {
    console.log('   En base Prisma, le mois devrait être PAYÉ (realized >= expected).');
    console.log('   → La timeline lit IndexedDB. Si "En retard" persiste :');
    console.log('     • IndexedDB n\'a pas ces transactions (sync nécessaire)');
    console.log('     • Ou expected en IndexedDB est différent (échéances/fallback)');
  } else {
    console.log(`   En base Prisma : realized (${totalRealise}€) < expected (${totalAttendu}€)`);
    console.log('   → Le mois est correctement affiché "En retard" (montant insuffisant).');
  }

  // 5. Vérification IndexedDB (instruction pour l'utilisateur)
  console.log('\n📋 5. VÉRIFICATION INDEXEDDB (côté navigateur)');
  console.log('─'.repeat(70));
  console.log('   La timeline lit IndexedDB. Pour vérifier si les transactions sont présentes :');
  console.log('   1. Ouvrez /app, affichez le détail du bail Fouquoire');
  console.log('   2. Ajoutez ?diagnostic=1 à l\'URL (ex: /app?view=baux&diagnostic=1)');
  console.log('   3. Le panneau "Diagnostic IndexedDB" s\'affichera sous la table Paiements');
  console.log('   Ou exécutez en console : window.__checkLeaseIdb("' + leaseId + '")');

  // Échéances pour ce bail (pour expected)
  const echeances = await prisma.echeanceRecurrente.findMany({
    where: { leaseId, isActive: true },
    select: { id: true, type: true, montant: true, natureCode: true },
  });
  console.log('\n   Échéances actives sur ce bail :', echeances.length);
  echeances.forEach((e) => {
    const m = typeof e.montant === 'object' ? parseFloat((e.montant as any).toString()) : e.montant;
    console.log(`     - ${e.type} / ${e.natureCode ?? '—'} : ${m}€`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
