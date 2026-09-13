import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import ConfigPanel from './components/ConfigPanel';
import MQL5Generator from './components/MQL5Generator';
import { BotConfig, TradeRecord, TickData } from './types';

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'config' | 'code'>('dashboard');
  const [isConnected, setIsConnected] = useState(false);
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [currentSymbol, setCurrentSymbol] = useState('BOOM1000');
  const [ticks, setTicks] = useState<TickData[]>([]);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [config, setConfig] = useState<BotConfig>({
    takeProfit: 50,
    stopLoss: 25,
    lotSize: 0.2,
    symbol: 'BOOM1000',
    strategy: 'spike_catcher',
    maxTrades: 10,
    apiKey: '',
  });

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center">
              <i className="fas fa-robot text-white text-lg"></i>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Deriv Boom & Crash Bot</h1>
              <p className="text-xs text-gray-400">MT5 Trading Panel</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${isConnected ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
              {isConnected ? 'Conectado' : 'Desconectado'}
            </div>
            <button
              onClick={() => setIsBotRunning(!isBotRunning)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                isBotRunning
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              <i className={`fas ${isBotRunning ? 'fa-stop' : 'fa-play'} mr-2`}></i>
              {isBotRunning ? 'Detener Bot' : 'Iniciar Bot'}
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-gray-800/50 border-b border-gray-700 px-6">
        <div className="max-w-7xl mx-auto flex gap-1">
          {[
            { id: 'dashboard' as const, label: 'Dashboard', icon: 'fa-chart-line' },
            { id: 'config' as const, label: 'Configuración', icon: 'fa-cog' },
            { id: 'code' as const, label: 'Código MQL5', icon: 'fa-code' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-yellow-400 text-yellow-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <i className={`fas ${tab.icon} mr-2`}></i>
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'dashboard' && (
          <Dashboard
            config={config}
            isBotRunning={isBotRunning}
            isConnected={isConnected}
            setIsConnected={setIsConnected}
            ticks={ticks}
            setTicks={setTicks}
            trades={trades}
            setTrades={setTrades}
            currentSymbol={currentSymbol}
            setCurrentSymbol={setCurrentSymbol}
          />
        )}
        {activeTab === 'config' && (
          <ConfigPanel config={config} setConfig={setConfig} />
        )}
        {activeTab === 'code' && (
          <MQL5Generator config={config} />
        )}
      </main>
    </div>
  );
}

export default App;
