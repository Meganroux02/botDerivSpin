import React from 'react';
import { BotConfig } from '../types';

interface ConfigPanelProps {
  config: BotConfig;
  setConfig: React.Dispatch<React.SetStateAction<BotConfig>>;
}

export default function ConfigPanel({ config, setConfig }: ConfigPanelProps) {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <i className="fas fa-sliders text-yellow-400"></i>
          Configuración del Bot
        </h2>

        {/* API Key */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <i className="fas fa-key mr-2 text-yellow-400"></i>
            API Token de Deriv
          </label>
          <input
            type="password"
            value={config.apiKey}
            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
            placeholder="Ingresa tu API token de Deriv..."
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-yellow-500 focus:outline-none transition-colors"
          />
          <p className="text-xs text-gray-500 mt-1">
            Obtén tu token en: <a href="https://app.deriv.com/account/api-token" target="_blank" rel="noopener" className="text-yellow-400 hover:underline">app.deriv.com/account/api-token</a>
          </p>
        </div>

        {/* Take Profit & Stop Loss */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <i className="fas fa-bullseye mr-2 text-green-400"></i>
              Take Profit ($)
            </label>
            <input
              type="number"
              value={config.takeProfit}
              onChange={(e) => setConfig({ ...config, takeProfit: parseFloat(e.target.value) || 0 })}
              min="1"
              step="1"
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-green-500 focus:outline-none transition-colors"
            />
            <p className="text-xs text-gray-500 mt-1">El bot se detendrá al alcanzar esta ganancia</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <i className="fas fa-shield-halved mr-2 text-red-400"></i>
              Stop Loss ($)
            </label>
            <input
              type="number"
              value={config.stopLoss}
              onChange={(e) => setConfig({ ...config, stopLoss: parseFloat(e.target.value) || 0 })}
              min="1"
              step="1"
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-red-500 focus:outline-none transition-colors"
            />
            <p className="text-xs text-gray-500 mt-1">El bot se detendrá al alcanzar esta pérdida</p>
          </div>
        </div>

        {/* Lot Size & Max Trades */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <i className="fas fa-layer-group mr-2 text-blue-400"></i>
              Tamaño de Lote
            </label>
            <input
              type="number"
              value={config.lotSize}
              onChange={(e) => setConfig({ ...config, lotSize: parseFloat(e.target.value) || 0.01 })}
              min="0.01"
              step="0.01"
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:outline-none transition-colors"
            />
            <p className="text-xs text-gray-500 mt-1">Volumen por operación (0.01 - 5.0)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <i className="fas fa-hashtag mr-2 text-purple-400"></i>
              Máximo de Operaciones
            </label>
            <input
              type="number"
              value={config.maxTrades}
              onChange={(e) => setConfig({ ...config, maxTrades: parseInt(e.target.value) || 1 })}
              min="1"
              step="1"
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:outline-none transition-colors"
            />
            <p className="text-xs text-gray-500 mt-1">Número máximo de operaciones por sesión</p>
          </div>
        </div>

        {/* Symbol Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <i className="fas fa-chart-line mr-2 text-orange-400"></i>
            Índice a Operar
          </label>
          <select
            value={config.symbol}
            onChange={(e) => setConfig({ ...config, symbol: e.target.value })}
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-orange-500 focus:outline-none transition-colors"
          >
            <optgroup label="Boom Indices">
              <option value="BOOM1000">Boom 1000</option>
              <option value="BOOM500">Boom 500</option>
              <option value="BOOM300">Boom 300</option>
            </optgroup>
            <optgroup label="Crash Indices">
              <option value="CRASH1000">Crash 1000</option>
              <option value="CRASH500">Crash 500</option>
              <option value="CRASH300">Crash 300</option>
            </optgroup>
          </select>
        </div>

        {/* Strategy */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <i className="fas fa-brain mr-2 text-pink-400"></i>
            Estrategia de Trading
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                value: 'spike_catcher',
                label: 'Spike Catcher',
                desc: 'Captura los spikes de Boom/Crash',
                icon: 'fa-bolt',
                color: 'yellow',
              },
              {
                value: 'trend_follow',
                label: 'Trend Follow',
                desc: 'Sigue la tendencia del mercado',
                icon: 'fa-arrow-trend-up',
                color: 'green',
              },
              {
                value: 'scalping',
                label: 'Scalping',
                desc: 'Operaciones rápidas con poco profit',
                icon: 'fa-bolt-lightning',
                color: 'blue',
              },
            ].map((strategy) => (
              <button
                key={strategy.value}
                onClick={() => setConfig({ ...config, strategy: strategy.value as BotConfig['strategy'] })}
                className={`p-4 rounded-lg border text-left transition-all ${
                  config.strategy === strategy.value
                    ? 'border-yellow-500 bg-yellow-500/10'
                    : 'border-gray-600 bg-gray-900 hover:border-gray-500'
                }`}
              >
                <i className={`fas ${strategy.icon} text-${strategy.color}-400 text-lg mb-2`}></i>
                <p className="text-sm font-medium text-white">{strategy.label}</p>
                <p className="text-xs text-gray-400 mt-1">{strategy.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <button className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]">
          <i className="fas fa-save mr-2"></i>
          Guardar Configuración
        </button>
      </div>

      {/* Info Card */}
      <div className="bg-blue-900/20 border border-blue-700/50 rounded-xl p-4">
        <h3 className="text-blue-400 font-medium flex items-center gap-2 mb-2">
          <i className="fas fa-info-circle"></i>
          Información Importante
        </h3>
        <ul className="text-sm text-blue-300/80 space-y-1">
          <li>• Boom indices: El precio sube gradualmente y hace spikes hacia arriba</li>
          <li>• Crash indices: El precio baja gradualmente y hace spikes hacia abajo</li>
          <li>• Para Boom: Compra para capturar los spikes alcistas</li>
          <li>• Para Crash: Vende para capturar los spikes bajistas</li>
          <li>• Los spikes ocurren en promedio cada N ticks (300, 500, o 1000)</li>
          <li>• Configura tu TP y SL según tu tolerancia al riesgo</li>
        </ul>
      </div>
    </div>
  );
}
