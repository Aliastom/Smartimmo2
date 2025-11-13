'use client';

import React from 'react';
import { X, Download, Trash2, Paperclip } from 'lucide-react';

interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
}

interface AttachmentViewerProps {
  isOpen: boolean;
  onClose: () => void;
  attachments: Attachment[];
  title?: string;
  onDownload?: (attachment: Attachment) => void;
  onDelete?: (id: string) => void;
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.includes('pdf')) return '📄';
  if (mimeType.includes('word')) return '📝';
  if (mimeType.includes('excel')) return '📊';
  return '📎';
};

export default function AttachmentViewer({
  isOpen,
  onClose,
  attachments,
  title = 'Pièces jointes',
  onDownload,
  onDelete,
}: AttachmentViewerProps) {
  
  if (!isOpen) return null;

  const handleDownload = (attachment: Attachment) => {
    if (onDownload) {
      onDownload(attachment);
    } else {
      const link = document.createElement('a');
      link.href = attachment.url;
      link.download = attachment.filename;
      link.click();
    }
  };

  const handleDownloadAll = () => {
    attachments.forEach(attachment => {
      handleDownload(attachment);
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-base-content bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-base-100 rounded-lg shadow-xl max-w-2xl w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-neutral-200">
            <div className="flex items-center space-x-3">
              <Paperclip size={24} className="text-primary" />
              <div>
                <h2 className="text-xl font-semibold text-neutral-900">{title}</h2>
                <p className="text-sm text-neutral-600 mt-1">
                  {attachments.length} pièce{attachments.length > 1 ? 's' : ''} jointe{attachments.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {attachments.length > 1 && (
                <button
                  onClick={handleDownloadAll}
                  className="px-3 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-md hover:bg-green-100 transition-colors flex items-center space-x-2"
                >
                  <Download size={16} />
                  <span>Tout télécharger</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {attachments.length === 0 ? (
              <div className="text-center py-8">
                <Paperclip size={48} className="mx-auto text-neutral-300 mb-4" />
                <p className="text-neutral-500">Aucune pièce jointe</p>
              </div>
            ) : (
              <div className="space-y-3">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <span className="text-2xl flex-shrink-0">{getFileIcon(attachment.mimeType)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-neutral-900 truncate">
                          {attachment.filename}
                        </div>
                        <div className="text-sm text-neutral-500">
                          {formatFileSize(attachment.size)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
                      <button
                        onClick={() => handleDownload(attachment)}
                        className="p-2 text-success hover:text-green-800 hover:bg-green-50 rounded-md transition-colors"
                        title="Télécharger"
                      >
                        <Download size={18} />
                      </button>
                      {onDelete && (
                        <button
                          onClick={() => {
                            if (confirm(`Supprimer ${attachment.filename} ?`)) {
                              onDelete(attachment.id);
                            }
                          }}
                          className="p-2 text-error hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end p-6 border-t border-neutral-200">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 rounded-md hover:bg-neutral-200 transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

