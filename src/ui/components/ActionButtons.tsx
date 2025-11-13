'use client';

import React from 'react';
import { Edit, Trash2, Plus, Paperclip, Download, Eye } from 'lucide-react';

interface ActionButtonsProps {
  onEdit?: () => void;
  onDelete?: () => void;
  onAddTransaction?: () => void;
  onView?: () => void;
  onDownload?: () => void;
  onAttachments?: () => void;
  attachmentCount?: number;
  showAddTransaction?: boolean;
  showView?: boolean;
  showDownload?: boolean;
  showAttachments?: boolean;
}

export default function ActionButtons({ 
  onEdit, 
  onDelete, 
  onAddTransaction, 
  onView,
  onDownload,
  onAttachments,
  attachmentCount = 0,
  showAddTransaction = false,
  showView = false,
  showDownload = false,
  showAttachments = false
}: ActionButtonsProps) {
  return (
    <div className="flex gap-2 justify-center items-center">
      {showAddTransaction && onAddTransaction && (
        <button
          onClick={onAddTransaction}
          className="text-success hover:text-green-700 transition p-2 border border-green-200 rounded-md hover:bg-green-50 hover-pop press"
          title="Ajouter une transaction"
        >
          <Plus className="h-4 w-4" />
        </button>
      )}
      {showAttachments && onAttachments && (
        <button
          onClick={onAttachments}
          className="text-purple-600 hover:text-purple-700 transition p-2 border border-purple-200 rounded-md hover:bg-purple-50 relative hover-pop press"
          title="Pièces jointes"
        >
          <Paperclip className="h-4 w-4" />
          {attachmentCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-error text-base-100 text-xs rounded-full h-4 w-4 flex items-center justify-center">
              {attachmentCount}
            </span>
          )}
        </button>
      )}
      {showView && onView && (
        <button
          onClick={onView}
          className="text-primary hover:text-primary transition p-2 border border-blue-200 rounded-md hover:bg-blue-50 hover-pop press"
          title="Voir"
        >
          <Eye className="h-4 w-4" />
        </button>
      )}
      {showDownload && onDownload && (
        <button
          onClick={onDownload}
          className="text-success hover:text-green-700 transition p-2 border border-green-200 rounded-md hover:bg-green-50 hover-pop press"
          title="Télécharger"
        >
          <Download className="h-4 w-4" />
        </button>
      )}
      {onEdit && (
        <button
          onClick={onEdit}
          className="text-primary hover:text-primary transition p-2 border border-blue-200 rounded-md hover:bg-blue-50 hover-pop press"
          title="Aperçu"
        >
          <Eye className="h-4 w-4" />
        </button>
      )}
      {onDelete && (
        <button
          onClick={onDelete}
          className="text-error hover:text-red-700 transition p-2 border border-red-200 rounded-md hover:bg-red-50 hover-pop press"
          title="Supprimer"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
