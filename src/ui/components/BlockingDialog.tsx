'use client';

import React from 'react';
import { X, AlertTriangle, Info, Home, Landmark, Users, Receipt, FileText, Camera, CreditCard } from 'lucide-react';
import Link from 'next/link';

import { HardBlockerItem, SoftInfoItem, ActionItem } from '../../types/deletion-guard';
import { useGuardTranslations } from '../../hooks/useGuardTranslations';

interface BlockingDialogProps {
  open: boolean;
  onClose: () => void;
  hardBlockers: Array<HardBlockerItem & { icon: string }>;
  softInfo: Array<SoftInfoItem & { icon: string }>;
  actions: ActionItem[];
}

const iconMap = {
  Home,
  Landmark,
  Users,
  Receipt,
  FileText,
  Camera,
  CreditCard,
  AlertTriangle,
  Info,
};

export default function BlockingDialog({
  open,
  onClose,
  hardBlockers,
  softInfo,
  actions
}: BlockingDialogProps) {
  const t = useGuardTranslations();
  
  console.log('BlockingDialog render:', { open, hardBlockers, softInfo, actions });
  
  if (!open) return null;

  const hasHardBlockers = hardBlockers.length > 0;
  const hasSoftInfo = softInfo.length > 0;

  if (!hasHardBlockers) return null;

  return (
    <div className="fixed inset-0 bg-base-content bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-base-100 rounded-lg shadow-xl max-w-lg w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-100 rounded-full">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            <h2 className="text-lg font-semibold text-neutral-900">
              {t.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-neutral-600 mb-6">
            {t.subtitle}
          </p>

          {/* Section A: À faire pour supprimer */}
          {hasHardBlockers && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center">
                <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full mr-2">
                  {t.sections.blocking.badge}
                </span>
                {t.sections.blocking.title}
              </h3>
              <div className="space-y-3">
                {hardBlockers.map((blocker, index) => {
                  const IconComponent = iconMap[blocker.icon as keyof typeof iconMap] || AlertTriangle;
                  return (
                    <div key={index} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <IconComponent className="h-4 w-4 text-error" />
                        <span className="font-medium text-neutral-900">{blocker.label}</span>
                      </div>
                      <div className="text-sm text-neutral-600">
                        {blocker.hint || `${blocker.count} élément(s)`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section B: Informations (aucune action requise) */}
          {hasSoftInfo && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center">
                <span className="px-2 py-1 bg-base-200 text-base-content text-xs rounded-full mr-2">
                  {t.sections.info.badge}
                </span>
                {t.sections.info.title}
              </h3>
              <div className="space-y-2">
                {softInfo.map((info, index) => {
                  const IconComponent = iconMap[info.icon as keyof typeof iconMap] || Info;
                  return (
                    <div key={index} className="flex items-center justify-between p-2 bg-base-200 rounded">
                      <div className="flex items-center space-x-2">
                        <IconComponent className="h-4 w-4 text-base-content opacity-80" />
                        <span className="text-sm text-base-content opacity-90">{info.label}</span>
                      </div>
                      <span className="text-sm text-base-content opacity-80">{info.count}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-base-content opacity-70 mt-3">
                {t.sections.info.help}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-neutral-200">
          {actions.map((action, index) => {
            const IconComponent = iconMap[action.icon as keyof typeof iconMap] || Info;
            return (
              <Link
                key={index}
                href={action.href}
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors flex items-center space-x-1"
              >
                <IconComponent className="h-4 w-4" />
                <span>{action.label}</span>
              </Link>
            );
          })}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary-600 text-base-100 text-sm font-medium rounded-md hover:bg-primary-700 transition-colors"
          >
            {t.actions.ok}
          </button>
        </div>
      </div>
    </div>
  );
}

