import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BotConfig, TradeRecord, TickData } from '../types';

interface DashboardProps {
  config: BotConfig;
  isBotRunning: boolean;
  isConnected: boolean;
  setIsConnected: (v: boolean) => void;
  ticks: TickData[];
  setTicks: React.Dispatch<React.SetStateAction<TickData[]>>;
  trades: TradeRecord[];
  setTrades: React.Dispatch<React.SetStateAction<TradeRecord[]>>;
  currentSymbol: string;
  setCurrentSymbol: (v: string) => void;
}

const SYMBOLS = [
  { value: 'BOOM1000', label: 'Boom 1000', emoji: '🚀' },
  { value: 'BOOM500', label: 'Boom 500', emoji: '📈' },
  { value: 'BOOM300', label: 'Boom 300', emoji: '⬆️' },
  { value: 'CRASH1000', label: 'Crash 1000', emoji: '💥' },
  { value: 'CRASH500', label: 'Crash 500', emoji: '📉' },
  { value: 'CRASH300', label: 'Crash 300', emoji: '⬇️' },
];

export default function Dashboard({
  config,
  isBotRunning,
  isConnected,
  setIsConnected,
  ticks,
  setTicks,
  trades,
  setTrades,
  currentSymbol,
  setCurrentSymbol,
}: DashboardProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(!config.apiKey);
  const [balance, setBalance] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);
  const [openTrades, setOpenTrades] = useState(0);
  const [lastPrice, setLastPrice] = useState(0);
  const [priceChange, setPriceChange] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [accountId, setAccountId] = useState('');
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const prevPriceRef = useRef(0);
  const reqIdRef = useRef(1);
  const pendingProposalsRef = useRef<Map<number, { type: 'BUY' | 'SELL', lotSize: number, symbol: string }>>(new Map());

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${time}] ${msg}`, ...prev].slice(0, 50));
  }, []);

  // Determine demo mode based on API key
  useEffect(() => {
    setIsDemoMode(!config.apiKey);
  }, [config.apiKey]);

  // Connect to Deriv WebSocket API
  useEffect(() => {
    if (isBotRunning) {
      addLog('Conectando a Deriv API...');
      try {
        const ws = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');

        ws.onopen = () => {
          setIsConnected(true);
          addLog('✅ Conectado a Deriv WebSocket');

          // If API key provided, authorize
          if (config.apiKey && !isDemoMode) {
            addLog('🔐 Autorizando con API Token...');
            ws.send(JSON.stringify({
              authorize: config.apiKey,
              req_id: reqIdRef.current++,
            }));
          } else {
            addLog('🎮 Modo DEMO activado (sin API Token)');
            // Subscribe to ticks anyway
            ws.send(JSON.stringify({
              ticks: currentSymbol,
              subscribe: 1,
              req_id: reqIdRef.current++,
            }));
            addLog(`📊 Suscrito a ticks de ${currentSymbol}`);
            setBalance(10000); // Demo balance
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            handleWsMessage(data, ws);
          } catch (e) {
            // ignore parse errors
          }
        };

        ws.onerror = () => {
          addLog('❌ Error de conexión WebSocket');
          setIsConnected(false);
        };

        ws.onclose = () => {
          setIsConnected(false);
          setIsAuthorized(false);
          addLog('🔌 Desconectado de Deriv');
        };

        wsRef.current = ws;
      } catch (e) {
        addLog('❌ No se pudo conectar a Deriv');
        setIsConnected(false);
      }
    }

    if (!isBotRunning && wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setIsConnected(false);
      setIsAuthorized(false);
    }

    return () => {};
  }, [isBotRunning, currentSymbol, isDemoMode]);

  const handleWsMessage = (data: any, ws: WebSocket) => {
    // Handle authorization response
    if (data.msg_type === 'authorize' && data.authorize) {
      setIsAuthorized(true);
      setAccountId(data.authorize.loginid || '');
      setBalance(data.authorize.balance || 0);
      addLog(`✅ Autorizado como: ${data.authorize.loginid}`);
      addLog(`💰 Balance: $${data.authorize.balance}`);

      // Subscribe to balance updates
      ws.send(JSON.stringify({
        balance: 1,
        subscribe: 1,
        req_id: reqIdRef.current++,
      }));

      // Subscribe to ticks
      ws.send(JSON.stringify({
        ticks: currentSymbol,
        subscribe: 1,
        req_id: reqIdRef.current++,
      }));
      addLog(`📊 Suscrito a ticks de ${currentSymbol}`);
    }

    // Handle auth error
    if (data.msg_type === 'authorize' && data.error) {
      addLog(`❌ Error de autenticación: ${data.error.message}`);
      addLog('⚠️ Cambiando a modo DEMO');
      setIsDemoMode(true);
      setBalance(10000);
      // Still subscribe to ticks
      ws.send(JSON.stringify({
        ticks: currentSymbol,
        subscribe: 1,
        req_id: reqIdRef.current++,
      }));
    }

    // Handle balance updates
    if (data.msg_type === 'balance' && data.balance) {
      setBalance(data.balance.balance);
    }

    // Handle tick data
    if (data.msg_type === 'tick' && data.tick) {
      const tick = data.tick;
      const newTick: TickData = {
        time: tick.epoch,
        price: tick.quote,
        symbol: tick.symbol,
      };
      setTicks((prev) => [...prev, newTick].slice(-150));
      setLastPrice(tick.quote);
      if (prevPriceRef.current > 0) {
        setPriceChange(tick.quote - prevPriceRef.current);
      }
      prevPriceRef.current = tick.quote;
    }

    // Handle proposal response (price quote for buying)
    if (data.msg_type === 'proposal' && data.proposal) {
      const reqId = data.echo_req?.req_id;
      const pending = pendingProposalsRef.current.get(reqId);
      if (pending) {
        pendingProposalsRef.current.delete(reqId);
        addLog(`💲 Precio recibido: $${data.proposal.ask} | Payout: $${data.proposal.payout}`);
        // Execute buy
        ws.send(JSON.stringify({
          buy: data.proposal.id,
          price: data.proposal.ask,
          req_id: reqIdRef.current++,
        }));
      }
    }

    // Handle buy response
    if (data.msg_type === 'buy' && data.buy) {
      addLog(`✅ OPERACIÓN REAL EJECUTADA! ID: ${data.buy.contract_id}`);
      addLog(`💵 Costo: $${data.buy.buy_price} | Payout potencial: $${data.buy.payout}`);

      const trade: TradeRecord = {
        id: `real-${data.buy.contract_id}`,
        symbol: currentSymbol,
        type: 'BUY',
        lotSize: config.lotSize,
        entryPrice: lastPrice,
        timestamp: new Date(),
        status: 'open',
      };
      setTrades((prev) => [trade, ...prev]);
      setOpenTrades(1);

      // Subscribe to contract updates
      ws.send(JSON.stringify({
        proposal_open_contract: 1,
        contract_id: data.buy.contract_id,
        subscribe: 1,
        req_id: reqIdRef.current++,
      }));
    }

    // Handle buy error
    if (data.msg_type === 'buy' && data.error) {
      addLog(`❌ Error al comprar: ${data.error.message}`);
    }

    // Handle contract updates (open contract)
    if (data.msg_type === 'proposal_open_contract' && data.proposal_open_contract) {
      const contract = data.proposal_open_contract;
      const profit = contract.profit || 0;

      if (contract.is_sold || contract.is_expired) {
        // Contract closed
        const isWin = profit > 0;
        addLog(`${isWin ? '✅' : '❌'} Contrato cerrado: ${isWin ? 'GANANCIA' : 'PÉRDIDA'} $${profit.toFixed(2)}`);

        setTrades((prev) =>
          prev.map((t) =>
            t.id === `real-${contract.contract_id}`
              ? { ...t, status: 'closed' as const, exitPrice: contract.exit_tick || lastPrice, profit: profit }
              : t
          )
        );
        setOpenTrades(0);
        setTotalProfit((prev) => parseFloat((prev + profit).toFixed(2)));
      } else {
        // Update open trade profit
        setTrades((prev) =>
          prev.map((t) =>
            t.id === `real-${contract.contract_id}`
              ? { ...t, profit: profit }
              : t
          )
        );
      }
    }

    // Handle proposal error
    if (data.msg_type === 'proposal' && data.error) {
      addLog(`❌ Error en propuesta: ${data.error.message}`);
    }
  };

  // Trading logic - runs when bot is active
  useEffect(() => {
    if (!isBotRunning || !isConnected) return;

    const interval = setInterval(() => {
      if (openTrades > 0) return; // Already have open trade

      // Check TP/SL limits
      if (totalProfit >= config.takeProfit) {
        addLog(`🎯 TAKE PROFIT ALCANZADO! +$${totalProfit.toFixed(2)}`);
        return;
      }
      if (totalProfit <= -config.stopLoss) {
        addLog(`🛑 STOP LOSS ALCANZADO! $${totalProfit.toFixed(2)}`);
        return;
      }

      // Simple strategy: trade based on tick count pattern
      // For Boom: buy expecting spike up
      // For Crash: sell expecting spike down
      const isBoom = currentSymbol.startsWith('BOOM');
      const random = Math.random();

      if (isDemoMode) {
        // DEMO MODE - simulated trades
        if (random > 0.92) {
          const entryPrice = lastPrice || (1000 + Math.random() * 100);
          const trade: TradeRecord = {
            id: `demo-${Date.now()}`,
            symbol: currentSymbol,
            type: isBoom ? 'BUY' : 'SELL',
            lotSize: config.lotSize,
            entryPrice: entryPrice,
            timestamp: new Date(),
            status: 'open',
          };
          setTrades((prev) => [trade, ...prev]);
          setOpenTrades(1);
          addLog(`🎮 [DEMO] ${isBoom ? 'COMPRA' : 'VENTA'} ${currentSymbol} @ ${entryPrice.toFixed(2)}`);
        }
      } else {
        // REAL MODE - use Deriv API to get proposal and buy
        if (random > 0.90 && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          addLog(`🔍 Buscando entrada en ${currentSymbol}...`);

          // Get proposal for a "DIGITDIFF" or "CALL/PUT" contract
          // For simplicity, use a rise/fall contract
          const contractType = isBoom ? 'CALL' : 'PUT';
          const reqId = reqIdRef.current++;

          pendingProposalsRef.current.set(reqId, {
            type: isBoom ? 'BUY' : 'SELL',
            lotSize: config.lotSize,
            symbol: currentSymbol,
          });

          wsRef.current.send(JSON.stringify({
            proposal: 1,
            amount: config.lotSize * 100, // Stake in dollars
            basis: 'stake',
            contract_type: contractType,
            currency: 'USD',
            duration: 5, // 5 ticks
            duration_unit: 't',
            symbol: currentSymbol,
            req_id: reqId,
          }));

          addLog(`📋 Solicitando propuesta ${contractType} para ${currentSymbol}...`);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isBotRunning, isConnected, openTrades, lastPrice, currentSymbol, isDemoMode, config, totalProfit]);

  // Handle demo trade closing
  useEffect(() => {
    if (!isDemoMode || !isBotRunning || openTrades === 0) return;

    const interval = setInterval(() => {
      const random = Math.random();
      if (random > 0.75) {
        const profit = (Math.random() - 0.35) * config.takeProfit * 1.5;
        const isWin = profit > 0;
        setTrades((prev) =>
          prev.map((t, i) =>
            i === 0 && t.status === 'open'
              ? { ...t, status: 'closed' as const, exitPrice: lastPrice || t.entryPrice, profit: parseFloat(profit.toFixed(2)) }
              : t
          )
        );
        setOpenTrades(0);
        setTotalProfit((prev) => parseFloat((prev + profit).toFixed(2)));
        setBalance((prev) => parseFloat((prev + profit).toFixed(2)));
        addLog(`🎮 [DEMO] ${isWin ? '✅' : '❌'} Cerrada: ${isWin ? '+' : ''}$${profit.toFixed(2)}`);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isDemoMode, isBotRunning, openTrades, lastPrice, config.takeProfit]);

  // Draw chart
  useEffect(() => {
    const canvas = chartCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = 300 * 2;
    ctx.scale(2, 2);

    const width = rect.width;
    const height = 300;

    ctx.clearRect(0, 0, width, height);

    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0f0f23');
    bgGrad.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    if (ticks.length < 2) {
      ctx.fillStyle = '#666';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Esperando datos en vivo...', width / 2, height / 2);
      return;
    }

    const prices = ticks.map((t) => t.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice || 1;
    const padding = 40;

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = padding + ((height - 2 * padding) / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - 10, y);
      ctx.stroke();

      const priceLabel = (maxPrice - (range / 4) * i).toFixed(2);
      ctx.fillStyle = '#666';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(priceLabel, padding - 5, y + 3);
    }

    const isUp = prices[prices.length - 1] >= prices[0];
    const lineColor = isUp ? '#10b981' : '#ef4444';

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();

    const chartWidth = width - padding - 10;
    const chartHeight = height - 2 * padding;

    prices.forEach((price, i) => {
      const x = padding + (i / (prices.length - 1)) * chartWidth;
      const y = padding + chartHeight - ((price - minPrice) / range) * chartHeight;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    const lastX = padding + chartWidth;
    const lastY = padding + chartHeight - ((prices[prices.length - 1] - minPrice) / range) * chartHeight;
    ctx.lineTo(lastX, padding + chartHeight);
    ctx.lineTo(padding, padding + chartHeight);
    ctx.closePath();

    const fillGrad = ctx.createLinearGradient(0, padding, 0, padding + chartHeight);
    if (isUp) {
      fillGrad.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
      fillGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
    } else {
      fillGrad.addColorStop(0, 'rgba(239, 68, 68, 0.25)');
      fillGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
    }
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // Current price dot
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lastX, lastY, 7, 0, Math.PI * 2);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Current price label
    ctx.fillStyle = lineColor;
    const labelWidth = 70;
    const labelHeight = 20;
    const labelX = width - labelWidth - 5;
    const labelY = lastY - labelHeight / 2;
    ctx.beginPath();
    ctx.roundRect(labelX, labelY, labelWidth, labelHeight, 3);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(prices[prices.length - 1].toFixed(2), labelX + labelWidth / 2, lastY + 4);
  }, [ticks]);

  const winTrades = trades.filter((t) => t.status === 'closed' && (t.profit ?? 0) > 0).length;
  const closedTrades = trades.filter((t) => t.status === 'closed').length;
  const winRate = closedTrades > 0 ? ((winTrades / closedTrades) * 100).toFixed(1) : '0.0';
  const lossTrades = trades.filter((t) => t.status === 'closed' && (t.profit ?? 0) < 0).length;

  return (
    <div className="space-y-6">
      {/* MODE BANNER */}
      <div className={`rounded-xl p-4 border-2 ${
        isDemoMode
          ? 'bg-yellow-900/20 border-yellow-500/50'
          : 'bg-green-900/20 border-green-500/50'
      }`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              isDemoMode ? 'bg-yellow-500/20' : 'bg-green-500/20'
            }`}>
              <i className={`fas ${isDemoMode ? 'fa-flask' : 'fa-bolt'} text-2xl ${
                isDemoMode ? 'text-yellow-400' : 'text-green-400'
              }`}></i>
            </div>
            <div>
              <h3 className={`text-lg font-bold ${isDemoMode ? 'text-yellow-400' : 'text-green-400'}`}>
                {isDemoMode ? '⚠️ MODO DEMO / SIMULACIÓN' : '🔴 MODO REAL - OPERANDO CON DINERO REAL'}
              </h3>
              <p className="text-sm text-gray-300">
                {isDemoMode
                  ? 'Las operaciones son simuladas. Ingresa tu API Token en Configuración para operar en real.'
                  : `Conectado a cuenta: ${accountId || '---'} | Las operaciones se ejecutan en tu cuenta Deriv.`
                }
              </p>
            </div>
          </div>
          {isDemoMode && (
            <div className="text-right">
              <p className="text-xs text-yellow-400/70">Balance Demo</p>
              <p className="text-xl font-bold text-yellow-400">${balance.toFixed(2)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Symbol Selector */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-gray-400 text-sm font-medium mr-2">
            <i className="fas fa-crosshairs mr-1"></i> Instrumento:
          </span>
          {SYMBOLS.map((s) => (
            <button
              key={s.value}
              onClick={() => setCurrentSymbol(s.value)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                currentSymbol === s.value
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 shadow-lg shadow-yellow-500/10'
                  : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-500 hover:text-gray-200'
              }`}
            >
              <span className="mr-1">{s.emoji}</span> {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title={isDemoMode ? "Balance Demo" : "Balance Real"}
          value={`$${balance.toFixed(2)}`}
          icon="fa-wallet"
          color="blue"
        />
        <StatCard
          title="Profit Total"
          value={`${totalProfit >= 0 ? '+' : ''}$${totalProfit.toFixed(2)}`}
          icon={totalProfit >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}
          color={totalProfit >= 0 ? 'green' : 'red'}
        />
        <StatCard
          title="Win Rate"
          value={`${winRate}%`}
          subtitle={`${winTrades}W / ${lossTrades}L`}
          icon="fa-trophy"
          color="yellow"
        />
        <StatCard
          title="Operaciones"
          value={`${closedTrades}`}
          subtitle={`${openTrades} abierta${openTrades !== 1 ? 's' : ''}`}
          icon="fa-chart-bar"
          color="purple"
        />
      </div>

      {/* Take Profit / Stop Loss Progress */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-green-900/30 to-gray-800/50 border border-green-700/40 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-green-400 text-sm font-medium flex items-center gap-1.5">
                <i className="fas fa-bullseye"></i> Take Profit
              </p>
              <p className="text-3xl font-bold text-green-300 mt-1">${config.takeProfit}</p>
            </div>
            <div className="text-right">
              <p className="text-green-400/80 text-sm">Progreso</p>
              <p className="text-xl font-bold text-green-300">
                {totalProfit > 0 ? ((totalProfit / config.takeProfit) * 100).toFixed(1) : '0.0'}%
              </p>
            </div>
          </div>
          <div className="w-full bg-gray-700/50 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-green-600 to-green-400 h-3 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, (totalProfit / config.takeProfit) * 100))}%` }}
            ></div>
          </div>
          <p className="text-xs text-green-400/60 mt-2">
            Faltan ${Math.max(0, config.takeProfit - totalProfit).toFixed(2)} para alcanzar el objetivo
          </p>
        </div>

        <div className="bg-gradient-to-br from-red-900/30 to-gray-800/50 border border-red-700/40 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-red-400 text-sm font-medium flex items-center gap-1.5">
                <i className="fas fa-shield-halved"></i> Stop Loss
              </p>
              <p className="text-3xl font-bold text-red-300 mt-1">${config.stopLoss}</p>
            </div>
            <div className="text-right">
              <p className="text-red-400/80 text-sm">Riesgo</p>
              <p className="text-xl font-bold text-red-300">
                {totalProfit < 0 ? ((Math.abs(totalProfit) / config.stopLoss) * 100).toFixed(1) : '0.0'}%
              </p>
            </div>
          </div>
          <div className="w-full bg-gray-700/50 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-red-600 to-red-400 h-3 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, (Math.abs(Math.min(0, totalProfit)) / config.stopLoss) * 100))}%` }}
            ></div>
          </div>
          <p className="text-xs text-red-400/60 mt-2">
            {totalProfit >= 0 ? '✅ Sin pérdidas actualmente' : `Pérdida actual: $${Math.abs(totalProfit).toFixed(2)}`}
          </p>
        </div>
      </div>

      {/* Live Chart */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <i className="fas fa-chart-area text-yellow-400"></i>
            {currentSymbol}
            <span className="text-sm text-gray-400 font-normal">- Precio en Vivo (Datos Reales de Deriv)</span>
          </h3>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className={`text-xl font-mono font-bold ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {lastPrice ? lastPrice.toFixed(2) : '---'}
              </span>
              <div className={`text-xs ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChange).toFixed(4)}
                {lastPrice > 0 && (
                  <span className="ml-1">
                    ({((priceChange / lastPrice) * 100).toFixed(4)}%)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <canvas
          ref={chartCanvasRef}
          className="w-full rounded-lg"
          style={{ height: '300px' }}
        />
        <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
          <span>{ticks.length} ticks recibidos</span>
          <span>Última actualización: {ticks.length > 0 ? new Date(ticks[ticks.length - 1].time * 1000).toLocaleTimeString() : '---'}</span>
        </div>
      </div>

      {/* Trade History & Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Trades */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <i className="fas fa-list-check text-blue-400"></i>
            Operaciones {isDemoMode ? '(Demo)' : '(Reales)'}
          </h3>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {trades.length === 0 ? (
              <div className="text-center py-8">
                <i className="fas fa-inbox text-3xl text-gray-600 mb-2"></i>
                <p className="text-gray-500 text-sm">No hay operaciones aún</p>
                <p className="text-gray-600 text-xs mt-1">Inicia el bot para comenzar</p>
              </div>
            ) : (
              trades.slice(0, 15).map((trade) => (
                <div
                  key={trade.id}
                  className={`flex items-center justify-between rounded-lg px-3 py-2.5 border ${
                    trade.status === 'open'
                      ? 'bg-yellow-900/10 border-yellow-700/30'
                      : (trade.profit ?? 0) > 0
                      ? 'bg-green-900/10 border-green-700/30'
                      : 'bg-red-900/10 border-red-700/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {isDemoMode && <span className="text-xs text-yellow-400">[DEMO]</span>}
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      trade.type === 'BUY' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                    }`}>
                      {trade.type}
                    </span>
                    <div>
                      <span className="text-sm text-gray-200 font-medium">{trade.symbol}</span>
                      <p className="text-xs text-gray-500">{trade.timestamp.toLocaleTimeString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-bold ${
                      trade.status === 'open' ? 'text-yellow-400' :
                      (trade.profit ?? 0) > 0 ? 'text-green-400' : (trade.profit ?? 0) < 0 ? 'text-red-400' : 'text-gray-400'
                    }`}>
                      {trade.status === 'open' ? '⏳ Abierta' : `${(trade.profit ?? 0) > 0 ? '+' : ''}$${(trade.profit ?? 0).toFixed(2)}`}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Bot Logs */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <i className="fas fa-terminal text-green-400"></i>
            Log del Bot
          </h3>
          <div className="space-y-0.5 max-h-72 overflow-y-auto pr-1 font-mono text-xs bg-gray-900/50 rounded-lg p-3">
            {logs.length === 0 ? (
              <div className="text-center py-8">
                <i className="fas fa-terminal text-3xl text-gray-600 mb-2"></i>
                <p className="text-gray-500 text-sm">Inicia el bot para ver logs</p>
              </div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={`py-1 px-2 rounded ${
                  log.includes('✅') ? 'text-green-400' :
                  log.includes('❌') ? 'text-red-400' :
                  log.includes('🔔') ? 'text-yellow-400' :
                  log.includes('🎯') ? 'text-green-300 font-bold' :
                  log.includes('🛑') ? 'text-red-300 font-bold' :
                  log.includes('[DEMO]') ? 'text-yellow-300' :
                  log.includes('OPERACIÓN REAL') ? 'text-green-300 font-bold bg-green-900/20' :
                  'text-gray-400'
                }`}>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon, color }: { title: string; value: string; subtitle?: string; icon: string; color: string }) {
  const colorClasses: Record<string, { bg: string; text: string; iconBg: string; border: string }> = {
    blue: { bg: 'from-blue-900/20', text: 'text-blue-400', iconBg: 'bg-blue-500/20', border: 'border-blue-700/30' },
    green: { bg: 'from-green-900/20', text: 'text-green-400', iconBg: 'bg-green-500/20', border: 'border-green-700/30' },
    red: { bg: 'from-red-900/20', text: 'text-red-400', iconBg: 'bg-red-500/20', border: 'border-red-700/30' },
    yellow: { bg: 'from-yellow-900/20', text: 'text-yellow-400', iconBg: 'bg-yellow-500/20', border: 'border-yellow-700/30' },
    purple: { bg: 'from-purple-900/20', text: 'text-purple-400', iconBg: 'bg-purple-500/20', border: 'border-purple-700/30' },
  };

  const c = colorClasses[color] || colorClasses.blue;

  return (
    <div className={`bg-gradient-to-br ${c.bg} to-gray-800/50 border ${c.border} rounded-xl p-4`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">{title}</p>
          <p className={`text-xl md:text-2xl font-bold ${c.text} mt-1`}>{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className={`w-9 h-9 ${c.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
          <i className={`fas ${icon} ${c.text} text-sm`}></i>
        </div>
      </div>
    </div>
  );
}
