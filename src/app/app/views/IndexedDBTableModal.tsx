'use client';

/**
 * Modal pour afficher les données d'une table IndexedDB
 */

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { Loader2 } from 'lucide-react';
import { getLocalDB } from '@/lib/offline/db';

interface IndexedDBTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableName: string;
  label: string;
  organizationId: string;
}

export function IndexedDBTableModal({
  isOpen,
  onClose,
  tableName,
  label,
  organizationId,
}: IndexedDBTableModalProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;

  useEffect(() => {
    if (!isOpen || !tableName || !organizationId) {
      setData([]);
      setError(null);
      setCurrentPage(1); // Réinitialiser la page quand on ferme/ouvre
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const db = await getLocalDB();
        
        // ⚠️ CRITIQUE: Si la DB est indisponible, afficher une erreur claire
        if (!db) {
          setError('La base de données locale n\'est pas accessible. Veuillez réessayer ou réinitialiser les données locales.');
          setLoading(false);
          return;
        }
        
        // ⚠️ GESTION SPÉCIALE POUR TRANSACTION : db.Transaction est une fonction au lieu d'un objet Table
        let table: any;
        if (tableName === 'Transaction') {
          table = (db as any).Transaction;
          if (!table || typeof table === 'function' || typeof table.where !== 'function') {
            const transactionTable = db.tables.find((t: any) => t.name === 'Transaction');
            if (transactionTable && typeof transactionTable.where === 'function') {
              table = transactionTable;
            } else {
              throw new Error('Table Transaction non accessible dans IndexedDB');
            }
          }
        } else {
          table = (db as any)[tableName];
        }
        
        if (!table || typeof table.where !== 'function') {
          throw new Error(`Table ${tableName} n'est pas une table Dexie valide`);
        }

        // Filtrer par organizationId si la table en a un (pas les tables de référence)
        const isReferenceTable = [
          'Category', 'NatureEntity', 'DocumentType', 'FiscalType', 
          'FiscalRegime', 'ManagementCompany', 'Signal', 'FiscalCompatibility'
        ].includes(tableName);

        let items: any[];
        if (isReferenceTable) {
          // Tables de référence : récupérer tout
          items = await table.toArray();
        } else {
          // Tables métier : filtrer par organizationId
          items = await table.where('organizationId').equals(organizationId).toArray();
        }

        // Trier par date de création (plus récent en premier)
        // Chercher un champ de date dans l'ordre : createdAt, date, uploadedAt, updatedAt
        items.sort((a, b) => {
          const dateFields = ['createdAt', 'date', 'uploadedAt', 'updatedAt'];
          for (const field of dateFields) {
            if (a[field] || b[field]) {
              const dateA = a[field] ? new Date(a[field]).getTime() : 0;
              const dateB = b[field] ? new Date(b[field]).getTime() : 0;
              if (dateA !== dateB) {
                return dateB - dateA; // Descendant (plus récent en premier)
              }
            }
          }
          return 0; // Pas de tri si aucune date trouvée
        });

        setData(items);
      } catch (err: any) {
        console.error(`[IndexedDBTableModal] Erreur lors du chargement de ${tableName}:`, err);
        setError(err.message || 'Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, tableName, organizationId]);

  // Extraire les clés de la première ligne pour les colonnes
  const columns = data.length > 0 ? Object.keys(data[0]) : [];

  // Filtrer les colonnes sensibles ou peu utiles
  const filteredColumns = columns.filter(col => 
    !col.includes('password') && 
    !col.includes('token') && 
    !col.includes('secret') &&
    col !== '__typename'
  );

  // Calculs de pagination
  const totalPages = Math.ceil(data.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = data.slice(startIndex, endIndex);

  // Réinitialiser à la page 1 si on change de table
  useEffect(() => {
    if (isOpen && tableName) {
      setCurrentPage(1);
    }
  }, [isOpen, tableName]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Données IndexedDB : ${label}`}
      size="xl"
    >
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <span className="ml-3 text-gray-600">Chargement des données...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        ) : data.length === 0 ? (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
            <p className="text-gray-600">Aucune donnée trouvée dans cette table</p>
          </div>
        ) : (
          <>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
                <table className="w-full min-w-full border-collapse">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      {filteredColumns.map((col) => (
                        <th
                          key={col}
                          className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap bg-gray-50"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedData.map((row, idx) => (
                      <tr key={startIndex + idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        {filteredColumns.map((col) => (
                          <td
                            key={col}
                            className="px-4 py-2 text-sm text-gray-900 border-b border-gray-100 whitespace-nowrap"
                          >
                            {(() => {
                              const value = row[col];
                              if (value === null || value === undefined) {
                                return <span className="text-gray-400">—</span>;
                              }
                              if (typeof value === 'object') {
                                return (
                                  <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
                                    {JSON.stringify(value).substring(0, 100)}
                                  </code>
                                );
                              }
                              if (typeof value === 'boolean') {
                                return value ? '✓' : '✗';
                              }
                              if (typeof value === 'string' && value.length > 100) {
                                return (
                                  <span title={value} className="truncate block max-w-xs">
                                    {value.substring(0, 100)}...
                                  </span>
                                );
                              }
                              return <span className="truncate block max-w-xs">{String(value)}</span>;
                            })()}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Pagination */}
            {data.length > itemsPerPage && (
              <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                <div className="text-sm text-gray-600">
                  Affichage de {startIndex + 1} à {Math.min(endIndex, data.length)} sur {data.length} résultats
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Précédent
                  </button>
                  <span className="text-sm text-gray-700">
                    Page {currentPage} sur {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}
            {data.length <= itemsPerPage && data.length > 0 && (
              <div className="text-sm text-gray-600 text-center mt-2">
                {data.length} résultat{data.length > 1 ? 's' : ''} au total
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

