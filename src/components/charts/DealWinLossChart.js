'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { motion } from 'framer-motion';

export default function DealWinLossChart({ data }) {
  const COLORS = ['#10b981', '#ef4444'];

  const formatValue = (value) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}K`;
    }
    return value.toString();
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-semibold text-foreground">{data.name}</p>
          <p className="text-sm">Deals: {data.deals}</p>
          <p className="text-sm">Value: {formatValue(data.value)}</p>
        </div>
      );
    }
    return null;
  };

  const totalValue = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-6"
    >
      <h3 className="text-lg font-semibold text-foreground mb-6">Deal Win/Loss Analysis</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, deals }) => `${name}: ${deals} deals`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-6 grid grid-cols-2 gap-4">
        {data.map((item, idx) => (
          <div key={idx} className="border border-border rounded-lg p-3">
            <p className={`text-sm font-semibold ${idx === 0 ? 'text-green-600' : 'text-red-600'}`}>
              {item.name}
            </p>
            <p className="text-lg font-bold text-foreground">{item.deals} deals</p>
            <p className="text-xs text-muted-foreground">{formatValue(item.value)}</p>
            <p className="text-xs text-muted-foreground">
              {((item.value / totalValue) * 100).toFixed(1)}% of value
            </p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
