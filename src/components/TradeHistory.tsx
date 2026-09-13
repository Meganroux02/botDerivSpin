import React from 'react';
import { TradeRecord } from '../types';

interface TradeHistoryProps {
  trades: TradeRecord[];
}

export default function TradeHistory({ trades }: TradeHistoryProps) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
      <h3 className="text-lg font-semibold mb-4">
        <i className="fas fa-history text-blue-400 mr-2"></i>
        Historial de Operaciones
      </h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {trades.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">No hay operaciones aún</p>
        ) : (
          trades.map((trade) => (
            <div
              key={trade.id}
              className="flex items-center justify-between bg-gray-700/50 rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                  trade.type === 'BUY' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                }`}>
                  {trade.type}
                </span>
                <span className="text-sm text-gray-300">{trade.symbol}</span>
                <span className="text-xs text-gray-500">
                  {trade.timestamp.toLocaleTimeString()}
                </span>
              </div>
              <div className="text-right">
                <span className={`text-sm font-medium ${
                  (trade.profit ?? 0) > 0 ? 'text-green-400' : (trade.profit ?? 0) < 0 ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  {trade.status === 'open' ? 'Abierta' : `${(trade.profit ?? 0) > 0 ? '+' : ''}$${(trade.profit ?? 0).toFixed(2)}`}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
