'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/shared/card';
import { Button } from '@/ui/shared/button';
import { Badge } from '@/ui/shared/badge';

export function ThemeDemo() {
  return (
    <div className="space-y-6 p-6">
      <h2 className="text-2xl font-bold text-base-content">Démonstration des thèmes</h2>
      
      {/* Couleurs principales */}
      <Card className="bg-base-100 border-base-300">
        <CardHeader>
          <CardTitle className="text-base-content">Couleurs principales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <Button className="btn-primary">Primary</Button>
            <Button className="btn-secondary">Secondary</Button>
            <Button className="btn-accent">Accent</Button>
            <Button className="btn-neutral">Neutral</Button>
          </div>
          
          <div className="flex gap-4 flex-wrap">
            <Button className="btn-info">Info</Button>
            <Button className="btn-success">Success</Button>
            <Button className="btn-warning">Warning</Button>
            <Button className="btn-error">Error</Button>
          </div>
        </CardContent>
      </Card>

      {/* Badges */}
      <Card className="bg-base-100 border-base-300">
        <CardHeader>
          <CardTitle className="text-base-content">Badges</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <Badge className="badge-primary">Primary</Badge>
            <Badge className="badge-secondary">Secondary</Badge>
            <Badge className="badge-accent">Accent</Badge>
            <Badge className="badge-success">Success</Badge>
            <Badge className="badge-warning">Warning</Badge>
            <Badge className="badge-error">Error</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Backgrounds */}
      <Card className="bg-base-100 border-base-300">
        <CardHeader>
          <CardTitle className="text-base-content">Arrière-plans</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-base-100 border border-base-300 rounded">
            <p className="text-base-content">Base-100 (fond principal)</p>
          </div>
          <div className="p-4 bg-base-200 border border-base-300 rounded">
            <p className="text-base-content">Base-200 (fond secondaire)</p>
          </div>
          <div className="p-4 bg-base-300 border border-base-300 rounded">
            <p className="text-base-content">Base-300 (fond tertiaire)</p>
          </div>
        </CardContent>
      </Card>

      {/* Alertes */}
      <div className="space-y-2">
        <div className="alert alert-info">
          <span>Information - Couleur info</span>
        </div>
        <div className="alert alert-success">
          <span>Succès - Couleur success</span>
        </div>
        <div className="alert alert-warning">
          <span>Attention - Couleur warning</span>
        </div>
        <div className="alert alert-error">
          <span>Erreur - Couleur error</span>
        </div>
      </div>
    </div>
  );
}
