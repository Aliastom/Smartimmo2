import React from 'react';
import { notFound } from 'next/navigation';
import { tenantRepository } from '../../../infra/repositories/tenantRepository';
import TenantDetailClient from '../../../ui/tenants/TenantDetailClient';

interface TenantDetailPageProps {
  params: {
    id: string;
  };
}

export default async function TenantDetailPage({ params }: TenantDetailPageProps) {
  const tenant = await tenantRepository.findById(params.id);
  
  if (!tenant) {
    notFound();
  }

  return <TenantDetailClient tenant={tenant} />;
}
