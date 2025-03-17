import { getTestMode } from '../settings';
import { executeMockTrade } from './mockAlerts';
import { executeAlertTrade, AlertPayload } from './tradeManager';

export async function processAlert(alertData: any): Promise<void> {
  const payload: AlertPayload = {
    symbol: alertData.symbol,
    side: alertData.side.toUpperCase() === "BUY" ? "BUY" : "SELL",
    takeProfit: Number(alertData.takeProfit),
    stopLoss: Number(alertData.stopLoss),
    trailingStop: alertData.trailingStop === true,
    trailPrice: alertData.trailPrice ? Number(alertData.trailPrice) : undefined,
    trailOffset: alertData.trailOffset ? Number(alertData.trailOffset) : undefined,
  };

  if (getTestMode()) {
    console.log("🟠 Test mode active: Simulating trade");
    await executeMockTrade(payload);
  } else {
    await executeAlertTrade(payload);
  }
}