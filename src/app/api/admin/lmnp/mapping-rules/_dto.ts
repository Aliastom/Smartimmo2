import type { Prisma } from '@prisma/client';

export const lmnpRuleAdminInclude = {
  Organization: { select: { name: true } },
  Category: { select: { label: true, slug: true } },
  Property: { select: { name: true } },
} as const;

export type LmnpRuleWithRelations = Prisma.LmnpExportMappingRuleGetPayload<{
  include: typeof lmnpRuleAdminInclude;
}>;

export function toLmnpRuleAdminDto(r: LmnpRuleWithRelations) {
  return {
    id: r.id,
    organizationId: r.organizationId,
    organizationName: r.Organization.name,
    exerciseYear: r.exerciseYear,
    propertyId: r.propertyId,
    propertyName: r.Property?.name ?? null,
    natureCode: r.natureCode,
    categoryId: r.categoryId,
    categoryLabel: r.Category?.label ?? null,
    categorySlug: r.Category?.slug ?? null,
    lmnpBucket: r.lmnpBucket,
    lmnpLabel: r.lmnpLabel,
    priority: r.priority,
    mappingVersion: r.mappingVersion,
    active: r.active,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}
