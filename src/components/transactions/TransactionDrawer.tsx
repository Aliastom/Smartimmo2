'use client';

import React, { useState } from 'react';
import { X, Edit, Trash2, FileText, Plus, Calendar, Euro, Building2, Users, Tag, Info } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToggleRapprochement, type RapprochementStatus } from '@/hooks/useToggleRapprochement';
import { notify2 } from '@/lib/notify2';

interface Transaction {
  id: string;
  date: string;
  label: string;
  Property: {
    id: string;
    name: string;
    address: string;
  };
  lease?: {
    id: string;
    status: string;
  };
  tenant?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  nature: {
    id: string;
    label: string;
    type: 'RECETTE' | 'DEPENSE';
  };
  Category: {
    id: string;
    label: string;
  };
  amount: number;
  reference?: string;
  paymentDate?: string;
  paymentMethod?: string;
  paidAt?: string;
  method?: string;
  notes?: string;
  accountingMonth?: string;
  monthsCovered?: number;
  autoDistribution?: boolean;
  hasDocument: boolean;
  status: 'rapprochee' | 'nonRapprochee';
  rapprochementStatus?: string;
  dateRapprochement?: string | null;
  bankRef?: string | null;
  createdAt?: string;
  updatedAt?: string;
  documents?: Array<{
    id: string;
    name: string;
    type: string;
    createdAt: string;
  }>;
  // Champs de série
  parentTransactionId?: string;
  moisIndex?: number;
  moisTotal?: number;
  // Gestion déléguée
  isAuto?: boolean;
  autoSource?: string | null;
}

interface TransactionDrawerProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onViewDocument?: (documentId: string, documentName: string) => void;
  onRefresh?: () => void;
}

const PAYMENT_METHODS = {
  virement: 'Virement',
  cheque: 'Chèque',
  especes: 'Espèces',
  carte: 'Carte bancaire',
  prelevement: 'Prélèvement'
};

export default function TransactionDrawer({
  transaction,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onViewDocument,
  onRefresh
}: TransactionDrawerProps) {
  const { mutate: toggleRapprochement, isPending: isTogglingRapprochement } = useToggleRapprochement();
  const [localRapprochementStatus, setLocalRapprochementStatus] = useState<RapprochementStatus>(
    transaction?.rapprochementStatus === 'rapprochee' ? 'rapprochee' : 'non_rapprochee'
  );

  // Synchroniser l'état local quand la transaction change
  React.useEffect(() => {
    if (transaction) {
      console.log('[TransactionDrawer] 🔍 Transaction reçue:', {
        id: transaction.id,
        label: transaction.label,
        rapprochementStatus: transaction.rapprochementStatus,
        status: transaction.status,
        dateRapprochement: transaction.dateRapprochement,
        bankRef: transaction.bankRef
      });
      
      const status = transaction.rapprochementStatus || transaction.status;
      console.log('[TransactionDrawer] 🔍 Status utilisé:', status);
      
      const newStatus: RapprochementStatus = status === 'rapprochee' ? 'rapprochee' : 'non_rapprochee';
      console.log('[TransactionDrawer] 🔍 Nouveau localRapprochementStatus:', newStatus);
      
      setLocalRapprochementStatus(newStatus);
    }
  }, [transaction]);

  console.log('[TransactionDrawer] 🎨 Rendu - localRapprochementStatus actuel:', localRapprochementStatus);

  if (!isOpen || !transaction) return null;

  const handleToggleRapprochement = (checked: boolean) => {
    const newStatus: RapprochementStatus = checked ? 'rapprochee' : 'non_rapprochee';
    setLocalRapprochementStatus(newStatus);
    
    toggleRapprochement({
      id: transaction.id,
      status: newStatus
    }, {
      onSuccess: () => {
        // Le toast est déjà géré dans useToggleRapprochement
        // Rafraîchir les données (KPI, graphiques, liste)
        if (onRefresh) {
          onRefresh();
        }
      },
      onError: (error) => {
        // Le toast est déjà géré dans useToggleRapprochement
        console.error('[TransactionDrawer] Erreur:', error);
        // Revenir à l'état précédent en cas d'erreur
        setLocalRapprochementStatus(checked ? 'non_rapprochee' : 'rapprochee');
      }
    });
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatAmount = (amount: number, type: 'RECETTE' | 'DEPENSE'): string => {
    const formatted = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(Math.abs(amount));
    
    return type === 'DEPENSE' ? `-${formatted}` : formatted;
  };

  const getAmountColor = (type: 'RECETTE' | 'DEPENSE'): string => {
    return type === 'RECETTE' ? 'text-green-600' : 'text-red-600';
  };

  const formatAccountingMonth = (yyyymm: string): string => {
    if (!yyyymm || !yyyymm.includes('-')) return yyyymm;
    const [year, month] = yyyymm.split('-');
    if (!month) return yyyymm; // Fallback si le split n'a pas fonctionné
    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    const monthName = monthNames[parseInt(month, 10) - 1];
    return `${monthName} ${year}`;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl transform transition-transform">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b bg-gray-50">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Détail de la transaction
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {transaction.label}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Informations principales */}
            <div className="space-y-6">
              {/* Montant et statut */}
              <div className="flex items-center justify-between">
                <div>
                  <span className={`text-3xl font-bold ${getAmountColor(transaction.nature.type)}`}>
                    {formatAmount(transaction.amount, transaction.nature.type)}
                  </span>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge
                      variant={transaction.nature.type === 'RECETTE' ? 'success' : 'danger'}
                    >
                      {transaction.nature.label}
                    </Badge>
                    <Badge
                      variant={localRapprochementStatus === 'rapprochee' ? 'success' : 'warning'}
                    >
                      {localRapprochementStatus === 'rapprochee' ? 'Rapprochée' : 'Non rapprochée'}
                    </Badge>
                    {transaction.isAuto && transaction.autoSource === 'gestion' && (
                      <Badge variant="danger" className="text-xs font-semibold">
                        A
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Date</p>
                  <p className="font-medium">{formatDate(transaction.date)}</p>
                </div>
              </div>

              {/* Rapprochement bancaire (autosave) */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    checked={localRapprochementStatus === 'rapprochee'}
                    onChange={(e) => handleToggleRapprochement(e.target.checked)}
                    disabled={isTogglingRapprochement}
                  />
                  <span className="text-sm font-medium text-gray-900">
                    Marquer comme rapprochée
                  </span>
                  {isTogglingRapprochement && (
                    <span className="text-xs text-gray-500 ml-auto">Enregistrement...</span>
                  )}
                </label>
                <p className="text-xs text-gray-600 mt-2 ml-8">
                  Cette modification est automatiquement sauvegardée.
                </p>
              </div>

              {/* Détails */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Bien */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Bien</span>
                  </div>
                  <div>
                    <p className="font-medium">{transaction.Property.name}</p>
                    <p className="text-sm text-gray-600">{transaction.Property.address}</p>
                  </div>
                </div>

                {/* Locataire */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Locataire</span>
                  </div>
                  {transaction.Tenant ? (
                    <p className="font-medium">
                      {transaction.Tenant.firstName} {transaction.Tenant.lastName}
                    </p>
                  ) : (
                    <p className="text-gray-400">Aucun locataire</p>
                  )}
                </div>

                {/* Nature */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Nature</span>
                  </div>
                  <p className="font-medium">{transaction.nature.label}</p>
                </div>

                {/* Catégorie */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Catégorie</span>
                  </div>
                  <p className="font-medium">{transaction.Category.label}</p>
                </div>

                {/* Référence */}
                {transaction.reference && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Référence</span>
                    </div>
                    <p className="font-medium">{transaction.reference}</p>
                  </div>
                )}
              </div>

              {/* Paiement */}
              {(transaction.paymentDate || transaction.paymentMethod || transaction.paidAt || transaction.method) && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <Euro className="h-5 w-5" />
                    Informations de paiement
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(transaction.paymentDate || transaction.paidAt) && (
                      <div>
                        <p className="text-sm text-gray-600">Date de paiement</p>
                        <p className="font-medium">{formatDate(transaction.paymentDate || transaction.paidAt || '')}</p>
                      </div>
                    )}
                    {(transaction.paymentMethod || transaction.method) && (
                      <div>
                        <p className="text-sm text-gray-600">Mode de paiement</p>
                        <p className="font-medium">
                          {PAYMENT_METHODS[(transaction.paymentMethod || transaction.method) as keyof typeof PAYMENT_METHODS] || (transaction.paymentMethod || transaction.method)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Période */}
              {(transaction.accountingMonth || transaction.monthsCovered) && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Période couverte
                  </h3>
                  
                  {/* Mois comptable - Format visible et important */}
                  {transaction.accountingMonth && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <p className="text-sm text-gray-600 mb-1">Mois comptable</p>
                      <p className="text-2xl font-bold text-blue-900">
                        {formatAccountingMonth(transaction.accountingMonth)}
                      </p>
                    </div>
                  )}
                  
                  {transaction.monthsCovered && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-600">Mois couverts</p>
                      <p className="font-medium">{transaction.monthsCovered} mois</p>
                    </div>
                  )}
                  
                  {/* Badge de série multi-mois - Debug et affichage */}
                  {(() => {
                    console.log('[TransactionDrawer] Badge check:', {
                      moisTotal: transaction.moisTotal,
                      moisIndex: transaction.moisIndex,
                      parentTransactionId: transaction.parentTransactionId,
                      willShow: !!(transaction.moisTotal && transaction.moisIndex)
                    });
                    
                    if (transaction.moisTotal && transaction.moisIndex) {
                      return (
                        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm text-blue-900 font-medium flex items-center gap-2">
                                Transaction multi-mois
                                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                                  Série ({transaction.moisTotal}) — {transaction.moisIndex}/{transaction.moisTotal}
                                </Badge>
                              </p>
                              <p className="text-xs text-blue-700 mt-1">
                                Cette transaction fait partie d'une série de {transaction.moisTotal} mois. 
                                Le nombre de mois couverts n'est modifiable qu'à la création.
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
                  {transaction.autoDistribution && (
                    <div className="mt-4">
                      <Badge variant="primary">Distribution automatique</Badge>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              {transaction.notes && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Notes</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{transaction.notes}</p>
                </div>
              )}

              {/* Métadonnées */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Informations système</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {transaction.accountingMonth && (
                    <div>
                      <p className="text-sm text-gray-600">Mois comptable</p>
                      <p className="font-medium">{transaction.accountingMonth}</p>
                    </div>
                  )}
                  {transaction.createdAt && (
                    <div>
                      <p className="text-sm text-gray-600">Créée le</p>
                      <p className="font-medium">{formatDate(transaction.createdAt)}</p>
                    </div>
                  )}
                  {transaction.updatedAt && (
                    <div>
                      <p className="text-sm text-gray-600">Modifiée le</p>
                      <p className="font-medium">{formatDate(transaction.updatedAt)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-600">ID Transaction</p>
                    <p className="font-mono text-xs text-gray-500">{transaction.id}</p>
                  </div>
                </div>
              </div>

              {/* Documents liés */}
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Documents liés
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className="text-gray-400"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Ajouter (bientôt)
                  </Button>
                </div>
                
                {transaction.Document && transaction.Document.length > 0 ? (
                  <div className="space-y-2">
                    {transaction.Document.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium">{doc.name}</p>
                          <p className="text-sm text-gray-600">
                            {doc.type} • {doc.createdAt ? formatDate(doc.createdAt) : 'Date inconnue'}
                          </p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => onViewDocument?.(doc.id, doc.name)}
                        >
                          Voir
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Aucun document lié</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
            <Button
              variant="outline"
              onClick={() => onDelete(transaction)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </Button>
            {/* Bouton Modifier masqué - le rapprochement se fait via la checkbox avec autosave */}
          </div>
        </div>
      </div>
    </div>
  );
}
