'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Settings } from 'lucide-react';
import DataTable from '../../../ui/components/DataTable';
import FormModal from '../../../ui/components/FormModal';
import ActionButtons from '../../../ui/components/ActionButtons';
import { Category } from '../../../domain/entities/Category';

export default function AdminCategoriesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/categories');
        if (res.ok) {
          const data = await res.json();
          setCategories(data);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  const handleSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    try {
      const data = {
        name: formData.get('name'),
        type: formData.get('type'),
        isDeductible: formData.get('isDeductible') === 'on',
        isCapitalizable: formData.get('isCapitalizable') === 'on',
        active: formData.get('active') === 'on',
      };

      const result = editingCategory
        ? await fetch(`/api/categories/${editingCategory.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          })
        : await fetch('/api/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });

      if (result.ok) {
        // Refresh data
        const res = await fetch('/api/categories');
        if (res.ok) {
          const data = await res.json();
          setCategories(data);
        }
        setIsModalOpen(false);
        setEditingCategory(null);
      } else {
        alert('Une erreur est survenue');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('Une erreur inattendue est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setIsModalOpen(true);
  };

  const handleDelete = async (category: Category) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ?')) {
      try {
        const result = await fetch(`/api/categories/${category.id}`, {
          method: 'DELETE',
        });
        
        if (result.ok) {
          // Refresh data
          const res = await fetch('/api/categories');
          if (res.ok) {
            const data = await res.json();
            setCategories(data);
          }
        } else {
          alert('Erreur lors de la suppression');
        }
      } catch (error) {
        console.error('Error deleting category:', error);
        alert('Erreur lors de la suppression');
      }
    }
  };

  const getTypeLabel = (type?: string) => {
    const types: Record<string, string> = {
      expense: 'Dépense',
      income: 'Revenu',
      financial: 'Financier',
      other: 'Autre',
    };
    return types[type || ''] || 'Non défini';
  };

  const columns = [
    { 
      key: 'name' as keyof Category, 
      label: 'Nom', 
      sortable: true 
    },
    { 
      key: 'type' as keyof Category, 
      label: 'Type', 
      sortable: true,
      render: (category: Category) => getTypeLabel(category.type)
    },
    { 
      key: 'isDeductible' as keyof Category, 
      label: 'Déductible', 
      sortable: true,
      render: (category: Category) => (
        <span className={`px-2 py-1 rounded-full text-xs ${
          category.isDeductible 
            ? 'bg-blue-100 text-blue-800' 
            : 'bg-base-200 text-base-content'
        }`}>
          {category.isDeductible ? 'Oui' : 'Non'}
        </span>
      )
    },
    { 
      key: 'isCapitalizable' as keyof Category, 
      label: 'Capitalisable', 
      sortable: true,
      render: (category: Category) => (
        <span className={`px-2 py-1 rounded-full text-xs ${
          category.isCapitalizable 
            ? 'bg-purple-100 text-purple-800' 
            : 'bg-base-200 text-base-content'
        }`}>
          {category.isCapitalizable ? 'Oui' : 'Non'}
        </span>
      )
    },
    { 
      key: 'active' as keyof Category, 
      label: 'Actif', 
      sortable: true,
      render: (category: Category) => (
        <span className={`px-2 py-1 rounded-full text-xs ${
          category.active 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {category.active ? 'Oui' : 'Non'}
        </span>
      )
    },
    {
      key: 'actions' as keyof Category,
      label: 'Actions',
      render: (category: Category) => (
        <ActionButtons
          onEdit={() => handleEdit(category)}
          onDelete={() => handleDelete(category)}
        />
      ),
    },
  ];

  if (loading) {
    return (
      <div className="space-y-8">
        <h2 className="text-3xl font-bold text-neutral-900">Gestion des Catégories</h2>
        <div className="text-center py-8">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <Settings size={32} className="text-primary-700" />
          <h2 className="text-3xl font-bold text-neutral-900">Gestion des Catégories</h2>
        </div>
        <button
          onClick={() => {
            setEditingCategory(null);
            setIsModalOpen(true);
          }}
          className="bg-primary-700 text-base-100 px-4 py-2 rounded-md shadow-md hover:bg-primary-800 transition-colors flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>Ajouter une catégorie</span>
        </button>
      </div>

      <DataTable
        columns={columns}
        data={categories}
        searchPlaceholder="Rechercher une catégorie..."
      />

      <FormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCategory(null);
        }}
        title={editingCategory ? "Modifier la catégorie" : "Ajouter une nouvelle catégorie"}
      >
        <form onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          handleSubmit(formData);
        }} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-neutral-700 mb-1">
              Nom de la catégorie
            </label>
            <input
              type="text"
              id="name"
              name="name"
              defaultValue={editingCategory?.name || ''}
              required
              className="w-full border border-neutral-300 rounded-md p-2 focus:ring-primary-700 focus:border-primary-700"
            />
          </div>

          <div>
            <label htmlFor="type" className="block text-sm font-medium text-neutral-700 mb-1">
              Type
            </label>
            <select
              id="type"
              name="type"
              defaultValue={editingCategory?.type || ''}
              className="w-full border border-neutral-300 rounded-md p-2 focus:ring-primary-700 focus:border-primary-700"
            >
              <option value="">Sélectionner un type</option>
              <option value="expense">Dépense</option>
              <option value="income">Revenu</option>
              <option value="financial">Financier</option>
              <option value="other">Autre</option>
            </select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isDeductible"
                name="isDeductible"
                defaultChecked={editingCategory?.isDeductible ?? false}
                className="h-4 w-4 text-primary-700 focus:ring-primary-700 border-neutral-300 rounded"
              />
              <label htmlFor="isDeductible" className="ml-2 block text-sm text-neutral-700">
                Charge déductible
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isCapitalizable"
                name="isCapitalizable"
                defaultChecked={editingCategory?.isCapitalizable ?? false}
                className="h-4 w-4 text-primary-700 focus:ring-primary-700 border-neutral-300 rounded"
              />
              <label htmlFor="isCapitalizable" className="ml-2 block text-sm text-neutral-700">
                Immobiliser (capitalisable)
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="active"
                name="active"
                defaultChecked={editingCategory?.active ?? true}
                className="h-4 w-4 text-primary-700 focus:ring-primary-700 border-neutral-300 rounded"
              />
              <label htmlFor="active" className="ml-2 block text-sm text-neutral-700">
                Catégorie active
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setEditingCategory(null);
              }}
              className="px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-200 rounded-md hover:bg-neutral-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              disabled={isSubmitting}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-base-100 bg-primary-700 rounded-md shadow-sm hover:bg-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Envoi...' : (editingCategory ? 'Modifier' : 'Ajouter')}
            </button>
          </div>
        </form>
      </FormModal>
    </div>
  );
}
