import React from 'react';
import { X } from 'lucide-react';

interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function FormModal({ isOpen, onClose, title, children, footer }: FormModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900 bg-opacity-75 backdrop-blur-sm">
      <div className="bg-base-100 rounded-lg shadow-xl max-w-lg w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-500 hover:text-neutral-700 transition-colors"
        >
          <X size={24} />
        </button>
        <h2 className="text-2xl font-semibold text-neutral-900 mb-6">{title}</h2>
        <div className="max-h-[70vh] overflow-y-auto pr-2 -mr-2">
          {children}
        </div>
        {footer && <div className="mt-6 pt-4 border-t border-neutral-200 flex justify-end space-x-3">{footer}</div>}
      </div>
    </div>
  );
}
