'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';

export default function PipelineFunnelChart({ data }) {
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
          <p className="text-sm font-semibold text-foreground">{data.stage}</p>
          <p className="text-sm text-blue-600">Deals: {data.count}</p>
          <p className="text-sm text-purple-600">Value: {formatValue(data.value)}</p>
          <p className="text-sm text-orange-600">Avg Probability: {data.probability}%</p>
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-6"
    >
      <h3 className="text-lg font-semibold text-foreground mb-6">Pipeline Funnel Analysis</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="stage" stroke="#9ca3af" angle={-45} textAnchor="end" height={100} />
          <YAxis stroke="#9ca3af" />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} name="Deal Count" />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
        {data.map((stage) => (
          <div key={stage.stage} className="border border-border rounded-lg p-3">
            <p className="text-muted-foreground text-xs mb-1">{stage.stage}</p>
            <p className="text-lg font-bold text-foreground">{stage.count} deals</p>
            <p className="text-xs text-primary">Total: {formatValue(stage.value)}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
