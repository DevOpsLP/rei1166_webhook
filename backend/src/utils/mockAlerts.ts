import { getUSDMClient } from "../utils/websocketManager";
import { getCredentials } from "../models/credentials";
import { AlertPayload } from "./tradeManager";
import { saveTrade } from "../models/trades";
import { decrementTradeCount, incrementTradeCount } from "../models/settings";

interface MockTrade {
  symbol: string;
  entry_price: number;
  side: "BUY" | "SELL";
  takeProfit: number;
  stopLoss: number;
  leverage: number;
  trade_amount: number;
  startTime: number;
}

const mockTrades: { [symbol: string]: NodeJS.Timeout } = {};

export async function executeMockTrade(alert: AlertPayload): Promise<void> {
  // 🔹 Add a temporary lock
  if (mockTrades[alert.symbol]) {
      console.log(`⏭️ Mock trade already running for ${alert.symbol}, skipping new signal`);
      return;
  }
  
  // 🔹 Lock the trade immediately
  mockTrades[alert.symbol] = setTimeout(() => {}, 0);

  try {
      const creds = await getCredentials();
      if (!creds.length) {
          console.error("No credentials available for mock trade");
          delete mockTrades[alert.symbol]; // Remove lock on failure
          return;
      }

      const client = getUSDMClient();
      if (!client) {
          console.error("USDMClient is not initialized");
          delete mockTrades[alert.symbol]; // Remove lock on failure
          return;
      }

      const ticker = await client.getSymbolPriceTicker({ symbol: alert.symbol });
      const entry_price = parseFloat(Array.isArray(ticker) ? ticker[0].price.toString() : ticker.price.toString());
      if (!entry_price) {
          console.error("No price returned for symbol");
          delete mockTrades[alert.symbol]; // Remove lock on failure
          return;
      }

      const leverage = creds[0].leverage;
      const trade_amount = (creds[0].trade_amount * leverage) / entry_price;

      const mockTrade: MockTrade = {
          symbol: alert.symbol,
          entry_price,
          side: alert.side,
          takeProfit: alert.takeProfit,
          stopLoss: alert.stopLoss,
          leverage,
          trade_amount,
          startTime: Date.now(),
      };

      await incrementTradeCount();

      console.log(`🟢 Simulating trade for ${alert.symbol}: Entry @ ${entry_price}, TP @ ${alert.takeProfit}, SL @ ${alert.stopLoss}`);

      // 🔹 Store actual monitoring interval
      mockTrades[alert.symbol] = setInterval(async () => {
          try {
              const ticker = await client.getSymbolPriceTicker({ symbol: alert.symbol });
              const currentPrice = parseFloat(Array.isArray(ticker) ? ticker[0].price.toString() : ticker.price.toString());
              if (!currentPrice) return;

              if ((mockTrade.side === "BUY" && currentPrice >= mockTrade.takeProfit) ||
                  (mockTrade.side === "SELL" && currentPrice <= mockTrade.takeProfit)) {
                  console.log(`✅ Mock trade for ${alert.symbol} hit Take Profit @ ${currentPrice}`);
                  await finalizeMockTrade(mockTrade, "TP", currentPrice);
              }

              if ((mockTrade.side === "BUY" && currentPrice <= mockTrade.stopLoss) ||
                  (mockTrade.side === "SELL" && currentPrice >= mockTrade.stopLoss)) {
                  console.log(`❌ Mock trade for ${alert.symbol} hit Stop Loss @ ${currentPrice}`);
                  await finalizeMockTrade(mockTrade, "SL", currentPrice);
              }
          } catch (err) {
              console.error(`⚠️ Error fetching price for ${alert.symbol}:`, err);
          }
      }, 3 * 60 * 1000); // 3-minute interval

  } catch (error) {
      console.error("❌ Error in mock trade execution:", error);
      delete mockTrades[alert.symbol]; // Ensure cleanup on failure
  }
}

async function finalizeMockTrade(trade: MockTrade, exitReason: "TP" | "SL", exit_price: number) {
  clearInterval(mockTrades[trade.symbol]);
  delete mockTrades[trade.symbol];

  const pnl = exitReason === "TP"
    ? (trade.takeProfit - trade.entry_price) * trade.trade_amount
    : (trade.stopLoss - trade.entry_price) * trade.trade_amount;

  console.log(`📊 Mock trade result for ${trade.symbol}: ${exitReason} @ ${exit_price}, PnL: ${pnl.toFixed(2)}`);

  // 🔹 Make assumptions to match `saveTrade()` expected properties
  await saveTrade({
    trade_type: "mock", // Assuming mock trades should be labeled
    symbol: trade.symbol,
    trade_amount: trade.trade_amount,
    entry_price: trade.entry_price,
    mark_price: exit_price, // Using exit_price as mark price
    pnl,
    roi: (pnl / (trade.entry_price * trade.trade_amount)) * 100, // ROI calculation
    realized_pnl: pnl.toFixed(2), // Assuming realized PnL is just the PnL
    quote_qty: (trade.entry_price * trade.trade_amount).toFixed(2), // Approximate quantity
    commission: "0", // No commission in mock mode
    commission_asset: "USDT", // Assuming USDT is used for mock
    side: trade.side,
    time: Date.now(), // Mock timestamp
    extra_info: `Mock trade exited via ${exitReason}`, // Log why trade closed
  });
  decrementTradeCount();
  
}