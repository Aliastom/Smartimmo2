'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Badge } from '@/components/ui/Badge';
import { z } from 'zod';
import { 
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  FileText,
  AlertCircle,
  CheckCircle,
  Building2,
  Euro,
  X,
  Sparkles,
  Star
} from 'lucide-react';
import AddressAutocomplete from '@/components/forms/AddressAutocomplete';

const tenantSchema = z.object({
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  email: z.string().email('Email invalide'),
  phone: z.string().optional(),
  birthDate: z.string().optional(),
  nationality: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  occupation: z.string().optional(),
  employer: z.string().optional(),
  monthlyIncome: z.number().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']).optional(),
  tags: z.array(z.string()).optional(),
});

interface TenantEditModalV2Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  initialData?: any;
  title: string;
}

export function TenantEditModalV2({ 
  isOpen, 
  onClose, 
  onSubmit, 
  initialData, 
  title 
}: TenantEditModalV2Props) {
  const [activeTab, setActiveTab] = useState('personal');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    birthDate: '',
    nationality: '',
    address: '',
    postalCode: '',
    city: '',
    country: '',
    occupation: '',
    employer: '',
    monthlyIncome: '',
    emergencyContact: '',
    emergencyPhone: '',
    notes: '',
    status: 'ACTIVE',
    tags: [] as string[],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newTag, setNewTag] = useState('');

  // Initialiser les données du formulaire
  useEffect(() => {
    if (initialData) {
      setFormData({
        firstName: initialData.firstName || '',
        lastName: initialData.lastName || '',
        email: initialData.email || '',
        phone: initialData.phone || '',
        birthDate: initialData.birthDate ? new Date(initialData.birthDate).toISOString().split('T')[0] : '',
        nationality: initialData.nationality || '',
        address: initialData.address || '',
        postalCode: initialData.postalCode || '',
        city: initialData.city || '',
        country: initialData.country || '',
        occupation: initialData.occupation || '',
        employer: initialData.employer || '',
        monthlyIncome: initialData.monthlyIncome?.toString() || '',
        emergencyContact: initialData.emergencyContact || '',
        emergencyPhone: initialData.emergencyPhone || '',
        notes: initialData.notes || '',
        status: initialData.status || 'ACTIVE',
        tags: initialData.tags ? (typeof initialData.tags === 'string' ? JSON.parse(initialData.tags) : initialData.tags) : [],
      });
    } else {
      // Réinitialiser le formulaire pour un nouveau locataire
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        birthDate: '',
        nationality: '',
        address: '',
        postalCode: '',
        city: '',
        country: '',
        occupation: '',
        employer: '',
        monthlyIncome: '',
        emergencyContact: '',
        emergencyPhone: '',
        notes: '',
        status: 'ACTIVE',
        tags: [],
      });
    }
  }, [initialData]);

  const tabs = [
    { id: 'personal', label: 'Personnel', icon: User, color: 'blue' },
    { id: 'contact', label: 'Contact', icon: MapPin, color: 'green' },
    { id: 'professional', label: 'Pro', icon: Building2, color: 'purple' },
    { id: 'financial', label: 'Finance', icon: Euro, color: 'yellow' },
    { id: 'emergency', label: 'Urgence', icon: AlertCircle, color: 'red' },
    { id: 'notes', label: 'Notes', icon: FileText, color: 'indigo' },
  ];

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Effacer l'erreur quand l'utilisateur commence à taper
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      // Validation avec Zod
      const validatedData = tenantSchema.parse({
        ...formData,
        monthlyIncome: formData.monthlyIncome ? parseFloat(formData.monthlyIncome) : undefined,
        birthDate: formData.birthDate ? new Date(formData.birthDate).toISOString() : undefined,
      });

      await onSubmit(validatedData);
      onClose();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach(err => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        console.error('Erreur lors de la soumission:', error);
        setErrors({ general: 'Une erreur est survenue lors de l\'enregistrement' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTabIcon = (IconComponent: any, color: string) => {
    const colorClasses = {
      blue: 'text-blue-600 bg-blue-100',
      green: 'text-green-600 bg-green-100',
      purple: 'text-purple-600 bg-purple-100',
      yellow: 'text-yellow-600 bg-yellow-100',
      red: 'text-red-600 bg-red-100',
      indigo: 'text-indigo-600 bg-indigo-100',
    };
    
    return (
      <div className={`p-2 rounded-lg ${colorClasses[color as keyof typeof colorClasses]}`}>
        <IconComponent className="h-4 w-4" />
      </div>
    );
  };

  const renderPersonalInfo = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="firstName" className="flex items-center gap-2">
            <User className="h-4 w-4 text-blue-600" />
            Prénom *
          </Label>
          <Input
            id="firstName"
            value={formData.firstName}
            onChange={(e) => handleInputChange('firstName', e.target.value)}
            className={errors.firstName ? 'border-red-500' : ''}
            placeholder="Entrez le prénom"
          />
          {errors.firstName && <p className="text-sm text-red-600">{errors.firstName}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastName" className="flex items-center gap-2">
            <User className="h-4 w-4 text-blue-600" />
            Nom *
          </Label>
          <Input
            id="lastName"
            value={formData.lastName}
            onChange={(e) => handleInputChange('lastName', e.target.value)}
            className={errors.lastName ? 'border-red-500' : ''}
            placeholder="Entrez le nom"
          />
          {errors.lastName && <p className="text-sm text-red-600">{errors.lastName}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-green-600" />
            Email *
          </Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            className={errors.email ? 'border-red-500' : ''}
            placeholder="exemple@email.com"
          />
          {errors.email && <p className="text-sm text-red-600">{errors.email}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-blue-600" />
            Téléphone
          </Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            placeholder="+33 6 12 34 56 78"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="birthDate" className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-purple-600" />
            Date de naissance
          </Label>
          <Input
            id="birthDate"
            type="date"
            value={formData.birthDate}
            onChange={(e) => handleInputChange('birthDate', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="nationality" className="flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-600" />
            Nationalité
          </Label>
          <Input
            id="nationality"
            value={formData.nationality}
            onChange={(e) => handleInputChange('nationality', e.target.value)}
            placeholder="Française"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            Statut
          </Label>
          <select
            id="status"
            value={formData.status}
            onChange={(e) => handleInputChange('status', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="ACTIVE">Actif</option>
            <option value="INACTIVE">Inactif</option>
            <option value="BLOCKED">Bloqué</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderContactInfo = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-2">
          <Label htmlFor="address" className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-green-600" />
            Adresse
          </Label>
          <AddressAutocomplete
            initialValue={formData.address}
            onAddressSelect={(address) => {
              handleInputChange('address', address.street);
              handleInputChange('postalCode', address.postcode);
              handleInputChange('city', address.city);
            }}
            placeholder="123 rue de la Paix, Paris"
            className="w-full"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="postalCode">Code postal</Label>
            <Input
              id="postalCode"
              value={formData.postalCode}
              onChange={(e) => handleInputChange('postalCode', e.target.value)}
              placeholder="75001"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">Ville</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => handleInputChange('city', e.target.value)}
              placeholder="Paris"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">Pays</Label>
            <Input
              id="country"
              value={formData.country}
              onChange={(e) => handleInputChange('country', e.target.value)}
              placeholder="France"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderProfessionalInfo = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="occupation" className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-purple-600" />
            Profession
          </Label>
          <Input
            id="occupation"
            value={formData.occupation}
            onChange={(e) => handleInputChange('occupation', e.target.value)}
            placeholder="Développeur web"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="employer" className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-purple-600" />
            Employeur
          </Label>
          <Input
            id="employer"
            value={formData.employer}
            onChange={(e) => handleInputChange('employer', e.target.value)}
            placeholder="Nom de l'entreprise"
          />
        </div>
      </div>
    </div>
  );

  const renderFinancialInfo = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="monthlyIncome" className="flex items-center gap-2">
          <Euro className="h-4 w-4 text-yellow-600" />
          Revenus mensuels
        </Label>
        <Input
          id="monthlyIncome"
          type="number"
          value={formData.monthlyIncome}
          onChange={(e) => handleInputChange('monthlyIncome', e.target.value)}
          placeholder="3000"
        />
      </div>
    </div>
  );

  const renderEmergencyInfo = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="emergencyContact" className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            Contact d'urgence
          </Label>
          <Input
            id="emergencyContact"
            value={formData.emergencyContact}
            onChange={(e) => handleInputChange('emergencyContact', e.target.value)}
            placeholder="Nom du contact"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="emergencyPhone" className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-red-600" />
            Téléphone d'urgence
          </Label>
          <Input
            id="emergencyPhone"
            value={formData.emergencyPhone}
            onChange={(e) => handleInputChange('emergencyPhone', e.target.value)}
            placeholder="+33 6 12 34 56 78"
          />
        </div>
      </div>
    </div>
  );

  const renderNotesAndTags = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="notes" className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-indigo-600" />
          Notes
        </Label>
        <textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => handleInputChange('notes', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          rows={4}
          placeholder="Notes sur le locataire..."
        />
      </div>

      <div className="space-y-4">
        <Label className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-600" />
          Tags
        </Label>
        
        <div className="flex gap-2">
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Ajouter un tag"
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
          />
          <Button type="button" onClick={handleAddTag} variant="outline">
            Ajouter
          </Button>
        </div>

        {formData.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {formData.tags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="flex items-center gap-1">
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-1 hover:text-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'personal':
        return renderPersonalInfo();
      case 'contact':
        return renderContactInfo();
      case 'professional':
        return renderProfessionalInfo();
      case 'financial':
        return renderFinancialInfo();
      case 'emergency':
        return renderEmergencyInfo();
      case 'notes':
        return renderNotesAndTags();
      default:
        return renderPersonalInfo();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-6 rounded-t-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/50 rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Navigation des onglets */}
        <div className="flex space-x-1 bg-white/70 p-1 rounded-lg">
          {tabs.map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-200 ${
                  isActive
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                }`}
              >
                {getTabIcon(IconComponent, tab.color)}
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 bg-white">
        {/* Contenu de l'onglet */}
        <div className="min-h-[400px]">
          {renderTabContent()}
        </div>

        {/* Message d'erreur général */}
        {errors.general && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{errors.general}</p>
          </div>
        )}

        {/* Boutons d'action */}
        <div className="flex gap-3 pt-6 border-t border-gray-200 mt-6">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onClose} 
            disabled={isSubmitting}
          >
            Annuler
          </Button>
          <Button 
            type="submit" 
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
