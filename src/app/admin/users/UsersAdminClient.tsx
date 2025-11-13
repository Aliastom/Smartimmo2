'use client';

import React, { useState, useEffect } from 'react';
import { Edit, Trash2, Search, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { Checkbox } from '@/components/ui/Checkbox';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/Tooltip';
import { toast } from 'sonner';
import { updateUserRole, updateUser, deleteUser, createUser } from './actions';
import UserFormModal from './UserFormModal';

interface User {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  createdAt: string;
}

export default function UsersAdminClient() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/users');
      const json = await res.json();
      setUsers(json.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchQuery || 
      (user.name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.email?.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  const handleCreateClick = () => {
    setSelectedUser(null);
    setIsCreating(true);
    setIsModalOpen(true);
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setIsCreating(false);
    setIsModalOpen(true);
  };

  const handleSave = async (data: { id: string; name: string; email: string; role: 'ADMIN' | 'USER' }) => {
    try {
      await updateUser(data.id, {
        name: data.name,
        role: data.role,
        // Email cannot be changed
      });
      toast.success('Utilisateur modifié avec succès');
      setIsModalOpen(false);
      setSelectedUser(null);
      setIsCreating(false);
      fetchUsers();
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors de la modification');
      throw error;
    }
  };

  const handleCreateUser = async (data: { name: string; email: string; role: 'ADMIN' | 'USER'; sendInvitation: boolean }) => {
    try {
      await createUser(data);
      toast.success(data.sendInvitation ? 'Utilisateur créé et invitation envoyée' : 'Utilisateur créé avec succès');
      setIsModalOpen(false);
      setSelectedUser(null);
      setIsCreating(false);
      fetchUsers();
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors de la création');
      throw error;
    }
  };

  const handlePromote = async (userId: string) => {
    try {
      await updateUserRole(userId, 'ADMIN');
      toast.success('Utilisateur promu administrateur');
      fetchUsers();
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors de la promotion');
    }
  };

  const handleDemote = async (userId: string) => {
    try {
      await updateUserRole(userId, 'USER');
      toast.success('Utilisateur rétrogradé');
      fetchUsers();
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors de la rétrogradation');
    }
  };

  const handleDelete = async (userId: string, email: string | null) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur ${email || userId} ?`)) {
      return;
    }
    try {
      await deleteUser(userId);
      toast.success('Utilisateur supprimé');
      fetchUsers();
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors de la suppression');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">Chargement...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestion des utilisateurs</h1>
            <p className="text-gray-600 mt-1">
              Créez, promouvez et supprimez des comptes utilisateurs et leurs permissions.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreateClick}>
              <UserPlus className="h-4 w-4 mr-2" />
              Nouvel utilisateur
            </Button>
          </div>
        </div>

        {/* Encart d'information */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                Gestion des utilisateurs
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  Les utilisateurs avec le rôle <strong>ADMIN</strong> ont accès à toutes les fonctionnalités d'administration. 
                  Les utilisateurs avec le rôle <strong>USER</strong> ont un accès limité aux fonctionnalités de base. 
                  Vous pouvez promouvoir un utilisateur en ADMIN ou le rétrograder en USER à tout moment.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filtres */}
        <Card>
          <CardHeader>
            <CardTitle>Filtres</CardTitle>
            <CardDescription>Recherchez et filtrez les utilisateurs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-center">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Rechercher un utilisateur par nom ou email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeInactive"
                  checked={showInactive}
                  onCheckedChange={(checked) => setShowInactive(checked as boolean)}
                />
                <label htmlFor="includeInactive" className="text-sm font-medium cursor-pointer">
                  Inclure inactifs
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tableau des Utilisateurs */}
        <Card>
          <CardHeader>
            <CardTitle>Utilisateurs</CardTitle>
            <CardDescription>Liste de tous les utilisateurs configurés</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Nom</TableHeaderCell>
                    <TableHeaderCell>Email</TableHeaderCell>
                    <TableHeaderCell>Rôle</TableHeaderCell>
                    <TableHeaderCell>Créé le</TableHeaderCell>
                    <TableHeaderCell className="text-center">Actions</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        Aucun utilisateur trouvé
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name || '—'}</TableCell>
                        <TableCell>{user.email || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'ADMIN' ? 'danger' : 'secondary'} className="text-xs">
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(user.createdAt).toLocaleDateString('fr-FR')}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(user)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Modifier</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(user.id, user.email)}
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Supprimer</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal */}
      <UserFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedUser(null);
          setIsCreating(false);
        }}
        user={selectedUser}
        onSave={selectedUser ? handleSave : undefined}
        onCreate={!selectedUser ? handleCreateUser : undefined}
      />
    </>
  );
}
