'use client';

import React, { useState, useEffect } from 'react';
import { Property } from '../../domain/entities/Property';
import { Payment } from '../../domain/entities/Payment';
import { Loan } from '../../domain/entities/Loan';
import PropertyProfitabilityTab from '../components/PropertyProfitabilityTab';

interface PropertyProfitabilityClientProps {
  property: Property;
}

export default function PropertyProfitabilityClient({ property }: PropertyProfitabilityClientProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [property.id]);

  const fetchData = async () => {
    try {
      const [paymentsRes, loansRes] = await Promise.all([
        fetch(`/api/payments?propertyId=${property.id}`),
        fetch(`/api/loans?propertyId=${property.id}`),
      ]);

      if (paymentsRes.ok) {
        const data = await paymentsRes.json();
        setPayments(data.items || []);
      }

      if (loansRes.ok) {
        const data = await loansRes.json();
        setLoan(data[0] || null);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Convertir payments (Payment[]) en transactions (Transaction[]) pour PropertyProfitabilityTab
  const transactions = payments.map((p: any) => ({
    id: p.id,
    date: new Date(p.date),
    amount: ['LOYER', 'CHARGES', 'DEPOT_RECU'].includes(p.Category) ? p.amount : -p.amount,
    label: p.label,
    type: ['LOYER', 'CHARGES', 'DEPOT_RECU'].includes(p.Category) ? 'revenue' : 'expense',
  }));

  if (loading) {
    return (
      <div className="bg-base-100 rounded-lg shadow-card p-6">
        <p className="text-neutral-500">Chargement...</p>
      </div>
    );
  }

  return (
    <div>
      <PropertyProfitabilityTab
        property={property}
        transactions={transactions as any}
        loan={loan}
      />
    </div>
  );
}

