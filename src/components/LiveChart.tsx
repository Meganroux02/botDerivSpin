import React from 'react';
import { TickData } from '../types';

interface LiveChartProps {
  ticks: TickData[];
  symbol: string;
}

export default function LiveChart({ ticks, symbol }: LiveChartProps) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
      <h3 className="text-lg font-semibold mb-4">
        <i className="fas fa-chart-area text-yellow-400 mr-2"></i>
        {symbol} - Live Chart
      </h3>
      <div className="h-64 flex items-center justify-center text-gray-500">
        {ticks.length === 0 ? (
          <p>Inicia el bot para ver el gráfico en vivo</p>
        ) : (
          <p>Gráfico renderizado en Dashboard</p>
        )}
      </div>
    </div>
  );
}
