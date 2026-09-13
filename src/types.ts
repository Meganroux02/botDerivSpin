export interface BotConfig {
  takeProfit: number;
  stopLoss: number;
  lotSize: number;
  symbol: string;
  strategy: 'spike_catcher' | 'trend_follow' | 'scalping';
  maxTrades: number;
  apiKey: string;
}

export interface TradeRecord {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  lotSize: number;
  entryPrice: number;
  exitPrice?: number;
  profit?: number;
  timestamp: Date;
  status: 'open' | 'closed' | 'stopped';
}

export interface TickData {
  time: number;
  price: number;
  symbol: string;
}

export interface BotStats {
  totalProfit: number;
  totalTrades: number;
  winRate: number;
  maxDrawdown: number;
  currentBalance: number;
  todayProfit: number;
}
