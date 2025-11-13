'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/shared/select';
import { toast } from 'sonner';

interface User {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  createdAt: string;
}

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onSave?: (data: { id: string; name: string; email: string; role: 'ADMIN' | 'USER' }) => Promise<void>;
  onCreate?: (data: { name: string; email: string; role: 'ADMIN' | 'USER'; sendInvitation: boolean }) => Promise<void>;
}

export default function UserFormModal({
  isOpen,
  onClose,
  user,
  onSave,
  onCreate
}: UserFormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [sendInvitation, setSendInvitation] = useState(true);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'USER' as 'ADMIN' | 'USER'
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        role: user.role as 'ADMIN' | 'USER'
      });
    } else {
      setFormData({
        name: '',
        email: '',
        role: 'USER'
      });
    }
    setErrors({});
  }, [user, isOpen]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setErrors({});
    
    // Validation
    if (!formData.email) {
      setErrors({ email: 'L\'email est obligatoire' });
      toast.error('L\'email est obligatoire');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setErrors({ email: 'Format d\'email invalide' });
      toast.error('Format d\'email invalide');
      return;
    }

    setIsSubmitting(true);
    try {
      if (user) {
        // Modification
        if (!onSave) {
          throw new Error('onSave non défini');
        }
        await onSave({
          id: user.id,
          name: formData.name,
          email: formData.email,
          role: formData.role
        });
      } else {
        // Création
        if (!onCreate) {
          throw new Error('onCreate non défini');
        }
        await onCreate({
          name: formData.name,
          email: formData.email,
          role: formData.role,
          sendInvitation
        });
      }
      onClose();
    } catch (error: any) {
      console.error('Error saving user:', error);
      toast.error(error?.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      email: '',
      role: 'USER'
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {user ? 'Modifier l\'utilisateur' : 'Inviter un nouvel utilisateur'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
            <div>
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email *
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="utilisateur@example.com"
                disabled={!!user} // Email cannot be changed when editing
                className={user ? 'bg-gray-100' : ''}
                required={!user} // Required when creating
              />
              {user && (
                <p className="text-xs text-gray-500 mt-1">L'email ne peut pas être modifié</p>
              )}
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                Nom
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Nom complet"
              />
              {errors.name && (
                <p className="text-red-500 text-sm mt-1">{errors.name}</p>
              )}
            </div>

            <div>
              <Label htmlFor="role" className="text-sm font-medium text-gray-700">
                Rôle *
              </Label>
              <Select 
                value={formData.role} 
                onValueChange={(value: 'ADMIN' | 'USER') => handleInputChange('role', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">Utilisateur (USER)</SelectItem>
                  <SelectItem value="ADMIN">Administrateur (ADMIN)</SelectItem>
                </SelectContent>
              </Select>
              {errors.role && (
                <p className="text-red-500 text-sm mt-1">{errors.role}</p>
              )}
            </div>

            {/* Option d'invitation (seulement en création) */}
            {!user && (
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="sendInvitation"
                  checked={sendInvitation}
                  onChange={(e) => setSendInvitation(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="sendInvitation" className="text-sm font-medium cursor-pointer">
                  Envoyer un email d'invitation
                </label>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-8 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Enregistrement...' : (user ? 'Modifier' : 'Créer l\'utilisateur')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

