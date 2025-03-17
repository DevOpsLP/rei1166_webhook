import { 
  USDMClient, 
  NewFuturesOrderParams, 
  NewOrderResult, 
  SetLeverageParams, 
  SetLeverageResult 
} from 'binance';

import { getCredentials } from '../models/credentials';
import { incrementTradeCount } from '../models/settings';

export interface AlertPayload {
  symbol: string;
  side: "BUY" | "SELL";
  takeProfit: number;
  stopLoss: number;
  trailingStop?: boolean;
  trailPrice?: number;
  trailOffset?: number;
}

async function getSymbolPrecision(client: USDMClient, symbol: string) {
  try {
    const exchangeInfo = await client.getExchangeInfo();
    const symbolInfo = exchangeInfo.symbols.find((s: any) => s.symbol === symbol);

    if (!symbolInfo) throw new Error(`Symbol ${symbol} not found in exchange info`);

    return {
      pricePrecision: symbolInfo.pricePrecision, // Number of decimals allowed for price
      quantityPrecision: symbolInfo.quantityPrecision, // Number of decimals allowed for quantity
      minQty: parseFloat((symbolInfo.filters.find((f: any) => f.filterType === "LOT_SIZE") as any)?.minQty),
      stepSize: parseFloat((symbolInfo.filters.find((f: any) => f.filterType === "LOT_SIZE") as any)?.stepSize),
      tickSize: parseFloat((symbolInfo.filters.find((f: any) => f.filterType === "PRICE_FILTER") as any)?.tickSize),
    };
  } catch (error) {
    console.error("Error fetching symbol precision:", error);
    throw error;
  }
}

function roundToStepSize(value: number, stepSize: number): number {
  return Math.floor(value / stepSize) * stepSize;
}

export async function executeAlertTrade(alert: AlertPayload): Promise<void> {
  const creds = await getCredentials();
  if (!creds.length) {
    throw new Error('No credentials available');
  }
  const credential = creds[0];

  const client = new USDMClient({
    api_key: credential.api_key,
    api_secret: credential.api_secret,
    beautifyResponses: true,
  });
  // Check for open positions for the symbol
  try {
    const positions = await client.getPositionsV3();
    const existingPosition = positions.find((p: any) => p.symbol === alert.symbol && parseFloat(p.positionAmt) !== 0);

    if (existingPosition) {
      console.log(`⚠️ Open position detected for ${alert.symbol}, skipping trade execution.`);
      return;
    }
  } catch (error) {
    console.error(`❌ Failed to fetch open positions:`, error);
    return;
  }
  // Fetch leverage from credentials
  const leverage = credential.leverage;
  if (!leverage || leverage <= 0) {
    throw new Error('Invalid leverage value');
  }

  try {
    // Set leverage for the symbol
    const leverageParams: SetLeverageParams = {
      symbol: alert.symbol,
      leverage: leverage,
    };

    const leverageResult: SetLeverageResult = await client.setLeverage(leverageParams);
    console.log(`✅ Leverage set to ${leverage}x for ${alert.symbol}`, leverageResult);
  } catch (error) {
    console.error(`❌ Failed to set leverage for ${alert.symbol}:`, error);
    return;
  }

  await incrementTradeCount();

  // Fetch precision details for symbol
  const { pricePrecision, quantityPrecision, stepSize, tickSize } = await getSymbolPrecision(client, alert.symbol);

  // Fetch the latest price
  const ticker = await client.getSymbolPriceTicker({ symbol: alert.symbol });
  const priceData = Array.isArray(ticker) ? ticker[0] : ticker;
  const lastPrice = parseFloat(priceData.price.toString());
  if (!lastPrice) throw new Error('No price returned for symbol');

  // Calculate order quantity: (balance * leverage) / price
  const rawQuantity = (credential.trade_amount * leverage) / lastPrice;
  const tradeQuantity = roundToStepSize(parseFloat(rawQuantity.toFixed(quantityPrecision)), stepSize);

  // Ensure the price is rounded to the correct tick size
  const adjustedPrice = parseFloat(lastPrice.toFixed(pricePrecision));

  console.log(`Placing MARKET ORDER for ${tradeQuantity} ${alert.symbol} at price ${adjustedPrice}`);

  // Place market order
  const marketOrderRequest: NewFuturesOrderParams = {
    symbol: alert.symbol,
    quantity: tradeQuantity,
    side: alert.side,
    type: 'MARKET',
  };

  try {
    const marketOrderResult = (await client.submitNewOrder(marketOrderRequest)) as NewOrderResult;
    console.log(`✅ Market order executed:`, JSON.stringify(marketOrderResult, null, 2));

    // Determine opposite side for stop loss and take profit
    const oppositeSide = alert.side === "BUY" ? "SELL" : "BUY";

    // Place Stop Loss Order (STOP_MARKET)
    const slOrderRequest: NewFuturesOrderParams = {
      symbol: alert.symbol,
      quantity: tradeQuantity,
      side: oppositeSide,
      type: 'STOP_MARKET',
      stopPrice: Number(alert.stopLoss.toFixed(tickSize)),
      reduceOnly: 'true',
    };

    await client.submitNewOrder(slOrderRequest);
    console.log(`✅ Stop Loss order placed at ${Number(alert.stopLoss.toFixed(tickSize))}`);

    // If trailingStop is enabled, place a trailing stop order instead of take profit
    if (alert.trailingStop && alert.trailOffset && alert.trailPrice) {
      const trailingStopOrderRequest: NewFuturesOrderParams = {
        symbol: alert.symbol,
        quantity: tradeQuantity,
        side: oppositeSide,
        type: 'TRAILING_STOP_MARKET',
        callbackRate: Number(alert.trailOffset),
        activationPrice: Number(alert.trailPrice.toFixed(tickSize)),
        reduceOnly: 'true',
      };

      await client.submitNewOrder(trailingStopOrderRequest);
      console.log(`✅ Trailing Stop order placed with offset ${alert.trailOffset} and activation price ${alert.trailPrice ?? 'auto'}`);
    } else {
      // Place Take Profit Order (TAKE_PROFIT_MARKET)
      const tpOrderRequest: NewFuturesOrderParams = {
        symbol: alert.symbol,
        quantity: tradeQuantity,
        side: oppositeSide,
        type: 'TAKE_PROFIT_MARKET',
        stopPrice: Number(alert.takeProfit.toFixed(tickSize)),
        reduceOnly: 'true',
      };

      await client.submitNewOrder(tpOrderRequest);
      console.log(`✅ Take Profit order placed at ${(alert.takeProfit.toFixed(tickSize))}`);
    }

    console.log(`✅ Trade setup complete: Market ${alert.side} + SL + ${alert.trailingStop ? 'Trailing Stop' : 'TP'}`);
  } catch (error) {
    console.error(`❌ Order execution failed:`, error);
  }
}