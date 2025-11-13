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
  Legend,
} from 'recharts';

interface ChartCardProps {
  title: string;
  data: any[];
  dataKey: string;
  lineKey: string;
  color?: string;
}

const ChartCard: React.FC<ChartCardProps> = ({
  title,
  data,
  dataKey,
  lineKey,
  color = 'var(--p)', // primary daisyUI
}) => {
  return (
    <div className="bg-base-100 rounded-lg shadow-card p-6">
      <h3 className="text-lg font-semibold text-base-content mb-4">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--bc) / 0.2)" />
            <XAxis dataKey={dataKey} stroke="hsl(var(--bc) / 0.6)" />
            <YAxis stroke="hsl(var(--bc) / 0.6)" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--b1) / 0.95)',
                border: '1px solid hsl(var(--bc) / 0.2)',
                borderRadius: '8px',
              }}
              labelStyle={{ color: 'hsl(var(--bc))', fontWeight: 'bold' }}
              itemStyle={{ color: 'hsl(var(--bc) / 0.8)' }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey={lineKey}
              stroke={color}
              strokeWidth={2}
              dot={{ stroke: color, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ChartCard;
