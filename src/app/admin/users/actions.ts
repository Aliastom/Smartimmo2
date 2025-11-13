'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function updateUserRole(userId: string, role: 'ADMIN' | 'USER') {
  // TODO: Ajouter protection authentification
  await prisma.user.update({
    where: { id: userId },
    data: { role },
  });
  revalidatePath('/admin/users');
}

export async function updateUser(userId: string, data: { name?: string; email?: string; role?: 'ADMIN' | 'USER' }) {
  // TODO: Ajouter protection authentification
  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.role !== undefined && { role: data.role }),
      // Email cannot be changed via this action
    },
  });
  revalidatePath('/admin/users');
}

export async function createUser(data: { name: string; email: string; role: 'ADMIN' | 'USER'; sendInvitation: boolean }) {
  // TODO: Ajouter protection authentification
  
  // Vérifier si l'utilisateur existe déjà
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });
  
  if (existingUser) {
    throw new Error('Un utilisateur avec cet email existe déjà');
  }
  
  // Créer l'utilisateur
  const user = await prisma.user.create({
    data: {
      email: data.email,
      name: data.name || data.email.split('@')[0],
      role: data.role,
      emailVerified: new Date(), // Marquer comme vérifié si on l'invite
    },
  });
  
  // Envoyer l'email d'invitation si demandé
  if (data.sendInvitation) {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/users/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          name: user.name,
        }),
      });
    } catch (error) {
      console.error('Error sending invitation email:', error);
      // Ne pas faire échouer la création si l'email échoue
    }
  }
  
  revalidatePath('/admin/users');
  return user;
}

export async function deleteUser(userId: string) {
  // TODO: Ajouter protection authentification
  await prisma.user.delete({
    where: { id: userId },
  });
  revalidatePath('/admin/users');
}
