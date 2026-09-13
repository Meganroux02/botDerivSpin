import React, { useState } from 'react';
import { BotConfig } from '../types';

interface MQL5GeneratorProps {
  config: BotConfig;
}

export default function MQL5Generator({ config }: MQL5GeneratorProps) {
  const [copied, setCopied] = useState(false);

  const generateCode = () => {
    const symbolComment = `"BoomCrashBot_${config.strategy}"`;
    const tp = config.takeProfit;
    const sl = config.stopLoss;
    const lots = config.lotSize;
    const maxTrades = config.maxTrades;
    const symbol = config.symbol;

    return `//+------------------------------------------------------------------+
//|                                    BoomCrashBot_Deriv_MT5.mq5    |
//|                        Bot para Boom & Crash - Deriv MT5         |
//|                    Generado por Deriv Boom & Crash Bot Panel     |
//+------------------------------------------------------------------+
#property copyright "Deriv Boom & Crash Bot"
#property version   "1.00"
#property description "Bot automático para operar Boom y Crash en Deriv MT5"
#property strict

//--- Parámetros de entrada
input group "=== CONFIGURACIÓN PRINCIPAL ==="
input double   TakeProfitDollars = ${tp};        // Take Profit en Dólares
input double   StopLossDollars   = ${sl};         // Stop Loss en Dólares
input double   LotSize           = ${lots};        // Tamaño del Lote
input int      MaxTrades         = ${maxTrades};   // Máximo de Operaciones
input string   TradingSymbol     = "${symbol}";   // Símbolo a Operar

input group "=== ESTRATEGIA ==="
input int      SpikeInterval     = ${symbol.includes('1000') ? '1000' : symbol.includes('500') ? '500' : '300'};  // Intervalo de Spikes (ticks)
input int      MinTicksBeforeTrade = 50;           // Mínimo de ticks antes de operar
input double   SpikeMultiplier   = 2.0;            // Multiplicador para detectar spike
input int      MagicNumber       = 123456;         // Número mágico del EA

input group "=== GESTIÓN DE RIESGO ==="
input double   MaxDailyLoss      = ${sl * 2};      // Pérdida máxima diaria ($)
input bool     UseTrailingStop   = true;            // Usar Trailing Stop
input double   TrailingStopPips  = 50;              // Distancia del Trailing Stop

//--- Variables globales
double g_totalProfit = 0;
double g_dailyProfit = 0;
int g_tradeCount = 0;
datetime g_lastResetDate = 0;
double g_initialBalance = 0;
bool g_isBoom = false;
double g_lastPrice = 0;
double g_priceHistory[];
int g_tickCount = 0;
double g_avgChange = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                     |
//+------------------------------------------------------------------+
int OnInit()
{
    // Verificar si es Boom o Crash
    if(StringFind(TradingSymbol, "BOOM") >= 0)
    {
        g_isBoom = true;
        Print("📈 Modo BOOM detectado - Comprando para capturar spikes alcistas");
    }
    else if(StringFind(TradingSymbol, "CRASH") >= 0)
    {
        g_isBoom = false;
        Print("📉 Modo CRASH detectado - Vendiendo para capturar spikes bajistas");
    }
    else
    {
        Print("❌ Símbolo no válido. Use BOOM o CRASH indices.");
        return INIT_FAILED;
    }
    
    g_initialBalance = AccountInfoDouble(ACCOUNT_BALANCE);
    g_lastResetDate = TimeCurrent();
    
    // Inicializar array de precios
    ArrayResize(g_priceHistory, 100);
    ArrayInitialize(g_priceHistory, 0);
    
    Print("✅ Bot inicializado correctamente");
    Print("💰 Take Profit: $", TakeProfitDollars);
    Print("🛡️ Stop Loss: $", StopLossDollars);
    Print("📊 Lote: ", LotSize);
    Print("🔄 Max Trades: ", MaxTrades);
    
    EventSetTimer(1); // Timer cada segundo
    return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                   |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
    EventKillTimer();
    Print("🔴 Bot detenido. Profit total: $", g_totalProfit);
}

//+------------------------------------------------------------------+
//| Expert tick function                                               |
//+------------------------------------------------------------------+
void OnTick()
{
    // Reset diario
    MqlDateTime timeInfo;
    TimeToStruct(TimeCurrent(), timeInfo);
    if(timeInfo.day_of_year != TimeDayOfYear(g_lastResetDate))
    {
        g_dailyProfit = 0;
        g_lastResetDate = TimeCurrent();
        Print("📅 Nuevo día - Profit diario reseteado");
    }
    
    // Verificar límites
    if(CheckLimits()) return;
    
    // Actualizar precio actual
    double currentPrice = SymbolInfoDouble(TradingSymbol, SYMBOL_BID);
    if(currentPrice == 0) return;
    
    // Guardar historial de precios
    g_tickCount++;
    int idx = g_tickCount % 100;
    g_priceHistory[idx] = currentPrice;
    
    // Calcular cambio promedio
    if(g_tickCount > 1)
    {
        int prevIdx = (g_tickCount - 1) % 100;
        double change = currentPrice - g_priceHistory[prevIdx];
        g_avgChange = (g_avgChange * 0.95) + (change * 0.05); // Media móvil exponencial
    }
    
    g_lastPrice = currentPrice;
    
    // Verificar si hay posiciones abiertas
    if(CountOpenPositions() > 0)
    {
        ManageOpenPositions();
        return;
    }
    
    // Detectar oportunidad de entrada
    if(CheckEntrySignal())
    {
        OpenTrade();
    }
}

//+------------------------------------------------------------------+
//| Timer function                                                     |
//+------------------------------------------------------------------+
void OnTimer()
{
    // Actualizar profit total
    g_totalProfit = AccountInfoDouble(ACCOUNT_BALANCE) - g_initialBalance;
    
    // Mostrar info en chart
    Comment(StringFormat(
        "=== BOOM & CRASH BOT ===\\n"
        "Símbolo: %s\\n"
        "Balance: $%.2f\\n"
        "Profit Total: $%.2f\\n"
        "Profit Diario: $%.2f\\n"
        "Operaciones: %d/%d\\n"
        "Take Profit: $%.2f\\n"
        "Stop Loss: $%.2f\\n"
        "Estado: %s\\n"
        "========================",
        TradingSymbol,
        AccountInfoDouble(ACCOUNT_BALANCE),
        g_totalProfit,
        g_dailyProfit,
        g_tradeCount,
        MaxTrades,
        TakeProfitDollars,
        StopLossDollars,
        g_isBoom ? "BUSCA SPIKES ALCISTAS" : "BUSCA SPIKES BAJISTAS"
    ));
}

//+------------------------------------------------------------------+
//| Verificar límites de TP/SL                                        |
//+------------------------------------------------------------------+
bool CheckLimits()
{
    g_totalProfit = AccountInfoDouble(ACCOUNT_BALANCE) - g_initialBalance;
    g_dailyProfit = g_totalProfit; // Simplificado
    
    // Verificar Take Profit
    if(g_totalProfit >= TakeProfitDollars)
    {
        Print("🎯 TAKE PROFIT ALCANZADO! Profit: $", g_totalProfit);
        CloseAllPositions();
        ExpertRemove();
        return true;
    }
    
    // Verificar Stop Loss
    if(g_totalProfit <= -StopLossDollars)
    {
        Print("🛑 STOP LOSS ALCANZADO! Pérdida: $", g_totalProfit);
        CloseAllPositions();
        ExpertRemove();
        return true;
    }
    
    // Verificar pérdida diaria máxima
    if(g_dailyProfit <= -MaxDailyLoss)
    {
        Print("⚠️ PÉRDIDA DIARIA MÁXIMA ALCANZADA!");
        CloseAllPositions();
        return true;
    }
    
    // Verificar máximo de operaciones
    if(g_tradeCount >= MaxTrades)
    {
        Print("📊 Máximo de operaciones alcanzado: ", MaxTrades);
        return true;
    }
    
    return false;
}

//+------------------------------------------------------------------+
//| Detectar señal de entrada basada en spikes                        |
//+------------------------------------------------------------------+
bool CheckEntrySignal()
{
    if(g_tickCount < MinTicksBeforeTrade) return false;
    
    // Calcular volatilidad reciente
    double recentHigh = 0, recentLow = 999999;
    int lookback = MathMin(g_tickCount, SpikeInterval / 10);
    
    for(int i = 0; i < lookback; i++)
    {
        int idx = (g_tickCount - i) % 100;
        if(g_priceHistory[idx] > recentHigh) recentHigh = g_priceHistory[idx];
        if(g_priceHistory[idx] < recentLow) recentLow = g_priceHistory[idx];
    }
    
    double volatility = recentHigh - recentLow;
    if(volatility == 0) return false;
    
    // Para BOOM: esperar consolidación y comprar antes del spike
    if(g_isBoom)
    {
        // Detectar si el precio está en zona de consolidación (baja volatilidad)
        double currentPrice = SymbolInfoDouble(TradingSymbol, SYMBOL_BID);
        double distanceFromLow = currentPrice - recentLow;
        
        // Si estamos cerca del mínimo relativo, es probable un spike
        if(distanceFromLow < volatility * 0.2 && g_tickCount % SpikeInterval > SpikeInterval * 0.7)
        {
            Print("🔍 Señal BOOM detectada - Posible spike alcista");
            return true;
        }
        
        // Estrategia alternativa: contar ticks desde último movimiento
        if(g_tickCount % SpikeInterval > SpikeInterval - 50)
        {
            Print("⏰ Tick count接近 del intervalo de spike BOOM");
            return true;
        }
    }
    // Para CRASH: esperar consolidación y vender antes del spike
    else
    {
        double currentPrice = SymbolInfoDouble(TradingSymbol, SYMBOL_BID);
        double distanceFromHigh = recentHigh - currentPrice;
        
        // Si estamos cerca del máximo relativo, es probable un crash
        if(distanceFromHigh < volatility * 0.2 && g_tickCount % SpikeInterval > SpikeInterval * 0.7)
        {
            Print("🔍 Señal CRASH detectada - Posible spike bajista");
            return true;
        }
        
        if(g_tickCount % SpikeInterval > SpikeInterval - 50)
        {
            Print("⏰ Tick count接近 del intervalo de spike CRASH");
            return true;
        }
    }
    
    return false;
}

//+------------------------------------------------------------------+
//| Abrir operación                                                    |
//+------------------------------------------------------------------+
void OpenTrade()
{
    MqlTradeRequest request = {};
    MqlTradeResult result = {};
    
    request.action = TRADE_ACTION_DEAL;
    request.symbol = TradingSymbol;
    request.volume = LotSize;
    request.magic = MagicNumber;
    request.comment = ${symbolComment};
    request.deviation = 10;
    
    if(g_isBoom)
    {
        // Comprar en Boom para capturar spike alcista
        request.type = ORDER_TYPE_BUY;
        request.price = SymbolInfoDouble(TradingSymbol, SYMBOL_ASK);
    }
    else
    {
        // Vender en Crash para capturar spike bajista
        request.type = ORDER_TYPE_SELL;
        request.price = SymbolInfoDouble(TradingSymbol, SYMBOL_BID);
    }
    
    // Calcular SL y TP en puntos basado en dólares
    double tickValue = SymbolInfoDouble(TradingSymbol, SYMBOL_TRADE_TICK_VALUE);
    double tickSize = SymbolInfoDouble(TradingSymbol, SYMBOL_TRADE_TICK_SIZE);
    
    if(tickValue > 0 && tickSize > 0)
    {
        double slPoints = (StopLossDollars / (LotSize * tickValue)) * tickSize;
        double tpPoints = (TakeProfitDollars / (LotSize * tickValue)) * tickSize;
        
        if(g_isBoom)
        {
            request.sl = request.price - slPoints;
            request.tp = request.price + tpPoints;
        }
        else
        {
            request.sl = request.price + slPoints;
            request.tp = request.price - tpPoints;
        }
    }
    
    if(OrderSend(request, result))
    {
        g_tradeCount++;
        Print("✅ Operación #", g_tradeCount, " abierta: ", 
              g_isBoom ? "BUY" : "SELL", " ", LotSize, " lotes de ", TradingSymbol,
              " @ ", request.price);
    }
    else
    {
        Print("❌ Error al abrir operación: ", result.retcode, " - ", result.comment);
    }
}

//+------------------------------------------------------------------+
//| Gestionar posiciones abiertas                                      |
//+------------------------------------------------------------------+
void ManageOpenPositions()
{
    for(int i = PositionsTotal() - 1; i >= 0; i--)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket == 0) continue;
        
        if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        if(PositionGetString(POSITION_SYMBOL) != TradingSymbol) continue;
        
        double profit = PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
        
        // Verificar si el profit de la posición alcanza el TP
        if(profit >= TakeProfitDollars / MaxTrades)
        {
            ClosePosition(ticket);
            Print("✅ Posición cerrada con profit: $", profit);
        }
        // Verificar si la pérdida alcanza el SL parcial
        else if(profit <= -(StopLossDollars / MaxTrades))
        {
            ClosePosition(ticket);
            Print("🛑 Posición cerrada por stop loss: $", profit);
        }
        // Trailing stop
        else if(UseTrailingStop && profit > 0)
        {
            ApplyTrailingStop(ticket);
        }
    }
}

//+------------------------------------------------------------------+
//| Aplicar Trailing Stop                                              |
//+------------------------------------------------------------------+
void ApplyTrailingStop(ulong ticket)
{
    if(!PositionSelectByTicket(ticket)) return;
    
    double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
    double currentSL = PositionGetDouble(POSITION_SL);
    double currentTP = PositionGetDouble(POSITION_TP);
    double currentPrice = PositionGetDouble(POSITION_PRICE_CURRENT);
    long posType = PositionGetInteger(POSITION_TYPE);
    
    double point = SymbolInfoDouble(TradingSymbol, SYMBOL_POINT);
    double trailDistance = TrailingStopPips * point;
    
    if(posType == POSITION_TYPE_BUY)
    {
        double newSL = currentPrice - trailDistance;
        if(newSL > currentSL && newSL > openPrice)
        {
            MqlTradeRequest request = {};
            MqlTradeResult result = {};
            request.action = TRADE_ACTION_SLTP;
            request.position = ticket;
            request.sl = newSL;
            request.tp = currentTP;
            OrderSend(request, result);
        }
    }
    else if(posType == POSITION_TYPE_SELL)
    {
        double newSL = currentPrice + trailDistance;
        if((newSL < currentSL || currentSL == 0) && newSL < openPrice)
        {
            MqlTradeRequest request = {};
            MqlTradeResult result = {};
            request.action = TRADE_ACTION_SLTP;
            request.position = ticket;
            request.sl = newSL;
            request.tp = currentTP;
            OrderSend(request, result);
        }
    }
}

//+------------------------------------------------------------------+
//| Contar posiciones abiertas                                         |
//+------------------------------------------------------------------+
int CountOpenPositions()
{
    int count = 0;
    for(int i = PositionsTotal() - 1; i >= 0; i--)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket == 0) continue;
        if(PositionGetInteger(POSITION_MAGIC) == MagicNumber && 
           PositionGetString(POSITION_SYMBOL) == TradingSymbol)
            count++;
    }
    return count;
}

//+------------------------------------------------------------------+
//| Cerrar una posición                                                |
//+------------------------------------------------------------------+
void ClosePosition(ulong ticket)
{
    MqlTradeRequest request = {};
    MqlTradeResult result = {};
    
    request.action = TRADE_ACTION_DEAL;
    request.position = ticket;
    request.symbol = TradingSymbol;
    request.volume = PositionGetDouble(POSITION_VOLUME);
    request.magic = MagicNumber;
    request.deviation = 10;
    
    long posType = PositionGetInteger(POSITION_TYPE);
    if(posType == POSITION_TYPE_BUY)
    {
        request.type = ORDER_TYPE_SELL;
        request.price = SymbolInfoDouble(TradingSymbol, SYMBOL_BID);
    }
    else
    {
        request.type = ORDER_TYPE_BUY;
        request.price = SymbolInfoDouble(TradingSymbol, SYMBOL_ASK);
    }
    
    OrderSend(request, result);
}

//+------------------------------------------------------------------+
//| Cerrar todas las posiciones                                        |
//+------------------------------------------------------------------+
void CloseAllPositions()
{
    for(int i = PositionsTotal() - 1; i >= 0; i--)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket == 0) continue;
        if(PositionGetInteger(POSITION_MAGIC) == MagicNumber)
        {
            ClosePosition(ticket);
        }
    }
    Print("🔄 Todas las posiciones cerradas");
}
//+------------------------------------------------------------------+
`;
  };

  const code = generateCode();

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'BoomCrashBot_Deriv_MT5.mq5';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
          <i className="fas fa-code text-yellow-400"></i>
          Código MQL5 para MetaTrader 5
        </h2>
        <p className="text-gray-400 text-sm mb-4">
          Este código está configurado con tus parámetros actuales. Descárgalo y colócalo en la carpeta
          <code className="bg-gray-700 px-2 py-0.5 rounded mx-1 text-yellow-400">MQL5/Experts/</code>
          de tu terminal MT5.
        </p>

        {/* Config Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-gray-900 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-400">Take Profit</p>
            <p className="text-green-400 font-bold">${config.takeProfit}</p>
          </div>
          <div className="bg-gray-900 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-400">Stop Loss</p>
            <p className="text-red-400 font-bold">${config.stopLoss}</p>
          </div>
          <div className="bg-gray-900 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-400">Lote</p>
            <p className="text-blue-400 font-bold">{config.lotSize}</p>
          </div>
          <div className="bg-gray-900 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-400">Símbolo</p>
            <p className="text-yellow-400 font-bold">{config.symbol}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleCopy}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-2.5 px-4 rounded-lg transition-all"
          >
            <i className={`fas ${copied ? 'fa-check text-green-400' : 'fa-copy'} mr-2`}></i>
            {copied ? '¡Copiado!' : 'Copiar Código'}
          </button>
          <button
            onClick={handleDownload}
            className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-medium py-2.5 px-4 rounded-lg transition-all"
          >
            <i className="fas fa-download mr-2"></i>
            Descargar .mq5
          </button>
        </div>
      </div>

      {/* Code Display */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        <div className="bg-gray-900 px-4 py-2 flex items-center justify-between border-b border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-gray-400 text-sm ml-2">BoomCrashBot_Deriv_MT5.mq5</span>
          </div>
          <span className="text-xs text-gray-500">MQL5</span>
        </div>
        <pre className="p-4 overflow-x-auto text-xs leading-relaxed max-h-[600px] overflow-y-auto">
          <code className="text-gray-300">{code}</code>
        </pre>
      </div>

      {/* Instructions */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <i className="fas fa-book text-blue-400"></i>
          Instrucciones de Instalación
        </h3>
        <ol className="space-y-3 text-sm text-gray-300">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-yellow-500/20 text-yellow-400 rounded-full flex items-center justify-center text-xs font-bold">1</span>
            <span>Descarga el archivo <code className="bg-gray-700 px-1.5 py-0.5 rounded text-yellow-400">.mq5</code> usando el botón de descarga</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-yellow-500/20 text-yellow-400 rounded-full flex items-center justify-center text-xs font-bold">2</span>
            <span>Abre MetaTrader 5 y ve a <strong>Archivo → Abrir carpeta de datos</strong></span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-yellow-500/20 text-yellow-400 rounded-full flex items-center justify-center text-xs font-bold">3</span>
            <span>Copia el archivo en la carpeta <code className="bg-gray-700 px-1.5 py-0.5 rounded text-yellow-400">MQL5/Experts/</code></span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-yellow-500/20 text-yellow-400 rounded-full flex items-center justify-center text-xs font-bold">4</span>
            <span>En MT5, abre el <strong>Navegador</strong> (Ctrl+N) y busca el EA en <strong>Asesores Expertos</strong></span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-yellow-500/20 text-yellow-400 rounded-full flex items-center justify-center text-xs font-bold">5</span>
            <span>Arrastra el EA al gráfico del símbolo que quieras operar (Boom 1000, Crash 500, etc.)</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-yellow-500/20 text-yellow-400 rounded-full flex items-center justify-center text-xs font-bold">6</span>
            <span>Configura los parámetros (TP, SL, lote) en la pestaña de <strong>Parámetros de Entrada</strong></span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-yellow-500/20 text-yellow-400 rounded-full flex items-center justify-center text-xs font-bold">7</span>
            <span>Asegúrate de que el <strong>AutoTrading</strong> está activado (botón en la barra superior)</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-yellow-500/20 text-yellow-400 rounded-full flex items-center justify-center text-xs font-bold">8</span>
            <span>¡El bot comenzará a operar automáticamente! 🚀</span>
          </li>
        </ol>

        <div className="mt-6 bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
          <p className="text-yellow-400 text-sm font-medium flex items-center gap-2">
            <i className="fas fa-exclamation-triangle"></i>
            Advertencia
          </p>
          <p className="text-yellow-300/80 text-xs mt-1">
            El trading de Boom & Crash conlleva riesgos significativos. Prueba siempre el bot en una cuenta demo primero.
            Los resultados pasados no garantizan resultados futuros. Opera solo con capital que puedas permitirte perder.
          </p>
        </div>
      </div>
    </div>
  );
}
