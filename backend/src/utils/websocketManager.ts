import { USDMClient, WebsocketClient, WsMessageFuturesUserDataOrderTradeUpdateEventRaw } from "binance";
import { getCredentials } from "../models/credentials";
import { decrementTradeCount } from "../models/settings";
import { saveTrade, Trade } from "../models/trades";

let wsClient: WebsocketClient | null = null;
let usdmClient: USDMClient // Store USDMClient instance
let isWsConnected = false; // Track WebSocket connection status

export async function initializeWebSocket() {
    try {
        const creds = await getCredentials();
        if (!creds.length) {
            console.log("No credentials available");
            isWsConnected = false;
            return null;
        }

        const credential = creds[0];

        console.log('Initializing Binance WebSocket with API key:', credential.api_key);

        wsClient = new WebsocketClient(
            {
                api_key: credential.api_key,
                api_secret: credential.api_secret,
                beautify: true,
            },
        );

        usdmClient = new USDMClient({  // Store the USDMClient instance
            api_key: credential.api_key,
            api_secret: credential.api_secret,
            beautifyResponses: true,
        });

        wsClient.subscribeUsdFuturesUserDataStream(false, true, true);

        // Event listeners
        wsClient.on('open', (data) => {
            console.log('Connection opened:', data.wsKey);
            isWsConnected = true;
        });

        wsClient.on('close', (data) => {
            console.log('Connection closed:', data.wsKey);
            isWsConnected = false;
        });

        wsClient.on('error', (data) => {
            console.error('WebSocket error:', data?.wsKey);
            isWsConnected = false;
        });

        wsClient.on('reconnecting', (data) => {
            console.log('WebSocket reconnecting...', data?.wsKey);
            isWsConnected = false;
        });

        wsClient.on('reconnected', (data) => {
            console.log('WebSocket reconnected:', data?.wsKey);
            isWsConnected = true;
        });

        wsClient.on("message", async (data: any) => {
            const websocket_data = data as WsMessageFuturesUserDataOrderTradeUpdateEventRaw;
            const event_type = websocket_data.e;

            if (event_type === "ORDER_TRADE_UPDATE") {
                const order_data = websocket_data.o;
                if ((order_data.ot === "STOP_MARKET" || order_data.ot === "TAKE_PROFIT_MARKET" || order_data.ot === "TRAILING_STOP_MARKET") && order_data.X === "FILLED") {
                    const symbol = order_data.s;
                    console.log(`${order_data.ot} filled for ${symbol}. Cancelling open orders...`);
                    try {
                        const trade: Trade = {
                            trade_type: order_data.ot,
                            symbol: order_data.s,
                            trade_amount: parseFloat(order_data.q.toString()),
                            entry_price: parseFloat(order_data.ap.toString()),
                            mark_price: parseFloat(order_data.L.toString()),
                            pnl: parseFloat(order_data.rp.toString()),
                            roi: calculateROI(parseFloat(order_data.rp.toString()), parseFloat(order_data.ap.toString())),
                            realized_pnl: order_data.rp.toString(),
                            quote_qty: order_data.q.toString(),
                            commission: order_data.n.toString() || "0",
                            commission_asset: order_data.N || "USDT",
                            side: order_data.S == "BUY" ? "SELL" : "BUY",
                            time: parseFloat(order_data.T.toString()),
                            extra_info: JSON.stringify(order_data),
                          };
                          const tradeId = await saveTrade(trade);

                        // Fetch all open orders for the symbol
                        const openOrders = await usdmClient.getAllOpenOrders({ symbol });
                        if (openOrders.length > 0) {
                            console.log(`Found ${openOrders.length} open orders for ${symbol}. Cancelling...`);
                            // Cancel all open orders for the same symbol
                            await usdmClient.cancelAllOpenOrders({ symbol });
                            decrementTradeCount();
                            console.log(`All open orders for ${symbol} cancelled.`);
                        } else {
                            console.log(`No open orders found for ${symbol}.`);
                        }
                    } catch (err) {
                        console.error(`Error cancelling open orders for ${symbol}:`, err);
                    }
                }
            }
        });

        console.log('Binance WebSocket initialized successfully.');
        return wsClient;
    } catch (err) {
        console.error('Error initializing Binance WebSocket:', err);
        isWsConnected = false;
        return null;
    }
}

// Function to check WebSocket status
export function isWebSocketConnected(): boolean {
    return isWsConnected;
}

// Function to get USDMClient instance
export function getUSDMClient(): USDMClient {
    return usdmClient;
}

function calculateROI(pnl: number, entryPrice: number): number {
    if (entryPrice === 0) return 0;
    return (pnl / entryPrice) * 100;
  }

export { wsClient };