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

// ✅ Get the number of **significant** decimal places from stepSize/tickSize
function getDecimalPlaces(value: string | number): number {
  const strValue = value.toString();
  if (strValue.includes(".")) {
    return strValue.replace(/0+$/, "").split(".")[1].length; // Remove trailing zeros
  }
  return 0;
}

// ✅ Round/truncate value based on stepSize (avoids floating precision errors)
function roundToStepSize(value: number, stepSize: number): number {
  const decimals = getDecimalPlaces(stepSize);
  return parseFloat(value.toFixed(decimals));
}

// ✅ Fetch Binance Exchange Info via Axios
async function getSymbolPrecision(symbol: string) {
  try {
    const { data } = await axios.get("https://fapi.binance.com/fapi/v1/exchangeInfo");
    const symbolInfo = data.symbols.find((s: any) => s.symbol === symbol);

    if (!symbolInfo) throw new Error(`Symbol ${symbol} not found in exchange info`);

    // Extract filters
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
    console.error("❌ Error fetching symbol precision:", error);
    throw error;
  }
}

// ✅ Execute Alert Trade with Proper Rounding & Debug Logs
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

  // ✅ Fetch trading rules
  const { pricePrecision, quantityPrecision, stepSize, tickSize } = await getSymbolPrecision(alert.symbol);

  // ✅ Fetch latest market price
  const ticker = await client.getSymbolPriceTicker({ symbol: alert.symbol });
  const priceData = Array.isArray(ticker) ? ticker[0] : ticker;
  const lastPrice = parseFloat(priceData.price.toString());
  if (!lastPrice) throw new Error('No price returned for symbol');

  // ✅ Calculate raw order quantity
  const rawQuantity = (credential.trade_amount * credential.leverage) / lastPrice;
  const tradeQuantity = roundToStepSize(rawQuantity, stepSize);
  const adjustedPrice = roundToStepSize(lastPrice, tickSize);

  // 🔍 Debug Logs
  console.log(`🔍 Raw Quantity: ${rawQuantity}`);
  console.log(`✅ Rounded Quantity (stepSize: ${stepSize}): ${tradeQuantity}`);
  console.log(`🔍 Raw Price: ${lastPrice}`);
  console.log(`✅ Rounded Price (tickSize: ${tickSize}): ${adjustedPrice}`);

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

    // ✅ Stop Loss & Take Profit
    const oppositeSide = alert.side === "BUY" ? "SELL" : "BUY";
    const stopLossPrice = roundToStepSize(alert.stopLoss, tickSize);
    const takeProfitPrice = roundToStepSize(alert.takeProfit, tickSize);

    console.log(`🔍 Stop Loss Price: ${alert.stopLoss} → Rounded: ${stopLossPrice}`);
    console.log(`🔍 Take Profit Price: ${alert.takeProfit} → Rounded: ${takeProfitPrice}`);

    // ✅ Stop Loss Order
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

    // ✅ Take Profit Order
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

    console.log(`✅ Trade setup complete: Market ${alert.side} + SL + TP`);
  } catch (error) {
    console.error(`❌ Order execution failed:`, error);
  }
}