'use client';

import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

export interface LoyersRetardChartInternalProps {
  data: Array<{ month: string; count: number }>;
}

export default function LoyersRetardChartInternal({
  data,
}: LoyersRetardChartInternalProps) {
  // Formater le mois pour l'affichage (ex: "2025-11" -> "Nov 2025")
  const formatMonth = (month: string) => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    return date.toLocaleDateString('fr-FR', {
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div style={{ width: '100%', height: '300px' }}>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={data}
          margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="month"
            tickFormatter={formatMonth}
            stroke="#6b7280"
            fontSize={12}
          />
          <YAxis
            stroke="#6b7280"
            fontSize={12}
            label={{ value: 'Nombre de loyers', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            content={({ active, payload }: any) => {
              if (active && payload && payload.length > 0) {
                const data = payload[0].payload;
                return (
                  <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                    <p className="text-sm font-semibold text-gray-900 mb-2">
                      {formatMonth(data.month)}
                    </p>
                    <p className="text-xs text-gray-600">
                      Nombre: <span className="font-semibold text-red-600">{data.count}</span>
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#ef4444"
            strokeWidth={2}
            dot={{ fill: '#ef4444', r: 4 }}
            activeDot={{ r: 6 }}
            name="Nombre de loyers"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

