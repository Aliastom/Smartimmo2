'use client';

import React from 'react';
import { Settings, Bell, Key, Shield } from 'lucide-react';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { BackToPropertyButton } from '@/components/shared/BackToPropertyButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

interface PropertySettingsClientProps {
  propertyId: string;
  propertyName: string;
}

export default function PropertySettingsClient({ propertyId, propertyName }: PropertySettingsClientProps) {
  return (
    <div className="space-y-6">
      {/* Le titre et le menu contextuel sont déjà dans PropertyHeader via le layout */}
      <div className="flex items-center justify-end mb-6">
        <BackToPropertyButton propertyId={propertyId} propertyName={propertyName} />
      </div>

      {/* Contenu paramètres */}
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Bell className="h-5 w-5 text-blue-600" />
                </div>
                <CardTitle>Notifications</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm">
                Configurez les alertes et notifications pour ce bien
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Key className="h-5 w-5 text-green-600" />
                </div>
                <CardTitle>Accès</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm">
                Gérez les droits d'accès et les utilisateurs autorisés
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Shield className="h-5 w-5 text-purple-600" />
                </div>
                <CardTitle>Sécurité</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm">
                Paramètres de sécurité et confidentialité
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Settings className="h-5 w-5 text-orange-600" />
                </div>
                <CardTitle>Général</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm">
                Paramètres généraux et préférences du bien
              </p>
            </CardContent>
          </Card>
        </div>
        
        <div className="text-center mt-8 p-6 bg-gray-50 rounded-lg">
          <p className="text-gray-600">
            Les paramètres détaillés seront bientôt disponibles
          </p>
        </div>
      </div>
    </div>
  );
}

