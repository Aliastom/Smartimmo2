'use client';

import React from 'react';
import { DocumentMetadataSchema } from '@/types/document';
import { Input } from '@/ui/shared/input';
import { Label } from '@/ui/shared/label';
import { Textarea } from '@/ui/shared/textarea';
import { Button } from '@/ui/shared/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/shared/card';
import { Database, Plus, Trash2 } from 'lucide-react';

interface DynamicMetadataFormProps {
  schema: DocumentMetadataSchema;
  metadata: Record<string, any>;
  onChange: (metadata: Record<string, any>) => void;
  className?: string;
}

export function DynamicMetadataForm({ schema, metadata, onChange, className }: DynamicMetadataFormProps) {
  const handleFieldChange = (fieldName: string, value: any) => {
    onChange({
      ...metadata,
      [fieldName]: value,
    });
  };

  const handleArrayItemChange = (fieldName: string, index: number, value: any) => {
    const currentArray = metadata[fieldName] || [];
    const newArray = [...currentArray];
    newArray[index] = value;
    onChange({
      ...metadata,
      [fieldName]: newArray,
    });
  };

  const addArrayItem = (fieldName: string) => {
    const currentArray = metadata[fieldName] || [];
    onChange({
      ...metadata,
      [fieldName]: [...currentArray, ''],
    });
  };

  const removeArrayItem = (fieldName: string, index: number) => {
    const currentArray = metadata[fieldName] || [];
    const newArray = currentArray.filter((_: any, i: number) => i !== index);
    onChange({
      ...metadata,
      [fieldName]: newArray,
    });
  };

  const renderField = (fieldName: string, fieldSchema: any) => {
    const isRequired = schema.required?.includes(fieldName);
    const value = metadata[fieldName] || '';

    switch (fieldSchema.type) {
      case 'string':
        if (fieldSchema.format === 'textarea') {
          return (
            <div key={fieldName} className="space-y-2">
              <Label htmlFor={fieldName}>
                {fieldSchema.title}
                {isRequired && <span className="text-error ml-1">*</span>}
              </Label>
              <Textarea
                id={fieldName}
                value={value}
                onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                placeholder={fieldSchema.description}
                rows={3}
              />
              {fieldSchema.description && (
                <p className="text-sm text-muted-foreground">{fieldSchema.description}</p>
              )}
            </div>
          );
        }

        if (fieldSchema.enum) {
          return (
            <div key={fieldName} className="space-y-2">
              <Label htmlFor={fieldName}>
                {fieldSchema.title}
                {isRequired && <span className="text-error ml-1">*</span>}
              </Label>
              <select
                id={fieldName}
                value={value}
                onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Sélectionner...</option>
                {fieldSchema.enum.map((option: string) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {fieldSchema.description && (
                <p className="text-sm text-muted-foreground">{fieldSchema.description}</p>
              )}
            </div>
          );
        }

        return (
          <div key={fieldName} className="space-y-2">
            <Label htmlFor={fieldName}>
              {fieldSchema.title}
              {isRequired && <span className="text-error ml-1">*</span>}
            </Label>
            <Input
              id={fieldName}
              type={fieldSchema.format === 'date' ? 'date' : fieldSchema.format === 'email' ? 'email' : 'text'}
              value={value}
              onChange={(e) => handleFieldChange(fieldName, e.target.value)}
              placeholder={fieldSchema.description}
            />
            {fieldSchema.description && (
              <p className="text-sm text-muted-foreground">{fieldSchema.description}</p>
            )}
          </div>
        );

      case 'number':
        return (
          <div key={fieldName} className="space-y-2">
            <Label htmlFor={fieldName}>
              {fieldSchema.title}
              {isRequired && <span className="text-error ml-1">*</span>}
            </Label>
            <Input
              id={fieldName}
              type="number"
              value={value}
              onChange={(e) => handleFieldChange(fieldName, parseFloat(e.target.value) || 0)}
              placeholder={fieldSchema.description}
            />
            {fieldSchema.description && (
              <p className="text-sm text-muted-foreground">{fieldSchema.description}</p>
            )}
          </div>
        );

      case 'boolean':
        return (
          <div key={fieldName} className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={fieldName}
                checked={value || false}
                onChange={(e) => handleFieldChange(fieldName, e.target.checked)}
                className="rounded"
              />
              <Label htmlFor={fieldName}>
                {fieldSchema.title}
                {isRequired && <span className="text-error ml-1">*</span>}
              </Label>
            </div>
            {fieldSchema.description && (
              <p className="text-sm text-muted-foreground">{fieldSchema.description}</p>
            )}
          </div>
        );

      case 'array':
        const arrayValue = value || [];
        return (
          <div key={fieldName} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={fieldName}>
                {fieldSchema.title}
                {isRequired && <span className="text-error ml-1">*</span>}
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addArrayItem(fieldName)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Ajouter
              </Button>
            </div>
            
            {arrayValue.map((item: any, index: number) => (
              <div key={index} className="flex items-center space-x-2">
                <Input
                  value={item}
                  onChange={(e) => handleArrayItemChange(fieldName, index, e.target.value)}
                  placeholder={`Élément ${index + 1}`}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeArrayItem(fieldName, index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            
            {fieldSchema.description && (
              <p className="text-sm text-muted-foreground">{fieldSchema.description}</p>
            )}
          </div>
        );

      default:
        return (
          <div key={fieldName} className="space-y-2">
            <Label htmlFor={fieldName}>
              {fieldSchema.title} ({fieldSchema.type})
              {isRequired && <span className="text-error ml-1">*</span>}
            </Label>
            <Input
              id={fieldName}
              value={value}
              onChange={(e) => handleFieldChange(fieldName, e.target.value)}
              placeholder={fieldSchema.description}
            />
            {fieldSchema.description && (
              <p className="text-sm text-muted-foreground">{fieldSchema.description}</p>
            )}
          </div>
        );
    }
  };

  if (!schema || !schema.Property || Object.keys(schema.Property).length === 0) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Métadonnées spécifiques
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(schema.Property).map(([fieldName, fieldSchema]) =>
          renderField(fieldName, fieldSchema)
        )}
      </CardContent>
    </Card>
  );
}
