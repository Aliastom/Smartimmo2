'use client';

import React, { useState } from 'react';
import { Plus, Landmark, Calendar, Euro, TrendingDown } from 'lucide-react';
import { Property } from '../../domain/entities/Property';
import { Loan } from '../../domain/entities/Loan';
import FormModal from './FormModal';
import ActionButtons from './ActionButtons';
import LoanForm from './LoanForm';
import { formatCurrencyEUR, formatPercentage } from '@/utils/format';
import { useDeletionGuard } from '../hooks/useDeletionGuard';

interface PropertyLoanTabProps {
  property: Property;
  loan: Loan | null;
  onUpdate: () => void;
}

export default function PropertyLoanTab({ property, loan, onUpdate }: PropertyLoanTabProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const deletionGuard = useDeletionGuard('loan');

  const handleSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    
    // Debug: afficher les données envoyées
    console.log('[PropertyLoanTab] FormData entries:');
    for (const [key, value] of formData.entries()) {
      console.log(`  ${key}:`, value);
    }
    
    try {
      const response = loan 
        ? await fetch(`/api/loans/${loan.id}`, {
            method: 'PUT',
            body: formData,
          })
        : await fetch('/api/loans', {
            method: 'POST',
            body: formData,
          });

      if (response.ok) {
        setIsModalOpen(false);
        onUpdate();
      } else {
        alert('Erreur lors de la sauvegarde du prêt');
      }
    } catch (error) {
      console.error('Error saving loan:', error);
      alert('Une erreur inattendue est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!loan) return;
    
    if (confirm('Êtes-vous sûr de vouloir supprimer ce prêt ?')) {
      try {
        const response = await fetch(`/api/loans/${loan.id}`, {
          method: 'DELETE',
        });
        
        if (response.status === 409) {
          const payload = await response.json();
          deletionGuard.openWith(payload, loan.id);
          return;
        }
        
        if (response.ok) {
          onUpdate();
        } else {
          alert('Erreur lors de la suppression');
        }
      } catch (error) {
        console.error('Error deleting loan:', error);
        alert('Erreur lors de la suppression');
      }
    }
  };

  const calculateRemainingMonths = () => {
    if (!loan) return 0;
    const startDate = new Date(loan.startDate);
    const currentDate = new Date();
    const monthsElapsed = (currentDate.getFullYear() - startDate.getFullYear()) * 12 + 
                         (currentDate.getMonth() - startDate.getMonth());
    return Math.max(0, loan.durationMonths - monthsElapsed);
  };

  const calculateTotalPaid = () => {
    if (!loan) return 0;
    const monthsElapsed = calculateRemainingMonths();
    return monthsElapsed * loan.monthlyPayment;
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-neutral-900">Prêt immobilier</h3>
        {loan && (
          <ActionButtons
            onEdit={() => setIsModalOpen(true)}
            onDelete={handleDelete}
          />
        )}
      </div>

      {/* Loan Summary */}
      {loan ? (
        <div className="space-y-6">
          {/* Main Info */}
          <div className="bg-base-100 border border-neutral-200 rounded-lg p-6">
            <h4 className="text-md font-semibold text-neutral-900 mb-4 flex items-center">
              <Landmark className="h-5 w-5 mr-2" />
              Informations du prêt
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-neutral-600">Banque</p>
                <p className="font-semibold">{loan.bankName}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-600">Montant emprunté</p>
                <p className="font-semibold">{formatCurrencyEUR(loan.loanAmount)}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-600">Taux d'intérêt</p>
                <p className="font-semibold">{formatPercentage(loan.interestRate)}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-600">Taux d'assurance</p>
                <p className="font-semibold">{formatPercentage(loan.insuranceRate)}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-600">Durée totale</p>
                <p className="font-semibold">{loan.durationMonths} mois</p>
              </div>
              <div>
                <p className="text-sm text-neutral-600">Date de début</p>
                <p className="font-semibold">{new Date(loan.startDate).toLocaleDateString('fr-FR')}</p>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          <div className="bg-base-100 border border-neutral-200 rounded-lg p-6">
            <h4 className="text-md font-semibold text-neutral-900 mb-4 flex items-center">
              <Euro className="h-5 w-5 mr-2" />
              Remboursements
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-neutral-600">Mensualité</p>
                <p className="text-2xl font-bold text-primary">{formatCurrencyEUR(loan.monthlyPayment)}</p>
              </div>
              <div>
                <p className="text-neutral-600">Capital restant</p>
                <p className="text-xl font-semibold">{formatCurrencyEUR(loan.remainingCapital)}</p>
              </div>
              <div>
                <p className="text-neutral-600">Mois restants</p>
                <p className="text-xl font-semibold">{calculateRemainingMonths()}</p>
              </div>
              <div>
                <p className="text-neutral-600">Total payé</p>
                <p className="text-xl font-semibold">{formatCurrencyEUR(calculateTotalPaid())}</p>
              </div>
            </div>
          </div>

          {/* Progress */}
          <div className="bg-base-100 border border-neutral-200 rounded-lg p-6">
            <h4 className="text-md font-semibold text-neutral-900 mb-4 flex items-center">
              <TrendingDown className="h-5 w-5 mr-2" />
              Avancement du remboursement
            </h4>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm text-neutral-600 mb-1">
                  <span>Progression</span>
                  <span>{((loan.loanAmount - loan.remainingCapital) / loan.loanAmount * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(loan.loanAmount - loan.remainingCapital) / loan.loanAmount * 100}%` }}
                  ></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-neutral-600">Capital remboursé</p>
                  <p className="font-semibold">{formatCurrencyEUR(loan.loanAmount - loan.remainingCapital)}</p>
                </div>
                <div>
                  <p className="text-neutral-600">Restant à payer</p>
                  <p className="font-semibold">{formatCurrencyEUR(loan.remainingCapital)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-neutral-50 rounded-lg border border-neutral-200">
          <Landmark className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-neutral-900 mb-2">Aucun prêt enregistré</h4>
          <p className="text-neutral-600 mb-4">Ajoutez un prêt pour suivre vos remboursements</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-primary text-base-100 rounded-md hover:bg-primary transition mx-auto"
          >
            <Plus className="h-4 w-4" />
            <span>Ajouter un prêt</span>
          </button>
        </div>
      )}

      {/* Modal */}
      <FormModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={loan ? "Modifier le prêt" : "Ajouter un nouveau prêt"}
      >
        <LoanForm
          properties={[property]} // Seulement le bien courant
          loan={loan || undefined}
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
          isLoading={isSubmitting}
        />
      </FormModal>
      
      {/* Dialog de garde */}
      {deletionGuard.dialog}
    </div>
  );
}