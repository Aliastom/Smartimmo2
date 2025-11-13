'use client';

import React from 'react';
import { TenantEditModalV2 } from './TenantEditModalV2';

interface TenantEditModalWrapperProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  initialData?: any;
  title: string;
}

export function TenantEditModalWrapper(props: TenantEditModalWrapperProps) {
  return <TenantEditModalV2 {...props} />;
}
