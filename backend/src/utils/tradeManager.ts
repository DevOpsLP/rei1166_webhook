import axios from 'axios';
import { 
  USDMClient, 
  NewFuturesOrderParams, 
  NewOrderResult, 
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

// ✅ Fetch exchange info directly via Axios
async function getSymbolPrecision(symbol: string) {
  try {
    const { data } = await axios.get("https://fapi.binance.com/fapi/v1/exchangeInfo");
    const symbolInfo = data.symbols.find((s: any) => s.symbol === symbol);

    if (!symbolInfo) throw new Error(`Symbol ${symbol} not found in exchange info`);

    // Extract relevant filters
    const lotSizeFilter = symbolInfo.filters.find((f: any) => f.filterType === "LOT_SIZE");
    const priceFilter = symbolInfo.filters.find((f: any) => f.filterType === "PRICE_FILTER");

    return {
      pricePrecision: symbolInfo.pricePrecision, 
      quantityPrecision: symbolInfo.quantityPrecision, 
      minQty: parseFloat(lotSizeFilter?.minQty || "0.001"),
      stepSize: parseFloat(lotSizeFilter?.stepSize || "0.001"),
      tickSize: parseFloat(priceFilter?.tickSize || "0.01"),
    };
  } catch (error) {
    console.error("Error fetching symbol precision:", error);
    throw error;
  }
}

// ✅ Helper function to round/truncate values correctly
function getDecimalPlaces(value: string | number): number {
  const strValue = value.toString();
  return strValue.includes('.') ? strValue.split('.')[1].length : 0;
}

function roundToStepSize(value: number, stepSize: number): number {
  const decimals = getDecimalPlaces(stepSize);
  return parseFloat(value.toFixed(decimals));
}

// ✅ Main trading function
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

  // ✅ Fetch symbol-specific trading rules using Axios
  const {stepSize, tickSize } = await getSymbolPrecision(alert.symbol);

  // ✅ Fetch latest market price
  const ticker = await client.getSymbolPriceTicker({ symbol: alert.symbol });
  const priceData = Array.isArray(ticker) ? ticker[0] : ticker;
  const lastPrice = parseFloat(priceData.price.toString());
  if (!lastPrice) throw new Error('No price returned for symbol');

  // ✅ Calculate order quantity: (balance * leverage) / price
  const rawQuantity = (credential.trade_amount * credential.leverage) / lastPrice;
  const tradeQuantity = roundToStepSize(rawQuantity, stepSize);

  // ✅ Ensure the price is rounded to the correct tick size
  const adjustedPrice = roundToStepSize(lastPrice, tickSize);

  console.log(`Placing MARKET ORDER for ${tradeQuantity} ${alert.symbol} at price ${adjustedPrice}`);

  // ✅ Place market order
  const marketOrderRequest: NewFuturesOrderParams = {
    symbol: alert.symbol,
    quantity: tradeQuantity,
    side: alert.side,
    type: 'MARKET',
  };

  try {
    const marketOrderResult = (await client.submitNewOrder(marketOrderRequest)) as NewOrderResult;
    console.log(`✅ Market order executed:`, JSON.stringify(marketOrderResult, null, 2));

    // ✅ Determine opposite side for SL/TP
    const oppositeSide = alert.side === "BUY" ? "SELL" : "BUY";

    // ✅ Place Stop Loss Order (STOP_MARKET)
    const stopLossPrice = roundToStepSize(alert.stopLoss, tickSize);
    const slOrderRequest: NewFuturesOrderParams = {
      symbol: alert.symbol,
      quantity: tradeQuantity,
      side: oppositeSide,
      type: 'STOP_MARKET',
      stopPrice: stopLossPrice,
      reduceOnly: 'true',
    };
    await client.submitNewOrder(slOrderRequest);
    console.log(`✅ Stop Loss order placed at ${stopLossPrice}`);

    // ✅ If trailingStop is enabled, place trailing stop order
    if (alert.trailingStop && alert.trailOffset && alert.trailPrice) {
      const trailingStopPrice = roundToStepSize(alert.trailPrice, tickSize);
      const trailingStopOrderRequest: NewFuturesOrderParams = {
        symbol: alert.symbol,
        quantity: tradeQuantity,
        side: oppositeSide,
        type: 'TRAILING_STOP_MARKET',
        callbackRate: alert.trailOffset,
        activationPrice: trailingStopPrice,
        reduceOnly: 'true',
      };
      await client.submitNewOrder(trailingStopOrderRequest);
      console.log(`✅ Trailing Stop order placed with offset ${alert.trailOffset} and activation price ${trailingStopPrice}`);
    } else {
      // ✅ Place Take Profit Order (TAKE_PROFIT_MARKET)
      const takeProfitPrice = roundToStepSize(alert.takeProfit, tickSize);
      const tpOrderRequest: NewFuturesOrderParams = {
        symbol: alert.symbol,
        quantity: tradeQuantity,
        side: oppositeSide,
        type: 'TAKE_PROFIT_MARKET',
        stopPrice: takeProfitPrice,
        reduceOnly: 'true',
      };
      await client.submitNewOrder(tpOrderRequest);
      console.log(`✅ Take Profit order placed at ${takeProfitPrice}`);
    }

    console.log(`✅ Trade setup complete: Market ${alert.side} + SL + ${alert.trailingStop ? 'Trailing Stop' : 'TP'}`);
  } catch (error) {
    console.error(`❌ Order execution failed:`, error);
  }
}