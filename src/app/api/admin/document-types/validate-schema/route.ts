import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateSuggestionConfig, validateMetadataSchema } from '@/services/validation';

// Schémas de validation

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

const suggestionRuleSchema = z.object({
  pattern: z.string().min(1, 'Pattern is required'),
  apply_in: z.array(z.string()).min(1, 'At least one context is required'),
  mime_in: z.array(z.string()).optional(),
  ocr_keywords: z.array(z.string()).optional(),
  weight: z.number().min(0).max(10),
  type_code: z.string().min(1, 'Type code is required'),
  lock: z.boolean().default(false),
});

const suggestionConfigSchema = z.object({
  rules: z.array(suggestionRuleSchema).default([]),
  defaults_by_context: z.record(z.string()).optional(),
  mime_overrides: z.record(z.string()).optional(),
  postprocess: z.object({
    min_confidence_for_autoselect: z.number().min(0).max(1).optional(),
    ask_top3_below: z.number().min(0).max(1).optional(),
  }).optional(),
});

const metadataSchemaPropertySchema = z.object({
  type: z.string(),
  title: z.string(),
  description: z.string().optional(),
  enum: z.array(z.string()).optional(),
  format: z.string().optional(),
  required: z.boolean().optional(),
});

const metadataSchemaSchema = z.object({
  type: z.literal('object'),
  properties: z.record(metadataSchemaPropertySchema),
  required: z.array(z.string()).optional(),
});

const validateSchemaRequestSchema = z.object({
  type: z.enum(['suggestionConfig', 'metadataSchema']),
  data: z.any(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data } = validateSchemaRequestSchema.parse(body);

    let validationResult: any = {};

    if (type === 'suggestionConfig') {
      try {
        const validated = suggestionConfigSchema.parse(data);
        const advancedValidation = validateSuggestionConfig(validated);
        
        validationResult = {
          valid: advancedValidation.isValid,
          data: validated,
          message: advancedValidation.isValid ? 'Suggestion configuration is valid' : 'Suggestion configuration has errors',
          errors: advancedValidation.errors,
          warnings: advancedValidation.warnings
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          validationResult = {
            valid: false,
            errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
            message: 'Suggestion configuration validation failed'
          };
        } else {
          throw error;
        }
      }
    } else if (type === 'metadataSchema') {
      try {
        const validated = metadataSchemaSchema.parse(data);
        const advancedValidation = validateMetadataSchema(validated);
        
        validationResult = {
          valid: advancedValidation.isValid,
          data: validated,
          message: advancedValidation.isValid ? 'Metadata schema is valid' : 'Metadata schema has errors',
          errors: advancedValidation.errors,
          warnings: advancedValidation.warnings
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          validationResult = {
            valid: false,
            errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
            message: 'Metadata schema validation failed'
          };
        } else {
          throw error;
        }
      }
    }

    return NextResponse.json(validationResult);
  } catch (error) {
    console.error('Error validating schema:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          valid: false,
          error: 'Invalid request format', 
          details: error.errors 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        valid: false,
        error: 'Failed to validate schema' 
      },
      { status: 500 }
    );
  }
}
