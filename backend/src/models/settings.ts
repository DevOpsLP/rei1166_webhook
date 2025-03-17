import { runQuery, get } from '../db';
import { getLastTrade } from './trades';

export async function getMaxTrades(): Promise<number> {
  const row = await get(`SELECT value FROM settings WHERE key = 'maxTrades'`);
  return row && typeof row === 'object' && 'value' in row ? Number(row.value) : 0;
}

export async function setMaxTrades(maxTrades: number): Promise<void> {
  await runQuery(`
    INSERT INTO settings (key, value) VALUES ('maxTrades', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `, [maxTrades]);
}

export async function getCurrentTrades(): Promise<number> {
  const row = await get(`SELECT value FROM settings WHERE key = 'currentTrades'`);
  return row && typeof row === 'object' && 'value' in row ? Number(row.value) : 0;
}

export async function setCurrentTrades(value: number): Promise<void> {
  await runQuery(`
    INSERT INTO settings (key, value) VALUES ('currentTrades', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `, [value]);
}

const clients: any[] = [];

export async function incrementTradeCount(): Promise<void> {
  await runQuery(`
    UPDATE settings SET value = value + 1 WHERE key = 'currentTrades'
  `);
  sendCurrentTradesUpdate(); // Ensure clients are notified
}

export async function decrementTradeCount(): Promise<void> {
  await runQuery(`
    UPDATE settings SET value = CASE WHEN value > 0 THEN value - 1 ELSE 0 END WHERE key = 'currentTrades'
  `);
  sendCurrentTradesUpdate(); // Notify clients when a trade is removed
}


export async function sendCurrentTradesUpdate() {
  try {
    const currentTrades = await getCurrentTrades();
    const currentTradesData = `data: ${JSON.stringify({ type: "currentTrades", currentTrades })}\n\n`;

    clients.forEach((client) => client.res.write(currentTradesData));
  } catch (error) {
    console.error("Error sending current trades update:", error);
  }
}

export async function sendLatestTradeUpdate() {
  try {
    const latestTrade = await getLastTrade();
    if (latestTrade) {
      const latestTradeData = `data: ${JSON.stringify({ type: "latestTrade", trade: latestTrade })}\n\n`;
      clients.forEach((client) => client.res.write(latestTradeData));
    }
  } catch (error) {
    console.error("Error sending latest trade update:", error);
  }
}
export function registerSSEClient(req: any, res: any) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  clients.push({ req, res });

  req.on("close", () => {
    const index = clients.findIndex((client) => client.res === res);
    if (index !== -1) clients.splice(index, 1);
  });
}