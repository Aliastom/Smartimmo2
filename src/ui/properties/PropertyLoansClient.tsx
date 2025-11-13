'use client';

import React, { useState } from 'react';
import { Property } from '../../domain/entities/Property';
import { Loan } from '../../domain/entities/Loan';
import PropertyLoanTab from '../components/PropertyLoanTab';

interface PropertyLoansClientProps {
  property: Property;
  initialLoans: Loan[];
}

export default function PropertyLoansClient({ property, initialLoans }: PropertyLoansClientProps) {
  const [loan, setLoan] = useState<Loan | null>(initialLoans[0] || null);

  const refreshLoan = async () => {
    try {
      const res = await fetch(`/api/loans?propertyId=${property.id}`);
      if (res.ok) {
        const data = await res.json();
        setLoan(data[0] || null);
      }
    } catch (error) {
      console.error('Error refreshing loan:', error);
    }
  };

  return (
    <div>
      <PropertyLoanTab
        property={property}
        loan={loan}
        onUpdate={refreshLoan}
      />
    </div>
  );
}

