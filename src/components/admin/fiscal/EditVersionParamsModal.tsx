/**
 * Modal d'édition des paramètres fiscaux d'une version
 * Permet d'éditer les barèmes IR, PS, micro, déficit foncier, PER, etc.
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/ui/shared/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Plus, Trash2, Save } from 'lucide-react';

interface EditVersionParamsModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  version: any;
}

export function EditVersionParamsModal({
  open,
  onClose,
  onSuccess,
  version,
}: EditVersionParamsModalProps) {
  const [loading, setLoading] = useState(false);
  const [params, setParams] = useState<any>(null);

  useEffect(() => {
    if (version?.params?.jsonData) {
      const parsed = JSON.parse(version.params.jsonData);
      // Initialiser tous les champs avec des valeurs par défaut pour éviter les erreurs
      setParams({
        // Barème IR
        irBrackets: [],
        
        // Décote IR
        irDecote: {
          seuilCelibataire: 1929,
          seuilCouple: 3858,
          facteur: 0.75
        },
        
        // Abattement forfaitaire salaires (Article 83 CGI)
        salaryDeduction: {
          taux: 0.10,      // 10%
          min: 472,        // Min 2025
          max: 13522,      // Max 2025
        },
        
        // Prélèvements sociaux
        psRate: 0.172,
        
        // Régimes micro
        micro: {
          foncier: {
            plafond: 15000,
            abattement: 0.30
          },
          bic: {
            vente: {
              plafond: 188700,
              abattement: 0.71
            },
            services: {
              plafond: 77700,
              abattement: 0.50
            }
          }
        },
        
        // Déficit foncier
        deficitFoncier: {
          plafondImputationRevenuGlobal: 10700,
          reportYears: 10
        },
        
        // PER
        per: {
          plafondBase: 4399,
          plafondMaxPASSMultiple: 8
        },
        
        // SCI IS
        sciIS: {
          tauxReduit: 0.15,
          plafondTauxReduit: 42500,
          tauxNormal: 0.25
        },
        
        // Écraser avec les valeurs réelles si elles existent
        ...parsed,
      });
    }
  }, [version]);

  const handleSave = async () => {
    if (!params) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/tax/versions/${version.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonData: JSON.stringify(params),
        }),
      });

      if (response.ok) {
        alert('✅ Paramètres mis à jour avec succès');
        onSuccess();
        onClose();
      } else {
        const errorData = await response.json();
        alert(`❌ Erreur lors de la mise à jour: ${errorData.error || 'Erreur inconnue'}`);
      }
    } catch (error) {
      console.error('Erreur:', error);
      alert('❌ Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  const addIRBracket = () => {
    setParams({
      ...params,
      irBrackets: [
        ...(params.irBrackets || []),
        { lower: 0, upper: null, rate: 0 },
      ],
    });
  };

  const removeIRBracket = (index: number) => {
    setParams({
      ...params,
      irBrackets: (params.irBrackets || []).filter((_: any, i: number) => i !== index),
    });
  };

  const updateIRBracket = (index: number, field: string, value: any) => {
    const newBrackets = [...(params.irBrackets || [])];
    newBrackets[index] = { ...newBrackets[index], [field]: value };
    setParams({ ...params, irBrackets: newBrackets });
  };

  const formatEuro = (amount: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
    }).format(amount);

  const formatPercent = (rate: number) => `${(rate * 100).toFixed(2)}%`;

  if (!params) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Éditer les paramètres fiscaux - {version?.code}
          </DialogTitle>
          <DialogDescription>
            Modifiez les barèmes et paramètres fiscaux de cette version
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="ir" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="ir">IR</TabsTrigger>
            <TabsTrigger value="ps">PS</TabsTrigger>
            <TabsTrigger value="micro">Micro</TabsTrigger>
            <TabsTrigger value="deficit">Déficit</TabsTrigger>
            <TabsTrigger value="per">PER</TabsTrigger>
          </TabsList>

          {/* ========== ONGLET IR ========== */}
          <TabsContent value="ir" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Barème IR</CardTitle>
                <Button size="sm" onClick={addIRBracket}>
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter une tranche
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {(params.irBrackets || []).map((bracket: any, index: number) => (
                  <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="flex-1 grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Seuil inférieur (€)</Label>
                        <Input
                          type="number"
                          value={bracket.lower}
                          onChange={(e) =>
                            updateIRBracket(index, 'lower', parseFloat(e.target.value))
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Seuil supérieur (€)</Label>
                        <Input
                          type="number"
                          value={bracket.upper || ''}
                          onChange={(e) =>
                            updateIRBracket(
                              index,
                              'upper',
                              e.target.value ? parseFloat(e.target.value) : null
                            )
                          }
                          placeholder="∞ (infini)"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Taux (0-1)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={bracket.rate}
                          onChange={(e) =>
                            updateIRBracket(index, 'rate', parseFloat(e.target.value))
                          }
                        />
                        <p className="text-xs text-gray-500">{formatPercent(bracket.rate)}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeIRBracket(index)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Décote IR</CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <Label>Seuil de décote (€)</Label>
                  <Input
                    type="number"
                    value={params.irDecote?.threshold || 0}
                    onChange={(e) =>
                      setParams({
                        ...params,
                        irDecote: {
                          ...params.irDecote,
                          threshold: parseFloat(e.target.value),
                        },
                      })
                    }
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Seuil en dessous duquel la décote s'applique
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 🆕 Abattement forfaitaire salaires */}
            <Card>
              <CardHeader>
                <CardTitle>Abattement forfaitaire salaires (Article 83 CGI)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Taux d'abattement (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={(params.salaryDeduction?.taux || 0.10) * 100}
                    onChange={(e) =>
                      setParams({
                        ...params,
                        salaryDeduction: {
                          ...(params.salaryDeduction || { min: 472, max: 13522 }),
                          taux: parseFloat(e.target.value) / 100,
                        },
                      })
                    }
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Abattement forfaitaire sur les salaires bruts (généralement 10%)
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Minimum (€)</Label>
                    <Input
                      type="number"
                      value={params.salaryDeduction?.min || 472}
                      onChange={(e) =>
                        setParams({
                          ...params,
                          salaryDeduction: {
                            ...(params.salaryDeduction || { taux: 0.10, max: 13522 }),
                            min: parseFloat(e.target.value),
                          },
                        })
                      }
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Abattement minimum garanti
                    </p>
                  </div>
                  
                  <div>
                    <Label>Maximum (€)</Label>
                    <Input
                      type="number"
                      value={params.salaryDeduction?.max || 13522}
                      onChange={(e) =>
                        setParams({
                          ...params,
                          salaryDeduction: {
                            ...(params.salaryDeduction || { taux: 0.10, min: 472 }),
                            max: parseFloat(e.target.value),
                          },
                        })
                      }
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Plafond de l'abattement
                    </p>
                  </div>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <p className="text-xs text-blue-900">
                    <strong>Exemple :</strong> Salaire brut 50 000 € → Abattement {((params.salaryDeduction?.taux || 0.10) * 100).toFixed(0)}% = {Math.min(Math.max(50000 * (params.salaryDeduction?.taux || 0.10), params.salaryDeduction?.min || 472), params.salaryDeduction?.max || 13522).toLocaleString('fr-FR')} € 
                    → Revenu net imposable : {(50000 - Math.min(Math.max(50000 * (params.salaryDeduction?.taux || 0.10), params.salaryDeduction?.min || 472), params.salaryDeduction?.max || 13522)).toLocaleString('fr-FR')} €
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== ONGLET PS ========== */}
          <TabsContent value="ps">
            <Card>
              <CardHeader>
                <CardTitle>Prélèvements Sociaux</CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <Label>Taux PS (0-1)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    max="1"
                    value={params.psRate}
                    onChange={(e) =>
                      setParams({ ...params, psRate: parseFloat(e.target.value) })
                    }
                  />
                  <p className="text-sm text-gray-600 mt-2">
                    Taux actuel : <strong>{formatPercent(params.psRate)}</strong>
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== ONGLET MICRO ========== */}
          <TabsContent value="micro" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Micro-foncier</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Abattement (0-1)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={params.micro.foncierAbattement}
                    onChange={(e) =>
                      setParams({
                        ...params,
                        micro: {
                          ...params.micro,
                          foncierAbattement: parseFloat(e.target.value),
                        },
                      })
                    }
                  />
                  <p className="text-xs text-gray-500">
                    {formatPercent(params.micro.foncierAbattement)} d'abattement
                  </p>
                </div>
                <div>
                  <Label>Plafond (€)</Label>
                  <Input
                    type="number"
                    value={params.micro.foncierPlafond}
                    onChange={(e) =>
                      setParams({
                        ...params,
                        micro: {
                          ...params.micro,
                          foncierPlafond: parseFloat(e.target.value),
                        },
                      })
                    }
                  />
                  <p className="text-xs text-gray-500">
                    {formatEuro(params.micro.foncierPlafond)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Micro-BIC (Meublé)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Abattement (0-1)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={params.micro.bicAbattement}
                    onChange={(e) =>
                      setParams({
                        ...params,
                        micro: { ...params.micro, bicAbattement: parseFloat(e.target.value) },
                      })
                    }
                  />
                  <p className="text-xs text-gray-500">
                    {formatPercent(params.micro.bicAbattement)} d'abattement
                  </p>
                </div>
                <div>
                  <Label>Plafond (€)</Label>
                  <Input
                    type="number"
                    value={params.micro.bicPlafond}
                    onChange={(e) =>
                      setParams({
                        ...params,
                        micro: { ...params.micro, bicPlafond: parseFloat(e.target.value) },
                      })
                    }
                  />
                  <p className="text-xs text-gray-500">{formatEuro(params.micro.bicPlafond)}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Meublé Tourisme Classé</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Abattement (0-1)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={params.micro.meubleTourismeAbattement || 0}
                    onChange={(e) =>
                      setParams({
                        ...params,
                        micro: {
                          ...params.micro,
                          meubleTourismeAbattement: parseFloat(e.target.value),
                        },
                      })
                    }
                  />
                  <p className="text-xs text-gray-500">
                    {formatPercent(params.micro.meubleTourismeAbattement || 0)} d'abattement
                  </p>
                </div>
                <div>
                  <Label>Plafond (€)</Label>
                  <Input
                    type="number"
                    value={params.micro.meubleTourismePlafond || 0}
                    onChange={(e) =>
                      setParams({
                        ...params,
                        micro: {
                          ...params.micro,
                          meubleTourismePlafond: parseFloat(e.target.value),
                        },
                      })
                    }
                  />
                  <p className="text-xs text-gray-500">
                    {formatEuro(params.micro.meubleTourismePlafond || 0)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== ONGLET DÉFICIT FONCIER ========== */}
          <TabsContent value="deficit">
            <Card>
              <CardHeader>
                <CardTitle>Déficit Foncier</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Plafond imputation revenu global (€)</Label>
                  <Input
                    type="number"
                    value={params.deficitFoncier.plafondImputationRevenuGlobal}
                    onChange={(e) =>
                      setParams({
                        ...params,
                        deficitFoncier: {
                          ...params.deficitFoncier,
                          plafondImputationRevenuGlobal: parseFloat(e.target.value),
                        },
                      })
                    }
                  />
                  <p className="text-xs text-gray-500">
                    {formatEuro(params.deficitFoncier.plafondImputationRevenuGlobal)}
                  </p>
                </div>
                <div>
                  <Label>Durée de report (années)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="20"
                    value={params.deficitFoncier.dureeReport}
                    onChange={(e) =>
                      setParams({
                        ...params,
                        deficitFoncier: {
                          ...params.deficitFoncier,
                          dureeReport: parseInt(e.target.value),
                        },
                      })
                    }
                  />
                  <p className="text-xs text-gray-500">
                    {params.deficitFoncier.dureeReport} ans
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== ONGLET PER ========== */}
          <TabsContent value="per">
            <Card>
              <CardHeader>
                <CardTitle>Plan Épargne Retraite (PER)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Taux plafond (0-1)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={params.per.tauxPlafond}
                    onChange={(e) =>
                      setParams({
                        ...params,
                        per: { ...params.per, tauxPlafond: parseFloat(e.target.value) },
                      })
                    }
                  />
                  <p className="text-xs text-gray-500">
                    {formatPercent(params.per.tauxPlafond)} des revenus professionnels
                  </p>
                </div>
                <div>
                  <Label>Plancher légal (€)</Label>
                  <Input
                    type="number"
                    value={params.per.plancherLegal}
                    onChange={(e) =>
                      setParams({
                        ...params,
                        per: { ...params.per, plancherLegal: parseFloat(e.target.value) },
                      })
                    }
                  />
                  <p className="text-xs text-gray-500">{formatEuro(params.per.plancherLegal)}</p>
                </div>
                <div>
                  <Label>Durée report reliquats (années)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="10"
                    value={params.per.dureeReportReliquats}
                    onChange={(e) =>
                      setParams({
                        ...params,
                        per: { ...params.per, dureeReportReliquats: parseInt(e.target.value) },
                      })
                    }
                  />
                  <p className="text-xs text-gray-500">{params.per.dureeReportReliquats} ans</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            <Save className="mr-2 h-4 w-4" />
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

