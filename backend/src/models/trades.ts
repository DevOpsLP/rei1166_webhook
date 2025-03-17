import { runQuery, all } from '../db';
import { sendLatestTradeUpdate } from './settings'; // Import functions to update trade count and SSE

export interface Trade {
  id?: number;
  trade_type: string;
  symbol: string;
  trade_amount: number;
  entry_price: number;
  mark_price: number;
  pnl: number;
  roi: number;
  realized_pnl: string;
  quote_qty: string;
  commission: string;
  commission_asset: string;
  side: string;
  time: number;
  extra_info?: string;
}

/**
 * Saves a new trade into the database and triggers an SSE update.
 */
export async function saveTrade(trade: Trade): Promise<number> {
  const { lastID } = await runQuery(
    `INSERT INTO trades 
      (trade_type, symbol, trade_amount, entry_price, mark_price, pnl, roi, 
      realized_pnl, quote_qty, commission, commission_asset, side, time, extra_info) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      trade.trade_type,
      trade.symbol,
      trade.trade_amount,
      trade.entry_price,
      trade.mark_price,
      trade.pnl,
      trade.roi,
      trade.realized_pnl,
      trade.quote_qty,
      trade.commission,
      trade.commission_asset,
      trade.side,
      trade.time,
      trade.extra_info || null
    ]
  );

  sendLatestTradeUpdate(); // Notify SSE clients with currentTrades count and latest trade

  return lastID;
}

/**
 * Fetches the most recent trade from the database.
 */
export async function getLastTrade(): Promise<Trade | null> {
  const rows = await all(`SELECT * FROM trades ORDER BY time DESC LIMIT 1`);
  return rows.length > 0 ? (rows[0] as Trade) : null;
}